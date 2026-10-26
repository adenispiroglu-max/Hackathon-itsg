"""Local single-user demo server. Standard-library runtime; optional document extras."""
import argparse
import base64
import io
import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from . import __version__
from .domain import InputError
from .model import Model, ModelError
from .service import Service
from .store import Store

ROOT=Path(__file__).resolve().parents[1]
STATIC=Path(__file__).resolve().parent/'static'


def create_service(db_path=None):
    seed=json.loads((ROOT/'data/seed.json').read_text(encoding='utf-8'))
    return Service(Store(db_path or os.environ.get('AUDITFLOW_DB',str(ROOT/'var/auditflow.sqlite3')),seed),(ROOT/'data/sample.teel').read_bytes())


def report_pdf(run):
    try:
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import reportlab
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from xml.sax.saxutils import escape
    except ImportError:
        raise InputError('PDF-Export benötigt reportlab; JSON-Export ist verfügbar.') from None
    output=io.BytesIO();styles=getSampleStyleSheet();story=[]
    fonts=Path(reportlab.__file__).parent/'fonts'
    for name,file in [('AuditSans','Vera.ttf'),('AuditSansBold','VeraBd.ttf')]:
        if name not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
    for name in ['BodyText','Normal']:styles[name].fontName='AuditSans'
    for name in ['Title','Heading2','Heading3']:styles[name].fontName='AuditSansBold'
    styles['BodyText'].fontSize=9
    styles['BodyText'].leading=13
    def text(s,style='BodyText'):
        story.append(Paragraph(escape(str(s)).replace('\n','<br/>'),styles[style]));story.append(Spacer(1,8))
    text('AuditFlow / Demo assessment','Title');text(run['case_name'],'Heading2')
    for key in ['id','created_at','overall_status','ruleset','execution_mode','checker_version','input_hash']:
        text(f'{key}: {run[key]}')
    if run['error']:text('Technical error: '+run['error'])
    text('Scope and limitations','Heading2')
    for s in run['limitations']:text(s)
    text('Checks','Heading2')
    for r in run['results']:
        text(f"{r['requirement_id']} / {r['status']}",'Heading3')
        for key in ['expected','actual','note','evidence','source']:
            text(f'{key}: '+json.dumps(r.get(key),ensure_ascii=False))
    text('Expected versus actual','Heading2')
    for row in run['comparison']:text(json.dumps(row,ensure_ascii=False))
    text('Scenario snapshot','Heading2');text(json.dumps(run['snapshot'],ensure_ascii=False,indent=2))
    SimpleDocTemplate(output,title='AuditFlow demo assessment').build(story)
    return output.getvalue()


def handler_for(service):
    class Handler(BaseHTTPRequestHandler):
        server_version='AuditFlow/'+__version__
        def log_message(self,fmt,*args):
            # Do not log user input, credentials, paths with queries or source text.
            pass

        def send(self,data,status=200,mime='application/json; charset=utf-8',filename=None):
            if not isinstance(data,bytes):data=json.dumps(data,ensure_ascii=False).encode()
            self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)))
            self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'")
            if filename:self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
            self.end_headers();self.wfile.write(data)

        def authorized(self):
            token=os.environ.get('AUDITFLOW_ACCESS_TOKEN','')
            if token and not secrets.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):
                self.send({'error':'Zugriffstoken erforderlich.'},401);return False
            return True

        def do_GET(self):
            path=urlparse(self.path).path
            if path.startswith('/api/') and not self.authorized():return
            try:
                if path=='/api/state':
                    docs=service.store.list('document');reqs=service.store.list('requirement');runs=service.store.list('run')
                    return self.send({'version':__version__,'documents':docs,'requirements':reqs,'cases':service.store.list('case'),
                      'runs':list(reversed(runs)),'automation':service.automation.state(),'chain':service.store.get('meta','chain')['steps'],'model':Model().status(),'coverage':service.coverage()})
                if path=='/api/health':return self.send({'status':'ok','version':__version__,'mode':'local-demo'})
                if path=='/api/events':return self.send(service.store.events())
                if path.startswith('/api/automation/'):
                    parts=path.split('/');query=parse_qs(urlparse(self.path).query)
                    offset=int(query.get('offset',['0'])[0]);limit=int(query.get('limit',['25'])[0])
                    if offset<0 or not 1<=limit<=100:raise InputError('Ungültige Seitengröße.')
                    if parts[3]=='state':return self.send(service.automation.state())
                    if parts[3]=='cases' and len(parts)==5:return self.send(service.automation.cases(parts[4],offset,limit))
                    if parts[3]=='jobs' and len(parts)>=5:
                        id=parts[4]
                        if len(parts)==5:return self.send(service.automation.detail(id))
                        if parts[5]=='results':return self.send(service.automation.results(id,offset,limit))
                        if parts[5] in ['input','report']:
                            return self.send(service.automation.export(id,parts[5]),filename='AuditFlow-'+parts[5]+'-'+id+'.json')
                        if parts[5]=='csv':
                            import csv
                            buf=io.StringIO();w=csv.writer(buf);w.writerow(['case_id','profile_id','status','expected_message','actual_message','package_hash'])
                            for r in service.automation.export(id,'report')['results']:
                                w.writerow([r['case_id'],r['profile_id'],r['status'],r['expected']['message_present'],r['actual']['message_present'],r['package_hash']])
                            return self.send(buf.getvalue().encode('utf-8-sig'),mime='text/csv; charset=utf-8',filename='AuditFlow-'+id+'.csv')
                    return self.send({'error':'Automatik-Endpunkt nicht gefunden.'},404)
                if path.startswith('/api/runs/'):
                    parts=path.split('/');run=service.store.get('run',parts[3])
                    if len(parts)==5 and parts[4]=='pdf':return self.send(report_pdf(run),mime='application/pdf',filename='AuditFlow-'+run['id']+'.pdf')
                    return self.send(run,filename='AuditFlow-'+run['id']+'.json')
                files={'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8'),'/automation.js':('automation.js','text/javascript; charset=utf-8'),'/workspace.js':('workspace.js','text/javascript; charset=utf-8')}
                if path not in files:return self.send({'error':'Nicht gefunden.'},404)
                file,mime=files[path];return self.send((STATIC/file).read_bytes(),mime=mime)
            except KeyError:return self.send({'error':'Datensatz nicht gefunden.'},404)
            except (InputError,ValueError) as e:return self.send({'error':str(e)},422)

        def do_POST(self):
            if not self.authorized():return
            # Local UI is same-origin; reject cross-site writes and DNS-rebinding origins.
            origin=self.headers.get('Origin')
            if origin and urlparse(origin).netloc!=self.headers.get('Host'):
                return self.send({'error':'Fremde Herkunft nicht erlaubt.'},403)
            try:
                length=int(self.headers.get('Content-Length','0'))
                if length<1 or length>7_000_000:return self.send({'error':'Ungültige Anfragegröße.'},413)
                if self.headers.get_content_type()!='application/json':return self.send({'error':'JSON erwartet.'},415)
                body=json.loads(self.rfile.read(length))
                if not isinstance(body,dict):raise InputError('JSON-Objekt erwartet.')
                path=urlparse(self.path).path
                if path=='/api/assistant/explain':
                    from .assistant import explain
                    # Network inference must not hold the worker's database lock.
                    return self.send(explain(service.store,body))
                with service.store.lock:
                    if path=='/api/automation/package':result=service.automation.package_version(body)
                    elif path=='/api/automation/approve':result=service.automation.approve_package(body)
                    elif path=='/api/automation/project':result=service.automation.create_project(body)
                    elif path=='/api/automation/start':result=service.automation.launch(body)
                    elif path=='/api/automation/impact':result=service.automation.impact(body)
                    elif path=='/api/automation/rerun':result=service.automation.rerun(body)
                    elif path=='/api/automation/full-rerun':result=service.automation.full_rerun(body)
                    elif path=='/api/automation/import':result=service.automation.import_results(body)
                    elif path=='/api/automation/cancel':result=service.automation.cancel(body['job_id'])
                    elif path=='/api/automation/resume':result=service.automation.resume(body['job_id'])
                    elif path=='/api/review':result=service.approve(body['kind'],body['id'],body)
                    elif path=='/api/import':result=service.import_document(body)
                    elif path=='/api/draft':result=service.draft(body)
                    elif path=='/api/cases':result=service.create_case(body)
                    elif path=='/api/generate':result=service.generate_cases(body)
                    elif path=='/api/run':result=service.run(body)
                    elif path=='/api/diff':result=service.diff(body)
                    elif path=='/api/verify':
                        r=service.store.get('requirement',body['id']);service.verify(r);result=service.store.put('requirement',r)
                    elif path=='/api/model/test':
                        reply=Model().call('Reply only with OK.','Connection test.')
                        result={'status':'connected','model':Model().model,'reply':reply[:100]}
                    else:return self.send({'error':'Nicht gefunden.'},404)
                return self.send(result)
            except ModelError as e:return self.send({'error':str(e)},502)
            except KeyError as e:return self.send({'error':'Fehlendes Feld oder unbekannter Datensatz: '+str(e)},422)
            except (InputError,ValueError,TypeError) as e:return self.send({'error':str(e)},422)
            except Exception:
                return self.send({'error':'Verarbeitung fehlgeschlagen. Eingabedatei und Format prüfen; keine Freigabe erfolgt.'},500)
    return Handler


def main():
    p=argparse.ArgumentParser(description='AuditFlow local demo')
    p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8080);args=p.parse_args()
    if args.host not in ['127.0.0.1','localhost','::1'] and not os.environ.get('AUDITFLOW_ACCESS_TOKEN'):
        p.error('Für Netzwerkbetrieb AUDITFLOW_ACCESS_TOKEN setzen. Keine öffentliche Produktion ohne zusätzliche Absicherung.')
    service=create_service()
    service.automation.start()
    server=ThreadingHTTPServer((args.host,args.port),handler_for(service))
    server.daemon_threads=True
    print(f'AuditFlow läuft auf http://{args.host}:{args.port} — lokale Hackathon-Demo',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        service.automation.close()
        server.server_close()

if __name__=='__main__':main()
