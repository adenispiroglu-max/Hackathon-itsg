"""Certification workflow for manufacturer software versions (synthetic demo scope).
No automatic approval or revocation; test results are evidence, never a decision.
Reviewer names are self-declared, so the four-eyes rule is a process safeguard, not a security control.

Evidence mapping (see automation.py):
- A version links to an auto_project through project_id. Jobs copy that project into job['project'],
  so a job belongs to a version when job['project']['id']==version['project_id'].
- Only jobs with mode=='import' (results supplied by the manufacturer's software) and status=='completed'
  count as evidence. mode=='simulation' never counts. The latest one is the last completed import job by created_at.
- Result statuses come from auto_result records of that job: 'fail' (observed != expected) and 'not_assessable'
  (observed or expected message_present is None; cases missing from the import are stored with observed None
  and are therefore not_assessable). job['counts'] holds the totals; 'technical_error' is treated as blocking like 'fail'.
"""
import base64
import hashlib
import re
from datetime import date, timedelta
from uuid import uuid4
from .domain import InputError
from .store import now

STATUSES=['neu','in_pruefung','freigegeben','abgelehnt','erneut_pruefen']
TRANSITIONS={'start':(['neu','erneut_pruefen'],'in_pruefung'),'approve':(['in_pruefung'],'freigegeben'),
             'reject':(['in_pruefung'],'abgelehnt'),'reopen':(['abgelehnt'],'in_pruefung')}
MIME={'pdf':'application/pdf','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','txt':'text/plain; charset=utf-8'}
MAX_FILE=5_000_000
SEED=[('Lohnwerk Demo GmbH (fiktiv)',[('LohnWerk','5.2'),('LohnWerk','6.0')]),
      ('Gehaltsbüro Nord (fiktiv)',[('Nordlohn','2026.1')]),
      ('Beispiel Software AG (fiktiv)',[('PayDemo','1.4'),('PayDemo Cloud','1.0')])]


def key(s):return re.sub(r'\s+',' ',s).strip().casefold()


def text(body,field,label,limit=160):
    v=body.get(field)
    if not isinstance(v,str) or not v.strip():raise InputError(label+' ist erforderlich.')
    return v.strip()[:limit]


def iso_date(value,label='Datum'):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):raise InputError(label+' muss YYYY-MM-DD sein.')
    try:return date.fromisoformat(value)
    except ValueError:raise InputError('Ungültiges Kalenderdatum: '+value) from None


def plural(n,one,many):return f'{n} {one if n==1 else many}'


class Certification:
    def __init__(self,store,today=None):
        self.store=store;self.today=today or date.today
        with store.lock:
            fresh=not store.list('manufacturer') and not store.list('software_version') and not store.list('reminder') \
                and not store.list('auto_project') and all(e['action']=='seed' for e in store.events())
            meta=self._meta()
            if fresh and not meta.get('demo_seeded'):self._seed()
            meta=self._meta();meta['demo_seeded']=True;store.put('meta',meta)
            self.migrate()

    def _meta(self):
        try:return self.store.get('meta','certification')
        except KeyError:return {'id':'certification'}

    # ---- setup -------------------------------------------------------------------------------
    def _seed(self):
        # Clearly fictional demo data: all versions 'neu', no approvals, no real law dates.
        for name,versions in SEED:
            m=self._manufacturer(name,'Demo-Seed','synthetic_demo')
            for software,version in versions:self._version(m,software,version,'Demo-Seed')
        r={'id':str(uuid4()),'title':'Synthetische Demo-Erinnerung: Regelpaket-Aktualisierung (fiktiv)',
           'effective_date':str(self.today()+timedelta(days=40)),'source':{'type':'manual','note':'Synthetische Demo-Erinnerung'},
           'created_by':'Demo-Seed','created_at':now(),'affected':None,'changes':[],'scope':'synthetic_demo'}
        self.store.put('reminder',r);self.store.event('cert_demo_seed',{'note':'Fiktive Hersteller; keine Freigaben.','reminder':r['id']})

    def migrate(self):
        """Idempotent: every auto_project without a linked version becomes a 'neu' version. Nothing is approved."""
        with self.store.lock:
            linked={v['project_id'] for v in self.store.list('software_version') if v.get('project_id')}
            for p in self.store.list('auto_project'):
                if p['id'] in linked:continue
                m=self._find_manufacturer(p['manufacturer']) or self._manufacturer(p['manufacturer'],'Migration',p.get('scope','synthetic_demo'))
                v=self._version(m,p['software'],p['software_version'],'Migration',project_id=p['id'],check=False)
                self.store.event('cert_migration',{'project_id':p['id'],'version_id':v['id']})

    def _derive_reminders(self):
        # One reminder per source document with an ISO valid_from date, idempotent by document id.
        with self.store.lock:
            existing={r['source'].get('document_id') for r in self.store.list('reminder') if r['source']['type']=='document'}
            for d in self.store.list('document'):
                if d['id'] in existing or not d.get('valid_from'):continue
                try:eff=iso_date(d['valid_from'])
                except InputError:continue
                r={'id':'doc:'+d['id'],'title':f"{d['name']} {d.get('version') or ''} gültig ab {eff.strftime('%d.%m.%Y')}".replace('  ',' '),
                   'effective_date':str(eff),'source':{'type':'document','document_id':d['id'],'note':'Abgeleitet aus valid_from des Quelldokuments.'},
                   'created_by':'Ableitung aus Quelldokument','created_at':now(),'affected':None,'changes':[]}
                self.store.put('reminder',r);self.store.event('cert_reminder_derived',{'id':r['id'],'document_id':d['id']})

    # ---- manufacturers and versions ----------------------------------------------------------
    def _find_manufacturer(self,name):
        return next((m for m in self.store.list('manufacturer') if key(m['name'])==key(name)),None)

    def _manufacturer(self,name,by,scope='user'):
        m={'id':str(uuid4()),'name':re.sub(r'\s+',' ',name).strip()[:160],'created_at':now(),'created_by':by,'scope':scope}
        self.store.put('manufacturer',m);self.store.event('cert_manufacturer',{'id':m['id'],'name':m['name'],'by':by});return m

    def _version(self,m,software,version,by,project_id=None,check=True):
        if check and any(v['manufacturer_id']==m['id'] and key(v['software'])==key(software) and key(v['version'])==key(version) for v in self.store.list('software_version')):
            raise InputError('Diese Software-Version ist für den Hersteller bereits angelegt.')
        if project_id is None:
            # Each version gets its own automation project so test packages and imports link to it.
            project_id=str(uuid4())
            self.store.put('auto_project',{'id':project_id,'manufacturer':m['name'],'software':software,'software_version':version,
                           'created_at':now(),'scope':'synthetic_demo','auto_on_rule_change':False})
        v={'id':str(uuid4()),'manufacturer_id':m['id'],'software':software.strip()[:160],'version':version.strip()[:160],'status':'neu',
           'project_id':project_id,'history':[{'at':now(),'action':'create','from':None,'to':'neu','reviewer':by,'note':'Angelegt.'}],
           'acceptances':{},'created_at':now(),'created_by':by}
        self.store.put('software_version',v);self.store.event('cert_version',{'id':v['id'],'manufacturer_id':m['id'],'project_id':project_id,'by':by})
        return v

    def create_version(self,body):
        reviewer=text(body,'reviewer','Prüfername',100);software=text(body,'software','Software');version=text(body,'version','Version')
        with self.store.lock:
            if body.get('manufacturer_id'):m=self.store.get('manufacturer',body['manufacturer_id'])
            else:
                name=text(body,'manufacturer_name','Hersteller')
                m=self._find_manufacturer(name) or self._manufacturer(name,reviewer)
            v=self._version(m,software,version,reviewer)
            return self.view(v)

    # ---- evidence and gate -------------------------------------------------------------------
    def _jobs(self,v,jobs=None):
        jobs=self.store.list('auto_job') if jobs is None else jobs
        own=[j for j in jobs if v.get('project_id') and j.get('project',{}).get('id')==v['project_id']]
        imports=sorted([j for j in own if j['mode']=='import' and j['status']=='completed'],key=lambda j:j['created_at'])
        return imports[-1] if imports else None,[j for j in own if j['mode']=='simulation']

    def _recheck(self,v,reminders):
        """Reminder that turns a stored approval into erneut_pruefen, if any (spec 3.4)."""
        if v['status']!='freigegeben':return None
        approved=max((h.get('on',h['at'][:10]) for h in v['history'] if h['action']=='approve'),default='')
        today=str(self.today());hits=[r for r in reminders if r.get('affected') and v['id'] in r['affected']['version_ids']
                                      and r['effective_date']<=today and approved<r['effective_date']]
        return max(hits,key=lambda r:r['effective_date']) if hits else None

    def gate(self,v,approver=None,jobs=None,submissions=None):
        latest,_=self._jobs(v,jobs)
        subs=[s for s in (self.store.list('submission') if submissions is None else submissions) if s['version_id']==v['id']]
        pending=sum(s['status']=='pending' for s in subs)
        acc=v['acceptances'].get(latest['id'],{}) if latest else {}
        unclear=latest['counts']['not_assessable'] if latest else 0
        fails=(latest['counts']['fail']+latest['counts'].get('technical_error',0)) if latest else 0
        names=sorted({a['reviewer'] for a in acc.values()},key=str.casefold)
        clash=approver is not None and any(key(n)==key(approver) for n in names)
        items=[{'key':'evidence','label':'Herstellerergebnisse vorhanden (Import)','ok':latest is not None,
                'detail':f"Letzter abgeschlossener Importlauf vom {latest['created_at'][:10]}." if latest else 'Kein abgeschlossener Importlauf. Simulationen zählen nicht.'},
               {'key':'no_failures','label':'Keine Fehler im letzten Ergebnis','ok':latest is not None and fails==0,
                'detail':'Kein Importlauf.' if not latest else plural(fails,'Fehler','Fehler')+' im letzten Importlauf.'},
               {'key':'unclear_accepted','label':'Unklare Ergebnisse fachlich akzeptiert','ok':latest is not None and len(acc)>=unclear,
                'detail':'Kein Importlauf.' if not latest else f'{len(acc)} von {unclear} akzeptiert.'},
               {'key':'submissions_decided','label':'Einreichungen entschieden','ok':pending==0,
                'detail':plural(pending,'Einreichung','Einreichungen')+' offen.' if pending else 'Keine offenen Einreichungen.'},
               {'key':'four_eyes','label':'Vier-Augen-Prinzip','ok':not clash,
                'detail':('Freigebende Person hat selbst unklare Ergebnisse akzeptiert.' if clash else
                          'Freigabe nicht durch: '+', '.join(names)+'.' if names else 'Keine Akzeptanzen; keine Einschränkung.')
                         +' Namen sind selbst angegeben (Prozessschutz, keine Sicherheitskontrolle).'}]
        return {'ok':all(i['ok'] for i in items),'items':items}

    def view(self,v,ctx=None):
        ctx=ctx or self._ctx()
        latest,sims=self._jobs(v,ctx['jobs'])
        recheck=self._recheck(v,ctx['reminders'])
        status='erneut_pruefen' if recheck else v['status']
        gate=self.gate(v,None,ctx['jobs'],ctx['submissions'])
        pending=sum(s['version_id']==v['id'] and s['status']=='pending' for s in ctx['submissions'])
        acc=v['acceptances'].get(latest['id'],{}) if latest else {}
        unclear=latest['counts']['not_assessable'] if latest else 0
        fails=(latest['counts']['fail']+latest['counts'].get('technical_error',0)) if latest else 0
        history=list(v['history']);waiting=history[-1]['at'] if history else v['created_at']
        if recheck:
            approved=max(h.get('on',h['at'][:10]) for h in history if h['action']=='approve')
            history.append({'at':recheck['effective_date'],'action':'reminder_effect','from':'freigegeben','to':'erneut_pruefen','reviewer':None,'ref':recheck['id'],
                            'note':f"Freigegeben am {approved[:10]} · betroffen von Erinnerung „{recheck['title']}“ ab {recheck['effective_date']}",'derived':True})
            waiting=max(waiting,recheck['effective_date'])
        if status=='freigegeben':hint=('approved','Freigegeben')
        elif status=='abgelehnt':hint=('rejected','Abgelehnt')
        elif not latest:hint=('waiting_results','Wartet auf Herstellerergebnisse')
        elif fails:hint=('failures',plural(fails,'Fehler','Fehler')+' im letzten Ergebnis')
        elif len(acc)<unclear:n=unclear-len(acc);hint=('unclear',plural(n,'unklares Ergebnis','unklare Ergebnisse'))
        elif pending:hint=('submissions',plural(pending,'Einreichung','Einreichungen')+' offen')
        elif status=='erneut_pruefen':hint=('recheck','Erneut prüfen: '+recheck['title'])
        elif status=='neu':hint=('start','Prüfung starten')
        else:hint=('ready','Bereit zur Freigabe')
        m=ctx['manufacturers'].get(v['manufacturer_id'],{})
        return {'id':v['id'],'manufacturer_id':v['manufacturer_id'],'manufacturer_name':m.get('name',''),'software':v['software'],'version':v['version'],
                'status':status,'stored_status':v['status'],'project_id':v.get('project_id'),'created_at':v['created_at'],'waiting_since':waiting,
                'history':history,'gate':gate,
                'evidence':{'latest_import_job':{'id':latest['id'],'status':latest['status'],'created_at':latest['created_at'],
                                                 'counts':{k:latest['counts'].get(k,0) for k in ['pass','fail','not_assessable']}} if latest else None,
                            'unclear_total':unclear,'unclear_accepted':len(acc),'simulation_jobs':len(sims)},
                'hint':{'key':hint[0],'text':hint[1]},'submissions_pending':pending,
                'recheck':{'reminder_id':recheck['id'],'title':recheck['title'],'effective_date':recheck['effective_date']} if recheck else None}

    def _ctx(self):
        return {'jobs':self.store.list('auto_job'),'reminders':self.store.list('reminder'),'submissions':self.store.list('submission'),
                'manufacturers':{m['id']:m for m in self.store.list('manufacturer')}}

    # ---- transitions and acceptances ---------------------------------------------------------
    def transition(self,body):
        action=body.get('action')
        if action not in TRANSITIONS:raise InputError('Unbekannte Aktion. Erlaubt: start, approve, reject, reopen.')
        reviewer=text(body,'reviewer','Prüfername',100);note=text(body,'note','Begründung',2000)
        with self.store.lock:
            v=self.store.get('software_version',body['version_id']);current=self.view(v)
            allowed,target=TRANSITIONS[action]
            if current['status'] not in allowed:raise InputError(f"Aktion nicht erlaubt im Status {current['status']}.")
            # 'on' is the server date (injectable) used by every date rule; 'at' is the UTC timestamp.
            entry={'at':now(),'on':str(self.today()),'action':action,'from':current['status'],'to':target,'reviewer':reviewer,'note':note}
            if current['recheck']:entry['ref']=current['recheck']['reminder_id']
            if action=='approve':
                gate=self.gate(v,reviewer)
                blocking=[i for i in gate['items'] if not i['ok']]
                if blocking:raise InputError('Freigabe nicht möglich: '+'; '.join(i['label']+' ('+i['detail'].split(' Namen sind')[0]+')' for i in blocking))
                latest,_=self._jobs(v);entry['ref']=latest['id']
            v['status']=target;v['history'].append(entry);self.store.put('software_version',v)
            self.store.event('cert_transition',{'version_id':v['id'],'action':action,'from':entry['from'],'to':target,'reviewer':reviewer,'note':note,'ref':entry.get('ref')})
            return self.view(v)

    def accept(self,body):
        reviewer=text(body,'reviewer','Prüfername',100);note=text(body,'note','Begründung',2000)
        with self.store.lock:
            v=self.store.get('software_version',body['version_id'])
            if self.view(v)['status'] not in ['neu','in_pruefung','erneut_pruefen']:raise InputError('Akzeptanz nur vor der Entscheidung möglich.')
            latest,_=self._jobs(v)
            if not latest or latest['id']!=body.get('job_id'):raise InputError('Akzeptanz nur für den letzten abgeschlossenen Importlauf der Version.')
            case_id=body.get('case_id')
            try:result=self.store.get('auto_result',latest['id']+':'+str(case_id))
            except KeyError:raise InputError('Ergebnis nicht im Importlauf gefunden.') from None
            if result['status']!='not_assessable':raise InputError('Nur unklare Ergebnisse (nicht bewertbar) können akzeptiert werden.')
            acc=v['acceptances'].setdefault(latest['id'],{})
            if case_id in acc:raise InputError('Ergebnis ist bereits akzeptiert.')
            acc[case_id]={'reviewer':reviewer,'note':note,'at':now()}
            self.store.put('software_version',v)
            self.store.event('cert_accept',{'version_id':v['id'],'job_id':latest['id'],'case_id':case_id,'reviewer':reviewer,'note':note})
            return {'ok':True}

    def detail(self,id,offset=0,limit=50):
        if type(offset) is not int or offset<0 or type(limit) is not int or not 1<=limit<=500:raise InputError('Ungültige Seitengröße.')
        v=self.store.get('software_version',id);latest,sims=self._jobs(v)
        rows=[r for r in self.store.filtered('auto_result','job_id',latest['id']) if r['status']=='not_assessable'] if latest else []
        acc=v['acceptances'].get(latest['id'],{}) if latest else {}
        def summary(r):
            why='keine Beobachtung geliefert' if r['actual'].get('message_present') is None else 'Erwartung offen'
            return (r.get('case_name') or r['case_id'])+' · '+why
        return {'version':self.view(v),'unclear_total':len(rows),
                'unclear':[{'job_id':r['job_id'],'case_id':r['case_id'],'summary':summary(r),'accepted':acc.get(r['case_id'])} for r in rows[offset:offset+limit]],
                'simulation_jobs':[{'id':j['id'],'status':j['status'],'created_at':j['created_at']} for j in sims]}

    # ---- submissions -------------------------------------------------------------------------
    @staticmethod
    def meta(s):return {k:v for k,v in s.items() if k!='data_base64'}

    def submit(self,body):
        reviewer=text(body,'reviewer','Prüfername',100);name=text(body,'name','Dateiname',200)
        suffix=name.lower().rsplit('.',1)[-1] if '.' in name else ''
        if suffix not in MIME:raise InputError('Erlaubt sind PDF, DOCX oder TXT.')
        try:raw=base64.b64decode(body.get('base64') or '',validate=True)
        except (ValueError,TypeError):raise InputError('Ungültiger Datei-Upload.') from None
        if not raw:raise InputError('Datei ist leer.')
        if len(raw)>MAX_FILE:raise InputError('Maximal 5 MB je Einreichung.')
        with self.store.lock:
            v=self.store.get('software_version',body['version_id'])
            s={'id':str(uuid4()),'version_id':v['id'],'name':name,'mime':MIME[suffix],'size':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
               'data_base64':base64.b64encode(raw).decode(),'status':'pending','uploaded_by':reviewer,'uploaded_at':now(),'decisions':[]}
            self.store.put('submission',s)
            self.store.event('cert_submission',{'id':s['id'],'version_id':v['id'],'name':name,'sha256':s['sha256'],'size':s['size'],'by':reviewer})
            return self.meta(s)

    def review_submission(self,body):
        if type(body.get('approve')) is not bool:raise InputError('approve muss true oder false sein.')
        reviewer=text(body,'reviewer','Prüfername',100);note=text(body,'note','Begründung',2000)
        with self.store.lock:
            s=self.store.get('submission',body['id'])
            s['status']='approved' if body['approve'] else 'rejected'
            s['decisions'].append({'at':now(),'approve':body['approve'],'reviewer':reviewer,'note':note})
            self.store.put('submission',s)
            self.store.event('cert_submission_review',{'id':s['id'],'approve':body['approve'],'reviewer':reviewer,'note':note})
            return self.meta(s)

    def download(self,id):
        s=self.store.get('submission',id);return base64.b64decode(s['data_base64']),s['mime'],s['name']

    # ---- reminders ---------------------------------------------------------------------------
    def create_reminder(self,body):
        reviewer=text(body,'reviewer','Prüfername',100);title=text(body,'title','Titel',200)
        eff=iso_date(body.get('effective_date'),'Wirksamkeitsdatum');source=text(body,'source_note','Quellenangabe',1000)
        r={'id':str(uuid4()),'title':title,'effective_date':str(eff),'source':{'type':'manual','note':source},
           'created_by':reviewer,'created_at':now(),'affected':None,'changes':[]}
        with self.store.lock:
            self.store.put('reminder',r);self.store.event('cert_reminder',{'id':r['id'],'effective_date':r['effective_date'],'source':source,'by':reviewer})
        return self.reminder_view(r)

    def set_affected(self,body):
        reviewer=text(body,'reviewer','Prüfername',100);note=text(body,'note','Begründung',2000);ids=body.get('version_ids')
        if not isinstance(ids,list) or any(not isinstance(i,str) for i in ids):raise InputError('version_ids muss eine Liste sein.')
        ids=list(dict.fromkeys(ids))
        with self.store.lock:
            r=self.store.get('reminder',body['reminder_id'])
            known={v['id'] for v in self.store.list('software_version')}
            if any(i not in known for i in ids):raise InputError('Unbekannte Software-Version in der Auswahl.')
            at=now();first=r['affected'] is None
            r['affected']={'version_ids':ids,'confirmed_by':reviewer if first else r['affected']['confirmed_by'],
                           'confirmed_at':at if first else r['affected']['confirmed_at'],'note':note}
            r['changes'].append({'at':at,'reviewer':reviewer,'note':note,'version_ids':ids})
            self.store.put('reminder',r);self.store.event('cert_reminder_affected',{'id':r['id'],'version_ids':ids,'reviewer':reviewer,'note':note})
            return self.reminder_view(r)

    def reminder_view(self,r,versions=None):
        today=self.today();eff=date.fromisoformat(r['effective_date']);days=(eff-today).days
        if days<=0:
            if r['affected'] is None:state='unconfirmed'
            else:
                versions=versions if versions is not None else {v['id']:v for v in self.store.list('software_version')}
                # Re-approved (or decided) on or after the effective date resolves the reminder for a version.
                open_=[i for i in r['affected']['version_ids'] if i in versions and not any(
                    h['action'] in ['approve','reject'] and h.get('on',h['at'][:10])>=r['effective_date'] for h in versions[i]['history'])]
                state='overdue' if open_ else 'done'
        elif r['affected'] is None and days<=90:state='unconfirmed'
        elif days<=14:state='soon'
        else:state='upcoming'  # beyond 90 days too; callers filter on days_until
        return {**r,'state':state,'days_until':days}

    # ---- state -------------------------------------------------------------------------------
    def state(self):
        self.migrate();self._derive_reminders()
        ctx=self._ctx();raw=self.store.list('software_version');versions={v['id']:v for v in raw}
        pending={}
        for q in self.store.list('requirement'):
            if q.get('status')=='pending':pending[q.get('source_id')]=pending.get(q.get('source_id'),0)+1
        docs=[{'document_id':d['id'],'name':d['name'],'version':d.get('version'),'pending':pending[d['id']]}
              for d in self.store.list('document') if pending.get(d['id'])]
        return {'today':str(self.today()),'manufacturers':list(ctx['manufacturers'].values()),
                'versions':[self.view(v,ctx) for v in raw],'submissions':[self.meta(s) for s in ctx['submissions']],
                'reminders':[self.reminder_view(r,versions) for r in ctx['reminders']],'documents_pending':docs}
