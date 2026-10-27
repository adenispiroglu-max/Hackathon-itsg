"""Prepared demo fingerprint routing with synthetic registered bytes; no original fixture files."""
import base64
import copy
import hashlib
import json
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
        self.pacing=patch.dict('os.environ',{'AUDITFLOW_DEMO_PACING_SECONDS':'0'});self.pacing.start()
    def tearDown(self):
        self.pacing.stop();self.no_worker.stop();self.no_model.stop();self.registry.stop()
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

    def test_demo_pacing_holds_sources_until_elapsed(self):
        d=self.upload()
        with patch.dict('os.environ',{'AUDITFLOW_DEMO_PACING_SECONDS':'30'}):w=self.workflow([d])
        f=self.s.workflow;self.assertEqual(w['demo_pacing']['seconds'],30.0)
        self.assertEqual(f.tick(w['id'])['phase'],'sources')
        with patch('auditflow.workflow.time.time',return_value=w['demo_pacing']['started']+31):self.assertEqual(f.tick(w['id'])['phase'],'requirements')

    def test_bulk_case_approval_skips_open_expectations_and_back_navigation(self):
        d=self.upload();w=self.workflow([d],requested_cases=4);f=self.s.workflow
        f.tick(w['id']);self.approve(self.req(d))
        for _ in range(5):w=f.tick(w['id'])
        self.assertEqual(w['phase'],'case_review')
        result=f.review_cases({'id':w['id']});self.assertEqual((result['approved'],result['skipped']),(3,1))
        w=result['workflow'];open_case=next(c for c in w['cases'] if c['review_status']=='pending')
        self.assertIsNone(open_case['expected']['value'])
        w=f.review_case({'id':w['id'],'case_id':open_case['id'],'decision':'rejected'})
        w=f.release({'id':w['id'],'individual':True,'reviewer':'Expert','note':'Checked','acknowledged':True})
        self.assertEqual((w['phase'],len(w['cases'])),('delivery',3))
        w=f.back({'id':w['id'],'target':'case_review'});self.assertEqual((w['phase'],len(w['cases'])),('case_review',4))
        w=f.back({'id':w['id'],'target':'requirements'});self.assertEqual((w['phase'],w['cases'],w['hold']),('requirements',[],True))
        self.assertEqual(f.tick(w['id'])['phase'],'requirements')
        f.advance({'id':w['id']});self.assertEqual(f.tick(w['id'])['phase'],'generation')
        w=f.back({'id':w['id'],'target':'intake'});self.assertEqual(w['phase'],'intake');self.assertNotIn('hold',w)
        with self.assertRaisesRegex(InputError,'nicht möglich'):f.back({'id':w['id'],'target':'requirements'})
        w=f.begin({'id':w['id']})
        for _ in range(6):w=f.tick(w['id'])
        self.assertEqual(w['phase'],'case_review')

    def test_handed_over_package_cannot_go_back(self):
        d=self.upload();w=self.workflow([d]);f=self.s.workflow
        f.tick(w['id']);self.approve(self.req(d))
        for _ in range(5):w=f.tick(w['id'])
        f.review_cases({'id':w['id']});w=f.release({'id':w['id'],'individual':True,'reviewer':'Expert','note':'Checked','acknowledged':True})
        f.manual_delivery({'id':w['id'],'reviewer':'Expert','note':'Synthetic demo handoff'})
        for target in ['intake','requirements','case_review']:
            with self.assertRaisesRegex(InputError,'nicht möglich'):f.back({'id':w['id'],'target':target})

    def test_catalogue_table_variants_are_sourced_and_generated(self):
        real=json.loads(Path(prepared_demo.__file__).with_name('prepared_demo_catalogue.json').read_text())['entries']
        keys=[r['key'] for e in real for r in e['requirements']];self.assertEqual(len(keys),len(set(keys)))
        self.entries=real
        for e in real:
            texts={s['id']:s['text'] for s in prepared_demo.excerpts(e)}
            for item in e['requirements']:
                self.assertIn(item['quote'],texts[item['section_id']]);self.assertTrue(item['quote'].strip())
                if item['kind']!='table':continue
                req={'prepared_source_hash':e['sha256'],'prepared_key':item['key'],'criterion':item['criterion'],'title':item['title'],'prepared_scope':e['scope']}
                cases=prepared_demo.cases(req,len(item['variants'])+1,0)
                self.assertEqual([c['expected']['value'] for c in cases],[v['value'] for v in item['variants']]+[None])
                self.assertEqual([c['expected']['field'] for c in cases][:-1],[v['field'] for v in item['variants']])

    def test_older_excerpt_import_gains_later_catalogue_quotes(self):
        d=self.upload();before=copy.deepcopy(d['sections'])
        extra=copy.deepcopy(self.entry['requirements'][0]);extra.update(key='synthetic-same-page',quote='Synthetic later quote on the same page.')
        other=copy.deepcopy(extra);other.update(key='synthetic-new-page',section_id='page-99',location='PDF-Seite 99',quote='Synthetic quote on another page.')
        self.entry['requirements']+= [extra,other];d=self.upload()
        reqs=self.s.store.filtered('requirement','source_id',d['id']);self.assertEqual(len(reqs),3)
        self.assertTrue(all(r['citation_status']=='verified' for r in reqs))
        self.assertEqual(d['sections'][:len(before)],before)
        self.assertEqual({r['section_id'] for r in reqs},{before[0]['id'],before[0]['id']+'~synthetic-same-page','page-99'})

    def to_case_review(self,count=2):
        d=self.upload();w=self.workflow([d],requested_cases=count);f=self.s.workflow
        f.tick(w['id']);self.approve(self.req(d))
        for _ in range(6):w=f.tick(w['id'])
        self.assertEqual(w['phase'],'case_review');return d,w

    def test_case_attachments_instruction_and_parsable_reference_record(self):
        from auditflow.parser import parse
        self.entry['requirements']=[json.loads(Path(prepared_demo.__file__).with_name('prepared_demo_catalogue.json').read_text())['entries'][0]['requirements'][1]] # months kind
        d,w=self.to_case_review(4);f=self.s.workflow
        state={x['id']:x for x in f.state()['items']}[w['id']]
        files=[c['attachments'] for c in state['cases']];self.assertEqual(files,[['instruction','reference'],['instruction'],['instruction'],['instruction']])
        data,mime,name=f.attachment(w['id'],w['cases'][0]['id'],'instruction');text=data.decode()
        self.assertIn(w['cases'][0]['id'],text);self.assertIn('sechsmonatsbedingung_erfuellt',text);self.assertNotIn(w['cases'][0]['expected']['rationale'],text)
        raw,mime,name=f.attachment(w['id'],w['cases'][0]['id'],'reference');parsed=parse(raw)
        self.assertEqual(parsed['abgabegrund'],'41');self.assertEqual(parsed['dbvo']['au_ab_ag'],'2026-03-11')
        self.assertEqual(parsed['dbvo']['periods'],[{'begin':'2025-12-09','end':'2025-12-11'}])
        with self.assertRaisesRegex(InputError,'kein Soll-Datensatz'):f.attachment(w['id'],w['cases'][1]['id'],'reference')

    def test_requirement_import_checks_quote_and_duplicates(self):
        d=self.upload();existing=self.req(d)
        result=self.s.documents.import_requirements({'document_id':d['id'],'items':[
            {'title':'Imported check','criterion':'Imported synthetic criterion.','quote':existing['source_excerpt'][:40]},
            {'title':'Duplicate','criterion':existing['criterion'],'quote':existing['source_excerpt']},
            {'title':'Invented','criterion':'Something else.','quote':'This sentence does not exist in the source.'},
            {'title':'Imported check','criterion':'Imported synthetic criterion.','quote':existing['source_excerpt'][:40]}]})
        self.assertEqual(result['created'],1);self.assertEqual(result['duplicates'],['Duplicate','Imported check'])
        self.assertEqual([r['index'] for r in result['rejected']],[3])
        imported=next(r for r in self.s.store.filtered('requirement','source_id',d['id']) if r.get('imported'))
        self.assertEqual((imported['status'],imported['citation_status'],imported['ai_review']['status']),('pending','verified','completed'))
        w=self.workflow([d]);f=self.s.workflow;f.tick(w['id']);self.approve(existing)
        self.assertEqual(f.tick(w['id'])['phase'],'requirements') # imported draft still needs a human decision
        self.approve(imported);self.assertEqual(f.tick(w['id'])['phase'],'generation')
        for _ in range(6):w=f.tick(w['id'])
        self.assertEqual(w['phase'],'case_review');skeleton=[c for c in w['cases'] if c['requirement_id']==imported['id']]
        self.assertTrue(skeleton and all(c['generation_mode']=='offline' and c['expected']['value'] is None for c in skeleton))
        self.s.documents.queue(d['id'],'demo',resume=True)
        self.assertIn(imported['id'],[r['id'] for r in self.s.store.filtered('requirement','source_id',d['id']) if not r.get('previous_requirement_ids') or imported['id'] not in r['previous_requirement_ids']])

    def test_case_import_checks_requirement_and_duplicates(self):
        d,w=self.to_case_review();f=self.s.workflow;first=w['cases'][0]
        result=f.import_cases({'id':w['id'],'items':[
            {'requirement_id':first['requirement_id'],'title':'Imported 45 days','profile':{'Profil':'synthetisch'},'inputs':{'AU_Tage_im_System':45},'steps':['Ausführen'],'expected':{'field':'mindestdauer_erreicht','value':True,'rationale':'45 >= 30'}},
            {'requirement_id':first['requirement_id'],'title':'Copy','profile':first['profile'],'inputs':first['inputs'],'steps':first['steps'],'expected':{'field':first['expected']['field'],'value':first['expected']['value'],'rationale':'x'}},
            {'requirement_id':'unknown','title':'Orphan','profile':{'a':1},'inputs':{'b':2},'steps':['s'],'expected':{'field':'f','value':1,'rationale':'r'}}]})
        self.assertEqual((result['created'],result['duplicates'],[r['index'] for r in result['rejected']]),(1,['Copy'],[3]))
        w=self.s.store.get('workflow',w['id']);self.assertEqual(len(w['cases']),3);self.assertEqual(w['cases'][-1]['generation_mode'],'import')
        self.assertEqual(f.review_cases({'id':w['id']})['approved'],3)
        w=f.release({'id':w['id'],'individual':True,'reviewer':'Expert','note':'Checked','acknowledged':True});self.assertEqual(len(w['cases']),3)

    def test_requirement_import_uses_original_full_text_for_prepared_sources(self):
        raw=b'DSLW synthetic sample line\r\nNCSZ second synthetic record outside the excerpt\r\n'
        sample=copy.deepcopy(self.entry);sample.update(sha256=hashlib.sha256(raw).hexdigest(),id='sample',name='Synthetic-Sample')
        sample['requirements'][0].update(section_id='technical-sample',quote='DSLW synthetic');self.entries.append(sample)
        d=self.upload('Synthetic-Sample.txt',raw);self.assertTrue(all(s.get('prepared_excerpt') for s in d['sections']))
        result=self.s.documents.import_requirements({'document_id':d['id'],'items':[{'title':'Trailer record','criterion':'Sample ends with an NCSZ record.','quote':'NCSZ second synthetic record'}]})
        self.assertEqual(result['created'],1)
        r=next(r for r in self.s.store.filtered('requirement','source_id',d['id']) if r.get('imported'))
        self.assertEqual((r['section_id'],r['citation_status']),('volltext','verified'))
        self.assertTrue(self.s.store.get('document',d['id'])['sections'][-1]['fulltext_for_import'])
