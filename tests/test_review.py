import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from auditflow.store import Store
from auditflow.review import Review, NO_MODEL
from auditflow.domain import InputError
from auditflow.model import Model, ModelError
ROOT=Path(__file__).resolve().parents[1]
NOTE='Automated fixture test only, not domain approval.'
NEW_C1='Demo requirement: allow an enquiry only when the current absence and at least two prior absences have confirmed certificate status.'


def review_reply(**kw):
    out={'recommendation':'freigabe_empfohlen','criteria':{k:{'ok':True,'note':'Synthetischer Test.'} for k in ['quellenbezug','vollstaendigkeit','widersprueche','pruefbarkeit','aenderungen']},
         'reasoning':'Synthetische Testbegründung.','evidence':None,'marks':{'source':[],'requirement':[]},'suggested_change':None,'open_question':None}
    out.update(kw);return out


class FakeModel:
    """Never calls the network; scripted answers for the Review contract."""
    key='synthetic-test-key';model='fake-model'
    def __init__(self):
        self.classification='fachlich';self.review=review_reply();self.error=None;self.calls=[]
    def classify_changes(self,changes):
        self.calls.append('classify')
        if self.error:raise self.error
        return [{'change_id':c['id'],'classification':self.classification,'reason':'Synthetische Einstufung.'} for c in changes]
    def draft_revision(self,req,change):
        self.calls.append('draft')
        return {'title':req['title'],'criterion':change['after'],'source_excerpt':change['after'],'conditions':[],'exceptions':[],'questions':[]}
    def prereview(self,req,source,approved,related):
        self.calls.append('prereview')
        if self.error:raise self.error
        return self.review


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.temp.name)/'db.sqlite3',json.loads((ROOT/'data/seed.json').read_text(encoding='utf-8')))
        self.model=FakeModel();self.review=Review(self.store,lambda:self.model,runner=lambda fn:fn());self.review.migrate()
    def tearDown(self):self.temp.cleanup()
    def offline(self):
        return Review(self.store,Model,runner=lambda fn:fn())
    def approve(self,id,note=NOTE,review=None):
        return (review or self.review).approve({'id':id,'reviewer':'Test reviewer','note':note,'approve':True})
    def versions(self,id):
        return sorted([v for v in self.store.list('requirement_version') if v['requirement_id']==id],key=lambda v:v['version_no'])
    def documents(self,new_text=NEW_C1,valid_from=None,old_until=None,diff=True):
        old=self.store.get('document','DOC-CRITERIA')
        old.update(library_id='LIB-1',version_no=1,version_label='synthetic-demo-v1',valid_until=old_until,withdrawn=None);self.store.put('document',old)
        sections=[{**s,'text':new_text if s['id']=='C1' else s['text']} for s in old['sections']]
        new={'id':'DOC-V2','name':'Synthetic demo requirements v2.txt','version':'synthetic-demo-v2','version_label':'synthetic-demo-v2','library_id':'LIB-1',
             'version_no':2,'valid_from':valid_from,'valid_until':None,'withdrawn':None,'kind':'txt','sha256':'x','sections':sections,
             'paragraphs':[{'ref':f'¶{i+1}','page':None,'location':s['location'],'text':s['text']} for i,s in enumerate(sections)],
             'note':'Fiktive synthetische Testversion.'}
        self.store.put('document',new)
        before=next(s['text'] for s in old['sections'] if s['id']=='C1')
        return {'id':'DIFF-1','library_id':'LIB-1','old_version_id':'DOC-CRITERIA','new_version_id':'DOC-V2','created_at':'2026-10-27',
                'changes':[{'id':'chg-1','kind':'changed','old_ref':'¶1','before':before,'new_ref':'¶1','after':new_text,'words':[]}],
                'affected_requirement_ids':[],'summary':{}}

    def test_migration_idempotent_and_keeps_approval(self):
        self.temp2=tempfile.TemporaryDirectory();self.addCleanup(self.temp2.cleanup)
        store=Store(Path(self.temp2.name)/'db.sqlite3',json.loads((ROOT/'data/seed.json').read_text(encoding='utf-8')))
        r=store.get('requirement','C1');r.update(status='approved',semantic_review='approved',reviewer='Alt',review_note='Bestehende Freigabe',reviewed_at='2026-01-01');store.put('requirement',r)
        review=Review(store,lambda:self.model,runner=lambda fn:fn())
        self.assertGreater(review.migrate(),0);self.assertEqual(review.migrate(),0)
        self.assertEqual(len(store.list('requirement_version')),4)
        c1=store.get('requirement','C1');v=store.get('requirement_version','C1@v1')
        self.assertEqual((c1['version_no'],c1['approved_version_no'],c1['status']),(1,1,'approved'))
        self.assertEqual((v['origin'],v['approval']['decision'],v['approval']['reviewer']),('migration','freigegeben','Alt'))
        self.assertIsNone(store.get('requirement','C2')['approved_version_no'])
        self.assertEqual(store.get('case','CASE-001')['requirement_versions'],{'C1':1,'C2':1,'C4':1,'C3':1})
        self.assertTrue(review.effective(c1))

    def test_new_version_keeps_old_approval_effective(self):
        self.approve('C1')
        with self.assertRaises(InputError):self.review.edit({'id':'C1','criterion':'Neu'})
        with self.assertRaises(InputError):self.review.edit({'id':'C1','criterion':self.store.get('requirement','C1')['criterion'],'reason':'x'})
        r=self.review.edit({'id':'C1','title':'Neuer Titel','reason':'Titel präzisiert'})
        self.assertEqual((r['version_no'],r['status'],r['approved_version_no']),(2,'pending',1))
        self.assertTrue(self.review.effective(r))
        vs=self.versions('C1');self.assertEqual([v['origin'] for v in vs],['migration','manuell'])
        self.assertEqual(vs[0]['approval']['decision'],'freigegeben');self.assertIsNone(vs[1]['approval'])
        self.assertEqual(r['ai_review']['status'],'fertig')
        self.assertTrue(any(e['action']=='requirement_version_created' for e in self.store.events()))

    def test_approve_against_ai_requires_justification(self):
        self.model.review=review_reply(recommendation='klaerung_erforderlich',open_question='Gilt die Ausnahme?')
        self.review.prereview('C1')
        with self.assertRaisesRegex(InputError,'Begründung zur KI-Empfehlung'):self.approve('C1',note='Passt so.')
        with self.assertRaises(InputError):self.review.approve({'id':'C1','approve':True})
        r=self.approve('C1',note='Die offene Frage ist für den Demo-Fall geklärt.')
        self.assertEqual((r['status'],r['semantic_review'],r['approved_version_no'],r['reviewer']),('approved','approved',1,'Test reviewer'))
        self.assertTrue(self.store.get('requirement_version','C1@v1')['approval']['against_ai'])
        self.model.review=review_reply();self.review.prereview('C2')
        self.approve('C2',note='Kurz ok.');self.assertFalse(self.store.get('requirement_version','C2@v1')['approval']['against_ai'])

    def test_reject_keeps_previous_approval(self):
        self.approve('C1');self.review.edit({'id':'C1','title':'Anders','reason':'Test'})
        r=self.review.approve({'id':'C1','reviewer':'Test reviewer','note':NOTE,'approve':False})
        self.assertEqual((r['status'],r['approved_version_no']),('rejected',1));self.assertTrue(self.review.effective(r))
        self.assertEqual(self.store.get('requirement_version','C1@v2')['approval']['decision'],'abgelehnt')

    def test_mismatched_citation_not_approvable(self):
        r=self.store.get('requirement','C1');r['source_excerpt']='invented';self.store.put('requirement',r)
        with self.assertRaisesRegex(InputError,'Quellenzitat'):self.approve('C1')

    def test_prereview_without_key_not_available(self):
        with patch.dict(os.environ,{'HAI_API_KEY':''}):r=self.offline().prereview('C1')
        self.assertEqual(r['ai_review']['status'],'nicht_verfügbar');self.assertEqual(r['ai_review']['error'],NO_MODEL)
        self.assertNotIn('recommendation',r['ai_review'])
        self.assertEqual(self.store.get('requirement_version','C1@v1')['ai_review']['status'],'nicht_verfügbar')

    def test_prereview_fields_and_invalid_marks_dropped(self):
        src=self.store.get('requirement','C1')['source_excerpt']
        self.model.review=review_reply(recommendation='ueberarbeitung_empfohlen',evidence={'location':'C1','excerpt':src},
            marks={'source':[{'location':'C1','excerpt':'current absence and at least one prior absence'},{'location':'S. 99','excerpt':'Erfundene Fundstelle'}],
                   'requirement':[{'field':'criterion','text':'confirmed certificate status'},{'field':'criterion','text':'nicht vorhanden'}]},
            suggested_change={'field':'criterion','after':'Geänderter Kriteriumstext.'},open_question='Gilt dies auch bei offener AU?')
        a=self.review.prereview('C1')['ai_review']
        self.assertEqual((a['status'],a['recommendation_label'],a['rejected_marks']),('fertig','Überarbeitung empfohlen',2))
        self.assertEqual(len(a['marks']['source']),1);self.assertEqual(len(a['marks']['requirement']),1)
        self.assertEqual(a['evidence']['document_id'],'DOC-CRITERIA');self.assertEqual(a['prompt_version'],'requirement-review-v1')
        self.assertEqual(a['suggested_change']['before'],self.store.get('requirement','C1')['criterion'])
        self.assertEqual(set(a['criteria']),{'quellenbezug','vollstaendigkeit','widersprueche','pruefbarkeit','aenderungen'})
        r=self.review.accept_suggestion({'id':'C1','reviewer':'Test reviewer'})
        self.assertEqual((r['version_no'],r['criterion'],self.store.get('requirement_version','C1@v2')['origin']),(2,'Geänderter Kriteriumstext.','ki_entwurf'))
        self.model.review=review_reply(evidence={'location':'x','excerpt':'Nicht in der Quelle'})
        self.assertEqual(self.review.prereview('C1')['ai_review']['rejected_marks'],1)

    def test_prereview_model_error_and_background_guard(self):
        self.model.error=ModelError('Modell nicht erreichbar oder Zeitlimit überschritten.')
        a=self.review.prereview('C1')['ai_review'];self.assertEqual(a['status'],'fehler');self.assertIn('nicht erreichbar',a['error'])
        self.model.error=RuntimeError('boom')
        a=self.review.schedule_prereview('C1')['ai_review'];self.assertEqual(a['status'],'fehler');self.assertIn('boom',a['error'])
        queued=[];review=Review(self.store,lambda:self.model,runner=queued.append)
        self.assertEqual(review.schedule_prereview('C2')['ai_review']['status'],'läuft');self.assertEqual(len(queued),1)

    def test_model_validation_rejects_bad_output(self):
        m=Model();m.call=lambda *a:'{"recommendation":"freigabe_erteilt"}'
        with self.assertRaises(ModelError):m.prereview({'id':'C1'},'text')
        m.call=lambda *a:'{"changes":[{"change_id":"unknown","classification":"fachlich","reason":"x"}]}'
        with self.assertRaises(ModelError):m.classify_changes([{'id':'chg-1'}])
        m.call=lambda *a:'{"title":"t","criterion":""}'
        with self.assertRaises(ModelError):m.draft_revision({},{'after':'x'})
        m.call=lambda *a:'```json\n'+json.dumps(review_reply())+'\n```'
        self.assertEqual(m.prereview({'id':'C1'},'text')['recommendation'],'freigabe_empfohlen')

    def test_document_change_offline_flags_without_rewrite(self):
        self.approve('C1');diff=self.documents()
        with patch.dict(os.environ,{'HAI_API_KEY':''}):diff=self.offline().apply_document_change(diff)
        self.assertEqual(diff['affected_requirement_ids'],['C1'])
        self.assertEqual((diff['changes'][0]['classification'],diff['changes'][0]['classification_source']),('offen','keine'))
        self.assertEqual(diff['summary'],{'added':0,'removed':0,'changed':1,'affected':1,'fachlich':0,'redaktionell':0,'offen':1})
        r=self.store.get('requirement','C1')
        self.assertEqual(r['change_flag']['text'],'Quelle geändert – Prüfung nötig');self.assertEqual(r['version_no'],1)
        self.assertNotEqual(r['criterion'],NEW_C1);self.assertIsNone(self.store.get('requirement','C2')['change_flag'])
        self.assertEqual(self.store.get('document_diff','DIFF-1')['affected_requirement_ids'],['C1'])
        r=self.offline().edit({'id':'C1','criterion':NEW_C1,'source_excerpt':NEW_C1,'reason':'Neue Quellversion manuell übernommen'})
        self.assertEqual((r['source_id'],r['citation_status'],r['version_no']),('DOC-V2','verified',2))
        r=self.approve('C1',review=self.offline());self.assertIsNone(r['change_flag'])

    def test_document_change_online_fachlich_drafts_version(self):
        self.approve('C1');self.model.classification='fachlich'
        diff=self.review.apply_document_change(self.documents())
        self.assertEqual((diff['summary']['fachlich'],diff['changes'][0]['classification_source']),(1,'ki'))
        r=self.store.get('requirement','C1')
        self.assertEqual((r['version_no'],r['status'],r['approved_version_no'],r['source_id'],r['citation_status']),(2,'pending',1,'DOC-V2','verified'))
        v=self.store.get('requirement_version','C1@v2');self.assertEqual((v['origin'],v['source_id']),('ki_entwurf','DOC-V2'))
        self.assertEqual(self.store.get('requirement_version','C1@v1')['source_id'],'DOC-CRITERIA')
        self.assertEqual(r['ai_review']['status'],'fertig');self.assertIn('prereview',self.model.calls)
        self.assertTrue(self.store.get('case','CASE-001')['outdated'])
        self.assertEqual(self.review.apply_document_change(diff)['affected_requirement_ids'],['C1'])
        self.assertEqual(self.store.get('requirement','C1')['version_no'],2)

    def test_redaktionell_editorial_accept_carries_approval(self):
        self.approve('C1');self.model.classification='redaktionell'
        diff=self.review.apply_document_change(self.documents())
        self.assertEqual(diff['summary']['redaktionell'],1);self.assertEqual(self.store.get('requirement','C1')['version_no'],1)
        with self.assertRaises(InputError):self.review.editorial_accept({'diff_id':'DIFF-1','reviewer':'Test reviewer'})
        diff=self.review.editorial_accept({'diff_id':'DIFF-1','reviewer':'Test reviewer','note':'Nur Wortlaut angepasst.'})
        self.assertEqual(diff['editorial_accepted'][0]['requirement_ids'],['C1'])
        r=self.store.get('requirement','C1');v=self.store.get('requirement_version','C1@v2')
        self.assertEqual((r['version_no'],r['status'],r['approved_version_no'],r['source_id'],r['source_excerpt']),(2,'approved',2,'DOC-V2',NEW_C1))
        self.assertEqual((v['origin'],v['approval']['carried_from_version'],v['citation_status']),('übernommen_redaktionell',1,'verified'))
        self.assertIsNone(self.store.get('case','CASE-001')['outdated']);self.assertEqual(self.store.get('case','CASE-001')['requirement_versions']['C1'],2)

    def test_reclassify_to_fachlich(self):
        self.approve('C1');self.model.classification='redaktionell'
        self.review.apply_document_change(self.documents())
        with self.assertRaises(InputError):self.review.reclassify({'diff_id':'DIFF-1','change_id':'chg-1','classification':'redaktionell'})
        diff=self.review.reclassify({'diff_id':'DIFF-1','change_id':'chg-1','classification':'fachlich'})
        self.assertEqual((diff['changes'][0]['classification_source'],diff['summary']['fachlich']),('mensch',1))
        self.assertEqual(self.store.get('requirement_version','C1@v2')['origin'],'ki_entwurf')

    def test_refresh_validity(self):
        self.approve('C1');diff=self.documents(valid_from='2027-01-01')
        with patch.dict(os.environ,{'HAI_API_KEY':''}):self.offline().apply_document_change(diff)
        self.assertEqual(self.review.refresh_validity('2026-10-27'),[])
        self.assertTrue(self.review.effective(self.store.get('requirement','C1'),'2026-10-27'))
        self.assertEqual(self.review.refresh_validity('2027-01-02'),['C1'])
        r=self.store.get('requirement','C1');self.assertEqual(r['approval_invalid']['reason'],'quelle_ersetzt')
        self.assertIn('Version synthetic-demo-v2',r['approval_invalid']['text']);self.assertFalse(self.review.effective(r,'2027-01-02'))
        self.assertTrue(self.review.effective(self.store.get('requirement','C2'),'2027-01-02') is False)  # C2 never approved
        self.approve('C2');self.assertTrue(self.review.effective(self.store.get('requirement','C2'),'2027-01-02'))

    def test_valid_until_past_invalidates(self):
        self.approve('C1');self.documents(old_until='2026-06-30')
        self.review.refresh_validity('2026-10-27')
        r=self.store.get('requirement','C1');self.assertEqual(r['approval_invalid']['reason'],'abgelaufen');self.assertFalse(self.review.effective(r))
        self.assertEqual(self.review.results('2026-10-27')['rows'][0]['approval_label'],'Freigabe nicht mehr gültig')

    def test_case_usable_inheritance(self):
        case=self.store.get('case','CASE-002');self.assertFalse(self.review.case_usable(case))
        for id in ['C1','C2','C4']:self.approve(id)
        self.assertTrue(self.review.case_usable(case))
        self.assertFalse(self.review.case_usable(self.store.get('case','CASE-006')))
        self.assertFalse(self.review.case_usable({**case,'expectation_edited':True}))
        self.assertTrue(self.review.case_usable({**case,'expectation_edited':True,'review_status':'approved'}))

    def test_outdated_and_regenerate_after_approval(self):
        for id in ['C1','C2','C4']:self.approve(id)
        self.review.edit({'id':'C1','title':'Präzisierter Titel','reason':'Fachliche Präzisierung'})
        old=self.store.get('case','CASE-002')
        self.assertEqual(old['outdated']['text'],'veraltet – basiert auf Version 1');self.assertFalse(self.review.case_usable(old))
        self.approve('C1')
        clones=[c for c in self.store.list('case') if c.get('regenerated_from')=='CASE-002']
        self.assertEqual(len(clones),1);clone=clones[0]
        self.assertEqual((clone['requirement_versions']['C1'],clone['expected_message'],clone['review_status']),(2,False,'pending'))
        self.assertTrue(self.review.case_usable(clone));self.assertTrue(self.store.get('case','CASE-002')['outdated'])
        self.assertEqual(self.review.regenerate_cases('C1'),[])
        self.assertTrue(any(e['action']=='cases_regenerated' for e in self.store.events()))

    def test_results_shape_and_evidence_states(self):
        from auditflow.service import Service
        service=Service(self.store,(ROOT/'data/sample.teel').read_bytes())
        for id in ['C1','C2','C4']:self.approve(id)
        service.run({'case_id':'CASE-002'})
        res=self.review.results()
        self.assertEqual(set(res),{'distribution','coverage','rows','limitations'})
        self.assertEqual(set(res['distribution']),{'bestanden','fehlgeschlagen','nicht_beurteilbar','veraltet','nicht_ausgefuehrt'})
        self.assertEqual(set(res['coverage']),{'total_approved','covered','open','missing','outdated'})
        rows={r['requirement_id']:r for r in res['rows']}
        self.assertEqual((rows['C1']['evidence_state'],rows['C1']['approval_label'],rows['C3']['evidence_state']),('aktuell','Freigegeben v1','offen'))
        self.assertEqual(rows['C1']['source']['document_id'],'DOC-CRITERIA')
        cell=next(c for c in rows['C4']['cases'] if c['case_id']=='CASE-002')
        self.assertEqual((cell['latest']['status'],cell['latest']['stale'],cell['usable']),('pass',False,True))
        self.assertEqual(res['coverage']['total_approved'],3);self.assertEqual((res['coverage']['covered'],res['coverage']['open']),(2,1))  # C1 fails for CASE-002
        self.assertGreater(res['distribution']['nicht_ausgefuehrt'],0)
        self.review.edit({'id':'C1','title':'Neu','reason':'Test'})
        res=self.review.results();rows={r['requirement_id']:r for r in res['rows']}
        self.assertEqual((rows['C1']['evidence_state'],rows['C1']['approval_label']),('offen','Wartet auf Freigabe'))
        # An unchanged requirement keeps its evidence even when a case also tests a changed one.
        self.assertEqual(rows['C4']['evidence_state'],'aktuell')
        self.approve('C1');res=self.review.results();rows={r['requirement_id']:r for r in res['rows']}
        self.assertEqual(rows['C1']['evidence_state'],'veraltet')  # new cases exist but are not yet run
        self.assertEqual(rows['C4']['evidence_state'],'aktuell');self.assertGreater(res['distribution']['veraltet'],0)
        old=next(c for c in rows['C1']['cases'] if c['case_id']=='CASE-002')
        self.assertEqual((old['outdated_text'],old['usable']),('veraltet – basiert auf Version 1',False))


if __name__=='__main__':
    unittest.main()
