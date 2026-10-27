"""Anforderungsversionen, KI-Vorprüfung, Freigabegültigkeit und Daten für „Ergebnisse & Abdeckung“.
Die KI empfiehlt nur; jede fachliche Freigabe trifft ein Mensch. Ohne Modell gibt es keine Ersatzempfehlung.
Eine Anforderungsversion verweist immer auf genau eine Quell-Dokumentversion (2026/2027 nie vermischt).
"""
import copy
import re
import threading
from datetime import date
from uuid import uuid4
from .domain import InputError
from .model import Model, ModelError, REVIEW_PROMPT_VERSION
from .store import now

FIELDS=['title','criterion','conditions','exceptions','questions','source_id','section_id','source_excerpt','citation_status']
EDITABLE=['title','criterion','conditions','exceptions','questions','source_excerpt']
LABELS={'freigabe_empfohlen':'Freigabe empfohlen','ueberarbeitung_empfohlen':'Überarbeitung empfohlen','klaerung_erforderlich':'Fachliche Klärung erforderlich'}
FLAG_TEXT='Quelle geändert – Prüfung nötig'
NO_MODEL='KI-Vorprüfung nicht verfügbar (kein Modell verbunden)'


def normalize(s):
    return re.sub(r'\s+',' ',re.sub(r'-\s*\n\s*','',s or '')).strip()


def _thread(fn):
    threading.Thread(target=fn,daemon=True).start()


def _day(today):
    return str(today or date.today())[:10]


class Review:
    def __init__(self,store,model_factory=Model,runner=None):
        self.store=store;self.model_factory=model_factory;self.runner=runner or _thread

    # --- Hilfen ---
    def _doc(self,id):
        try:return self.store.get('document',id)
        except KeyError:return None

    def _text(self,doc):
        if not doc:return ''
        parts=doc.get('sections') or doc.get('paragraphs') or []
        return '\n\n'.join(p.get('text','') for p in parts)

    def _locate(self,doc,excerpt):
        ex=normalize(excerpt)
        return next((s['id'] for s in (doc or {}).get('sections',[]) if ex and ex in normalize(s['text'])),None)

    def _verify(self,req):
        doc=self._doc(req.get('source_id'))
        sec=next((x for x in (doc or {}).get('sections',[]) if x['id']==req.get('section_id')),None)
        ex=normalize(req.get('source_excerpt'))
        req['citation_status']='verified' if sec and ex and ex in normalize(sec['text']) else 'mismatch'
        return req

    def _vid(self,req_id,n):
        return f'{req_id}@v{n}'

    def _version(self,req_id,n):
        try:return self.store.get('requirement_version',self._vid(req_id,n))
        except KeyError:return None

    def _configured(self,model):
        return bool(getattr(model,'key',True))

    def _snapshot(self,req,origin,change_reason=None,approval=None,diff_id=None):
        v={'id':self._vid(req['id'],req['version_no']),'requirement_id':req['id'],'version_no':req['version_no'],
           **{k:copy.deepcopy(req.get(k,[] if k in ['conditions','exceptions','questions'] else None)) for k in FIELDS},
           'origin':origin,'change_reason':change_reason,'ai_review':None,'approval':approval,'diff_id':diff_id,'created_at':now()}
        return self.store.put('requirement_version',v)

    def _ensure(self,req):
        """Legt fehlende Versionsfelder an (Migration einzelner Anforderung)."""
        if req.get('version_no'):return req
        req.update(version_no=1,approved_version_no=1 if req.get('status')=='approved' else None,
                   source_version_id=req.get('source_id'),ai_review=None,change_flag=None,approval_invalid=None)
        for k in ['conditions','exceptions','questions']:req.setdefault(k,[])
        approval=None
        if req.get('status') in ['approved','rejected'] and req.get('reviewer'):
            approval={'decision':'freigegeben' if req['status']=='approved' else 'abgelehnt','reviewer':req['reviewer'],
                      'note':req.get('review_note',''),'against_ai':False,'decided_at':req.get('reviewed_at')}
        if not self._version(req['id'],1):self._snapshot(req,'migration',approval=approval)
        self.store.put('requirement',req)
        return req

    def _req(self,id):
        try:return self._ensure(self.store.get('requirement',id))
        except KeyError:raise InputError('Anforderung nicht gefunden.') from None

    def _diff(self,id):
        try:return self.store.get('document_diff',id)
        except KeyError:raise InputError('Vergleich nicht gefunden.') from None

    # --- Migration ---
    def migrate(self):
        """Idempotent. Bewusst ohne Ereignis: certification.py erkennt eine frische DB an reinen 'seed'-Ereignissen."""
        changed=0
        for req in self.store.list('requirement'):
            if not req.get('version_no'):self._ensure(req);changed+=1
        reqs={r['id']:r for r in self.store.list('requirement')}
        for case in self.store.list('case'):
            if 'requirement_versions' in case:continue
            case['requirement_versions']={id:reqs[id]['version_no'] for id in case.get('requirement_ids',[]) if id in reqs}
            case.setdefault('expectation_edited',False);case.setdefault('outdated',None);case.setdefault('regenerated_from',None)
            self.store.put('case',case);changed+=1
        return changed

    def register(self,req_id,origin='ki_entwurf'):
        """Für neu entworfene Anforderungen (Service.draft): Version 1 mit Herkunft anlegen und vorprüfen."""
        req=self.store.get('requirement',req_id)
        if req.get('version_no'):return req
        req.update(version_no=1,approved_version_no=None,source_version_id=req.get('source_id'),ai_review=None,change_flag=None,approval_invalid=None)
        for k in ['conditions','exceptions','questions']:req.setdefault(k,[])
        self.store.put('requirement',req);self._snapshot(req,origin)
        self.store.event('requirement_version_created',{'id':req_id,'version_no':1,'origin':origin})
        return self.schedule_prereview(req_id)

    # --- Gültigkeit ---
    def _superseded_by(self,doc,today):
        if not doc or not doc.get('library_id'):return None
        later=[d for d in self.store.list('document') if d.get('library_id')==doc['library_id'] and (d.get('version_no') or 0)>(doc.get('version_no') or 0)
               and not d.get('withdrawn') and (not d.get('valid_from') or str(d['valid_from'])[:10]<=today)]
        return max(later,key=lambda d:d['version_no']) if later else None

    def _cited_changed(self,req_id,old,new):
        for diff in self.store.list('document_diff'):
            if diff.get('library_id')!=old.get('library_id'):continue
            a,b=self._doc(diff.get('old_version_id')),self._doc(diff.get('new_version_id'))
            if not a or not b or a.get('version_no',0)<old.get('version_no',0) or b.get('version_no',0)>new.get('version_no',0):continue
            ids=(diff.get('affected_changes') or {}).get(req_id)
            if ids is None and req_id in diff.get('affected_requirement_ids',[]):return True
            if any(c['id'] in (ids or []) and c.get('classification') in ['fachlich','offen'] for c in diff.get('changes',[])):return True
        return False

    def _invalidity(self,req,today=None):
        today=_day(today)
        if req.get('approved_version_no') is None:return None
        v=self._version(req['id'],req['approved_version_no']);doc=self._doc((v or req).get('source_id'))
        if not doc:return None
        if doc.get('valid_until') and str(doc['valid_until'])[:10]<today:
            return {'reason':'abgelaufen','text':'Freigabe nicht mehr gültig: Gültigkeit der Quelle abgelaufen ('+str(doc['valid_until'])[:10]+')','since':str(doc['valid_until'])[:10]}
        new=self._superseded_by(doc,today)
        if new and self._cited_changed(req['id'],doc,new):
            return {'reason':'quelle_ersetzt','text':'Freigabe nicht mehr gültig: Quelle ersetzt durch Version '+str(new.get('version_label') or new.get('version')),
                    'since':str(new.get('valid_from') or new.get('uploaded_at') or today)[:10]}
        return None

    def effective(self,req,today=None):
        req=self._ensure(req)
        return req.get('approved_version_no') is not None and self._invalidity(req,today) is None

    def refresh_validity(self,today=None):
        changed=[]
        for req in self.store.list('requirement'):
            req=self._ensure(req);inv=self._invalidity(req,today);old=req.get('approval_invalid')
            if (inv or {}).get('reason')==(old or {}).get('reason') and (inv or {}).get('text')==(old or {}).get('text'):continue
            req['approval_invalid']=inv;self.store.put('requirement',req);changed.append(req['id'])
            self.store.event('approval_validity',{'id':req['id'],'approved_version_no':req['approved_version_no'],'invalid':inv})
        return changed

    # --- Versionen ---
    def new_version(self,req_id,fields,origin,change_reason=None,diff_id=None,prereview=True):
        with self.store.lock:
            req=self._req(req_id)
            for k,v in fields.items():
                if k in FIELDS and k!='citation_status':req[k]=copy.deepcopy(v)
            req['source_version_id']=req['source_id']
            req.update(version_no=req['version_no']+1,status='pending',semantic_review='pending',ai_review=None)
            self._verify(req);self.store.put('requirement',req);self._snapshot(req,origin,change_reason,diff_id=diff_id)
            self.store.event('requirement_version_created',{'id':req_id,'version_no':req['version_no'],'origin':origin,'reason':change_reason,
                                                            'source_id':req['source_id'],'diff_id':diff_id})
        self.mark_outdated_cases(req_id)
        if prereview:self.schedule_prereview(req_id)
        return self.store.get('requirement',req_id)

    def edit(self,body):
        req=self._req(body.get('id'));reason=str(body.get('reason') or '').strip()
        if not reason:raise InputError('Änderungsgrund ist erforderlich.')
        fields={}
        for k in EDITABLE:
            if k not in body:continue
            v=body[k]
            if k in ['conditions','exceptions','questions']:
                if not isinstance(v,list) or not all(isinstance(s,str) for s in v):raise InputError('Bedingungen, Ausnahmen und Fragen müssen Textlisten sein.')
                v=[s.strip() for s in v if s.strip()]
            else:
                if not isinstance(v,str) or not v.strip() or len(v)>12000:raise InputError('Titel, Kriterium und Quellenzitat dürfen nicht leer sein.')
                v=v.strip()
            if v!=req.get(k):fields[k]=v
        source=body.get('source_id')
        if source is None and req.get('change_flag') and req['change_flag'].get('diff_id'):
            try:source=self.store.get('document_diff',req['change_flag']['diff_id'])['new_version_id']
            except KeyError:source=None
        if source and source!=req['source_id']:
            doc=self._doc(source)
            if not doc:raise InputError('Quellversion nicht gefunden.')
            fields['source_id']=source
            fields['section_id']=body.get('section_id') or self._locate(doc,fields.get('source_excerpt',req['source_excerpt'])) or req['section_id']
        elif body.get('section_id') and body['section_id']!=req['section_id']:fields['section_id']=body['section_id']
        if not fields:raise InputError('Keine Änderung erkannt.')
        return self.new_version(req['id'],fields,'manuell',reason)

    def accept_suggestion(self,body):
        req=self._req(body.get('id'));sc=(req.get('ai_review') or {}).get('suggested_change')
        if not sc:raise InputError('Kein Änderungsvorschlag der KI vorhanden.')
        if normalize(sc.get('before'))!=normalize(req.get('criterion')):raise InputError('Vorschlag passt nicht mehr zur aktuellen Version.')
        who=str(body.get('reviewer') or '').strip()
        return self.new_version(req['id'],{'criterion':sc['after']},'ki_entwurf','KI-Änderungsvorschlag übernommen'+(' von '+who if who else ''))

    # --- KI-Vorprüfung ---
    def _write_review(self,req_id,n,review):
        with self.store.lock:
            v=self._version(req_id,n)
            if v:v['ai_review']=review;self.store.put('requirement_version',v)
            req=self.store.get('requirement',req_id)
            if req.get('version_no')==n:req['ai_review']=review;self.store.put('requirement',req)
        if review['status']!='läuft':
            self.store.event('prereview',{'id':req_id,'version_no':n,'status':review['status'],'recommendation':review.get('recommendation'),
                                          'rejected_marks':review.get('rejected_marks',0)})
        return self.store.get('requirement',req_id)

    def prereview(self,req_id):
        req=self._req(req_id);n=req['version_no'];base={'created_at':now(),'prompt_version':REVIEW_PROMPT_VERSION}
        model=self.model_factory();base['model']=getattr(model,'model',None)
        if not self._configured(model):return self._write_review(req_id,n,{**base,'status':'nicht_verfügbar','error':NO_MODEL})
        doc=self._doc(req.get('source_id'));source=self._text(doc)[:30000]
        approved=self._version(req_id,req['approved_version_no']) if req.get('approved_version_no') not in [None,n] else None
        related=[r for r in self.store.list('requirement') if r['id']!=req_id and r.get('source_id')==req.get('source_id')][:10]
        try:raw=model.prereview(req,source,approved,related)
        except ModelError as e:return self._write_review(req_id,n,{**base,'status':'fehler','error':str(e)})
        full=normalize(self._text(doc));rejected=0;marks={'source':[],'requirement':[]}
        info={'document_id':req.get('source_id'),'document_name':(doc or {}).get('name'),'version_label':(doc or {}).get('version_label') or (doc or {}).get('version')}
        for m in (raw.get('marks') or {}).get('source',[]):
            ex=normalize(m.get('excerpt'))
            if ex and ex in full:marks['source'].append({'document_id':info['document_id'],'location':m.get('location',''),'excerpt':m['excerpt']})
            else:rejected+=1
        for m in (raw.get('marks') or {}).get('requirement',[]):
            value=req.get(m.get('field'));value=' '.join(value) if isinstance(value,list) else value
            if m.get('field') in EDITABLE+['source_excerpt'] and isinstance(value,str) and normalize(m.get('text')) and normalize(m['text']) in normalize(value):
                marks['requirement'].append({'field':m['field'],'text':m['text']})
            else:rejected+=1
        ev=raw.get('evidence')
        if ev and not (normalize(ev.get('excerpt')) and normalize(ev['excerpt']) in full):ev=None;rejected+=1
        sc=raw.get('suggested_change')
        sc={'field':'criterion','before':req['criterion'],'after':sc['after']} if sc and normalize(sc['after'])!=normalize(req['criterion']) else None
        review={**base,'status':'fertig','recommendation':raw['recommendation'],'recommendation_label':LABELS[raw['recommendation']],
                'criteria':raw['criteria'],'reasoning':raw['reasoning'],'evidence':ev and {**info,'location':ev.get('location',''),'excerpt':ev['excerpt']},
                'marks':marks,'rejected_marks':rejected,'suggested_change':sc,'open_question':raw.get('open_question')}
        return self._write_review(req_id,n,review)

    def schedule_prereview(self,req_id):
        req=self._req(req_id);n=req['version_no']
        self._write_review(req_id,n,{'status':'läuft','created_at':now(),'prompt_version':REVIEW_PROMPT_VERSION})
        def work():
            try:self.prereview(req_id)
            except Exception as e:  # Hintergrundarbeit darf nie still hängen bleiben.
                try:self._write_review(req_id,n,{'status':'fehler','error':'KI-Vorprüfung fehlgeschlagen: '+(str(e)[:300] or type(e).__name__),
                                                  'created_at':now(),'prompt_version':REVIEW_PROMPT_VERSION})
                except Exception:pass
        # Without a model there is no network call; answer 'nicht verfügbar' at once instead of spawning a thread.
        (work() if not self._configured(self.model_factory()) else self.runner(work))
        return self.store.get('requirement',req_id)

    # --- Freigabe ---
    def approve(self,body):
        reviewer=str(body.get('reviewer') or '').strip();note=str(body.get('note') or '').strip()
        if not reviewer or not note:raise InputError('Prüfername und fachliche Begründung sind erforderlich.')
        req=self._req(body.get('id'));approved=body.get('approve') is True
        self._verify(req)
        if approved and req['citation_status']!='verified':raise InputError('Quellenzitat stimmt nicht überein.')
        rec=(req.get('ai_review') or {}).get('recommendation')
        against=bool(approved and rec and rec!='freigabe_empfohlen')
        if against and len(note)<20:raise InputError('Begründung zur KI-Empfehlung erforderlich (offene Frage beantworten).')
        at=now();approval={'decision':'freigegeben' if approved else 'abgelehnt','reviewer':reviewer,'note':note,'against_ai':against,'decided_at':at}
        with self.store.lock:
            req['status']='approved' if approved else 'rejected';req['semantic_review']=req['status']
            req.update(reviewer=reviewer,review_note=note,reviewed_at=at)
            if approved:req.update(approved_version_no=req['version_no'],change_flag=None,approval_invalid=None)
            self.store.put('requirement',req)
            v=self._version(req['id'],req['version_no']) or self._snapshot(req,'migration')
            v.update(approval=approval,citation_status=req['citation_status']);self.store.put('requirement_version',v)
        self.store.event('review',{'kind':'requirement','id':req['id'],'approved':approved,'reviewer':reviewer,'note':note,
                                   'version_no':req['version_no'],'against_ai':against})
        if approved:self.regenerate_cases(req['id'])
        return self.store.get('requirement',req['id'])

    # --- Dokumentänderungen ---
    def _classify(self,diff,model):
        todo=[c for c in diff.get('changes',[]) if c.get('classification_source')!='mensch'][:60]
        if not todo or not self._configured(model):return False
        try:result={x['change_id']:x for x in model.classify_changes(todo)}
        except ModelError as e:diff['classification_error']=str(e);return False
        for c in todo:
            if c['id'] in result:c.update(classification=result[c['id']]['classification'],classification_reason=result[c['id']]['reason'],classification_source='ki')
        return True

    def _flag(self,req_id,diff,change_id):
        req=self._req(req_id)
        req['change_flag']={'reason':'quelle_geaendert','diff_id':diff['id'],'change_id':change_id,'text':FLAG_TEXT}
        self.store.put('requirement',req)
        self.store.event('requirement_flagged',{'id':req_id,'diff_id':diff['id'],'change_id':change_id})

    def _fachlich(self,req_id,diff,change,model):
        """Fachliche Änderung: mit Modell KI-Entwurf als neue Version (Freigabe nötig), sonst nur Kennzeichnung."""
        self._flag(req_id,diff,change['id'])
        req=self._req(req_id)
        v=self._version(req_id,req['version_no'])
        if v and v.get('diff_id')==diff['id'] and v.get('origin')=='ki_entwurf':return
        if not self._configured(model):return
        try:draft=model.draft_revision(req,change)
        except ModelError as e:
            self.store.event('revision_draft_failed',{'id':req_id,'diff_id':diff['id'],'error':str(e)});return
        new=self._doc(diff['new_version_id'])
        fields={**draft,'source_id':new['id'],'section_id':self._locate(new,draft['source_excerpt']) or req['section_id']}
        self.new_version(req_id,fields,'ki_entwurf','Quelle geändert (fachlich): '+str(change.get('classification_reason') or 'neue Quellversion'),diff_id=diff['id'])

    def _summary(self,diff,classes):
        kinds=[c['kind'] for c in diff.get('changes',[])]
        diff['summary']={'added':kinds.count('added'),'removed':kinds.count('removed'),'changed':kinds.count('changed'),
                         'affected':len(classes),**{k:list(classes.values()).count(k) for k in ['fachlich','redaktionell','offen']}}

    def _req_class(self,diff,ids):
        cls=[c.get('classification') or 'offen' for c in diff.get('changes',[]) if c['id'] in ids]
        return 'fachlich' if 'fachlich' in cls else 'offen' if 'offen' in cls or not cls else 'redaktionell'

    def apply_document_change(self,diff):
        if diff.get('applied_at'):return diff
        old=self._doc(diff['old_version_id']);new=self._doc(diff['new_version_id'])
        if not old or not new:raise InputError('Dokumentversion zum Vergleich nicht gefunden.')
        newtext=normalize(self._text(new));affected={}
        for c in diff.get('changes',[]):
            c.setdefault('classification','offen');c.setdefault('classification_reason',None);c.setdefault('classification_source','keine')
        for req in self.store.list('requirement'):
            req=self._ensure(req);v=self._version(req['id'],req['approved_version_no']) if req.get('approved_version_no') else None
            if old['id'] not in [req.get('source_id'),(v or {}).get('source_id')]:continue
            ex=normalize(req.get('source_excerpt') if req.get('source_id')==old['id'] else v.get('source_excerpt'))
            if not ex or ex in newtext:continue
            hits=[c['id'] for c in diff.get('changes',[]) if c['kind'] in ['removed','changed'] and normalize(c.get('before'))
                  and (ex in normalize(c['before']) or normalize(c['before']) in ex)]
            if hits:affected[req['id']]=hits
        model=self.model_factory()
        if not self._classify(diff,model):
            for c in diff.get('changes',[]):
                if c.get('classification_source')!='mensch':c.update(classification='offen',classification_source='keine')
        changes={c['id']:c for c in diff.get('changes',[])};classes={}
        for req_id,ids in affected.items():
            cls=classes[req_id]=self._req_class(diff,ids)
            if cls=='fachlich':self._fachlich(req_id,diff,next(changes[i] for i in ids if changes[i]['classification']=='fachlich'),model)
            elif cls=='offen':self._flag(req_id,diff,ids[0])
        diff['affected_requirement_ids']=list(affected);diff['affected_changes']=affected;diff['applied_at']=now()
        self._summary(diff,classes);self.store.put('document_diff',diff)
        self.store.event('document_change_applied',{'diff_id':diff['id'],'affected':list(affected),'summary':diff['summary']})
        return diff

    def editorial_accept(self,body):
        reviewer=str(body.get('reviewer') or '').strip();note=str(body.get('note') or '').strip()
        if not reviewer or not note:raise InputError('Prüfername und Begründung sind für die Übernahme erforderlich.')
        diff=self._diff(body.get('diff_id'));changes={c['id']:c for c in diff.get('changes',[])}
        selected={i for i,c in changes.items() if c.get('classification')=='redaktionell' and (not body.get('change_ids') or i in body['change_ids'])}
        if not selected:raise InputError('Keine redaktionellen Änderungen zum Übernehmen ausgewählt.')
        new=self._doc(diff['new_version_id']);done=[];skipped=[]
        for req_id,ids in (diff.get('affected_changes') or {}).items():
            if not set(ids)<=selected:continue
            req=self._req(req_id)
            if req.get('source_id')!=diff['old_version_id'] or req.get('approved_version_no')!=req['version_no']:
                skipped.append({'id':req_id,'reason':'Aktuelle Version ist nicht die freigegebene Version der alten Quelle.'});continue
            ex=req['source_excerpt']
            for i in ids:
                if normalize(changes[i].get('before'))==normalize(ex) and changes[i].get('after'):ex=changes[i]['after']
            section=self._locate(new,ex)
            if not section:
                skipped.append({'id':req_id,'reason':'Zitat ist nur Teil des Absatzes; neue Version manuell anlegen.'});continue
            old_n=req['version_no']
            with self.store.lock:
                req.update(source_excerpt=ex,source_id=new['id'],source_version_id=new['id'],section_id=section,version_no=old_n+1,
                           status='approved',semantic_review='approved',approved_version_no=old_n+1,change_flag=None,approval_invalid=None,
                           ai_review=None,reviewer=reviewer,review_note=note,reviewed_at=now())
                self._verify(req);self.store.put('requirement',req)
                self._snapshot(req,'übernommen_redaktionell',note,diff_id=diff['id'],approval={'decision':'freigegeben','reviewer':reviewer,'note':note,
                               'against_ai':False,'decided_at':req['reviewed_at'],'carried_from_version':old_n})
            # Redaktionelle Übernahme: fachlich gleiche Basis, Testfälle wandern ohne Neuerzeugung mit.
            for case in self.store.list('case'):
                if req_id in case.get('requirement_ids',[]) and not case.get('outdated') and case.get('requirement_versions',{}).get(req_id,1)==old_n:
                    case.setdefault('requirement_versions',{})[req_id]=old_n+1;self.store.put('case',case)
            done.append(req_id)
        diff.setdefault('editorial_accepted',[]).append({'change_ids':sorted(selected),'reviewer':reviewer,'note':note,'at':now(),
                                                         'requirement_ids':done,'skipped':skipped})
        self.store.put('document_diff',diff)
        self.store.event('editorial_accept',{'diff_id':diff['id'],'change_ids':sorted(selected),'reviewer':reviewer,'note':note,'requirement_ids':done,'skipped':[s['id'] for s in skipped]})
        return diff

    def reclassify(self,body):
        diff=self._diff(body.get('diff_id'))
        if body.get('classification')!='fachlich':raise InputError('Eine Änderung kann nur als „fachlich“ markiert werden.')
        change=next((c for c in diff.get('changes',[]) if c['id']==body.get('change_id')),None)
        if not change:raise InputError('Änderung nicht gefunden.')
        change.update(classification='fachlich',classification_source='mensch',classification_reason=str(body.get('reason') or '').strip() or 'Von einem Menschen als fachlich eingestuft.')
        model=None;classes={}
        for req_id,ids in (diff.get('affected_changes') or {}).items():
            classes[req_id]=self._req_class(diff,ids)
            if change['id'] in ids:
                model=model or self.model_factory();self._fachlich(req_id,diff,change,model)
        self._summary(diff,classes);self.store.put('document_diff',diff)
        self.store.event('change_reclassified',{'diff_id':diff['id'],'change_id':change['id'],'classification':'fachlich'})
        return diff

    # --- Testfälle ---
    def case_usable(self,case,today=None):
        if case.get('outdated'):return False
        if case.get('review_status')=='approved':return True
        if case.get('expectation_edited') or case.get('expected_message') is None:return False
        for id in case.get('requirement_ids',[]):
            try:req=self._ensure(self.store.get('requirement',id))
            except KeyError:return False
            if not self.effective(req,today):return False
            if case.get('requirement_versions',{}).get(id,1)!=req['approved_version_no']:return False
        return True

    def mark_outdated_cases(self,req_id):
        req=self._req(req_id);ids=[]
        for case in self.store.list('case'):
            if req_id not in case.get('requirement_ids',[]) or case.get('outdated'):continue
            basis=case.get('requirement_versions',{}).get(req_id,1)
            if basis<req['version_no']:
                case['outdated']={'text':f'veraltet – basiert auf Version {basis}','since':now(),'requirement_id':req_id}
                self.store.put('case',case);ids.append(case['id'])
        if ids:self.store.event('cases_outdated',{'requirement_id':req_id,'version_no':req['version_no'],'ids':ids})
        return ids

    def regenerate_cases(self,req_id):
        req=self._req(req_id)
        if req.get('approved_version_no')!=req['version_no']:return []
        reqs={r['id']:self._ensure(r) for r in self.store.list('requirement')};created=[]
        for case in self.store.list('case'):
            if req_id not in case.get('requirement_ids',[]) or not case.get('outdated') or case.get('regenerated_to'):continue
            basis=case.get('requirement_versions',{}).get(req_id,1)
            if basis>=req['version_no']:continue
            old_v=self._version(req_id,basis);clone=copy.deepcopy(case)
            for k in ['reviewer','review_note','reviewed_at','outdated','regenerated_to']:clone.pop(k,None)
            clone.update(id=str(uuid4()),review_status='pending',outdated=None,regenerated_from=case['id'],created_at=now(),
                         requirement_versions={id:reqs[id]['version_no'] for id in case.get('requirement_ids',[]) if id in reqs})
            if 'requirements_snapshot' in clone:clone['requirements_snapshot']=[copy.deepcopy(reqs[id]) for id in case.get('requirement_ids',[]) if id in reqs]
            if old_v and old_v.get('source_id')!=req['source_id']:
                # Neue Quellversion: Erwartung aus altem Stand nicht still übernehmen (2026/2027 nie vermischen).
                clone.update(expected_message=None,expectation_source='Quellversion geändert: erwartetes Ergebnis für Version '+str(req['version_no'])+' neu bestimmen.')
            self.store.put('case',clone);case['regenerated_to']=clone['id'];self.store.put('case',case);created.append(clone)
        if created:self.store.event('cases_regenerated',{'requirement_id':req_id,'version_no':req['version_no'],'ids':[c['id'] for c in created],
                                                         'from':[c['regenerated_from'] for c in created]})
        return created

    # --- Ergebnisse & Abdeckung ---
    def _latest(self,runs,case,req_id,basis):
        run=next((v for v in reversed(runs) if v['case_id']==case['id'] and v.get('ruleset')==case.get('ruleset')
                  and any(x['requirement_id']==req_id for x in v.get('results',[]))),None)
        if not run:return None
        result=next(x for x in run['results'] if x['requirement_id']==req_id)
        snap=next((x for x in run.get('requirements_snapshot',[]) if x['id']==req_id),None) or {}
        # Every substantive change creates a new version, so the version number decides staleness per requirement.
        stale=bool(any((run.get('snapshot') or {}).get(k)!=case.get(k) for k in ['scenario','expected_message'])
                   or (snap.get('version_no') or 1)!=basis)
        status=result.get('status') if result.get('status') in ['pass','fail'] else 'not_assessable'
        return {'run_id':run['id'],'status':status,'created_at':run.get('created_at'),'stale':stale}

    def _ai_label(self,ai):
        if not ai:return None
        return {'fertig':ai.get('recommendation_label'),'nicht_verfügbar':'KI-Vorprüfung nicht verfügbar','fehler':'KI-Vorprüfung fehlgeschlagen','läuft':'KI-Vorprüfung läuft'}.get(ai.get('status'))

    def results(self,today=None):
        reqs=[self._ensure(r) for r in self.store.list('requirement')];cases=self.store.list('case');runs=self.store.list('run')
        dist=dict(bestanden=0,fehlgeschlagen=0,nicht_beurteilbar=0,veraltet=0,nicht_ausgefuehrt=0)
        cov=dict(total_approved=0,covered=0,open=0,missing=0,outdated=0);rows=[]
        for r in reqs:
            inv=self._invalidity(r,today);eff=r.get('approved_version_no') is not None and inv is None
            label=('Freigabe nicht mehr gültig' if inv else 'Wartet auf Freigabe' if r.get('status')=='pending' else 'Abgelehnt' if r.get('status')=='rejected'
                   else f"Freigegeben v{r['approved_version_no']}" if r.get('approved_version_no') else 'Wartet auf Freigabe')
            doc=self._doc(r.get('source_id'));sec=next((s for s in (doc or {}).get('sections',[]) if s['id']==r.get('section_id')),{})
            items=[];basis=r.get('approved_version_no') if eff else r['version_no']
            for c in cases:
                if r['id'] not in c.get('requirement_ids',[]):continue
                # Evidence is outdated per requirement: only when this case was built on an older version of r.
                built=c.get('requirement_versions',{}).get(r['id'],1);old=built<(basis or 1)
                latest=self._latest(runs,c,r['id'],basis or 1)
                usable=not old and (c.get('review_status')=='approved' or (not c.get('expectation_edited') and c.get('expected_message') is not None))
                items.append({'case_id':c['id'],'name':c['name'],'usable':usable,'outdated_text':f'veraltet – basiert auf Version {built}' if old else None,
                              'latest':latest,'_open':c.get('expected_message') is None})
                dist['veraltet' if old or (latest and latest['stale']) else 'nicht_ausgefuehrt' if not latest
                     else {'pass':'bestanden','fail':'fehlgeschlagen'}.get(latest['status'],'nicht_beurteilbar')]+=1
            current=[x for x in items if x['usable'] and x['latest'] and not x['latest']['stale']]
            if r.get('status')=='pending':state='offen'
            elif not eff:state='veraltet' if inv else 'offen'
            elif current:state='aktuell'
            elif any(x['outdated_text'] or (x['latest'] and x['latest']['stale']) for x in items):state='veraltet'
            elif any(x['_open'] and not x['outdated_text'] for x in items):state='offen'
            else:state='fehlend'
            if eff:
                cov['total_approved']+=1
                if state=='aktuell' and any(x['latest']['status']=='pass' for x in current):cov['covered']+=1
                elif state=='veraltet':cov['outdated']+=1
                elif state=='fehlend':cov['missing']+=1
                else:cov['open']+=1
            for x in items:x.pop('_open')
            rows.append({'requirement_id':r['id'],'title':r.get('title'),'version_no':r['version_no'],'approved_version_no':r.get('approved_version_no'),
                         'approval_label':label,'approval_invalid':inv,'change_flag':r.get('change_flag'),'ai_label':self._ai_label(r.get('ai_review')),
                         'evidence_state':state,'source':{'document_id':r.get('source_id'),'document_name':(doc or {}).get('name'),
                         'version_label':(doc or {}).get('version_label') or (doc or {}).get('version'),'location':sec.get('location')},'cases':items})
        return {'distribution':dist,'coverage':cov,'rows':rows,
                'limitations':['Ergebnisse stammen aus der internen Simulation bzw. importierten Fixtures; keine echte Abrechnungssoftware angebunden.',
                               'Nur Beispielkriterien; keine vollständige EEL-Konformitätsprüfung und kein Zertifikat.',
                               'KI-Vorprüfung ist eine Empfehlung und kein unabhängiger Nachweis; Freigaben trifft ein Mensch.',
                               'Zurückgezogene Quellversionen machen Freigaben derzeit nicht automatisch ungültig (offener Punkt).',
                               'Aktuelle, aber nicht bestandene Nachweise zählen in der Abdeckung als „offen“.']}
