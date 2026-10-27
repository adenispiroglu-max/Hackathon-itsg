"""Dokumentenablage: Dokumente, Dokumentversionen, Originaldateien und Absatzvergleich."""
import base64
import difflib
import hashlib
import io
import os
import re
import tempfile
from datetime import date
from pathlib import Path
from uuid import uuid4
from .domain import InputError
from .store import now

DOC_TYPES={'gesetz':'Gesetz/Verordnung','spezifikation':'Technische Spezifikation','kriterien':'Prüfkriterien','sonstige':'Sonstige'}
EXTS=('pdf','txt','md','docx')
MIME={'pdf':'application/pdf','txt':'text/plain; charset=utf-8','md':'text/markdown; charset=utf-8',
      'docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
MATCH_MIN=0.45;CHANGED_MIN=0.6
DATE=r'(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})'
DATE_RULES=[('valid_from',r'(?:gilt|gültig)\s+ab(?:\s+dem)?\s+'+DATE),('valid_from',r'\bab\s+dem\s+'+DATE),
            ('valid_from',r'\btritt\b[^.\n]{0,80}?'+DATE+r'[^.\n]{0,40}?in\s+Kraft'),
            ('valid_until',r'(?:gilt|gültig)\s+bis(?:\s+(?:zum|einschließlich))?\s+'+DATE)]


def normalize(s):
    return re.sub(r'\s+',' ',re.sub(r'-\s*\n\s*','',s or '')).strip()


def iso(value,field):
    if value in (None,''):return None
    try:return date.fromisoformat(str(value)).isoformat()
    except ValueError:raise InputError(f'{field}: Datum im Format JJJJ-MM-TT angeben.') from None


def as_date(today):
    if today is None:return date.today()
    return today if isinstance(today,date) else date.fromisoformat(str(today))


def blocks(text):
    """Absätze an Leerzeilen; ohne Leerzeilen Zeilenblöcke bis zum Satzende."""
    parts=[p for p in re.split(r'\n\s*\n',text or '') if p.strip()]
    if len(parts)==1 and parts[0].count('\n')>=1:
        out,cur=[],[]
        for line in parts[0].splitlines():
            if not line.strip():continue
            cur.append(line)
            if re.search(r'[.:;!?]\s*$',line):out.append('\n'.join(cur));cur=[]
        if cur:out.append('\n'.join(cur))
        parts=out
    return parts


def build_paragraphs(sections):
    """Absätze mit Quellort; über Seitengrenzen getrennte Sätze werden zusammengeführt."""
    raw=[]
    for s in sections:
        page=s.get('page');parts=blocks(s['text']) if page else ([s['text']] if s['text'].strip() else [])
        for i,t in enumerate(parts):
            loc=f'Seite {page}, Absatz {i+1}' if page else s['location']
            raw.append({'page':page,'location':loc,'text':t.strip(),'section_id':s['id'],'first':i==0})
    out=[]
    for p in raw:
        prev=out[-1] if out else None
        if prev and p['page'] and prev['page'] and p['first'] and p['page']!=prev['page'] and not re.search(r'[.:;!?]["“”»)]?$',prev['text']) and re.match(r'[a-zäöüß]',p['text']):
            prev['text']=prev['text']+'\n'+p['text'];continue
        out.append(p)
    return [{'ref':f'¶{i+1}','page':p['page'],'location':f'Absatz {i+1}' if re.fullmatch(r'Abschnitt \d+',p['location']) else p['location'],'text':p['text'],'section_id':p['section_id']} for i,p in enumerate(out)]


def parse_file(name,raw):
    """Textextraktion wie Service.import_document, ohne Seitenauswahl."""
    suffix=name.lower().rsplit('.',1)[-1] if '.' in name else ''
    if suffix in ['txt','md']:
        try:text=raw.decode('utf-8-sig')
        except UnicodeError:raise InputError('Textdatei muss UTF-8 sein.') from None
        sections=[{'id':f'p{i+1}','location':f'Abschnitt {i+1}','text':s} for i,s in enumerate(re.split(r'\n\s*\n',text)) if s.strip()]
    elif suffix=='pdf':
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                sections=[{'id':f'page-{i+1}','page':i+1,'location':f'PDF-Seite {i+1}','text':p.extract_text() or ''} for i,p in enumerate(pdf.pages)]
        except ImportError:raise InputError('PDF-Import benötigt die optionalen Pakete aus requirements.txt.') from None
        except InputError:raise
        except Exception:raise InputError('PDF konnte nicht gelesen werden.') from None
    elif suffix=='docx':
        try:
            from zipfile import ZipFile,BadZipFile
            try:
                with ZipFile(io.BytesIO(raw)) as z:
                    if sum(x.file_size for x in z.infolist())>max(1_000_000_000,200*len(raw)):raise InputError('DOCX entpackt sich auf eine unplausible Größe (mögliche ZIP-Bombe).')
            except BadZipFile:raise InputError('DOCX konnte nicht gelesen werden.') from None
            from docx import Document
            doc=Document(io.BytesIO(raw))
            sections=[{'id':f'p{i+1}','location':f'Absatz {i+1}','text':p.text} for i,p in enumerate(doc.paragraphs) if p.text.strip()]
            sections+=[{'id':f't{ti+1}r{ri+1}','location':f'Tabelle {ti+1}, Zeile {ri+1}','text':' | '.join(c.text for c in r.cells)} for ti,t in enumerate(doc.tables) for ri,r in enumerate(t.rows)]
        except ImportError:raise InputError('DOCX-Import benötigt python-docx.') from None
    else:raise InputError('Unterstützt: TXT, MD, PDF, DOCX.')
    if not sections or not any(x['text'].strip() for x in sections):raise InputError('Kein Text erkannt. Für Scans ist externe OCR erforderlich.')
    return suffix,sections,build_paragraphs(sections)


def word_ops(before,after):
    a=re.findall(r'\s+|\S+',normalize(before));b=re.findall(r'\s+|\S+',normalize(after));ops=[]
    def add(op,text):
        if ops and ops[-1]['op']==op:ops[-1]['text']+=text
        elif text:ops.append({'op':op,'text':text})
    for tag,i1,i2,j1,j2 in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
        if tag=='equal':add('equal',''.join(a[i1:i2]))
        else:add('delete',''.join(a[i1:i2]));add('insert',''.join(b[j1:j2]))
    return ops


def diff_paragraphs(old,new):
    """Absatzvergleich unabhängig von Seitengrenzen (nur normalisierter Text zählt)."""
    a=[normalize(p['text']) for p in old];b=[normalize(p['text']) for p in new]
    gone,came,anchor=[],[],{}
    for tag,i1,i2,j1,j2 in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
        if tag=='equal':continue
        for i in range(i1,i2):gone.append(i);anchor[i]=j1
        came+=range(j1,j2)
    # Verschobene, aber unveränderte Absätze sind keine Änderung.
    pool={}
    for j in came:pool.setdefault(b[j],[]).append(j)
    moved=set()
    for i in list(gone):
        if pool.get(a[i]):moved.add(pool[a[i]].pop(0));gone.remove(i)
    came=[j for j in came if j not in moved]
    pairs=[]
    if len(gone)*len(came)<=250_000:
        for i in gone:
            for j in came:
                m=difflib.SequenceMatcher(None,a[i],b[j],autojunk=False)
                if m.real_quick_ratio()>=CHANGED_MIN and m.quick_ratio()>=CHANGED_MIN:
                    r=m.ratio()
                    if r>=CHANGED_MIN:pairs.append((-r,abs(anchor[i]-j),i,j))
    used_a,used_b,matched=set(),set(),[]
    for _,_,i,j in sorted(pairs):
        if i in used_a or j in used_b:continue
        used_a.add(i);used_b.add(j);matched.append((i,j))
    items=[]
    for i,j in matched:items.append((j,0,{'kind':'changed','old_ref':old[i]['ref'],'old_location':old[i]['location'],'before':old[i]['text'],
                                            'new_ref':new[j]['ref'],'new_location':new[j]['location'],'after':new[j]['text'],'words':word_ops(old[i]['text'],new[j]['text'])}))
    for i in gone:
        if i not in used_a:items.append((anchor[i],-1,{'kind':'removed','old_ref':old[i]['ref'],'old_location':old[i]['location'],'before':old[i]['text'],'words':[]}))
    for j in came:
        if j not in used_b:items.append((j,1,{'kind':'added','new_ref':new[j]['ref'],'new_location':new[j]['location'],'after':new[j]['text'],'words':[]}))
    changes=[]
    for n,(_,_,c) in enumerate(sorted(items,key=lambda x:(x[0],x[1]))):
        changes.append({'id':f'chg-{n+1}',**c,'classification':'offen','classification_reason':None,'classification_source':'keine'})
    return changes


def summarize(changes,affected=()):
    count=lambda k,v:sum(1 for c in changes if c.get(k)==v)
    return {'added':count('kind','added'),'removed':count('kind','removed'),'changed':count('kind','changed'),'affected':len(affected),
            'fachlich':count('classification','fachlich'),'redaktionell':count('classification','redaktionell'),'offen':count('classification','offen')}


def stem(name):
    s=(name or '').lower();s=re.sub(r'\.(pdf|txt|md|docx)$','',s)
    s=re.sub(r'\b(19|20)\d{2}\b|\bv(ersion)?\s*\d+(\.\d+)*\b|\d+',' ',s)
    return ' '.join(re.split(r'[\W_]+',s)).strip()


def similarity(a,b):
    return difflib.SequenceMatcher(None,a,b,autojunk=False).ratio() if a and b else 0.0


class Library:
    def __init__(self,store,files_dir,on_new_version=None):
        self.store=store;self.files_dir=Path(files_dir);self.on_new_version=on_new_version

    # --- Hilfen ---
    def _docs(self,lib):
        found=self.store.get_many('document',lib['version_ids']) if lib['version_ids'] else {}
        return [found[i] for i in lib['version_ids'] if i in found]

    def _current(self,lib,today=None):
        docs=[d for d in self._docs(lib) if not d.get('withdrawn')]
        if not docs:return (self._docs(lib) or [None])[-1]
        t=as_date(today).isoformat()
        live=[d for d in docs if not d.get('valid_from') or d['valid_from']<=t]
        return (live or docs)[-1]

    def _path(self,doc):
        if doc.get('file_ext') not in EXTS or not re.fullmatch(r'[0-9a-f]{64}',doc.get('sha256') or ''):raise InputError('Originaldatei nicht gespeichert.')
        path=(self.files_dir/f"{doc['sha256']}.{doc['file_ext']}").resolve()
        if path.parent!=self.files_dir.resolve():raise InputError('Ungültiger Dateipfad.')
        return path

    def _write(self,doc,raw):
        path=self._path(doc)
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==doc['sha256']:return
        self.files_dir.mkdir(parents=True,exist_ok=True)
        fd,tmp=tempfile.mkstemp(dir=self.files_dir,prefix='.upload-')
        try:
            with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
            os.replace(tmp,path)
        except BaseException:
            if os.path.exists(tmp):os.unlink(tmp)
            raise

    def summary(self,doc,today=None):
        return {'id':doc['id'],'version_no':doc.get('version_no'),'version_label':doc.get('version_label',doc.get('version')),
                'file_name':doc.get('file_name',doc.get('name')),'file_ext':doc.get('file_ext'),'file_stored':bool(doc.get('file_stored')),
                'sha256':doc.get('sha256'),'valid_from':doc.get('valid_from'),'valid_until':doc.get('valid_until'),
                'validity_confirmed':bool(doc.get('validity_confirmed')),'uploaded_at':doc.get('uploaded_at'),
                'status':self.version_status(doc,today),'withdrawn':doc.get('withdrawn'),'paragraphs':len(doc.get('paragraphs') or []),
                'diff_id':doc.get('diff_id')}

    # --- Status und Daten ---
    def version_status(self,doc,today=None):
        t=as_date(today).isoformat();w=doc.get('withdrawn')
        out=lambda code,label:{'code':code,'label':label,'withdrawn':('Zurückgezogen: '+w['reason']) if w else None}
        if doc.get('status')=='processing':return out('processing','Wird verarbeitet')
        if doc.get('status')=='error':return out('error','Fehler beim Lesen')
        if doc.get('library_id'):
            try:lib=self.store.get('library_doc',doc['library_id'])
            except KeyError:lib=None
            if lib:
                later=[d for d in self._docs(lib) if (d.get('version_no') or 0)>(doc.get('version_no') or 0) and not d.get('withdrawn') and (not d.get('valid_from') or d['valid_from']<=t)]
                if later:
                    by=later[-1];res=out('superseded',f"Ersetzt durch Version {by['version_no']}");res['by']=by['id'];return res
        if doc.get('valid_until') and doc['valid_until']<t:return out('expired','Abgelaufen')
        return out('ready','Bereit')

    def suggest_dates(self,text):
        flat=normalize(text);found,seen=[],set()
        for field,pattern in DATE_RULES:
            for m in re.finditer(pattern,flat,re.I):
                raw=m.group(1)
                try:
                    if '-' in raw:value=date.fromisoformat(raw).isoformat()
                    else:d,mo,y=map(int,raw.split('.'));value=date(y,mo,d).isoformat()
                except ValueError:continue
                if (field,value) in seen:continue
                seen.add((field,value));found.append({'field':field,'value':value,'excerpt':flat[max(0,m.start()-40):m.end()+40].strip()})
        return found[:10]

    # --- Upload ---
    def analyse(self,body):
        name=(body.get('name') or '').strip()
        if not name or len(name)>200:raise InputError('Dateiname fehlt oder ist zu lang.')
        label=(body.get('version_label') or '').strip()
        if not label:raise InputError('Versionsbezeichnung fehlt.')
        if len(label)>100:raise InputError('Versionsbezeichnung ist zu lang.')
        doc_type=body.get('doc_type') or None
        if doc_type and doc_type not in DOC_TYPES:raise InputError('Unbekannter Dokumenttyp.')
        valid_from=iso(body.get('valid_from'),'Gültig ab');valid_until=iso(body.get('valid_until'),'Gültig bis')
        if valid_from and valid_until and valid_until<valid_from:raise InputError('„Gültig bis“ liegt vor „Gültig ab“.')
        try:raw=base64.b64decode(body['base64'],validate=True)
        except (KeyError,ValueError,TypeError):raise InputError('Ungültiger Datei-Upload.') from None
        sha=hashlib.sha256(raw).hexdigest()
        dup=next((d for d in self.store.list('document') if d.get('sha256')==sha),None)
        if dup:
            title=dup.get('name')
            if dup.get('library_id'):
                try:title=self.store.get('library_doc',dup['library_id'])['title']
                except KeyError:pass
            vl=dup.get('version_label',dup.get('version'))
            return {'upload_id':None,'file_name':name,'sha256':sha,'paragraphs':0,'date_suggestions':[],'suggestion':None,
                    'duplicate':{'document_id':dup['id'],'library_id':dup.get('library_id'),'title':title,'version_label':vl,
                                 'message':f'Diese Datei ist bereits als „{title}“ Version {vl} vorhanden.'},
                    'steps':[{'label':'Datei geprüft','status':'error','detail':'Identische Datei bereits vorhanden; es wurde nichts gespeichert.'}]}
        ext,sections,paragraphs=parse_file(name,raw)
        text='\n\n'.join(p['text'] for p in paragraphs);dates=self.suggest_dates(text)
        suggestion=self._suggest(name,text)
        up={'id':'UP-'+uuid4().hex[:12],'name':name,'file_ext':ext,'sha256':sha,'base64':body['base64'],'sections':sections,'paragraphs':paragraphs,
            'date_suggestions':dates,'version_label':label,'doc_type':doc_type,'valid_from':valid_from,'valid_until':valid_until,
            'suggestion':suggestion,'created_at':now(),'confirmed':None}
        self.store.put('upload',up);self.store.event('library_upload',{'upload_id':up['id'],'name':name,'hash':sha})
        steps=[{'label':'Datei geprüft','status':'ok','detail':'Keine identische Datei vorhanden.'},
               {'label':'Text gelesen','status':'ok','detail':f'{len(paragraphs)} Absätze erkannt.'},
               {'label':'Dokument erkannt','status':'ok','detail':(f"Sieht aus wie eine neue Version von „{suggestion['title']}“ (aktuell Version {suggestion['current_version_no']}). Bitte bestätigen." if suggestion else 'Kein ähnliches Dokument gefunden; neues Dokument vorgeschlagen.')}]
        return {'upload_id':up['id'],'duplicate':None,'suggestion':suggestion,'paragraphs':len(paragraphs),'date_suggestions':dates,
                'file_name':name,'sha256':sha,'file_ext':ext,'steps':steps}

    def _suggest(self,name,text):
        best=None;s=stem(name);head=normalize(text)[:4000].split()
        for lib in self.store.list('library_doc'):
            cur=self._current(lib)
            if not cur:continue
            name_sim=max(similarity(s,stem(lib['title'])),similarity(s,stem(cur.get('file_name') or cur.get('name'))))
            text_sim=similarity(head,normalize('\n\n'.join(p['text'] for p in cur.get('paragraphs') or []))[:4000].split())
            score=round(0.4*name_sim+0.6*text_sim,3)
            if score>=MATCH_MIN and (not best or score>best['score']):
                best={'library_id':lib['id'],'title':lib['title'],'doc_type':lib['doc_type'],'current_version_label':cur.get('version_label',cur.get('version')),
                      'current_version_no':cur.get('version_no'),'score':score}
        return best

    def confirm(self,body):
        try:up=self.store.get('upload',body.get('upload_id') or '')
        except KeyError:raise InputError('Upload nicht gefunden. Bitte Datei erneut hochladen.') from None
        if up.get('confirmed'):raise InputError('Dieser Upload wurde bereits übernommen.')
        if any(d.get('sha256')==up['sha256'] for d in self.store.list('document')):raise InputError('Diese Datei ist bereits vorhanden.')
        raw=base64.b64decode(up['base64'])
        if hashlib.sha256(raw).hexdigest()!=up['sha256']:raise InputError('Upload beschädigt. Bitte Datei erneut hochladen.')
        doc_type=body.get('doc_type') or None
        if doc_type and doc_type not in DOC_TYPES:raise InputError('Unbekannter Dokumenttyp.')
        label=(body.get('version_label') or up['version_label']).strip()
        valid_from=iso(body['valid_from'],'Gültig ab') if 'valid_from' in body else up['valid_from']
        valid_until=iso(body['valid_until'],'Gültig bis') if 'valid_until' in body else up['valid_until']
        if valid_from and valid_until and valid_until<valid_from:raise InputError('„Gültig bis“ liegt vor „Gültig ab“.')
        at=now()
        if body.get('library_id'):
            try:lib=self.store.get('library_doc',body['library_id'])
            except KeyError:raise InputError('Dokument nicht gefunden.') from None
            if doc_type:lib['doc_type']=doc_type
            if (body.get('title') or '').strip():lib['title']=body['title'].strip()[:200]
            if (body.get('description') or '').strip():lib['description']=body['description'].strip()[:300]
            prev=next((d for d in reversed(self._docs(lib)) if not d.get('withdrawn')),None);recognized=f"Neue Version von „{lib['title']}“."
        else:
            title=((body.get('title') or '').strip() or re.sub(r'\.[^.]+$','',up['name']))[:200]
            lib={'id':'LIB-'+uuid4().hex[:8],'title':title,'doc_type':doc_type or up.get('doc_type') or 'sonstige','created_at':at,'version_ids':[],
                 'description':(body.get('description') or '').strip()[:300] or None}
            prev=None;recognized='Neues Dokument angelegt.'
        no=len(lib['version_ids'])+1
        doc={'id':str(uuid4()),'name':up['name'],'version':label,'valid_from':valid_from,'kind':up['file_ext'],'sha256':up['sha256'],
             'sections':up['sections'],'note':'Vollständiges Dokument importiert; Gültigkeit und Vollständigkeit prüfen.','page_range':None,
             'library_id':lib['id'],'version_no':no,'version_label':label,'doc_type':lib['doc_type'],'file_stored':True,'file_name':up['name'],
             'file_ext':up['file_ext'],'valid_until':valid_until,'validity_confirmed':bool(valid_from or valid_until),'status':'ready','withdrawn':None,
             'paragraphs':up['paragraphs'],'diff_id':None,'uploaded_at':at,'date_suggestions':up['date_suggestions']}
        self._write(doc,raw)
        lib['version_ids']=lib['version_ids']+[doc['id']]
        diff=None
        if prev:
            changes=diff_paragraphs(prev.get('paragraphs') or [],doc['paragraphs'])
            if changes:
                diff={'id':'DIFF-'+uuid4().hex[:8],'library_id':lib['id'],'old_version_id':prev['id'],'new_version_id':doc['id'],'created_at':at,
                      'changes':changes,'affected_requirement_ids':[],'summary':summarize(changes)}
                doc['diff_id']=diff['id']
        up['confirmed']=doc['id'];up['base64']=None
        self.store.put_many([('document',doc),('library_doc',lib),('upload',up)]+([('document_diff',diff)] if diff else []))
        self.store.event('library_confirm',{'document_id':doc['id'],'library_id':lib['id'],'version_no':no,'hash':doc['sha256'],'diff_id':doc['diff_id']})
        steps=[{'label':'Datei geprüft','status':'ok','detail':'Keine identische Datei vorhanden.'},
               {'label':'Text gelesen','status':'ok','detail':f"{len(doc['paragraphs'])} Absätze erkannt."},
               {'label':'Dokument erkannt','status':'ok','detail':recognized},
               {'label':'Gespeichert','status':'ok','detail':f'Version {no} gespeichert'+(f'; Version {prev["version_no"]} bleibt erhalten.' if prev else '.')}]
        if not prev:steps.append({'label':'Änderungen verglichen','status':'skipped','detail':'Erste Version; kein Vergleich nötig.'})
        elif not diff:steps.append({'label':'Änderungen verglichen','status':'ok','detail':'Keine inhaltlichen Änderungen gegenüber der Vorversion gefunden.'})
        else:
            s=diff['summary'];steps.append({'label':'Änderungen verglichen','status':'ok','detail':f"{s['changed']} Absätze geändert, {s['added']} neu, {s['removed']} entfernt."})
        if not diff:steps.append({'label':'Anforderungen aktualisiert','status':'skipped','detail':'Keine Änderungen zu übertragen.'})
        elif not self.on_new_version:steps.append({'label':'Anforderungen aktualisiert','status':'skipped','detail':'Anforderungsabgleich ist nicht angebunden.'})
        else:
            try:
                result=self.on_new_version(diff)
                if isinstance(result,dict):diff=result
                diff['summary']=summarize(diff['changes'],diff.get('affected_requirement_ids') or [])
                self.store.put('document_diff',diff);s=diff['summary']
                steps.append({'label':'Anforderungen aktualisiert','status':'ok','detail':f"{s['affected']} Anforderungen betroffen. Änderungen: {s['fachlich']} fachlich, {s['redaktionell']} redaktionell, {s['offen']} noch nicht eingestuft."})
            except InputError as e:
                steps.append({'label':'Anforderungen aktualisiert','status':'error','detail':str(e)})
            except Exception as e:
                self.store.event('library_change_error',{'diff_id':diff['id'],'error':type(e).__name__})
                steps.append({'label':'Anforderungen aktualisiert','status':'error','detail':'Abgleich der Anforderungen fehlgeschlagen ('+type(e).__name__+'). Vergleich ist gespeichert.'})
        text=None
        if diff:
            s=diff['summary'];text=f"{s['changed']} Absätze geändert, {s['added']} neu, {s['removed']} entfernt · {s['affected']} Anforderungen betroffen · Änderungen: {s['fachlich']} fachlich, {s['redaktionell']} redaktionell, {s['offen']} noch nicht eingestuft"
        return {'document':doc,'library_doc':lib,'diff':diff,'steps':steps,'summary':text}

    # --- Lesen ---
    def listing(self,today=None):
        reqs=self.store.list('requirement');folders={k:[] for k in DOC_TYPES}
        for lib in self.store.list('library_doc'):
            docs=self._docs(lib);ids={d['id'] for d in docs};cur=self._current(lib,today)
            folders.setdefault(lib['doc_type'],[]).append({'library_id':lib['id'],'title':lib['title'],'doc_type':lib['doc_type'],'description':lib.get('description'),
                'current':self.summary(cur,today) if cur else None,'versions':[self.summary(d,today) for d in reversed(docs)],
                'pending_requirements':sum(1 for r in reqs if r.get('source_id') in ids and r.get('status')=='pending')})
        return {'folders':[{'doc_type':k,'label':DOC_TYPES.get(k,k),'documents':v} for k,v in folders.items()]}

    def version(self,id,today=None):
        doc=self.store.get('document',id);out=self.summary(doc,today)
        lib=None
        if doc.get('library_id'):
            try:lib=self.store.get('library_doc',doc['library_id'])
            except KeyError:pass
        diff=None
        if doc.get('diff_id'):
            try:d=self.store.get('document_diff',doc['diff_id']);diff={'id':d['id'],'old_version_id':d['old_version_id'],'summary':d['summary'],'affected_requirement_ids':d.get('affected_requirement_ids') or []}
            except KeyError:pass
        out.update({'library_id':doc.get('library_id'),'title':lib['title'] if lib else doc.get('name'),'doc_type':doc.get('doc_type'),
                    'doc_type_label':DOC_TYPES.get(doc.get('doc_type'),'Sonstige'),'note':doc.get('note'),'page_range':doc.get('page_range'),
                    'import_scope':'Teilimport (Altbestand)' if doc.get('page_range') else 'vollständiges Dokument','date_suggestions':doc.get('date_suggestions') or [],
                    'diff':diff,'requirement_ids':[r['id'] for r in self.store.list('requirement') if r.get('source_id')==id]})
        return out

    def text(self,id):
        doc=self.store.get('document',id)
        return {'id':id,'name':doc.get('name'),'version_label':doc.get('version_label',doc.get('version')),
                'paragraphs':[{k:p.get(k) for k in ('ref','location','page','text')} for p in doc.get('paragraphs') or build_paragraphs(doc['sections'])]}

    def file(self,id):
        doc=self.store.get('document',id)
        if not doc.get('file_stored'):raise InputError('Originaldatei nicht gespeichert.')
        path=self._path(doc)
        if not path.exists():raise InputError('Originaldatei nicht gefunden.')
        raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=doc['sha256']:raise InputError('Originaldatei beschädigt: Fingerabdruck stimmt nicht.')
        safe=re.sub(r'[^\w.\- ]','_',Path(doc.get('file_name') or 'dokument').name)[:150] or 'dokument'
        return raw,MIME[doc['file_ext']],safe

    def diff(self,id):
        return self.store.get('document_diff',id)

    def withdraw(self,body):
        reason=(body.get('reason') or '').strip();by=(body.get('by') or '').strip()
        if not reason or not by:raise InputError('Name und Begründung sind für das Zurückziehen erforderlich.')
        doc=self.store.get('document',body.get('document_id') or '')
        if doc.get('withdrawn'):raise InputError('Diese Version ist bereits zurückgezogen.')
        doc['withdrawn']={'reason':reason,'by':by,'at':now()}
        self.store.put('document',doc);self.store.event('library_withdraw',{'document_id':doc['id'],'reason':reason,'by':by})
        return doc

    def created_requirements(self,ids):
        """Requirements whose current or first version cites one of the given document versions."""
        first={v['requirement_id']:v.get('source_id') for v in self.store.list('requirement_version') if v.get('version_no')==1}
        return [r for r in self.store.list('requirement') if r.get('source_id') in ids or first.get(r['id']) in ids]

    def delete(self,body):
        """Removes a document with all versions, stored files and comparisons, and the requirements created from it."""
        by=(body.get('by') or '').strip()
        if not by:raise InputError('Name ist für das Löschen erforderlich.')
        lib=self.store.get('library_doc',body.get('library_id') or '')
        docs=self._docs(lib);ids={d['id'] for d in docs}
        reqs=[r['id'] for r in self.created_requirements(ids)]
        versions=[v['id'] for v in self.store.list('requirement_version') if v.get('requirement_id') in reqs]
        diffs=[d['id'] for d in self.store.filtered('document_diff','library_id',lib['id'])]
        reminders=[r['id'] for r in self.store.list('reminder') if (r.get('source') or {}).get('document_id') in ids]
        self.store.delete_many([('library_doc',lib['id'])]+[('document',i) for i in ids]+[('requirement',i) for i in reqs]
                               +[('requirement_version',i) for i in versions]+[('document_diff',i) for i in diffs]+[('reminder',i) for i in reminders])
        for d in docs:
            if not d.get('file_stored'):continue
            try:self._path(d).unlink(missing_ok=True)
            except (InputError,OSError):pass
        # The audit log keeps what was removed and by whom.
        self.store.event('library_delete',{'library_id':lib['id'],'title':lib['title'],'document_ids':sorted(ids),'requirement_ids':reqs,
                                           'by':by,'reason':(body.get('reason') or '').strip()})
        return {'library_id':lib['id'],'title':lib['title'],'versions':len(ids),'requirements':reqs}

    # --- Migration ---
    def migrate(self):
        moved=[]
        for doc in self.store.list('document'):
            if doc.get('library_id'):continue
            crit='CRITERIA' in doc['id'].upper() or 'kriterien' in (doc.get('name') or '').lower()
            lib={'id':'LIB-'+hashlib.sha256(doc['id'].encode()).hexdigest()[:8],'title':re.sub(r'\.(pdf|txt|md|docx)$','',doc.get('name') or doc['id'],flags=re.I),
                 'doc_type':'kriterien' if crit else 'sonstige','created_at':now(),'version_ids':[doc['id']]}
            paragraphs=doc.get('paragraphs') or build_paragraphs(doc.get('sections') or [])
            doc.update({'library_id':lib['id'],'version_no':1,'version_label':doc.get('version') or 'unbekannt','doc_type':lib['doc_type'],
                        'file_stored':False,'file_name':doc.get('name'),'file_ext':doc.get('kind') if doc.get('kind') in EXTS else None,
                        'valid_until':doc.get('valid_until'),'validity_confirmed':bool(doc.get('valid_from')),'status':'ready','withdrawn':None,
                        'paragraphs':paragraphs,'diff_id':None,'uploaded_at':None,'migrated':True,
                        'date_suggestions':self.suggest_dates('\n\n'.join(p['text'] for p in paragraphs))})
            self.store.put_many([('library_doc',lib),('document',doc)]);moved.append(doc['id'])
        if moved:self.store.event('library_migrate',{'document_ids':moved})
        return moved
