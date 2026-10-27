import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from auditflow.server import create_service, handler_for


class PortalHTTPTests(unittest.TestCase):
    """Demo login over HTTP: cookie handling and the manufacturer-only API rule."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.env=patch.dict('os.environ',{'HAI_API_KEY':'','AUDITFLOW_ACCESS_TOKEN':''});self.env.start()
        self.service=create_service(Path(self.temp.name)/'db.sqlite3')
        self.server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(self.service));self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.env.stop();self.temp.cleanup()
    def call(self,path,body=None,cookie=None):
        headers={'Content-Type':'application/json'} if body is not None else {}
        if cookie:headers['Cookie']=cookie
        req=urllib.request.Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
        try:
            with urllib.request.urlopen(req) as r:return r.status,json.load(r),r.headers.get('Set-Cookie')
        except urllib.error.HTTPError as e:return e.code,json.load(e),e.headers.get('Set-Cookie')
    def login(self,account_id):
        status,body,cookie=self.call('/api/portal/login',{'account_id':account_id})
        self.assertEqual(status,200);self.assertIn('HttpOnly',cookie);self.assertNotIn('token',body)
        return cookie.split(';')[0]

    def test_manufacturer_session_only_reaches_portal(self):
        maker=next(a for a in self.call('/api/portal/accounts')[1] if a['role']=='hersteller')
        cookie=self.login(maker['id'])
        self.assertEqual(self.call('/api/portal/me',cookie=cookie)[1]['account']['id'],maker['id'])
        self.assertEqual(self.call('/api/portal/overview',cookie=cookie)[0],200)
        for path in ['/api/state','/api/library','/api/results']:self.assertEqual(self.call(path,cookie=cookie)[0],403)
        self.assertEqual(self.call('/api/review',{'kind':'requirement','id':'C1'},cookie=cookie)[0],403)
        self.assertEqual(self.call('/api/health',cookie=cookie)[0],200)

    def test_reviewer_session_and_logout(self):
        cookie=self.login('pruefer')
        self.assertEqual(self.call('/api/state',cookie=cookie)[0],200)
        self.assertEqual(self.call('/api/portal/overview',cookie=cookie)[0],403)  # reviewers use the workspace
        status,_,cleared=self.call('/api/portal/logout',{},cookie=cookie)
        self.assertEqual(status,200);self.assertIn('Max-Age=0',cleared)
        self.assertIsNone(self.call('/api/portal/me',cookie=cookie)[1]['account'])

    def test_register_signs_in_and_scopes_data(self):
        status,body,cookie=self.call('/api/portal/register',{'company':'Neue Lohn GmbH (fiktiv)','contact_name':'Erika Demo',
                                                            'software':[{'software':'NeuLohn','version':'1.0'}]})
        self.assertEqual(status,200);self.assertIn('HttpOnly',cookie);self.assertEqual(body['account']['role'],'hersteller')
        cookie=cookie.split(';')[0]
        ov=self.call('/api/portal/overview',cookie=cookie)[1]
        self.assertEqual([v['software'] for v in ov['versions']],['NeuLohn'])
        self.assertEqual(self.call('/api/portal/software',{'software':'NeuLohn','version':'1.1'},cookie=cookie)[0],200)
        self.assertEqual(self.call('/api/state',cookie=cookie)[0],403)
        self.assertEqual(self.call('/api/portal/software',{'software':'X','version':'1'})[0],401)

    def test_overview_requires_login(self):
        self.assertEqual(self.call('/api/portal/overview')[0],401)
        self.assertIsNone(self.call('/api/portal/me')[1]['account'])


if __name__=='__main__':unittest.main()
