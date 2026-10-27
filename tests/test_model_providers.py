"""Native Gemini protocol contracts; synthetic tokens, no external requests."""
import io
import json
import os
import socket
import ssl
import unittest
import urllib.error
from unittest.mock import patch
from auditflow.model import Model,ModelError


class GeminiTests(unittest.TestCase):
    def test_configurable_timeout_and_invalid_values(self):
        with patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':'gemini','GEMINI_API_KEY':'synthetic-only','AUDITFLOW_MODEL_TIMEOUT':'180'},clear=True):
            calls=[]
            def transport(request,timeout):calls.append(timeout);return io.BytesIO(json.dumps(self.reply('OK')).encode())
            m=Model(transport=transport);self.assertEqual(m.call('System','Question'),'OK');self.assertEqual(calls,[180]);self.assertEqual(m.status()['timeout_seconds'],180)
            for value in ['0','9','301','invalid','120.5']:
                with patch.dict(os.environ,{'AUDITFLOW_MODEL_TIMEOUT':value}):
                    with self.assertRaisesRegex(ModelError,'10 bis 300'):Model(transport=lambda *a,**kw:self.fail('Invalid timeout must not call network')).call('S','Q')

    def test_distinct_timeout_dns_tls_and_connection_errors(self):
        cases=[(TimeoutError('private timeout context'),'120 Sekunden'),(urllib.error.URLError(TimeoutError()),'120 Sekunden'),
               (urllib.error.URLError(socket.gaierror('private DNS context')),'DNS'),
               (urllib.error.URLError(ssl.SSLCertVerificationError('private certificate context')),'Zertifikat'),
               (ssl.SSLError('private TLS context'),'TLS'),(ConnectionRefusedError('private refused context'),'abgelehnt')]
        for failure,expected in cases:
            with self.subTest(error=type(failure).__name__):
                def transport(*a,**kw):raise failure
                with patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':'gemini','GEMINI_API_KEY':'synthetic-only'},clear=True):
                    with self.assertRaises(ModelError) as error:Model(transport=transport).call('System','Question')
                self.assertIn(expected,str(error.exception));self.assertNotIn('private',str(error.exception));self.assertNotIn('synthetic-only',str(error.exception))
    def configured(self,reply,**env):
        def transport(request,timeout):
            self.assertEqual(request.get_method(),'POST');self.assertEqual(timeout,120)
            self.assertEqual(request.full_url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent')
            self.assertEqual(request.get_header('X-goog-api-key'),'synthetic-gemini-token')
            self.assertIsNone(request.get_header('Authorization'));self.assertNotIn('synthetic-gemini-token',request.full_url)
            data=json.loads(request.data);self.assertIn('systemInstruction',data);self.assertEqual(data['contents'][0]['role'],'user')
            self.assertEqual(data['generationConfig']['maxOutputTokens'],8192);self.assertNotIn('messages',data)
            return io.BytesIO(json.dumps(reply).encode())
        with patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':'gemini','GEMINI_API_KEY':'synthetic-gemini-token',**env},clear=True):
            return Model(transport=transport)

    def reply(self,*parts):return {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':p} for p in parts]}}]}

    def test_native_request_multiple_parts_and_status_no_secrets(self):
        m=self.configured(self.reply('Synthetic ','answer'));self.assertEqual(m.call('System','Question'),'Synthetic answer')
        self.assertEqual(m.status()['provider'],'gemini');self.assertEqual(m.status()['key_variable'],'GEMINI_API_KEY')
        self.assertTrue(m.status()['configured']);self.assertNotIn('synthetic-gemini-token',json.dumps(m.status()))
    def test_json_tasks_request_native_json_but_chat_remains_text(self):
        m=self.configured(self.reply('{}'));original=m.transport;requests=[]
        def capture(request,timeout):requests.append(json.loads(request.data));return original(request,timeout)
        m.transport=capture;m.call_json('Return JSON','Synthetic input');m.call('System','Question')
        self.assertEqual(requests[0]['generationConfig']['responseMimeType'],'application/json')
        self.assertNotIn('responseMimeType',requests[1]['generationConfig'])

    def test_thought_parts_are_not_application_output(self):
        reply=self.reply('Draft');reply['candidates'][0]['content']['parts']=[{'text':'Internal thought','thought':True},{'text':'Final answer'}]
        self.assertEqual(self.configured(reply).call('System','Question'),'Final answer')

    def test_wrong_provider_key_is_never_used(self):
        for provider,key_name in [('gemini','HAI_API_KEY'),('hessian','GEMINI_API_KEY')]:
            with patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':provider,key_name:'synthetic-wrong-provider-token'},clear=True):
                m=Model(transport=lambda *a,**kw:self.fail('Must not call network'))
                self.assertFalse(m.status()['configured'])
                with self.assertRaisesRegex(ModelError,'Kein serverseitiger'):m.call('System','Question')

    def test_stale_hessian_url_cannot_receive_gemini_key(self):
        m=self.configured(self.reply('OK'),AUDITFLOW_MODEL_URL='https://hip-gw.hessian.ai/v1/chat/completions')
        self.assertEqual(m.call('System','Question'),'OK')

    def test_wrong_model_or_unknown_provider_stops_before_transport(self):
        m=self.configured(self.reply('OK'),AUDITFLOW_MODEL='vllm/GLM-Flash:Latest')
        with self.assertRaisesRegex(ModelError,'alte Hessian-Modellangabe'):m.call('System','Question')
        m=self.configured(self.reply('OK'));m.provider='invalid'
        with self.assertRaisesRegex(ModelError,'hessian oder gemini'):m.call('System','Question')

    def test_blocked_truncated_empty_and_malformed_responses_never_succeed(self):
        for reply in [[],{}, {'candidates':[]},{'candidates':[[]]},self.reply(''),{'candidates':[{'content':{'parts':'invalid'}}]},
                      {'promptFeedback':{'blockReason':'SAFETY'}},{'candidates':[{'finishReason':'SAFETY'}]},
                      {'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'partial JSON'}]}}]}]:
            with self.subTest(reply=reply):
                with self.assertRaises(ModelError):self.configured(reply).call('System','Question')

    def test_http_error_does_not_echo_response_body_or_request_secrets(self):
        for code in [400,401,403,404,429,500]:
            def fail(*a,**kw):raise urllib.error.HTTPError('https://example.invalid',code,'Synthetic failure',{},io.BytesIO(b'Private error content'))
            m=self.configured(self.reply('OK'));m.transport=fail
            with self.assertRaises(ModelError) as err:m.call('System','Question')
            self.assertIn(str(code),str(err.exception));self.assertNotIn('Private error content',str(err.exception));self.assertNotIn('synthetic-gemini-token',str(err.exception))

    def test_existing_extraction_schema_and_quotes_apply_to_gemini(self):
        source='A synthetic source statement for native Gemini extraction.'
        answer={'requirements':[{'title':'Synthetic','criterion':'Synthetic criterion','source_excerpt':source,'conditions':[],'exceptions':[],'questions':[]}]}
        m=self.configured(self.reply(json.dumps(answer)))
        r=m.extract({'name':'Synthetic.txt','version':'1'},{'id':'p1','text':source})
        self.assertEqual(r[0]['source_excerpt'],source)


class HessianTests(unittest.TestCase):
    def reply(self,content='Synthetic final answer',reason='stop',**message):
        return {'choices':[{'finish_reason':reason,'message':{'content':content,**message}}]}

    def call(self,reply,**env):
        requests=[]
        def transport(request,timeout):
            self.assertEqual(request.full_url,'https://hip-gw.hessian.ai/v1/chat/completions')
            self.assertEqual(request.get_header('Authorization'),'Bearer synthetic-hessian-token')
            self.assertIsNone(request.get_header('X-goog-api-key'))
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps(reply).encode())
        with patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':'hessian','HAI_API_KEY':'synthetic-hessian-token',**env},clear=True):
            m=Model(transport=transport)
            result=m.call_json('Return JSON','Synthetic page text')
        return result,requests,m.status()

    def test_budget_and_nonstreaming_request(self):
        result,requests,status=self.call(self.reply('{}'))
        self.assertEqual(result,'{}');self.assertEqual(len(requests),1)
        self.assertEqual(requests[0]['max_tokens'],8192);self.assertFalse(requests[0]['stream'])
        self.assertEqual(requests[0]['model'],'vllm/GLM-Flash:Latest')
        self.assertEqual(requests[0]['messages'][1]['content'],'Synthetic page text')
        self.assertEqual(status['max_output_tokens'],8192)
        self.assertNotIn('synthetic-hessian-token',json.dumps(status))
        self.assertEqual(self.call(self.reply(),AUDITFLOW_MODEL_MAX_TOKENS='12000')[1][0]['max_tokens'],12000)

    def test_invalid_budget_never_calls_network(self):
        for value in ['0','511','32769','bad','8192.5']:
            with self.subTest(value=value),patch.dict(os.environ,{'AUDITFLOW_MODEL_PROVIDER':'hessian','HAI_API_KEY':'synthetic','AUDITFLOW_MODEL_MAX_TOKENS':value},clear=True):
                with self.assertRaisesRegex(ModelError,'512 bis 32768'):
                    Model(transport=lambda *a,**kw:self.fail('Invalid budget must not call network')).call('S','Q')

    def test_token_truncation_rejected_even_if_json_looks_complete(self):
        for content in [None,'','{"requirements":[]}']:
            with self.subTest(content=content),self.assertRaisesRegex(ModelError,'Tokenlimit.*8192'):
                self.call(self.reply(content,'length',reasoning_content='private internal content'))

    def test_reasoning_only_is_diagnosed_but_never_used_as_answer(self):
        for field in ['reasoning','reasoning_content']:
            with self.subTest(field=field),self.assertRaises(ModelError) as error:
                self.call(self.reply(None,**{field:'private internal content'}))
            self.assertIn('nur Reasoning',str(error.exception));self.assertNotIn('private',str(error.exception))
            self.assertEqual(self.call(self.reply('Final answer',**{field:'private internal content'}))[0],'Final answer')

    def test_empty_refused_tool_and_unknown_finish_are_distinct_safe_errors(self):
        cases=[(self.reply(''),'leere Textantwort'),(self.reply(None,'content_filter'),'gefiltert'),
               (self.reply(None,refusal='private refusal'),'abgelehnt'),
               (self.reply(None,'tool_calls',tool_calls=[{'private':'payload'}]),'Werkzeugaufruf'),
               (self.reply('Text','private unknown reason'),'regulär abgeschlossene')]
        for reply,expected in cases:
            with self.subTest(expected=expected),self.assertRaises(ModelError) as error:self.call(reply)
            self.assertIn(expected,str(error.exception));self.assertNotIn('private',str(error.exception));self.assertNotIn('synthetic-hessian-token',str(error.exception))

    def test_malformed_response_rejected_and_legacy_missing_finish_allowed(self):
        for reply in [{},{'choices':[]},{'choices':[{}]},{'choices':[{'message':[]}]},self.reply(['invalid'])]:
            with self.subTest(reply=reply),self.assertRaisesRegex(ModelError,'Ungültige Antwortstruktur'):self.call(reply)
        self.assertEqual(self.call(self.reply('Legacy final',None))[0],'Legacy final')
