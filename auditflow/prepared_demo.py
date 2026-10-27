"""Prepared, source-linked showcase data. Never presented as live model inference.
Only exact supplied file bytes match. Originals remain exclusively in runtime storage.
"""
import copy
import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path
from uuid import uuid4
from .domain import InputError
from .store import now

VERSION='itsg-demo-v1'
NOTE='Vorbereitete Demo · kein Live-KI-Aufruf · ausgewählte Prüfpunkte, keine vollständige Rechtsprüfung.'

@lru_cache(maxsize=1)
def catalogue():
    return json.loads(Path(__file__).with_name('prepared_demo_catalogue.json').read_text())['entries']

def by_hash(sha):return next((x for x in catalogue() if x['sha256']==sha),None)
def recognize(raw):return by_hash(hashlib.sha256(raw).hexdigest())

def excerpts(entry):
    sections={}
    for item in entry['requirements']:
        sec=sections.setdefault(item['section_id'],{'id':item['section_id'],'location':item['location'],'text':'','prepared_excerpt':True})
        if sec['id'].startswith('page-'):sec['page']=int(sec['id'][5:])
        sec['text']+=('\n\n' if sec['text'] else '')+item['quote']
    return list(sections.values())

def template(req):
    entry=by_hash(req.get('prepared_source_hash'))
    return next((x for x in entry['requirements'] if x['key']==req.get('prepared_key')),None) if entry else None

def review_result(req):
    item=template(req)
    if not item:raise InputError('Vorbereitete Demo-Vorlage nicht gefunden.')
    changed=req['criterion']!=item['criterion'] or req['title']!=item['title']
    question='Geänderten Demo-Entwurf fachlich prüfen; die vorbereitete Empfehlung gilt nur für die ursprüngliche Fassung.' if changed else item.get('question')
    return {'recommendation':'clarify' if question else 'recommend_approval',
            'reason':NOTE+(' '+question if question else ' Quellenbezug vorbereitet; menschliche Freigabe erforderlich.'),
            'issues':[] if not question else [{'target':'criterion','quote':req['criterion'],'start':0,'end':len(req['criterion']),
                'reason':question,'suggestion':'Kontext und Sollverhalten fachlich bestätigen und Entscheidung begründen.'}]}

def prepare(service,doc,entry):
    from .documents import review_basis
    with service.store.lock:
        current=service.store.get('document',doc['id'])
        if current.get('hidden') or current.get('trashed_at'):raise InputError('Demo-Quelle ist ausgeblendet oder im Papierkorb.')
        # Keep uploaded full text when already stored; never rewrite prior approved content.
        current.update(prepared_demo=VERSION,prepared_scope=entry['scope'],prepared_role=entry['role'],prepared_note=NOTE)
        old_reqs=service.store.filtered('requirement','source_id',doc['id'])
        superseded={v for r in old_reqs for v in [r.get('previous_requirement_id'),*r.get('previous_requirement_ids',[])] if v}
        predecessors=[r['id'] for r in old_reqs if not r.get('prepared_demo') and not r.get('trashed_at') and r['id'] not in superseded]
        writes=[('document',current)]
        for item in entry['requirements']:
            matching=[r for r in old_reqs if r.get('prepared_key')==item['key'] and r['id'] not in superseded]
            if matching:
                # Deleted/hidden items stay deleted/hidden. Manual edits and approvals stay intact.
                continue
            section=next((s for s in current['sections'] if s['id']==item['section_id']),None)
            if not section:continue # A partial PDF view never acquires an out-of-view requirement.
            # Locate a whitespace-tolerant quote in an older full-text import.
            normalized=lambda s:re.sub(r'-\s*\n\s*','',re.sub(r'\s+',' ',s)).strip()
            if normalized(item['quote']) not in normalized(section['text']):
                # Different PDF extraction layouts must not fabricate a verified citation.
                from .service import normalize
                if normalize(item['quote']) not in normalize(section['text']):continue
            req={'id':str(uuid4()),'created_at':now(),'source_id':doc['id'],'section_id':section['id'],
                 'title':item['title'],'criterion':item['criterion'],'source_excerpt':item['quote'],
                 'conditions':[],'exceptions':[],'questions':[item['question']] if item.get('question') else [],
                 'status':'pending','semantic_review':'pending','mapping':None,'ruleset':'unmapped',
                 'citation_status':'verified','prepared_demo':VERSION,'prepared_key':item['key'],
                 'prepared_source_hash':entry['sha256'],'prepared_scope':entry['scope'],
                 'model_id':None,'prompt_version':VERSION,'note':NOTE,'previous_requirement_ids':predecessors}
            service.verify(req)
            review={**review_result(req),'id':str(uuid4()),'status':'completed','mode':'demo','model_id':None,
                    'prompt_version':VERSION,'basis_hash':review_basis(req,current,section),'created_at':now(),
                    'document_id':doc['id'],'section_id':section['id']}
            req['ai_review']=review
            writes.extend([('requirement',req),('requirement_review',{**review,'requirement_id':req['id']})])
        jobs=service.store.filtered('document_job','document_id',doc['id'])
        job=next((j for j in reversed(jobs) if j.get('prepared_demo')==VERSION and j['status']=='completed'),None)
        if not job:
            job={'id':str(uuid4()),'document_id':doc['id'],'mode':'demo','status':'completed','cursor':len(current['sections']),
                 'total':len(current['sections']),'created_at':now(),'updated_at':now(),'finished_at':now(),'error':None,'prepared_demo':VERSION}
        # Reinsert a completion marker if a newer failed/live job exists; never claim that job succeeded.
        if jobs and jobs[-1]['id']!=job['id']:job={**job,'id':str(uuid4()),'created_at':now()}
        writes.append(('document_job',job));service.store.put_many(writes)
        service.store.event('prepared_demo_loaded',{'document_id':doc['id'],'catalogue':VERSION,'mode':'demo','scope':entry['scope']})
        return job

def cases(req,count,offset):
    item=template(req)
    if not item:raise InputError('Demo-Testvorlage fehlt.')
    if req['criterion']!=item['criterion'] or req['title']!=item['title']:
        raise InputError('Demo-Anforderung wurde geändert. Vorgefertigte Tests gelten nicht für die neue Fassung; ursprüngliche Vorlage verwenden oder Tests separat fachlich erstellen.')
    kind=item['kind'];variants=[]
    def v(title,inputs,field,value,rationale=None):
        variants.append((title,inputs,field,value,rationale or item['criterion']))
    if kind in ['attest','certificates']:
        for label,a,b in [('Nachweise vorhanden',True,True),('Nachweis fehlt',False,True),('Vorerkrankung nicht attestiert',True,False)]:
            v(label,{'aktuelle_AU_attestiert':a,'fruehere_AU_attestiert':b,'sonstige_Voraussetzungen':'erfüllt'},'nachweis_voraussetzung_erfuellt',a and (b if kind=='certificates' else True))
    elif kind=='months':
        v('Abstand deutlich innerhalb',{'Abstand_Kalendermonate':3,'Vorerkrankung_attestiert':True},'sechsmonatsbedingung_erfuellt',True)
        v('Abstand deutlich außerhalb',{'Abstand_Kalendermonate':8,'Vorerkrankung_attestiert':True},'sechsmonatsbedingung_erfuellt',False)
        v('Exakte Sechsmonatsgrenze',{'Abstand_Kalendermonate':6},'sechsmonatsbedingung_erfuellt',None,'Grenzkonvention ist fachlich zu bestätigen.')
    elif kind=='days':
        for days in [30,29,31]:v(str(days)+' systemseitige Tage',{'AU_Tage_im_System':days,'Zeitraum':'letzte zwölf Monate einschließlich aktueller AU','sonstige_Voraussetzungen':'erfüllt'},'mindestdauer_erreicht',days>=30)
    elif kind=='insurance':
        for ins,mini,result in [('gesetzlich',False,True),('privat',False,False),('gesetzlich',True,False)]:
            v(ins+' · '+('geringfügig' if mini else 'regulär'),{'Versicherung':ins,'geringfuegig':mini,'sonstige_Voraussetzungen':'erfüllt'},'teilnahme_am_verfahren_moeglich',result)
    elif kind=='full_month':
        for month in ['Februar vollständig','Januar vollständig','November vollständig']:v(month,{'Zahlungszeitraum':month},'Zahlungstage',30)
    elif kind=='partial_month':
        v('Beispiel 129',{'Zahlung_von':'26.11.','Zahlung_bis':'30.11.'},'Zahlungstage',5)
        v('Fehlerhafte Herstellerberechnung',{'Zahlung_von':'26.11.','Zahlung_bis':'30.11.','Herstellerwert':4},'Zahlungstage',5)
    elif kind in ['maternity_48','maternity_49']:
        net,days=(1500,30) if kind=='maternity_48' else (920,23)
        v('Rechenbeispiel der Quelle',{'Nettoentgelt_EUR':net,'Divisor_Kalendertage':days},'kalendertaegliches_Nettoentgelt_EUR',50)
        v('Abweichendes Herstellerergebnis',{'Nettoentgelt_EUR':net,'Divisor_Kalendertage':days,'Herstellerwert_EUR':49},'kalendertaegliches_Nettoentgelt_EUR',50)
    elif kind in ['count_one','count_two']:
        n=1 if kind=='count_one' else 2
        v('Beispiel aus Quelle',{'Beispiel':'13.1' if n==1 else '13.2','übernommene_Zeiträume':n},'ANZAHL_AU',n)
        v('Falsche Anzahl gemeldet',{'übernommene_Zeiträume':n,'Herstellerwert':n+1},'ANZAHL_AU',n)
    elif kind=='correction':
        v('Korrigierte KK-Mitteilung nach Versand',{'erste_Bescheinigung_versandt':True,'korrigierte_KK_Mitteilung':True},'Storno_Abgabegrund','88')
        v('Ersatzbescheinigung nach Storno',{'Storno_Abgabegrund':'88','korrigierte_KK_Mitteilung':True},'neuer_Abgabegrund','01')
    elif kind=='employment_end':v('Beschäftigungsende der Testkonstellation',{'Szenario':'gelieferte Hinweise'},'Beschaeftigungsende','2026-03-31')
    elif kind=='record_order':v('Satzfolge der Musterdatei',{'Datei':'gelieferte technische Musterdatei'},'Satzfolge','VOSZ,DSKO,DSLW,NCSZ')
    else:
        # A documented scenario assertion, not an invented statutory calculation.
        v('Quellenvorgabe umgesetzt',{'Prüfvorgabe':item['criterion'],'Testbeobachtung':'Vorgabe vollständig umgesetzt'},'quellenvorgabe_erfuellt',True)
        v('Abweichung von Quellenvorgabe',{'Prüfvorgabe':item['criterion'],'Testbeobachtung':'Vorgabe nicht umgesetzt'},'quellenvorgabe_erfuellt',False)
    variants.append(('Fehlende Eingabedaten',{'Prüfvorgabe':item['criterion'],'Eingabedaten_vollstaendig':False},'Ergebnis',None,'Fehlende Daten müssen fachlich ergänzt werden.'))
    result=[]
    for n in range(count):
        k=(offset+n)%len(variants);title,inputs,field,value,rationale=variants[k]
        result.append({'title':item['title']+' · '+title+f' · Variante {offset+n+1}',
                       'type':'missing_data' if k==len(variants)-1 else 'boundary' if value is None or kind=='days' and k==2 else 'positive' if k==0 else 'negative',
                       'profile':{'Profil_ID':f'DEMO-{item["key"]}-{offset+n+1}','Datentyp':'synthetisch','Regelstand':req.get('prepared_scope'),'Prüfbereich':item['title']},
                       'inputs':copy.deepcopy(inputs),'steps':['Synthetisches Profil und Eingaben in der Herstellersoftware anlegen.','Den beschriebenen Prüfpunkt ausführen und das beobachtete Ausgabefeld dokumentieren.','Ergebnis mit dem fachlich bestätigten Sollwert vergleichen.'],
                       'expected':{'field':field,'value':value,'rationale':rationale+' '+NOTE},
                       'questions':['Sollwert und Fehlerbehandlung unabhängig fachlich festlegen.'] if value is None else [],'prepared_demo':VERSION})
    return result
