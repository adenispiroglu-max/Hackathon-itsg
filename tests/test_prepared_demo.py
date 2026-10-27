"""Prepared demo fingerprint routing with synthetic registered bytes; no original fixture files."""
import base64
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from auditflow import prepared_demo
from auditflow.domain import InputError
from auditflow.server import create_service


class PreparedDemoTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.s=create_service(Path(self.tmp.name)/'demo.db')
        self.raw=b'Synthetic registered demo bytes, not a real PDF.'
        self.entry=copy.deepcopy(prepared_demo.catalogue()[0]);self.entry.update(sha256=hashlib.sha256(self.raw).hexdigest(),name='Synthetic.pdf')
        self.entry['requirements']=[self.entry['requirements'][2]] # Concrete, sourced 30-day check.
        self.entries=[self.entry]
        self.registry=patch('auditflow.prepared_demo.catalogue',side_effect=lambda:self.entries);self.registry.start()
        self.no_model=patch('auditflow.model.Model.call',side_effect=AssertionError('Prepared demo must not call a model'));self.no_model.start()
        self.no_worker=patch.object(self.s.workflow,'start');self.no_worker.start()
    def tearDown(self):
        self.no_worker.stop();self.no_model.stop();self.registry.stop()
        self.s.documents.close();self.s.workflow.close();self.s.automation.close();self.tmp.cleanup()
    def upload(self,name='Synthetic.pdf',raw=None):
        doc=self.s.import_document({'name':name,'base64':base64.b64encode(self.raw if raw is None else raw).decode(),'mode':'demo','smart_upload':True})
        self.s.documents.queue(doc['id'],'demo',resume=True);return self.s.store.get('document',doc['id'])
    def req(self,doc):return self.s.store.filtered('requirement','source_id',doc['id'])[0]
    def workflow(self,docs,**extra):
        w=self.s.workflow.create({'name':'Synthetic demo','company':'Synthetic','contact':'Expert','email':'demo@example.invalid','software':'Synthetic','software_version':'1','mode':'demo','requested_cases':2,**extra})
        for d in docs:self.s.workflow.attach({'id':w['id'],'document_id':d['id']})
        return self.s.workflow.begin({'id':w['id']})
    def approve(self,r):return self.s.approve('requirement',r['id'],{'reviewer':'Synthetic expert','note':'Source and expectation checked for this demo','approve':True})
    def test_exact_bytes_renamed_upload_deduplicates_and_preserves_approval(self):
        d=self.upload();r=self.req(d)
        self.assertEqual(r['status'],'pending');self.assertEqual(r['semantic_review'],'pending');self.assertEqual(r['citation_status'],'verified')
        self.assertIsNone(r['model_id']);self.assertEqual(r['ai_review']['mode'],'demo')
        self.approve(r);again=self.upload(name='Renamed.docx')
        self.assertEqual(again['id'],d['id']);self.assertEqual(len(self.s.store.filtered('requirement','source_id',d['id'])),1)
        self.assertEqual(self.req(d)['status'],'approved');self.assertEqual(len(self.s.store.filtered('document_job','document_id',d['id'])),1)
        with self.assertRaisesRegex(InputError,'nicht im Demo-Katalog'):self.upload(raw=self.raw+b' changed')
    def test_full_conveyor_human_gates_and_result_comparison(self):
        d=self.upload();w=self.workflow([d]);f=self.s.workflow
        self.assertEqual(f.tick(w['id'])['phase'],'requirements')
        self.assertEqual(f.tick(w['id'])['phase'],'requirements');self.approve(self.req(d))
        for _ in range(5):w=f.tick(w['id'])
        self.assertEqual(w['phase'],'case_review');self.assertEqual(len(w['cases']),2)
        self.assertEqual([c['expected']['value'] for c in w['cases']],[True,False])
        self.assertTrue(all(c['generation_mode']=='demo' and c['model_id'] is None for c in w['cases']))
        with self.assertRaises(InputError):f.release({'id':w['id'],'reviewer':'Expert','note':'Checked','acknowledged':False})
        w=f.release({'id':w['id'],'reviewer':'Expert','note':'Independently checked','acknowledged':True})
        package=f.package(w['id']);self.assertEqual(package['execution_mode'],'demo');self.assertNotIn('expected',package['cases'][0])
        f.manual_delivery({'id':w['id'],'reviewer':'Expert','note':'Synthetic demo handoff'})
        w=f.import_results({'id':w['id'],'data':{'workflow_id':w['id'],'package_hash':w['package_hash'],'records':[{'case_id':c['id'],'value':c['expected']['value']} for c in w['cases']]}})
        self.assertEqual(w['result']['counts']['pass'],2);self.assertEqual(w['phase'],'final_review')
        self.assertTrue(all('Vorbereitete Demo' in self.s.store.get('workflow_report',id)['scope'] for id in w['reports']))
    def test_unknown_file_and_mixed_scopes_are_blocked_without_api(self):
        with self.assertRaises(InputError):self.upload(name='Synthetic.pdf',raw=b'unrecognized')
        first=self.upload();second=copy.deepcopy(self.entry);raw=b'Another synthetic registered document'
        second.update(sha256=hashlib.sha256(raw).hexdigest(),id='other',name='Other.pdf',version='13.4',scope='2027',role='Other synthetic source')
        self.entries.append(second);d=self.upload('Other.pdf',raw)
        with self.assertRaisesRegex(InputError,'2026 und 2027'):self.workflow([first,d])
    def test_manual_revision_never_receives_old_prepared_cases(self):
        d=self.upload();r=self.req(d)
        changed=self.s.documents.revise({'id':r['id'],'criterion':'Changed synthetic criterion requiring new specialist interpretation.'})
        self.assertEqual(changed['status'],'pending');self.assertNotIn('ai_review',changed)
        review=self.s.documents.review(changed['id'],'live');self.assertEqual(review['mode'],'demo');self.assertEqual(review['recommendation'],'clarify')
        with self.assertRaisesRegex(InputError,'geändert'):self.s.workflow.generate(changed,'live','demo',0,0)
    def test_hidden_and_trashed_sources_and_requirements_stay_inactive(self):
        d=self.upload();r=self.req(d);r['trashed_at']='synthetic';self.s.store.put('requirement',r)
        self.s.documents.queue(d['id'],'demo');self.assertEqual(self.req(d)['trashed_at'],'synthetic')
        d['hidden']=True;self.s.store.put('document',d)
        with self.assertRaises(InputError):self.s.documents.queue(d['id'],'demo')
    def test_more_variants_preserve_null_for_unresolved_inputs(self):
        d=self.upload();cases=self.s.workflow.generate(self.req(d),'live','demo',0,0,4)
        self.assertEqual([c['expected']['value'] for c in cases],[True,False,True,None]);self.assertTrue(cases[-1]['questions'])
        self.assertEqual(len({c['profile']['Profil_ID'] for c in cases}),4)

    def test_older_section_job_cannot_restart_live_inference(self):
        d=self.upload();self.s.documents.process_section(d,d['sections'][0],'live')
        old=copy.deepcopy(self.req(d));old['id']='old-model-draft';old.pop('prepared_demo');self.s.store.put('requirement',old)
        with self.assertRaisesRegex(InputError,'Früherer Entwurf'):self.s.documents.review(old['id'],'live')
