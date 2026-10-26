import base64
import copy
import io
import json
import os
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from auditflow.service import Service
from auditflow.server import create_service, handler_for
from auditflow.domain import InputError
from auditflow.model import Model, ModelError
ROOT=Path(__file__).resolve().parents[1]

class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.service=create_service(Path(self.temp.name)/'db.sqlite3')
    def tearDown(self):self.temp.cleanup()
    def approve(self,kind,id):
        return self.service.approve(kind,id,{'approve':True,'reviewer':'Test reviewer','note':'Automated fixture test only, not domain approval.'})
    def ready(self,case='CASE-001'):
        for id in ['C1','C2','C3','C4']:self.approve('requirement',id)
        self.approve('case',case)
    def test_default_gates_block_pass(self):
        r=self.service.run({'mode':'message'})
        self.assertEqual(r['overall_status'],'not_assessable')
    def test_review_identity_required(self):
        with self.assertRaises(InputError):self.service.approve('requirement','C1',{'approve':True})
    def test_changed_quote_not_approvable(self):
        r=self.service.store.get('requirement','C1');r['source_excerpt']='invented';self.service.store.put('requirement',r)
        with self.assertRaises(InputError):self.approve('requirement','C1')
    def test_original_then_mutants(self):
        self.ready()
        self.assertEqual(self.service.run({'mode':'message'})['overall_status'],'pass')
        for mutation in ['wrong_period','wrong_azvu','wrong_id','insurer_fields']:
            self.assertEqual(self.service.run({'mode':'message','mutation':mutation})['overall_status'],'fail',mutation)
        self.assertEqual(self.service.run({'mode':'message','mutation':'truncated'})['overall_status'],'technical_error')
    def test_correct_rejection_and_buggy_software(self):
        self.ready('CASE-002')
        self.assertEqual(self.service.run({'case_id':'CASE-002'})['overall_status'],'pass')
        self.assertEqual(self.service.run({'case_id':'CASE-002','software_mode':'buggy'})['overall_status'],'fail')
    def test_open_expectation_cannot_be_approved(self):
        with self.assertRaises(InputError):self.approve('case','CASE-006')
    def test_snapshot_unchanged_after_review_edit(self):
        self.ready();run=self.service.run({})
        self.service.approve('case','CASE-001',{'approve':False,'reviewer':'Later reviewer','note':'Withdrawn'})
        saved=self.service.store.get('run',run['id'])
        self.assertEqual(saved['snapshot']['review_status'],'approved')
        self.assertTrue(any(c['status']=='stale' for c in self.service.coverage()['cells']))
    def test_offline_drafts_not_approved_or_mapped(self):
        doc=self.service.store.get('document','DOC-CRITERIA')
        section=next(s for s in doc['sections'] if len(s['text'])>50)
        drafts=self.service.draft({'document_id':doc['id'],'section_id':section['id']})
        self.assertTrue(drafts)
        for r in drafts:
            self.assertEqual(r['status'],'pending');self.assertIsNone(r['mapping']);self.assertEqual(r['citation_status'],'verified')
    def test_deduplicated_import(self):
        body={'name':'example.txt','version':'1','base64':base64.b64encode('Ein sinnvoller Quelltext für eine Beispielregel.'.encode()).decode()}
        self.assertEqual(self.service.import_document(body)['id'],self.service.import_document(body)['id'])
    def test_scope_mismatch_rejected(self):
        c=self.service.store.get('case','CASE-001');c['ruleset']='2027';self.service.store.put('case',c)
        with self.assertRaises(InputError):self.service.run({})
    def test_seed_is_idempotent(self):
        create_service(Path(self.temp.name)/'db.sqlite3')
        self.assertEqual(len(self.service.store.list('case')),8)
    def test_coverage_uses_requirement_result(self):
        self.ready('CASE-002');self.service.run({'case_id':'CASE-002'})
        cells=[x for x in self.service.coverage()['cells'] if x['case_id']=='CASE-002']
        self.assertEqual(next(x for x in cells if x['requirement_id']=='C1')['status'],'fail')
        self.assertEqual(next(x for x in cells if x['requirement_id']=='C4')['status'],'pass')
    def test_diff_hierarchical_prefix(self):
        old={'id':'old','name':'test','version':'1','sections':[{'id':'3.12','text':'old'}]}
        new={'id':'new','name':'test','version':'2','sections':[{'id':'3.12','text':'new'}]}
        self.service.store.put('document',old);self.service.store.put('document',new)
        r=self.service.store.get('requirement','C1');r.update(source_id='old',section_id='3.120');self.service.store.put('requirement',r)
        self.assertEqual(self.service.diff({'old_id':'old','new_id':'new'})['requirements'],[])
    def test_events_hash_chain(self):
        self.ready();events=self.service.store.events()
        self.assertGreater(len(events),1)
        for a,b in zip(events,events[1:]):self.assertEqual(b['prev'],a['hash'])

class ModelTests(unittest.TestCase):
    def test_no_secret_offline_error(self):
        with patch.dict(os.environ,{'HAI_API_KEY':''}):
            with self.assertRaises(ModelError):Model().call('test','test')
    def test_malformed_response(self):
        with patch.dict(os.environ,{'HAI_API_KEY':'not-a-real-key'}):
            m=Model(transport=lambda *a,**k:io.BytesIO(b'{"choices": []}'))
            with self.assertRaises(ModelError):m.call('test','test')
    def test_unreachable(self):
        def fail(*a,**k):raise urllib.error.URLError('test')
        with patch.dict(os.environ,{'HAI_API_KEY':'not-a-real-key'}):
            with self.assertRaisesRegex(ModelError,'nicht erreichbar'):Model(transport=fail).call('test','test')
    def test_invalid_draft_schema(self):
        m=Model();m.call=lambda *a:'{"requirements":[{"title":3}]}'
        with self.assertRaises(ModelError):m.extract({'name':'test','version':'1'},{'id':'x','text':'source'})

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.service=create_service(Path(self.temp.name)/'db.sqlite3')
        self.server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(self.service));self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def test_static_and_api(self):
        with urllib.request.urlopen(self.url+'/') as r:self.assertIn(b'AuditFlow',r.read())
        with urllib.request.urlopen(self.url+'/api/state') as r:self.assertEqual(len(json.load(r)['cases']),8)
    def test_cross_origin_write_blocked(self):
        req=urllib.request.Request(self.url+'/api/run',data=b'{}',headers={'Content-Type':'application/json','Origin':'https://foreign.example'})
        with self.assertRaises(urllib.error.HTTPError) as c:urllib.request.urlopen(req)
        self.assertEqual(c.exception.code,403)
    def test_malformed_request(self):
        req=urllib.request.Request(self.url+'/api/run',data=b'[]',headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as c:urllib.request.urlopen(req)
        self.assertEqual(c.exception.code,422)
    def test_api_token(self):
        with patch.dict(os.environ,{'AUDITFLOW_ACCESS_TOKEN':'test-token'}):
            with self.assertRaises(urllib.error.HTTPError) as c:urllib.request.urlopen(self.url+'/api/state')
            self.assertEqual(c.exception.code,401)
            req=urllib.request.Request(self.url+'/api/state',headers={'Authorization':'Bearer test-token'})
            with urllib.request.urlopen(req) as r:self.assertEqual(r.status,200)

if __name__=='__main__':unittest.main()
