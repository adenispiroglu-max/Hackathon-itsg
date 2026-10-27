import base64
import json
import os
import tempfile
import time
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from auditflow.server import create_service
from auditflow.domain import InputError
from auditflow.portal import Portal, Forbidden

FORBIDDEN_KEYS={'data_base64','acceptances','requirements','requirement_ids','ai_review','expected','expectation','sha256'}


def keys(value):
    if isinstance(value,dict):
        for k,v in value.items():yield k;yield from keys(v)
    elif isinstance(value,list):
        for v in value:yield from keys(v)


class PortalBase(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'HAI_API_KEY':''});self.env.start()
        self.tmp=tempfile.TemporaryDirectory();self.service=create_service(Path(self.tmp.name)/'db.sqlite3')
        self.store=self.service.store;self.cert=self.service.certification;self.auto=self.service.automation
        self.cert.today=lambda:date(2026,10,27)
        self.portal=Portal(self.store,self.cert,self.auto)
        self.va=self.cert.create_version({'manufacturer_name':'Alpha Lohn (fiktiv)','software':'AlphaPay','version':'1.0','reviewer':'Anna'})
        self.vb=self.cert.create_version({'manufacturer_name':'Beta Lohn (fiktiv)','software':'BetaPay','version':'2.0','reviewer':'Anna'})
        self.a=self.login('m:'+self.va['manufacturer_id']);self.b=self.login('m:'+self.vb['manufacturer_id'])
        self.pruefer=self.login('pruefer')

    def tearDown(self):self.auto.close();self.tmp.cleanup();self.env.stop()

    def login(self,account_id):return self.portal.login({'account_id':account_id})['account']

    def b64(self,raw=b'Synthetischer Bericht'):return base64.b64encode(raw).decode()

    def wait(self,id,status):
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            if self.auto.detail(id)['status']==status:return
            time.sleep(.02)
        self.fail('timeout')

    def import_job(self,v=None):
        self.auto.approve_package({'package_id':'AUTO-PACKAGE-1','reviewer':'Paket','note':'Synthetic','acknowledge_demo':True})
        job=self.auto.launch({'project_id':(v or self.va)['project_id'],'package_id':'AUTO-PACKAGE-1','count':9,'mode':'import'})
        self.wait(job['id'],'waiting_import');return job


class AccountTests(PortalBase):
    def test_accounts(self):
        accounts=self.portal.accounts()
        self.assertEqual(accounts[0],{'id':'pruefer','role':'pruefer','name':'ITSG-Prüfer (Demo)'})
        rest=accounts[1:];self.assertTrue(rest)
        self.assertTrue(all(a['role']=='hersteller' and a['id']=='m:'+a['manufacturer_id'] for a in rest))
        self.assertTrue(all('(fiktiv)' in a['name'] for a in rest))
        self.assertEqual([a['name'] for a in rest],sorted([a['name'] for a in rest],key=str.casefold))

    def test_login_logout_account_for(self):
        r=self.portal.login({'account_id':'m:'+self.va['manufacturer_id']})
        self.assertGreaterEqual(len(r['token']),40);self.assertEqual(r['account']['name'],'Alpha Lohn (fiktiv)')
        self.assertEqual(self.portal.account_for(r['token']),r['account'])
        for bad in [{'account_id':'m:missing'},{'account_id':'admin'},{'account_id':None},{},None]:
            with self.assertRaises(InputError):self.portal.login(bad)
        self.assertIsNone(self.portal.account_for('nope'));self.assertIsNone(self.portal.account_for(None))
        dump=json.dumps(self.store.events())
        self.assertNotIn(r['token'],dump)
        self.assertTrue(any(e['action']=='portal_login' and e['data']['account_id']==r['account']['id'] for e in self.store.events()))
        self.assertEqual(self.portal.logout(r['token']),{'ok':True})
        self.assertIsNone(self.portal.account_for(r['token']))
        self.assertTrue(any(e['action']=='portal_logout' for e in self.store.events()))
        self.assertNotIn(r['token'],json.dumps(self.store.events()))
        p=self.portal.login({'account_id':'pruefer'});self.assertEqual(self.portal.account_for(p['token'])['role'],'pruefer')

    def test_session_of_deleted_manufacturer(self):
        r=self.portal.login({'account_id':'m:'+self.vb['manufacturer_id']})
        self.store.delete_many([('manufacturer',self.vb['manufacturer_id'])])
        self.assertIsNone(self.portal.account_for(r['token']))


class OverviewTests(PortalBase):
    def test_only_own_versions_and_no_forbidden_keys(self):
        self.import_job()
        self.cert.submit({'version_id':self.vb['id'],'name':'b.txt','base64':self.b64(),'reviewer':'B'})
        o=self.portal.overview(self.a)
        self.assertEqual(o['manufacturer'],{'id':self.va['manufacturer_id'],'name':'Alpha Lohn (fiktiv)'})
        self.assertEqual([v['id'] for v in o['versions']],[self.va['id']])
        self.assertIn('keine Sicherheitsfunktion',o['notice'])
        v=o['versions'][0]
        self.assertEqual(set(v),{'id','software','version','description','status','status_label','hint_text','waiting_since','missing','decisions','submissions','packages'})
        self.assertEqual((v['status'],v['status_label']),('neu','Neu'))
        self.assertEqual(v['decisions'],[]);self.assertEqual(v['submissions'],[])  # creation is no ITSG decision
        self.assertTrue(any('Herstellerergebnisse' in m for m in v['missing']))
        self.assertEqual(len(v['packages']),1);p=v['packages'][0]
        self.assertTrue(p['waiting']);self.assertIsNone(p['counts']);self.assertEqual(p['total'],9);self.assertEqual(p['status_label'],'Wartet auf Ihre Ergebnisse')
        self.assertFalse(FORBIDDEN_KEYS&set(keys(o)))
        dump=json.dumps(o,ensure_ascii=False);self.assertNotIn('Beta',dump);self.assertNotIn(self.vb['id'],dump)

    def test_simulations_hidden(self):
        self.auto.approve_package({'package_id':'AUTO-PACKAGE-1','reviewer':'Paket','note':'Synthetic','acknowledge_demo':True})
        sim=self.auto.launch({'project_id':self.va['project_id'],'package_id':'AUTO-PACKAGE-1','count':9})
        self.wait(sim['id'],'completed')
        self.assertEqual(self.portal.overview(self.a)['versions'][0]['packages'],[])
        with self.assertRaises(Forbidden):self.portal.package_input(self.a,sim['id'])

    def test_pruefer_forbidden(self):
        job=self.import_job()
        for call in [lambda:self.portal.overview(self.pruefer),lambda:self.portal.package_input(self.pruefer,job['id']),
                     lambda:self.portal.import_results(self.pruefer,{'job_id':job['id'],'records':[]}),
                     lambda:self.portal.submit(self.pruefer,{'version_id':self.va['id'],'name':'a.txt','base64':self.b64()}),
                     lambda:self.portal.download_submission(self.pruefer,'x'),lambda:self.portal.overview(None)]:
            with self.assertRaises(Forbidden):call()


class RegistrationTests(PortalBase):
    def body(self,**extra):
        return {'company':'Neue Lohn GmbH (fiktiv)','contact_name':'Erika Demo','email':'erika@example.org',
                'software':[{'software':'NeuLohn','version':'1.0','note':'Lohnabrechnung für kleine Betriebe'},{'software':'NeuLohn','version':'1.1'}],**extra}

    def test_register_creates_manufacturer_versions_and_session(self):
        r=self.portal.register(self.body())
        acc=self.portal.account_for(r['token']);self.assertEqual((acc['role'],acc['name']),('hersteller','Neue Lohn GmbH (fiktiv)'))
        self.assertIn(acc['id'],[a['id'] for a in self.portal.accounts()])
        ov=self.portal.overview(acc)
        self.assertEqual([(v['software'],v['version'],v['status']) for v in ov['versions']],[('NeuLohn','1.0','neu'),('NeuLohn','1.1','neu')])
        self.assertEqual(ov['versions'][0]['description'],'Lohnabrechnung für kleine Betriebe')
        m=self.store.get('manufacturer',acc['manufacturer_id']);self.assertEqual((m['scope'],m['contact_name']),('registration','Erika Demo'))
        # ITSG sees the new versions like any other, each with its own test-package project.
        mine=[v for v in self.cert.state()['versions'] if v['manufacturer_id']==m['id']]
        self.assertEqual(len(mine),2);self.assertTrue(all(v['project_id'] for v in mine))
        ev=[e for e in self.store.events() if e['action']=='portal_register'][-1]['data'];self.assertNotIn('email',ev)

    def test_register_validation(self):
        for bad in [{'company':''},{'contact_name':' '},{'email':'kein-mail'},{'software':[]},{'software':[{'software':'X','version':''}]},
                    {'software':[{'software':'X','version':'1'},{'software':'x','version':'1'}]},{'company':'Lohnwerk Demo GmbH (fiktiv)'}]:
            with self.assertRaises(InputError,msg=bad):self.portal.register(self.body(**bad))

    def test_add_software_only_for_own_account(self):
        acc=self.portal.account_for(self.portal.register(self.body())['token'])
        v=self.portal.add_software(acc,{'software':'NeuLohn Cloud','version':'2026.1'})
        self.assertIn(v['id'],[x['id'] for x in self.portal.overview(acc)['versions']])
        with self.assertRaises(InputError):self.portal.add_software(acc,{'software':'NeuLohn','version':'1.0'})  # duplicate
        with self.assertRaises(Forbidden):self.portal.add_software(self.pruefer,{'software':'X','version':'1'})


class PackageAndSubmissionTests(PortalBase):
    def test_package_flow_and_isolation(self):
        job=self.import_job()
        with self.assertRaises(Forbidden):self.portal.package_input(self.b,job['id'])
        with self.assertRaises(Forbidden):self.portal.import_results(self.b,{'job_id':job['id'],'records':[]})
        with self.assertRaises(Forbidden):self.portal.package_input(self.a,'missing')
        data=self.portal.package_input(self.a,job['id'])
        self.assertFalse({'reviewer','review_note','reviewed_at'}&set(data['package']))  # internal approval stays at ITSG
        self.assertEqual(len(data['cases']),9)
        self.assertFalse({'expected','expectation','requirement_ids'}&set(keys(data['cases'])))
        records=[{'case_id':c['case_id'],'observed':{'message_present':True}} for c in data['cases']]
        self.assertEqual(self.portal.import_results(self.a,{'job_id':job['id'],'records':records})['status'],'queued')
        self.wait(job['id'],'completed')
        p=self.portal.overview(self.a)['versions'][0]['packages'][0]
        self.assertFalse(p['waiting']);self.assertEqual(p['status_label'],'Abgeschlossen')
        self.assertEqual(sum(p['counts'].values()),9);self.assertEqual(set(p['counts']),{'pass','fail','not_assessable'})

    def test_submission_flow_and_decision(self):
        with self.assertRaises(Forbidden):self.portal.submit(self.b,{'version_id':self.va['id'],'name':'a.txt','base64':self.b64()})
        with self.assertRaises(Forbidden):self.portal.submit(self.a,{'version_id':'missing','name':'a.txt','base64':self.b64()})
        with self.assertRaises(InputError):self.portal.submit(self.a,{'version_id':self.va['id'],'name':'a.exe','base64':self.b64()})
        s=self.portal.submit(self.a,{'version_id':self.va['id'],'name':'bericht.txt','base64':self.b64(),'reviewer':'Fremder Name'})
        self.assertEqual(s['uploaded_by'],'Alpha Lohn (fiktiv)');self.assertNotIn('data_base64',s)
        self.assertEqual(self.portal.download_submission(self.a,s['id'])[0],b'Synthetischer Bericht')
        with self.assertRaises(Forbidden):self.portal.download_submission(self.b,s['id'])
        with self.assertRaises(Forbidden):self.portal.download_submission(self.b,'missing')
        v=self.portal.overview(self.a)['versions'][0]
        self.assertEqual(v['submissions'][0]['status_label'],'Wartet auf Entscheidung')
        self.assertTrue(any('Einreichungen warten' in m for m in v['missing']))
        self.cert.review_submission({'id':s['id'],'approve':False,'reviewer':'Chef','note':'Unterschrift fehlt'})
        sub=self.portal.overview(self.a)['versions'][0]['submissions'][0]
        self.assertEqual(sub['status_label'],'Abgelehnt')
        self.assertEqual([(d['label'],d['note']) for d in sub['decisions']],[('Abgelehnt','Unterschrift fehlt')])
        self.assertEqual(self.portal.overview(self.b)['versions'][0]['submissions'],[])

    def test_version_decisions_labelled(self):
        self.cert.transition({'version_id':self.va['id'],'action':'start','reviewer':'Chef','note':'Unterlagen vollständig'})
        self.cert.transition({'version_id':self.va['id'],'action':'reject','reviewer':'Chef','note':'Fehlende Nachweise'})
        v=self.portal.overview(self.a)['versions'][0]
        self.assertEqual((v['status'],v['status_label']),('abgelehnt','Abgelehnt'))
        self.assertEqual([d['label'] for d in v['decisions']],['Prüfung begonnen','Abgelehnt'])
        self.assertEqual((v['decisions'][-1]['note'],v['decisions'][-1]['by']),('Fehlende Nachweise','Chef'))


if __name__=='__main__':unittest.main()
