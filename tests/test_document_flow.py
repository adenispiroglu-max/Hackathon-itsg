import base64
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from auditflow.server import create_service
ROOT=Path(__file__).resolve().parents[1]
V2=ROOT/'data/demo/Synthetic demo requirements v2 (fiktiv).txt'


class DocumentFlowTests(unittest.TestCase):
    """Service-level wiring of library upload, requirement versions and the fixture checker."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.env=patch.dict('os.environ',{'HAI_API_KEY':''});self.env.start()
        self.service=create_service(Path(self.temp.name)/'db.sqlite3')
        self.service.review.runner=lambda fn:fn()
    def tearDown(self):self.env.stop();self.temp.cleanup()
    def approve(self,kind,id,note='Automated fixture test only, not domain approval.'):
        return self.service.approve(kind,id,{'approve':True,'reviewer':'Test reviewer','note':note})
    def upload_v2(self,valid_from=None):
        a=self.service.library.analyse({'name':V2.name,'base64':base64.b64encode(V2.read_bytes()).decode(),'version_label':'fiktiv-v2'})
        self.assertIsNotNone(a['suggestion']);self.assertEqual(a['suggestion']['library_id'],self.service.store.get('document','DOC-CRITERIA')['library_id'])
        return self.service.library.confirm({'upload_id':a['upload_id'],'library_id':a['suggestion']['library_id'],'valid_from':valid_from})

    def test_files_live_next_to_database(self):
        self.upload_v2()
        self.assertEqual(len(list((Path(self.temp.name)/'documents').iterdir())),1)

    def test_offline_upload_flags_and_future_source_keeps_approval(self):
        self.approve('requirement','C4')
        result=self.upload_v2(valid_from='2099-01-01')
        self.assertIn('C4',result['diff']['affected_requirement_ids'])
        self.service.review.refresh_validity()
        c4=self.service.store.get('requirement','C4')
        self.assertEqual(c4['change_flag']['text'],'Quelle geändert – Prüfung nötig')
        self.assertTrue(self.service.review.effective(c4))

    def test_source_in_force_invalidates_approval(self):
        self.approve('requirement','C4');self.upload_v2()
        self.service.review.refresh_validity()
        c4=self.service.store.get('requirement','C4')
        self.assertFalse(self.service.review.effective(c4));self.assertEqual(c4['approval_invalid']['reason'],'quelle_ersetzt')

    def test_fixture_checker_never_applies_to_newer_source_version(self):
        for id in ['C1','C2','C3','C4']:self.approve('requirement',id)
        self.approve('case','CASE-001')
        new=self.upload_v2()['document']
        text=next(p['text'] for p in new['paragraphs'] if '32-day' in p['text'])
        self.service.review.edit({'id':'C4','criterion':text,'source_excerpt':text,'reason':'Fiktive Quelle v2.'})
        self.approve('requirement','C4','Fiktive v2 gegen Quellabschnitt geprüft.')
        c4=self.service.store.get('requirement','C4')
        self.assertEqual((c4['version_no'],c4['approved_version_no'],c4['source_id']),(2,2,new['id']))
        run=self.service.run({'case_id':'CASE-001','mode':'scenario'})
        r=next(x for x in run['results'] if x['requirement_id']=='C4')
        self.assertEqual(r['status'],'not_assessable');self.assertIn('Fixture-Prüfer',r['note'])
        self.assertTrue(self.service.store.get('case','CASE-001')['outdated'])

    def test_versions_endpoint_lists_history(self):
        self.approve('requirement','C4')
        self.service.review.edit({'id':'C4','criterion':'Geänderter fiktiver Text.','reason':'Test'})
        v=self.service.requirement_versions('C4')
        self.assertEqual([x['version_no'] for x in v['versions']],[1,2]);self.assertEqual(v['approved_version_no'],1)


if __name__=='__main__':unittest.main()
