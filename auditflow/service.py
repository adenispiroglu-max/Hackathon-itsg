import base64
import copy
import hashlib
import io
import json
import re
from uuid import uuid4
from .domain import InputError, assess, check_chain, aggregate, check, validate_scenario
from .parser import parse, mutate, PARSER_VERSION
from .store import now
from .model import Model, ModelError, PROMPT_VERSION


def normalize(s):
    return re.sub(r'\s+',' ',re.sub(r'-\s*\n\s*','',s)).strip()


class Service:
    def __init__(self,store,sample):
        self.store=store;self.sample=sample

    def verify(self,req):
        doc=self.store.get('document',req['source_id'])
        sec=next((x for x in doc['sections'] if x['id']==req['section_id']),None)
        req['citation_status']='verified' if sec and normalize(req['source_excerpt']) in normalize(sec['text']) and normalize(req['source_excerpt']) else 'mismatch'
        return req

    def approve(self,kind,id,body):
        if kind not in ['requirement','case']:raise InputError('Unbekannte Freigabeart.')
        if not body.get('reviewer','').strip() or not body.get('note','').strip():
            raise InputError('Prüfername und fachliche Begründung sind erforderlich.')
        item=self.store.get(kind,id);approved=body.get('approve') is True
        if kind=='requirement':
            self.verify(item)
            if approved and item['citation_status']!='verified':raise InputError('Quellenzitat stimmt nicht überein.')
            item['status']='approved' if approved else 'rejected';item['semantic_review']=item['status']
        else:
            if approved and item['expected_message'] is None:raise InputError('Offene Erwartung kann nicht freigegeben werden.')
            item['review_status']='approved' if approved else 'rejected'
        item['reviewer']=body['reviewer'].strip();item['review_note']=body['note'].strip();item['reviewed_at']=now()
        self.store.put(kind,item);self.store.event('review',{'kind':kind,'id':id,'approved':approved,'reviewer':item['reviewer'],'note':item['review_note']})
        return item

    def import_document(self,body):
        name=body.get('name','').strip()
        if not name or len(name)>200:raise InputError('Dateiname fehlt oder ist zu lang.')
        try:raw=base64.b64decode(body['base64'],validate=True)
        except (KeyError,ValueError):raise InputError('Ungültiger Datei-Upload.') from None
        if len(raw)>5_000_000:raise InputError('Maximal 5 MB je Dokument.')
        sections=[]
        suffix=name.lower().rsplit('.',1)[-1]
        if suffix in ['txt','md']:
            try:text=raw.decode('utf-8-sig')
            except UnicodeError:raise InputError('Textdatei muss UTF-8 sein.') from None
            parts=re.split(r'\n\s*\n',text)
            sections=[{'id':f'p{i+1}','location':f'Abschnitt {i+1}','text':s} for i,s in enumerate(parts) if s.strip()]
        elif suffix=='pdf':
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(raw)) as pdf:
                    if len(pdf.pages)>500:raise InputError('Maximal 500 PDF-Seiten.')
                    sections=[{'id':f'page-{i+1}','page':i+1,'location':f'PDF-Seite {i+1}','text':p.extract_text() or ''} for i,p in enumerate(pdf.pages)]
            except ImportError:raise InputError('PDF-Import benötigt die optionalen Pakete aus requirements.txt.') from None
        elif suffix=='docx':
            try:
                from zipfile import ZipFile
                with ZipFile(io.BytesIO(raw)) as z:
                    if sum(x.file_size for x in z.infolist())>30_000_000:raise InputError('Entpacktes DOCX ist zu groß.')
                from docx import Document
                doc=Document(io.BytesIO(raw))
                sections=[{'id':f'p{i+1}','location':f'Absatz {i+1}','text':p.text} for i,p in enumerate(doc.paragraphs) if p.text.strip()]
                sections += [{'id':f't{ti+1}r{ri+1}','location':f'Tabelle {ti+1}, Zeile {ri+1}','text':' | '.join(c.text for c in r.cells)} for ti,t in enumerate(doc.tables) for ri,r in enumerate(t.rows)]
            except ImportError:raise InputError('DOCX-Import benötigt python-docx.') from None
        else:raise InputError('Unterstützt: TXT, MD, PDF, DOCX.')
        if not sections or not any(x['text'].strip() for x in sections):raise InputError('Kein Text erkannt. Für Scans ist externe OCR erforderlich.')
        hash=hashlib.sha256(raw).hexdigest()
        existing=next((d for d in self.store.list('document') if d['sha256']==hash),None)
        if existing:return existing
        doc={'id':str(uuid4()),'name':name,'version':body.get('version') or 'unbekannt','valid_from':body.get('valid_from') or None,
             'sha256':hash,'sections':sections,'kind':suffix,'note':'Importiert; Gültigkeit und Vollständigkeit prüfen.'}
        self.store.put('document',doc);self.store.event('document_import',{'id':doc['id'],'name':name,'hash':hash})
        return doc

    def draft(self,body):
        doc=self.store.get('document',body['document_id'])
        sec=next((s for s in doc['sections'] if s['id']==body['section_id']),None)
        if not sec:raise InputError('Quellabschnitt nicht gefunden.')
        if len(sec['text'])>35000:raise InputError('Pilotabschnitt zu lang; kleineren Abschnitt auswählen.')
        live=body.get('mode')=='live'
        if live:
            drafts=Model().extract(doc,sec)
        else:
            # Extraction assistance available with zero model calls: explicitly literal candidates.
            sentences=[s.strip() for s in re.split(r'\n|(?<=[.;])\s+',sec['text']) if len(s.strip())>35][:8]
            drafts=[{'title':s[:85],'criterion':s,'source_excerpt':s,'conditions':[],'exceptions':[],
                     'questions':['Wörtlicher Offline-Kandidat: Kontext, Ausnahmen und Regelzuordnung fachlich ergänzen.']} for s in sentences]
        created=[]
        for item in drafts:
            r={**item,'id':str(uuid4()),'source_id':doc['id'],'section_id':sec['id'],'status':'pending',
               'semantic_review':'pending','mapping':None,'ruleset':'unmapped','citation_status':'unverified',
               'model_id':Model().model if live else 'offline-literal','prompt_version':PROMPT_VERSION,
               'note':'KI-Vorschlag' if live else 'Wörtlicher Offline-Vorschlag, keine KI-Ausführung'}
            self.verify(r);self.store.put('requirement',r);created.append(r)
        self.store.event('requirements_drafted',{'document_id':doc['id'],'mode':'live' if live else 'offline','ids':[r['id'] for r in created]})
        return created

    def create_case(self,body):
        s=body['scenario'];validate_scenario(s)
        name=body.get('name','').strip()
        if not name:raise InputError('Testfallname fehlt.')
        ruleset=body.get('ruleset','fixture-2026')
        if ruleset!='fixture-2026':raise InputError('Nur Fixture-Regelsatz ist ausführbar; andere Versionen sind nicht implementiert.')
        expected=body.get('expected_message')
        if expected is not None and not isinstance(expected,bool):raise InputError('Erwartung muss true, false oder null sein.')
        item={'id':str(uuid4()),'name':name,'scenario':s,'expected_message':expected,'ruleset':ruleset,
              'review_status':'pending','expectation_source':body.get('expectation_source','Manueller Entwurf; Quelle ergänzen.'),
              'requirement_ids':['C1','C2','C4'],'fixture_questions':[]}
        self.store.put('case',item);self.store.event('case_created',{'id':item['id']});return item

    def run(self,body):
        case=self.store.get('case',body.get('case_id','CASE-001'))
        if case['ruleset']!='fixture-2026':raise InputError('Kein ausführbarer Prüfer für diesen Regelstand.')
        mode=body.get('mode','scenario')
        if mode not in ['scenario','message']:raise InputError('Unbekannter Prüfmodus.')
        rules={r['id']:r for r in self.store.list('requirement')}
        results=assess(case['scenario']);comparison=[];parsed=None;error=None
        raw=None
        if mode=='message':
            try:
                if body.get('base64'):
                    raw=base64.b64decode(body['base64'],validate=True)
                elif body.get('mutation'):
                    raw=mutate(self.sample,body['mutation'])
                else:raw=self.sample
                parsed=parse(raw)
                if parsed['abgabegrund']!='41' or 'dbvo' not in parsed:raise InputError('Ausführbarer Fixture-Prüfer unterstützt nur Abgabegrund 41 mit DBVO.')
                c=check_chain(parsed['dbvo']['periods'],case['scenario']);results.append(c)
                results.append(check('FORMAT','pass','Konsistentes Fixture-Layout',parsed['byte_length'],'raw_message'))
                results.append(check('GROUND_STATE','pass' if parsed['dbvo']['insurer_fields_zero'] else 'fail',
                                     'KK-Felder in AG-Fixture in Grundstellung',parsed['dbvo']['insurer_fields_zero'],'message.DBVO'))
                # All comparisons are explicitly fixture expectations; they do not certify the standard.
                expected={'reason':'41','current_begin':case['scenario']['current']['begin'],
                          'periods':sorted([{'begin':p['begin'],'end':p['end']} for p in case['scenario']['prior'] if p.get('certified')],key=lambda p:p['begin'],reverse=True)}
                actual={'reason':parsed['abgabegrund'],'current_begin':parsed['dbvo']['au_ab_ag'],'periods':parsed['dbvo']['periods']}
                if case['id']=='CASE-001':
                    expected.update(datensatz_id='00000000-0000-4000-8000-000000000001',azvu='DEMO-REFERENCE-001')
                    actual.update(datensatz_id=parsed['datensatz_id'],azvu=parsed.get('dbid',{}).get('aktenzeichen_verursacher'))
                for field in expected:
                    comparison.append({'field':field,'expected':expected[field],'actual':actual.get(field),
                                       'status':'pass' if expected[field]==actual.get(field) else 'fail'})
                if case['expected_message'] is False:
                    comparison.append({'field':'message_presence','expected':False,'actual':True,'status':'fail'})
            except (InputError,ValueError) as e:error=str(e)
        else:
            # Internal simulator shares the rule engine: explicitly not independent vendor validation.
            statuses=[r['status'] for r in results]
            simulated=False if 'fail' in statuses else None if 'not_assessable' in statuses else True
            if body.get('software_mode')=='buggy':simulated=True
            expected=case['expected_message']
            comparison=[{'field':'message_presence','expected':expected,'actual':simulated,
                         'status':'not_assessable' if expected is None or simulated is None else 'pass' if expected==simulated else 'fail'}]
        # Substantive approval is distinct from arithmetic and citation verification.
        for result in results:
            rule=rules.get(result['requirement_id'])
            if rule:
                result['source']={'document_id':rule['source_id'],'section_id':rule['section_id'],'excerpt':rule['source_excerpt']}
                result['computed_status']=result['status']
                if rule.get('status')!='approved':
                    result['status']='not_assessable';result['note']+=' Fachregel noch nicht freigegeben.'
            elif result['requirement_id'] in ['FORMAT','GROUND_STATE']:
                result['source']={'document_id':'fixture','section_id':'inferred-layout','excerpt':'Sample-specific structural check; normative technical schema not verified.'}
            if parsed and result['requirement_id']=='C3':
                block=parsed['blocks']['DBVO'];result['evidence'].update(block='DBVO',position=block['position'],position_basis='byte-1-based',raw=block['raw'])
        if case.get('review_status')!='approved':
            for row in comparison:
                row['computed_status']=row['status'];row['status']='not_assessable'
        # Compliance of a message vs eligibility of a scenario are different result axes.
        domain_status=aggregate(results)
        comparison_status=aggregate(comparison)
        combined=results+comparison
        run={'id':str(uuid4()),'created_at':now(),'case_id':case['id'],'case_name':case['name'],'ruleset':case['ruleset'],
             'mode':mode,'execution_mode':'simulation' if mode=='scenario' else 'imported_fixture',
             'overall_status':aggregate(combined if mode=='message' else comparison + [dict(status='not_assessable') for r in results if r['status']=='not_assessable'], bool(error)),'rule_status':domain_status,'comparison_status':comparison_status,
             'results':results,'comparison':comparison,'parsed':parsed,'error':error,
             'snapshot':copy.deepcopy(case),'requirements_snapshot':[rules[k] for k in ['C1','C2','C3','C4'] if k in rules],
             'checker_version':'fixture-rules-0.1','parser_version':PARSER_VERSION,'input_hash':hashlib.sha256(raw or json.dumps(case['scenario'],sort_keys=True).encode()).hexdigest(),
             'limitations':['Keine echte Abrechnungssoftware angebunden.','Nur vier Beispielkriterien; keine vollständige EEL-Konformitätsprüfung.',
                            'Fixture-Layout abgeleitet; technische Anlage nicht verifiziert.','Kein Zertifikat und keine verbindliche Leistungsberechnung.',
                            'Simulationsentscheidung und Regelprüfung teilen Logik; unabhängige Herstellerprüfung nicht nachgewiesen.']}
        self.store.put('run',run);self.store.event('test_run',{'run_id':run['id'],'status':run['overall_status'],'input_hash':run['input_hash']})
        return run

    def coverage(self):
        reqs=[r for r in self.store.list('requirement') if r.get('status')=='approved']
        cases=self.store.list('case');runs=self.store.list('run');cells=[]
        for r in reqs:
            for c in cases:
                if r['id'] not in c['requirement_ids']:continue
                latest=next((v for v in reversed(runs) if v['case_id']==c['id'] and v['ruleset']==c['ruleset'] and any(x['requirement_id']==r['id'] for x in v['results'])),None)
                result=next((x for x in latest['results'] if x['requirement_id']==r['id']),None) if latest else None
                stale=bool(latest and (latest['snapshot']!=c or next((x for x in latest['requirements_snapshot'] if x['id']==r['id']),None)!=r))
                cells.append({'requirement_id':r['id'],'case_id':c['id'],'case_approved':c['review_status']=='approved',
                              'status':'stale' if stale else result['status'] if result else 'not_run'})
        gaps=[r['id'] for r in reqs if not any(c['requirement_id']==r['id'] and c['case_approved'] for c in cells)]
        return {'requirements':reqs,'cases':cases,'cells':cells,'gaps':gaps}

    def diff(self,body):
        old=self.store.get('document',body['old_id']);new=self.store.get('document',body['new_id'])
        if old['id']==new['id']:raise InputError('Zwei unterschiedliche Dokumentstände auswählen.')
        a={s['id']:s for s in old['sections']};b={s['id']:s for s in new['sections']};changes=[]
        for id in sorted(a.keys()|b.keys()):
            if id not in a:kind='added'
            elif id not in b:kind='removed'
            elif normalize(a[id]['text'])!=normalize(b[id]['text']):kind='changed'
            else:continue
            changes.append({'section_id':id,'kind':kind,'before':a.get(id,{}).get('text'),'after':b.get(id,{}).get('text')})
        ids={x['section_id'] for x in changes}
        reqs=[r for r in self.store.list('requirement') if r['source_id']==old['id'] and any(r['section_id']==id or r['section_id'].startswith(id+'.') for id in ids)]
        affected={r['id'] for r in reqs}
        return {'changes':changes,'requirements':reqs,'cases':[c for c in self.store.list('case') if affected.intersection(c['requirement_ids'])],
                'limitations':'Struktureller Abschnittsvergleich; gleiche Abschnitts-IDs vorausgesetzt. Verschobene Definitionen und indirekte Abhängigkeiten manuell prüfen.'}
