import base64
import hashlib
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from datetime import date, timedelta
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from auditflow.server import create_service, handler_for
from auditflow.domain import InputError

TODAY=date(2026,10,27)  # injected synthetic test date


class CertBase(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'db.sqlite3'
        self.service=create_service(self.path);self.cert=self.service.certification;self.store=self.service.store
        self.today=TODAY;self.cert.today=lambda:self.today
        self.v=self.cert.create_version({'manufacturer_name':'Testhersteller (fiktiv)','software':'TestLohn','version':'1.0','reviewer':'Anna'})

    def tearDown(self):self.service.automation.close();self.tmp.cleanup()

    def go(self,action,reviewer='Anna',note='Begründung',v=None):
        return self.cert.transition({'version_id':(v or self.v)['id'],'action':action,'reviewer':reviewer,'note':note})

    def job(self,mode='import',results=(),created='2026-10-01T00:00:00+00:00',status='completed',v=None):
        """Synthetic completed job record for the version's project, written directly for gate tests."""
        v=v or self.v;id='job-'+str(len(self.store.list('auto_job'))+1);counts={'pass':0,'fail':0,'not_assessable':0,'technical_error':0}
        for case,st in results:
            counts[st]+=1
            self.store.put('auto_result',{'id':id+':'+case,'job_id':id,'case_id':case,'status':st,'case_name':case+' · Fall',
                           'actual':{'message_present':None if st=='not_assessable' else True},'expected':{'message_present':True}})
        j={'id':id,'project':{'id':v['project_id']},'mode':mode,'status':status,'created_at':created,'counts':counts}
        self.store.put('auto_job',j);return j

    def accept(self,job,case,reviewer='Bernd'):
        return self.cert.accept({'version_id':self.v['id'],'job_id':job['id'],'case_id':case,'reviewer':reviewer,'note':'Fachlich vertretbar'})

    def state_version(self,v=None):
        return next(x for x in self.cert.state()['versions'] if x['id']==(v or self.v)['id'])

    def blocking(self,v=None):
        return [i['key'] for i in self.state_version(v)['gate']['items'] if not i['ok']]


class SeedAndMigrationTests(CertBase):
    def test_demo_seed_fictional_and_unapproved(self):
        s=self.cert.state()
        seeded=[m for m in s['manufacturers'] if m['scope']=='synthetic_demo']
        self.assertTrue(2<=len(seeded)<=3);self.assertTrue(all('(fiktiv)' in m['name'] for m in seeded))
        ids={m['id'] for m in seeded};versions=[v for v in s['versions'] if v['manufacturer_id'] in ids]
        self.assertTrue(versions);self.assertTrue(all(v['status']=='neu' for v in versions))
        demo=[r for r in s['reminders'] if r['source']['note']=='Synthetische Demo-Erinnerung']
        self.assertEqual(len(demo),1);self.assertIsNone(demo[0]['affected'])
        fresh=create_service(self.path)
        try:self.assertEqual(len(fresh.certification.state()['manufacturers']),len(s['manufacturers']))
        finally:fresh.automation.close()

    def test_migration_idempotent_nothing_approved(self):
        p=self.service.automation.create_project({'manufacturer':'  testhersteller (FIKTIV) ','software':'Alt','software_version':'0.9'})
        for _ in range(2):
            fresh=create_service(self.path)
            try:
                linked=[v for v in fresh.store.list('software_version') if v['project_id']==p['id']]
                self.assertEqual(len(linked),1);self.assertEqual(linked[0]['status'],'neu')
                self.assertEqual(linked[0]['manufacturer_id'],self.v['manufacturer_id'])
            finally:fresh.automation.close()
        self.assertFalse(any(v['status']=='freigegeben' for v in self.store.list('software_version')))

    def test_no_seed_for_used_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=create_service(Path(tmp)/'db.sqlite3');s.automation.close()
            self.assertTrue(s.store.list('manufacturer'))
        # A database with user activity before the feature existed is not seeded.
        with tempfile.TemporaryDirectory() as tmp:
            from auditflow.store import Store
            from auditflow.certification import Certification
            store=Store(Path(tmp)/'db.sqlite3',json.loads(Path('data/seed.json').read_text(encoding='utf-8')))
            store.event('review',{'id':'x'})
            Certification(store);self.assertEqual(store.list('manufacturer'),[])

    def test_create_version_dedup(self):
        again=self.cert.create_version({'manufacturer_name':' TESTHERSTELLER  (fiktiv)','software':'TestLohn','version':'2.0','reviewer':'Anna'})
        self.assertEqual(again['manufacturer_id'],self.v['manufacturer_id'])
        with self.assertRaises(InputError):
            self.cert.create_version({'manufacturer_id':self.v['manufacturer_id'],'software':' testlohn ','version':'1.0','reviewer':'Anna'})
        with self.assertRaises(InputError):self.cert.create_version({'manufacturer_name':'X','software':'Y','version':'1'})
        self.assertIsNotNone(self.v['project_id']);self.store.get('auto_project',self.v['project_id'])


class TransitionTests(CertBase):
    def test_allowed_and_refused(self):
        for action in ['approve','reject','reopen']:
            with self.assertRaises(InputError):self.go(action)
        with self.assertRaises(InputError):self.go('start',note=' ')
        with self.assertRaises(InputError):self.go('start',reviewer='')
        with self.assertRaises(InputError):self.go('jump')
        self.assertEqual(self.go('start')['status'],'in_pruefung')
        for action in ['start','reopen']:
            with self.assertRaises(InputError):self.go(action)
        self.assertEqual(self.go('reject',note='Unvollständig')['status'],'abgelehnt')
        for action in ['start','approve','reject']:
            with self.assertRaises(InputError):self.go(action)
        v=self.go('reopen',note='Neue Unterlagen')
        self.assertEqual(v['status'],'in_pruefung')
        self.assertEqual([h['action'] for h in v['history']],['create','start','reject','reopen'])
        self.assertEqual(v['history'][2]['note'],'Unvollständig')
        events=[e for e in self.store.events() if e['action']=='cert_transition']
        self.assertEqual(len(events),3);self.assertEqual(events[-1]['data']['reviewer'],'Anna')


class GateTests(CertBase):
    def test_refused_without_import_and_simulation_never_counts(self):
        self.go('start');self.job(mode='simulation',results=[('c1','pass')])
        v=self.state_version();self.assertEqual(v['evidence']['simulation_jobs'],1);self.assertIsNone(v['evidence']['latest_import_job'])
        self.assertIn('evidence',self.blocking());self.assertEqual(v['hint']['text'],'Wartet auf Herstellerergebnisse')
        with self.assertRaisesRegex(InputError,'Herstellerergebnisse'):self.go('approve',reviewer='Chef')
        self.job(mode='import',status='waiting_import')
        self.assertIn('evidence',self.blocking())

    def test_refused_on_fail(self):
        self.go('start');self.job(results=[('c1','fail'),('c2','pass')])
        self.assertEqual(self.blocking(),['no_failures']);self.assertEqual(self.state_version()['hint']['text'],'1 Fehler im letzten Ergebnis')
        with self.assertRaisesRegex(InputError,'Keine Fehler'):self.go('approve',reviewer='Chef')

    def test_unclear_acceptance_four_eyes_and_pass(self):
        self.go('start');j=self.job(results=[('c1','not_assessable'),('c2','not_assessable'),('c3','pass')])
        self.assertEqual(self.state_version()['hint']['text'],'2 unklare Ergebnisse')
        with self.assertRaisesRegex(InputError,'akzeptiert'):self.go('approve',reviewer='Chef')
        with self.assertRaises(InputError):self.accept(j,'c3')  # pass result is not acceptable
        with self.assertRaises(InputError):self.accept(j,'unknown')
        with self.assertRaises(InputError):self.cert.accept({'version_id':self.v['id'],'job_id':j['id'],'case_id':'c1','reviewer':'Bernd','note':''})
        self.accept(j,'c1');self.accept(j,'c2',reviewer=' bernd ')
        with self.assertRaises(InputError):self.accept(j,'c1')
        self.assertEqual(self.state_version()['evidence']['unclear_accepted'],2)
        with self.assertRaisesRegex(InputError,'Vier-Augen'):self.go('approve',reviewer='BERND')
        v=self.go('approve',reviewer='Chef',note='Alle Kriterien erfüllt')
        self.assertEqual(v['status'],'freigegeben');self.assertEqual(v['history'][-1]['ref'],j['id'])

    def test_pending_submission_blocks(self):
        self.go('start');self.job(results=[('c1','pass')])
        s=self.cert.submit({'version_id':self.v['id'],'name':'bericht.txt','base64':base64.b64encode(b'Testbericht').decode(),'reviewer':'Anna'})
        self.assertEqual(self.blocking(),['submissions_decided']);self.assertEqual(self.state_version()['hint']['text'],'1 Einreichung offen')
        with self.assertRaisesRegex(InputError,'Einreichungen'):self.go('approve',reviewer='Chef')
        self.cert.review_submission({'id':s['id'],'approve':True,'reviewer':'Chef','note':'Geprüft'})
        self.assertEqual(self.state_version()['hint']['text'],'Bereit zur Freigabe')
        self.assertEqual(self.go('approve',reviewer='Chef')['status'],'freigegeben')

    def test_acceptances_do_not_carry_over_to_newer_job(self):
        self.go('start');old=self.job(results=[('c1','not_assessable')],created='2026-10-01T00:00:00+00:00');self.accept(old,'c1')
        self.assertEqual(self.blocking(),[])
        new=self.job(results=[('c1','not_assessable')],created='2026-10-05T00:00:00+00:00')
        v=self.state_version();self.assertEqual(v['evidence']['latest_import_job']['id'],new['id'])
        self.assertEqual(self.blocking(),['unclear_accepted'])
        with self.assertRaises(InputError):self.accept(old,'c1',reviewer='Dora')
        self.accept(new,'c1');self.assertEqual(self.blocking(),[])

    def test_detail_unclear_pagination(self):
        j=self.job(results=[(f'c{i}','not_assessable') for i in range(5)]+[('p','pass')]);self.job(mode='simulation')
        self.accept(j,'c0')
        d=self.cert.detail(self.v['id'],0,2)
        self.assertEqual(d['unclear_total'],5);self.assertEqual(len(d['unclear']),2)
        self.assertEqual(d['unclear'][0]['accepted']['reviewer'],'Bernd');self.assertIn('keine Beobachtung',d['unclear'][0]['summary'])
        self.assertEqual(len(d['simulation_jobs']),1)
        for args in [(-1,10),(0,0),(0,501)]:
            with self.assertRaises(InputError):self.cert.detail(self.v['id'],*args)


class ReminderTests(CertBase):
    def reminder(self,days,**kw):
        return self.cert.create_reminder({'title':'Testupdate','effective_date':str(self.today+timedelta(days=days)),'source_note':'Testquelle Abschnitt 1','reviewer':'Anna',**kw})

    def state_reminder(self,r):return next(x for x in self.cert.state()['reminders'] if x['id']==r['id'])

    def approved(self):
        self.go('start');self.job(results=[('c1','pass')]);return self.go('approve',reviewer='Chef')

    def test_manual_requires_source_and_date(self):
        with self.assertRaises(InputError):self.reminder(10,source_note=' ')
        for bad in ['2026-13-01','27.10.2026','']:
            with self.assertRaises(InputError):self.reminder(10,effective_date=bad)
        self.assertEqual(self.reminder(10)['source']['type'],'manual')

    def test_windows(self):
        far,mid,near=self.reminder(100),self.reminder(50),self.reminder(10)
        self.assertEqual(self.state_reminder(far)['state'],'upcoming');self.assertEqual(self.state_reminder(far)['days_until'],100)
        self.assertEqual(self.state_reminder(mid)['state'],'unconfirmed');self.assertEqual(self.state_reminder(near)['state'],'unconfirmed')
        for r in [mid,near]:self.cert.set_affected({'reminder_id':r['id'],'version_ids':[],'reviewer':'Anna','note':'Keine betroffen'})
        self.assertEqual(self.state_reminder(mid)['state'],'upcoming');self.assertEqual(self.state_reminder(near)['state'],'soon')
        self.today=TODAY+timedelta(days=20)
        self.assertEqual(self.state_reminder(near)['state'],'done');self.assertEqual(self.state_reminder(near)['days_until'],-10)
        past=self.reminder(-5);self.assertEqual(self.state_reminder(past)['state'],'unconfirmed')

    def test_erneut_pruefen_only_confirmed_after_effective_date(self):
        self.approved();other=self.cert.create_version({'manufacturer_name':'Zweiter (fiktiv)','software':'B','version':'1','reviewer':'Anna'})
        r=self.reminder(5)
        with self.assertRaises(InputError):self.cert.set_affected({'reminder_id':r['id'],'version_ids':['nope'],'reviewer':'Anna','note':'x'})
        with self.assertRaises(InputError):self.cert.set_affected({'reminder_id':r['id'],'version_ids':[self.v['id']],'reviewer':'Anna','note':''})
        self.cert.set_affected({'reminder_id':r['id'],'version_ids':[self.v['id']],'reviewer':'Anna','note':'Betroffen'})
        self.assertEqual(self.state_version()['status'],'freigegeben');self.assertEqual(self.state_reminder(r)['state'],'soon')
        self.today=TODAY+timedelta(days=5)
        v=self.state_version();self.assertEqual(v['status'],'erneut_pruefen');self.assertEqual(v['stored_status'],'freigegeben')
        self.assertEqual(v['recheck']['reminder_id'],r['id']);self.assertIn('betroffen von Erinnerung',v['history'][-1]['note'])
        self.assertEqual(self.state_version(other)['status'],'neu')
        self.assertEqual(self.state_reminder(r)['state'],'overdue')
        with self.assertRaises(InputError):self.go('approve',reviewer='Chef')
        v=self.go('start',note='Gesetzesänderung');self.assertEqual(v['status'],'in_pruefung');self.assertEqual(v['history'][-1]['from'],'erneut_pruefen')
        self.assertEqual(self.state_reminder(r)['state'],'overdue')
        v=self.go('approve',reviewer='Chef');self.assertEqual(v['status'],'freigegeben')
        self.assertEqual(self.state_reminder(r)['state'],'done')
        changed=self.cert.set_affected({'reminder_id':r['id'],'version_ids':[self.v['id'],other['id']],'reviewer':'Dora','note':'Ergänzt'})
        self.assertEqual(len(changed['changes']),2);self.assertEqual(changed['affected']['confirmed_by'],'Anna')

    def test_derived_from_valid_from_idempotent(self):
        body={'name':'quelle.txt','base64':base64.b64encode(b'Abschnitt eins.\n\nAbschnitt zwei.').decode(),'version':'v2','valid_from':'2027-01-01'}
        doc=self.service.import_document(body)
        self.service.import_document({**body,'name':'kaputt.txt','base64':base64.b64encode(b'Anderer Text.').decode(),'valid_from':'irgendwann'})
        for _ in range(3):self.cert.state()
        derived=[r for r in self.store.list('reminder') if r['source']['type']=='document']
        self.assertEqual(len(derived),1);self.assertEqual(derived[0]['source']['document_id'],doc['id'])
        self.assertEqual(derived[0]['effective_date'],'2027-01-01');self.assertEqual(derived[0]['title'],'quelle.txt v2 gültig ab 01.01.2027')

    def test_documents_pending(self):
        pending=self.cert.state()['documents_pending']
        expected={}
        for q in self.store.list('requirement'):
            if q['status']=='pending':expected[q['source_id']]=expected.get(q['source_id'],0)+1
        self.assertEqual({d['document_id']:d['pending'] for d in pending},expected)


class SubmissionTests(CertBase):
    def submit(self,name='bericht.pdf',raw=b'%PDF-1.4 test',**kw):
        return self.cert.submit({'version_id':self.v['id'],'name':name,'base64':base64.b64encode(raw).decode(),'reviewer':'Anna',**kw})

    def test_limits_hash_and_state_without_data(self):
        for name in ['bericht.exe','bericht']:
            with self.assertRaises(InputError):self.submit(name=name)
        with self.assertRaises(InputError):self.submit(raw=b'x'*5_000_001)
        with self.assertRaises(InputError):self.submit(base64='***')
        with self.assertRaises(InputError):self.submit(raw=b'')
        s=self.submit(raw=b'x'*5_000_000);self.assertEqual(s['sha256'],hashlib.sha256(b'x'*5_000_000).hexdigest())
        self.assertNotIn('data_base64',s);self.assertEqual(s['mime'],'application/pdf');self.assertEqual(s['status'],'pending')
        self.assertNotIn('data_base64',json.dumps(self.cert.state()))
        self.assertEqual(self.cert.download(s['id'])[0],b'x'*5_000_000)

    def test_decisions_logged(self):
        s=self.submit(name='erklaerung.docx')
        with self.assertRaises(InputError):self.cert.review_submission({'id':s['id'],'approve':True,'reviewer':'Chef','note':''})
        with self.assertRaises(InputError):self.cert.review_submission({'id':s['id'],'approve':'yes','reviewer':'Chef','note':'x'})
        self.cert.review_submission({'id':s['id'],'approve':False,'reviewer':'Chef','note':'Unterschrift fehlt'})
        s=self.cert.review_submission({'id':s['id'],'approve':True,'reviewer':'Chef','note':'Nachgereicht'})
        self.assertEqual(s['status'],'approved');self.assertEqual(len(s['decisions']),2)
        self.assertEqual(len([e for e in self.store.events() if e['action']=='cert_submission_review']),2)


class EndToEndImportTests(CertBase):
    def test_real_import_job_is_evidence(self):
        auto=self.service.automation
        auto.approve_package({'package_id':'AUTO-PACKAGE-1','reviewer':'Paket','note':'Synthetic','acknowledge_demo':True})
        sim=auto.launch({'project_id':self.v['project_id'],'package_id':'AUTO-PACKAGE-1','count':9})
        job=auto.launch({'project_id':self.v['project_id'],'package_id':'AUTO-PACKAGE-1','count':9,'mode':'import'})
        def wait(id,status):
            deadline=time.monotonic()+30
            while time.monotonic()<deadline:
                if auto.detail(id)['status']==status:return
                time.sleep(.02)
            self.fail('timeout')
        wait(job['id'],'waiting_import');wait(sim['id'],'completed')
        self.assertIn('evidence',self.blocking())
        case=auto.export(job['id'],'input')['cases'][0]['case_id']
        auto.import_results({'job_id':job['id'],'records':[{'case_id':case,'observed':{'message_present':True}}]});wait(job['id'],'completed')
        self.go('start');d=self.cert.detail(self.v['id'])
        self.assertEqual(d['unclear_total'],8);self.assertEqual(len(d['simulation_jobs']),1)
        for u in d['unclear']:self.accept({'id':u['job_id']},u['case_id'])
        self.assertEqual(self.blocking(),[])
        with self.assertRaises(InputError):self.go('approve',reviewer='Bernd')
        self.assertEqual(self.go('approve',reviewer='Chef')['status'],'freigegeben')


class CertHTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.service=create_service(Path(self.tmp.name)/'db.sqlite3')
        self.server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(self.service))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.service.automation.close();self.server.server_close();self.thread.join();self.tmp.cleanup()
    def call(self,path,body=None,headers=None):
        req=urllib.request.Request(self.url+path,data=json.dumps(body).encode() if body is not None else None,
                                   headers={'Content-Type':'application/json',**(headers or {})})
        try:
            with urllib.request.urlopen(req) as r:return r.status,r.read(),r.headers
        except urllib.error.HTTPError as e:return e.code,e.read(),e.headers

    def ok(self,path,body=None):
        code,data,_=self.call(path,body);self.assertEqual(code,200,data);return json.loads(data)

    def error(self,path,body=None,code=422):
        status,data,_=self.call(path,body);self.assertEqual(status,code,data);self.assertIn('error',json.loads(data))

    def test_ui_settings(self):
        self.assertEqual(self.ok('/api/state')['settings'],{'language':'de','theme':'light'})
        self.assertEqual(self.ok('/api/settings',{'language':'en','theme':'dark'}),{'language':'en','theme':'dark'})
        self.assertEqual(self.ok('/api/settings',{'theme':'system'}),{'language':'en','theme':'system'})
        self.error('/api/settings',{'language':'fr'});self.error('/api/settings',{'theme':'blue'})
        self.assertEqual(self.ok('/api/state')['settings'],{'language':'en','theme':'system'})
        code,data,headers=self.call('/locale.js')
        self.assertEqual(code,200);self.assertTrue(headers['Content-Type'].startswith('text/javascript'))

    def test_routes(self):
        state=self.ok('/api/state')['certification']
        self.assertEqual(set(state),{'today','manufacturers','versions','submissions','reminders','documents_pending'})
        v=self.ok('/api/cert/version',{'manufacturer_name':'HTTP (fiktiv)','software':'S','version':'1','reviewer':'Anna'})
        self.assertEqual(v['status'],'neu');self.assertEqual(set(v['gate']),{'ok','items'})
        self.assertEqual([i['key'] for i in v['gate']['items']],['evidence','no_failures','unclear_accepted','submissions_decided','four_eyes'])
        self.error('/api/cert/version',{'manufacturer_name':'HTTP (fiktiv)','software':'S','version':'1','reviewer':'Anna'})
        self.error('/api/cert/version',{'manufacturer_id':'missing','software':'S','version':'2','reviewer':'Anna'})
        self.error('/api/cert/transition',{'version_id':v['id'],'action':'approve','reviewer':'Anna','note':'x'})
        self.error('/api/cert/transition',{'version_id':'missing','action':'start','reviewer':'Anna','note':'x'})
        self.assertEqual(self.ok('/api/cert/transition',{'version_id':v['id'],'action':'start','reviewer':'Anna','note':'x'})['status'],'in_pruefung')
        self.error('/api/cert/accept',{'version_id':v['id'],'job_id':'x','case_id':'y','reviewer':'B','note':'n'})
        raw=b'Synthetischer Testbericht'
        self.error('/api/cert/submission',{'version_id':v['id'],'name':'a.exe','base64':base64.b64encode(raw).decode(),'reviewer':'Anna'})
        s=self.ok('/api/cert/submission',{'version_id':v['id'],'name':'bericht.txt','base64':base64.b64encode(raw).decode(),'reviewer':'Anna'})
        self.assertNotIn('data_base64',s)
        code,data,headers=self.call('/api/cert/submission/'+s['id'])
        self.assertEqual(code,200);self.assertEqual(data,raw);self.assertTrue(headers['Content-Type'].startswith('text/plain'))
        self.assertIn('bericht.txt',headers['Content-Disposition'])
        u=self.ok('/api/cert/submission',{'version_id':v['id'],'name':'Prüfbericht Ä.txt','base64':base64.b64encode(raw).decode(),'reviewer':'Anna'})
        _,_,headers=self.call('/api/cert/submission/'+u['id'])
        # The route stores an ASCII-cleaned name; the header adds an RFC 5987 form next to the plain fallback.
        self.assertIn('filename="Pr_fbericht__.txt"',headers['Content-Disposition'])
        self.assertIn("filename*=UTF-8''Pr_fbericht%20_.txt",headers['Content-Disposition'])
        self.ok('/api/cert/submission/review',{'id':u['id'],'approve':True,'reviewer':'Chef','note':'ok'})
        self.error('/api/cert/submission/missing',code=404)
        self.error('/api/cert/submission/review',{'id':s['id'],'approve':True,'reviewer':'Chef'})
        self.assertEqual(self.ok('/api/cert/submission/review',{'id':s['id'],'approve':True,'reviewer':'Chef','note':'ok'})['status'],'approved')
        self.error('/api/cert/reminder',{'title':'T','effective_date':'2027-01-01','reviewer':'Anna'})
        r=self.ok('/api/cert/reminder',{'title':'T','effective_date':'2027-01-01','source_note':'Quelle','reviewer':'Anna'})
        self.assertIn('state',r);self.assertIn('days_until',r)
        r=self.ok('/api/cert/reminder/affected',{'reminder_id':r['id'],'version_ids':[v['id']],'reviewer':'Anna','note':'betroffen'})
        self.assertEqual(r['affected']['version_ids'],[v['id']])
        self.error('/api/cert/reminder/affected',{'reminder_id':r['id'],'version_ids':'x','reviewer':'Anna','note':'n'})
        d=self.ok('/api/cert/version/'+v['id']+'?offset=0&limit=10');self.assertEqual(d['version']['id'],v['id']);self.assertEqual(d['unclear'],[])
        self.error('/api/cert/version/'+v['id']+'?limit=501');self.error('/api/cert/version/'+v['id']+'?limit=abc')
        self.error('/api/cert/version/missing',code=404);self.error('/api/cert/unknown',code=404);self.error('/api/cert/nothing',{},code=404)
        state=self.ok('/api/state')['certification']
        self.assertEqual(len([x for x in state['submissions'] if x['id']==s['id']]),1);self.assertNotIn(b'data_base64',self.call('/api/state')[1])

    def test_token_applies(self):
        with patch.dict(os.environ,{'AUDITFLOW_ACCESS_TOKEN':'test-token'}):
            self.assertEqual(self.call('/api/cert/version/x')[0],401)
            self.assertEqual(self.call('/api/cert/reminder',{'title':'T'})[0],401)
            self.assertEqual(self.call('/api/cert/version/x',headers={'Authorization':'Bearer test-token'})[0],404)


if __name__=='__main__':unittest.main()
