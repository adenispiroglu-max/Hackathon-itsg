"""Demo login and manufacturer portal (synthetic demo scope).
Demo-Anmeldung – keine Sicherheitsfunktion: anyone can pick any fictional account; there is no password.
The server still returns only the chosen manufacturer's own data, so the portal never shows requirements,
AI pre-reviews, internal acceptances of unclear results, expected outcomes, other manufacturers or file contents.
"""
import re
import secrets
from .domain import InputError
from .store import now

NOTICE='Demo-Anmeldung – keine Sicherheitsfunktion. Angaben werden nicht geprüft.'
PRUEFER={'id':'pruefer','role':'pruefer','name':'ITSG-Prüfer (Demo)'}
STATUS_LABELS={'neu':'Neu','in_pruefung':'In Prüfung','freigegeben':'Freigegeben','abgelehnt':'Abgelehnt','erneut_pruefen':'Erneut prüfen'}
ACTION_LABELS={'create':'Angelegt','start':'Prüfung begonnen','approve':'Freigegeben','reject':'Abgelehnt',
               'reopen':'Prüfung wieder aufgenommen','reminder_effect':'Erneute Prüfung erforderlich'}
HINTS={'start':'Wartet auf Prüfbeginn durch ITSG','ready':'Wartet auf Entscheidung durch ITSG',
       'unclear':'Unklare Ergebnisse werden von ITSG bewertet','submissions':'Einreichungen warten auf Entscheidung durch ITSG'}
SUBMISSION_LABELS={'pending':'Wartet auf Entscheidung','approved':'Angenommen','rejected':'Abgelehnt'}
JOB_LABELS={'queued':'In Vorbereitung','running':'Wird verarbeitet','waiting_import':'Wartet auf Ihre Ergebnisse',
            'completed':'Abgeschlossen','cancelled':'Abgebrochen','failed':'Fehlgeschlagen'}


class Forbidden(Exception):
    pass


class Portal:
    def __init__(self,store,certification,automation):
        self.store=store;self.cert=certification;self.auto=automation

    # ---- accounts and sessions ---------------------------------------------------------------
    @staticmethod
    def _account(m):return {'id':'m:'+m['id'],'role':'hersteller','name':m['name'],'manufacturer_id':m['id']}

    def accounts(self):
        ms=sorted(self.store.list('manufacturer'),key=lambda m:m['name'].casefold())
        return [dict(PRUEFER)]+[self._account(m) for m in ms]

    def _resolve(self,account_id):
        if account_id==PRUEFER['id']:return dict(PRUEFER)
        if isinstance(account_id,str) and account_id.startswith('m:'):
            try:return self._account(self.store.get('manufacturer',account_id[2:]))
            except KeyError:return None
        return None

    def login(self,body):
        account=self._resolve((body or {}).get('account_id')) if isinstance(body,dict) else None
        if not account:raise InputError('Unbekanntes Demo-Konto.')
        token=secrets.token_urlsafe(32)
        self.store.put('session',{'id':token,'account_id':account['id'],'created_at':now()})
        self.store.event('portal_login',{'account_id':account['id'],'name':account['name']})
        return {'token':token,'account':account}

    # ---- self-registration --------------------------------------------------------------------
    @staticmethod
    def _field(body,name,label,limit,required=True):
        v=body.get(name);v=v.strip() if isinstance(v,str) else ''
        if required and not v:raise InputError(label+' ist erforderlich.')
        return v[:limit]

    def _software(self,items):
        if not isinstance(items,list) or not 1<=len(items)<=10:raise InputError('Mindestens eine und höchstens zehn Software-Versionen angeben.')
        out=[]
        for item in items:
            if not isinstance(item,dict):raise InputError('Ungültige Software-Angabe.')
            sw=(self._field(item,'software','Softwarename',160),self._field(item,'version','Version',160),self._field(item,'note','Beschreibung',500,False))
            if any(sw[0].casefold()==o[0].casefold() and sw[1].casefold()==o[1].casefold() for o in out):raise InputError(f'{sw[0]} {sw[1]} ist doppelt angegeben.')
            out.append(sw)
        return out

    def _register_version(self,m,software,version,note,by):
        v=self.cert._version(m,software,version,by)
        # Registration is recorded in the history with the manufacturer's own description.
        v['history'][0]['note']='Vom Hersteller zur Prüfung registriert.'+(' '+note if note else '')
        if note:v['description']=note
        self.store.put('software_version',v);return v

    def register(self,body):
        """Demo self-registration: creates the manufacturer and its software versions, then signs in."""
        if not isinstance(body,dict):raise InputError('Ungültige Anfrage.')
        company=self._field(body,'company','Firmenname',160);contact=self._field(body,'contact_name','Ansprechperson',100)
        email=self._field(body,'email','E-Mail',200,False)
        if email and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',email):raise InputError('E-Mail-Adresse ist ungültig.')
        software=self._software(body.get('software'))
        with self.store.lock:
            if self.cert._find_manufacturer(company):
                raise InputError('Dieser Hersteller ist bereits registriert. Bitte unter „Konto wählen“ anmelden.')
            m=self.cert._manufacturer(company,contact,'registration')
            m.update(contact_name=contact,email=email or None,registered_at=now());self.store.put('manufacturer',m)
            versions=[self._register_version(m,sw,ver,note,contact) for sw,ver,note in software]
            self.store.event('portal_register',{'manufacturer_id':m['id'],'name':m['name'],'contact':contact,'version_ids':[v['id'] for v in versions]})
            return self.login({'account_id':'m:'+m['id']})

    def add_software(self,account,body):
        if not isinstance(body,dict):raise InputError('Ungültige Anfrage.')
        mid=self._mid(account)
        (sw,ver,note),=self._software([body])
        with self.store.lock:
            m=self.store.get('manufacturer',mid)
            v=self._register_version(m,sw,ver,note,m.get('contact_name') or account['name'])
            self.store.event('portal_software',{'manufacturer_id':mid,'version_id':v['id']})
            return {'id':v['id'],'software':v['software'],'version':v['version'],'status':v['status']}

    def logout(self,token):
        account=self.account_for(token) if token else None
        if token:self.store.delete_many([('session',token)])
        self.store.event('portal_logout',{'account_id':account['id'] if account else None,'name':account['name'] if account else None})
        return {'ok':True}

    def account_for(self,token):
        if not isinstance(token,str) or not token:return None
        try:session=self.store.get('session',token)
        except KeyError:return None
        return self._resolve(session.get('account_id'))

    # ---- ownership ---------------------------------------------------------------------------
    @staticmethod
    def _mid(account):
        if not account or account.get('role')!='hersteller' or not account.get('manufacturer_id'):raise Forbidden('Nur für Hersteller-Konten.')
        return account['manufacturer_id']

    def _own_version(self,account,version_id):
        # Unknown ids are Forbidden too, so other manufacturers' ids cannot be probed.
        mid=self._mid(account)
        try:v=self.store.get('software_version',version_id) if isinstance(version_id,str) else None
        except KeyError:v=None
        if not v or v['manufacturer_id']!=mid:raise Forbidden('Kein Zugriff auf diese Software-Version.')
        return v

    def _own_job(self,account,job_id):
        mid=self._mid(account)
        try:job=self.store.get('auto_job',job_id) if isinstance(job_id,str) else None
        except KeyError:job=None
        if not job or job.get('mode')!='import':raise Forbidden('Kein Zugriff auf dieses Testpaket.')
        pid=job.get('project',{}).get('id')
        if not pid or not any(v.get('project_id')==pid and v['manufacturer_id']==mid for v in self.store.list('software_version')):
            raise Forbidden('Kein Zugriff auf dieses Testpaket.')
        return job

    def _own_submission(self,account,id):
        try:s=self.store.get('submission',id) if isinstance(id,str) else None
        except KeyError:s=None
        if not s:self._mid(account);raise Forbidden('Kein Zugriff auf diese Einreichung.')
        self._own_version(account,s['version_id']);return s

    # ---- overview ----------------------------------------------------------------------------
    @staticmethod
    def _missing(view,jobs=()):
        items={i['key']:i for i in view['gate']['items'] if not i['ok']};out=[]
        if 'evidence' in items:
            # Only point to the download when ITSG has actually provided a package.
            out.append('Herstellerergebnisse fehlen: Testpaket herunterladen und Ergebnisse hochladen.' if any(j['status']=='waiting_import' for j in jobs)
                       else 'Herstellerergebnisse fehlen. ITSG stellt dafür ein Testpaket bereit.')
        else:
            if 'no_failures' in items:out.append('Fehler im letzten Ergebnis: '+items['no_failures']['detail'])
            if 'unclear_accepted' in items:out.append('Unklare Ergebnisse werden von ITSG fachlich bewertet.')
        if 'submissions_decided' in items:out.append('Einreichungen warten auf Entscheidung: '+items['submissions_decided']['detail'])
        # four_eyes concerns internal reviewer names only and is never shown to the manufacturer.
        return out

    @staticmethod
    def _package(job):
        done=job['status']=='completed'
        return {'job_id':job['id'],'name':job.get('package',{}).get('name') or 'Testpaket','created_at':job['created_at'],
                'status':job['status'],'status_label':JOB_LABELS.get(job['status'],job['status']),'waiting':job['status']=='waiting_import',
                'total':job.get('total',0),'counts':{k:job['counts'].get(k,0) for k in ['pass','fail','not_assessable']} if done else None}

    def _version(self,v,ctx):
        view=self.cert.view(v,ctx);hint=view['hint']
        decisions=[{'at':h['at'],'label':ACTION_LABELS.get(h['action'],'Statusänderung'),'note':h.get('note') or '','by':h.get('reviewer')}
                   for h in view['history'] if h.get('note') and h['action']!='create']  # creating a version is no ITSG decision
        subs=[{'id':s['id'],'name':s['name'],'size':s['size'],'uploaded_at':s['uploaded_at'],'uploaded_by':s['uploaded_by'],
               'status':s['status'],'status_label':SUBMISSION_LABELS.get(s['status'],s['status']),
               'decisions':[{'at':d['at'],'label':'Angenommen' if d['approve'] else 'Abgelehnt','note':d['note']} for d in s.get('decisions',[])]}
              for s in ctx['submissions'] if s['version_id']==v['id']]
        jobs=sorted([j for j in ctx['jobs'] if v.get('project_id') and j.get('mode')=='import' and j.get('project',{}).get('id')==v['project_id']],
                    key=lambda j:j['created_at'])
        return {'id':v['id'],'software':v['software'],'version':v['version'],'description':v.get('description'),'status':view['status'],
                'status_label':STATUS_LABELS.get(view['status'],view['status']),'hint_text':HINTS.get(hint['key'],hint['text']),
                'waiting_since':view['waiting_since'],'missing':self._missing(view,jobs),'decisions':decisions,'submissions':subs,
                'packages':[self._package(j) for j in jobs]}

    def overview(self,account):
        mid=self._mid(account)
        try:m=self.store.get('manufacturer',mid)
        except KeyError:raise Forbidden('Hersteller existiert nicht mehr.') from None
        ctx=self.cert._ctx()
        versions=[self._version(v,ctx) for v in self.store.list('software_version') if v['manufacturer_id']==mid]
        return {'manufacturer':{'id':m['id'],'name':m['name']},'versions':versions,'notice':NOTICE}

    # ---- manufacturer actions ----------------------------------------------------------------
    def package_input(self,account,job_id):
        self._own_job(account,job_id);data=self.auto.export(job_id,'input')
        # ITSG's internal package approval (who approved, why) is not part of what the manufacturer receives.
        for k in ['reviewer','review_note','reviewed_at']:data.get('package',{}).pop(k,None)
        return data

    def import_results(self,account,body):
        if not isinstance(body,dict):raise InputError('Ungültige Anfrage.')
        self._own_job(account,body.get('job_id'));return self.auto.import_results(body)

    def submit(self,account,body):
        if not isinstance(body,dict):raise InputError('Ungültige Anfrage.')
        self._own_version(account,body.get('version_id'))
        return self.cert.submit({**body,'reviewer':account['name']})

    def download_submission(self,account,id):
        self._own_submission(account,id);return self.cert.download(id)
