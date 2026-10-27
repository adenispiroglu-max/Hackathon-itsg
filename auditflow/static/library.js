'use strict';
/* "Quellen & KI": document library (folders by document type), upload dialog with live steps,
   version detail, stored version comparison, text view, original file view/download, document delete,
   and the requirement detail with AI pre-review and human approval.
   Contract: .plans/dokumente-versionen-impl-contract.md (sections 2, 4, 5). Missing API fields
   render as empty states. Nothing here approves automatically; a quote match is no approval. */
const LIB_TYPES={gesetz:'Gesetz/Verordnung',spezifikation:'Technische Spezifikation',kriterien:'Prüfkriterien',sonstige:'Sonstige'};
const LIB_ORIGIN={ki_entwurf:'KI-Entwurf',manuell:'Von Hand geändert','übernommen_redaktionell':'Redaktionell übernommen',migration:'Aus Altbestand übernommen',offline_literal:'Wörtlicher Vorschlag'};
const LIB_KIND={added:'Neu',removed:'Entfernt',changed:'Geändert'};
const LIB_CLASS={redaktionell:'Redaktionell',fachlich:'Fachlich',offen:'Einstufung offen'};
const LIB_CLASS_SRC={ki:'Einstufung durch KI',mensch:'Einstufung durch einen Menschen',keine:'Ohne KI-Schlüssel keine Einstufung'};
const LIB_CRITERIA=[['quellenbezug','Quellenbezug','Stützt die zitierte Textstelle die Aussage?'],['vollstaendigkeit','Vollständigkeit','Sind Bedingungen, Ausnahmen und Gültigkeitsdatum berücksichtigt?'],['widersprueche','Widersprüche','Passt die Anforderung zu anderen Anforderungen und zum richtigen Dokumentstand?'],['pruefbarkeit','Prüfbarkeit','Lässt sich ein eindeutiger Test mit erwartetem Ergebnis ableiten?'],['aenderungen','Änderungen','Was unterscheidet sich von der zuletzt freigegebenen Version?']];
const LIB_STEPS=['Datei geprüft','Text gelesen','Dokument erkannt','Gespeichert','Änderungen verglichen','Anforderungen aktualisiert','Zusammenfassung'];
let libFetch={state:'idle'},libUpload=null,libPollBusy=false;
const libDiffs={},libReqVersions={};
const libList=v=>Array.isArray(v)?v:[];
const libEnc=encodeURIComponent;
const libToday=()=>state?.certification?.today||new Date().toISOString().slice(0,10);
// Focus can linger inside a closed dialog; only forms that are still visible block a re-render.
const libEditing=()=>{const d=document.getElementById('dialog');if(d.open)return true;const f=document.activeElement?.closest('form');return !!f&&!d.contains(f);};
function libRerender(pages=['sources','requirements']){if(state&&pages.includes(route())&&!libEditing())render();}

/* Listing: GET /api/state → library; falls back to GET /api/library, then to the legacy documents. */
function libListing(){
 if(state.library&&Array.isArray(state.library.folders))return {folders:state.library.folders};
 if(libFetch.state==='idle'){libFetch={state:'busy'};api('library').then(d=>{libFetch={state:'done',data:d};libRerender(['sources']);}).catch(err=>{libFetch={state:'failed',error:err.message};libRerender(['sources']);});}
 if(libFetch.state==='done'&&Array.isArray(libFetch.data?.folders))return {folders:libFetch.data.folders};
 const docs=state.documents.map(d=>{const t=d.doc_type||(d.id==='DOC-CRITERIA'?'kriterien':'sonstige');const v={id:d.id,version_no:d.version_no||1,version_label:d.version_label||d.version,file_name:d.file_name||d.name,file_ext:d.file_ext||null,file_stored:!!d.file_stored,sha256:d.sha256,valid_from:d.valid_from,valid_until:d.valid_until||null,validity_confirmed:!!d.validity_confirmed,uploaded_at:d.uploaded_at||null,withdrawn:d.withdrawn||null,diff_id:d.diff_id||null};return {library_id:d.library_id||'legacy:'+d.id,title:d.name,doc_type:t,current:v,versions:[v],pending_requirements:state.requirements.filter(r=>r.source_id===d.id&&r.status==='pending').length};});
 return {folders:Object.entries(LIB_TYPES).map(([t,l])=>({doc_type:t,label:l,documents:docs.filter(x=>x.doc_type===t)})),derived:true,loading:libFetch.state==='busy',error:libFetch.error};
}
function libAllDocs(lst){return libList(lst.folders).flatMap(f=>libList(f.documents).map(d=>({...d,doc_type:d.doc_type||f.doc_type,versions:libList(d.versions).length?libList(d.versions):d.current?[d.current]:[]})));}
function libStatus(v){
 const s=v?.status;let code,label;
 if(s&&typeof s==='object'){code=s.code;label=s.label;}
 else if(s==='processing'){code='processing';label='Wird verarbeitet';}
 else if(s==='error'){code='error';label='Fehler beim Lesen';}
 else if(v?.valid_until&&v.valid_until<libToday()){code='expired';label='Abgelaufen';}
 else{code='ready';label='Bereit';}
 const cls={ready:'approved',processing:'pending',error:'fail',superseded:'',expired:'stale'}[code]||'';
 return `<span class="pill ${cls}">${e(label)}</span>`+(v?.withdrawn?`<span class="pill rejected" title="${e(v.withdrawn.reason||'')}">Zurückgezogen${v.withdrawn.reason?': '+e(String(v.withdrawn.reason).slice(0,60)):''}</span>`:'');
}
function libValidity(v){const from=v?.valid_from?dayDe(v.valid_from):null,until=v?.valid_until?dayDe(v.valid_until):null;if(!from&&!until)return 'Ab Upload · Gültigkeit nicht bestätigt';return (from?'ab '+from:'ab Upload')+(until?' bis '+until:'')+(v.validity_confirmed===false?' · nicht bestätigt':'');}
const libVerName=v=>'Version '+(v?.version_label||v?.version_no||'—');
const libField=(label,value,tip='')=>`<div><dt>${e(label)}${tip?' '+tip:''}</dt><dd>${value}</dd></div>`;

/* Highlight excerpts in text (whitespace- and case-tolerant, like the backend normalize). */
function libMark(text,needles){
 const src=String(text??'');const ranges=[];
 for(const n of libList(needles)){const words=String(n?.text||'').trim().split(/\s+/).filter(Boolean);if(!words.length)continue;const re=new RegExp(words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+'),'gi');let m;while((m=re.exec(src))){ranges.push([m.index,m.index+m[0].length,n.cls||'ai-mark']);if(!m[0].length)re.lastIndex++;}}
 if(!ranges.length)return e(src);
 ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);let out='',pos=0;
 for(const [s,t,c] of ranges){if(s<pos)continue;out+=e(src.slice(pos,s))+`<mark class="${c}">${e(src.slice(s,t))}</mark>`;pos=t;}
 return out+e(src.slice(pos));
}
/* Word diff. Uses stored backend word ops when present; otherwise a small LCS over words. */
function libWordOps(a,b){
 const A=String(a??'').split(/(\s+)/).filter(x=>x!==''),B=String(b??'').split(/(\s+)/).filter(x=>x!=='');
 if(A.length*B.length>400000)return [{op:'delete',text:A.join('')},{op:'insert',text:B.join('')}];
 const n=A.length,m=B.length,T=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)T[i][j]=A[i]===B[j]?T[i+1][j+1]+1:Math.max(T[i+1][j],T[i][j+1]);
 const ops=[];const add=(op,text)=>{const l=ops[ops.length-1];if(l&&l.op===op)l.text+=text;else ops.push({op,text});};
 let i=0,j=0;while(i<n&&j<m){if(A[i]===B[j]){add('equal',A[i]);i++;j++;}else if(T[i+1][j]>=T[i][j+1])add('delete',A[i++]);else add('insert',B[j++]);}
 while(i<n)add('delete',A[i++]);while(j<m)add('insert',B[j++]);return ops;
}
function libSideBySide(before,after,words,labels=['Vorher','Nachher']){
 const ops=libList(words).length?words:libWordOps(before,after);
 const left=ops.filter(w=>w.op!=='insert').map(w=>w.op==='delete'?`<del>${e(w.text)}</del>`:e(w.text)).join('');
 const right=ops.filter(w=>w.op!=='delete').map(w=>w.op==='insert'?`<ins>${e(w.text)}</ins>`:e(w.text)).join('');
 return `<div class="diff-cols"><div><span class="diff-label">${e(labels[0])}</span><div class="diff-text">${before===undefined||before===null?'<span class="muted">—</span>':left}</div></div><div><span class="diff-label">${e(labels[1])}</span><div class="diff-text">${after===undefined||after===null?'<span class="muted">—</span>':right}</div></div></div>`;
}

/* Page */
function libDescription(d){
 if(d.description)return d.description;
 const first=state.documents.find(x=>x.id===libList(d.versions).slice(-1)[0]?.id)||{};
 if(first.migrated&&first.note)return first.note;
 const cur=state.documents.find(x=>x.id===d.current?.id)||first;const text=libList(cur.sections).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();
 return text?(text.length>140?text.slice(0,140)+' …':text):'Keine Beschreibung.';
}
function librarySources(){
 const lst=libListing(),params=hashParams(),all=libAllDocs(lst).sort((a,b)=>String(a.title).localeCompare(String(b.title),'de'));
 const diffId=params.get('diff');const dd=diffId?libDiffGet(diffId):null;
 const wantVersion=params.get('version')||(dd?.data?.new_version_id)||null;
 let doc=all.find(d=>d.library_id===params.get('doc'));
 if(!doc&&wantVersion)doc=all.find(d=>d.versions.some(v=>v.id===wantVersion));
 if(!doc&&dd?.data?.library_id)doc=all.find(d=>d.library_id===dd.data.library_id);
 const notices=(lst.derived?`<div class="notice">${lst.loading?'Dokumente werden geladen …':'Die Dokumentenablage ist vom Backend noch nicht verfügbar'+(lst.error?' ('+e(lst.error)+')':'')+'. Angezeigt werden die vorhandenen Dokumente als Version 1, ohne Originaldatei.'}</div>`:'');
 // Detail view: one document with all versions and all requirements extracted from it.
 if(doc||dd)return `<div class="actions cust-back"><a class="btn small" href="#sources">← Alle Dokumente</a></div>`+notices+(dd&&!doc?libDiffPanel(diffId):'')+(doc?libDocDetail(doc,params,diffId):'');
 const rows=all.map(d=>{const v=d.current||libList(d.versions)[0];const n=Number(d.pending_requirements)||0;const count=libList(d.versions).length;const reqs=state.requirements.filter(r=>d.versions.some(x=>x.id===r.source_id)).length;
  return `<div class="lib-doc-row lib-list-row"><span class="doc-row-icon">${uiIcon('document')}</span><span class="cert-row-main"><strong>${e(d.title)}</strong><small class="lib-desc">${e(libDescription(d))}</small><small>${e(libVerName(v))} · ${count===1?'1 Version':count+' Versionen'} · ${reqs===1?'1 Anforderung':reqs+' Anforderungen'}</small></span><span class="cert-row-side">${v?libStatus(v):''}${n?`<span class="pill pending">${n} wartet auf Freigabe</span>`:''}<a class="btn small" href="#sources?doc=${libEnc(d.library_id)}">Detaillierte Informationen</a></span></div>`;}).join('');
 return heading('Backend 1 · Quellen & Extraktion','Jede Regel beginnt mit einer Quelle.','Alle Dokumente mit Version und Kurzbeschreibung. Ein Upload erkennt Duplikate und neue Versionen und vergleicht automatisch mit dem bisherigen Stand.',btn('+ Dokument hochladen','lib-upload','','primary'))+notices+
 `<label class="drop-box drop-page" for="lib-page-file" data-drop="page"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><strong>Dokument hochladen</strong><span>Datei hierher ziehen oder klicken · TXT, MD, PDF oder DOCX</span><input id="lib-page-file" class="drop-input" type="file" accept=".txt,.md,.pdf,.docx"></label>`+
 `<section class="panel" aria-label="Dokumente"><div class="panel-header"><h2>Dokumente</h2><span class="subtle-chip">${all.length===1?'1 Dokument':all.length+' Dokumente'}</span></div>${all.length?rows:`<div class="cert-empty"><strong>Noch keine Dokumente.</strong><p>Die erste Quelle über „+ Dokument hochladen“ hinzufügen.</p></div>`}</section>`;
}
function libDocDetail(doc,params,diffId){
 const versions=doc.versions;const cur=doc.current||versions[0];
 const v=versions.find(x=>x.id===params.get('version'))||(diffId&&libDiffs[diffId]?.data?versions.find(x=>x.id===libDiffs[diffId].data.new_version_id):null)||cur||versions[0];
 if(!v)return `<section class="panel"><h2>${e(doc.title)}</h2><p class="muted">Keine Versionen.</p></section>`;
 const full=state.documents.find(d=>d.id===v.id)||{};
 const allReqs=state.requirements.filter(r=>versions.some(x=>x.id===r.source_id));
 const pending=allReqs.filter(r=>r.status==='pending').length;
 const base='#sources?doc='+libEnc(doc.library_id)+'&version=';
 const table=`<div class="table-wrap"><table><thead><tr><th>Version</th><th>Hochgeladen</th><th>Gültigkeit</th><th>Status</th><th></th></tr></thead><tbody>${versions.map(x=>`<tr class="${x.id===v.id?'lib-selected-row':''}"><td><strong>${e(x.version_label||'—')}</strong><br><small class="muted">Nr. ${e(x.version_no||'—')}${cur&&x.id===cur.id?' · aktueller Stand':''}</small></td><td>${x.uploaded_at?e(custFmt(x.uploaded_at)):'<span class="muted">Altbestand</span>'}</td><td>${e(libValidity(x))}</td><td><div class="lib-pills">${libStatus(x)}</div></td><td>${x.id===v.id?'<span class="subtle-chip">ausgewählt</span>':`<a class="btn small" href="${base+libEnc(x.id)}">Ansehen</a>`}</td></tr>`).join('')}</tbody></table></div>`;
 const ext=v.file_ext||full.file_ext||full.kind;const stored=!!v.file_stored;
 const actions=`${btn(ext==='pdf'&&stored?'PDF öffnen ↗':'Text ansehen','lib-open',`data-id="${e(v.id)}" data-pdf="${ext==='pdf'&&stored?1:0}"`,'small')}${stored?btn('Herunterladen','lib-download',`data-id="${e(v.id)}" data-name="${e(v.file_name||full.name||'dokument')}"`,'small'):''}`;
 const pr=full.page_range||v.page_range;
 const info=`<dl class="field-list lib-fields">${libField('Datei',e(v.file_name||full.name||'—')+(stored?'':' <span class="pill">Originaldatei nicht gespeichert</span>'))}${libField('Dokumenttyp',e(LIB_TYPES[doc.doc_type]||doc.doc_type||'Sonstige'))}${libField('Gültig ab',v.valid_from?e(dayDe(v.valid_from)):'ab Upload')}${libField('Gültig bis',v.valid_until?e(dayDe(v.valid_until)):'läuft nicht ab')}${libField('Gültigkeit',v.validity_confirmed?'bestätigt':'Gültigkeit nicht bestätigt')}${libField('Status',`<span class="lib-pills">${libStatus(v)}</span>`)}${libField('Hochgeladen',v.uploaded_at?e(custFmt(v.uploaded_at)):'Altbestand (vor der Dokumentenablage importiert)')}${libField('Absätze',e(v.paragraphs??libList(full.paragraphs).length??'—'))}${libField('Importumfang',pr?e(`Seiten ${pr.from}–${pr.to} (Altbestand, nur lesbar)`):'vollständiges Dokument')}</dl>`;
 const withdrawn=v.withdrawn?`<div class="note"><strong>Zurückgezogen</strong> von ${e(v.withdrawn.by)} am ${e(custFmt(v.withdrawn.at))}: ${e(v.withdrawn.reason)}. Die Version bleibt sichtbar, zählt aber nicht mehr als aktueller Stand.</div>`:'';
 const verOf=id=>versions.find(x=>x.id===id);
 const reqList=`<section class="panel"><div class="panel-header"><div><h2>Extrahierte Anforderungen</h2><p class="muted">Aus allen Versionen dieses Dokuments${pending?` · ${pending} warten auf Freigabe`:''}</p></div>${pending?`<a class="btn small" href="#requirements?doc=${libEnc(v.id)}">Zur Freigabe</a>`:''}</div>${allReqs.length?allReqs.map(r=>`<a class="doc-row" href="#requirements?id=${libEnc(r.id)}"><div class="cert-row-main"><strong>${e(r.id)} <span>· ${e(r.title)}</span></strong><small>${r.version_no?'Anforderung v'+e(r.version_no)+' · ':''}zitiert ${e(libVerName(verOf(r.source_id)))}</small></div><div class="cert-row-side lib-pills">${reqAiBadge(r)}${reqApprovalBadge(r)}</div></a>`).join(''):'<p class="muted">Noch keine Anforderungen aus diesem Dokument. Unten aus einem Quellabschnitt Vorschläge erstellen.</p>'}</section>`;
 const sections=libList(full.sections);
 if(sections.length){if(activeDoc!==v.id){activeDoc=v.id;activeSection=null;}if(!sections.some(s=>s.id===activeSection))activeSection=sections[0].id;}
 const sec=sections.find(s=>s.id===activeSection);
 const drafting=sections.length?`<section class="panel"><h2>Anforderungen aus einem Abschnitt entwerfen</h2><div class="field"><label for="source-section">Quellabschnitt</label><select id="source-section">${sections.map(s=>`<option value="${e(s.id)}" ${s.id===sec?.id?'selected':''}>${e(s.location||s.id)}</option>`).join('')}</select></div><div class="source-text">${e(sec?.text||'Kein Text')}</div><div class="actions">${btn('Wörtliche Vorschläge','draft','data-mode="offline"','small')}${btn('Mit KI extrahieren','draft','data-mode="live"','small primary')}${btn('KI-Verbindung testen','model-test','','small')}</div><p class="muted">Offline: wörtliche Textkandidaten. KI: Modellaufruf, Ausgabeprüfung und Quellenabgleich. Alle Vorschläge bleiben offen.</p></section>`:'';
 const diff=v.diff_id?libDiffPanel(v.diff_id):(versions.length>1&&v.version_no>1?'<section class="panel"><h2>Vergleich zur Vorversion</h2><p class="muted">Kein gespeicherter Vergleich: keine inhaltlichen Änderungen gefunden oder Vergleich nicht verfügbar.</p></section>':'');
 return `<section class="panel"><div class="panel-header"><div><div class="lib-type">${e(LIB_TYPES[doc.doc_type]||'Sonstige')}</div><h2>${e(doc.title)}</h2><p class="muted">${versions.length===1?'1 Version':versions.length+' Versionen'}${cur?' · aktueller Stand '+e(libVerName(cur)):''} ${term('dokumentversion')}</p></div>${btn('+ Neue Version hochladen','lib-upload',`data-type="${e(doc.doc_type)}"`,'small')}${doc.library_id.startsWith('legacy:')?'':btn('Dokument löschen','lib-delete',`data-id="${e(doc.library_id)}"`,'small danger')}</div>${table}</section>`+
 `<section class="panel" id="lib-version"><div class="panel-header"><h2>${e(libVerName(v))}</h2><div class="actions">${actions}</div></div>${withdrawn}${info}${full.note?`<p class="muted">${e(full.note)}</p>`:''}</section>`+diff+reqList+drafting+
 `<section class="panel">${techDetails({'Dokument-ID (Version)':v.id,'Ablage-ID':doc.library_id.startsWith('legacy:')?'—':doc.library_id,'Fingerabdruck (SHA-256)':v.sha256||full.sha256,'Dateiformat':ext,'Vergleich-ID':v.diff_id})}</section>`;
}

/* Stored diff */
function libDiffGet(id){if(!libDiffs[id]){libDiffs[id]={busy:true};api('library/diff/'+libEnc(id)).then(d=>{libDiffs[id]={data:d};libRerender();}).catch(err=>{libDiffs[id]={error:err.message};libRerender();});}return libDiffs[id];}
function libDiffSummary(s){if(!s)return '';return `${Number(s.changed)||0} Absätze geändert, ${Number(s.added)||0} neu, ${Number(s.removed)||0} entfernt · ${Number(s.affected)||0} Anforderungen betroffen · Änderungen: ${Number(s.fachlich)||0} fachlich, ${Number(s.redaktionell)||0} redaktionell${s.offen?', '+Number(s.offen)+' noch nicht eingestuft':''}`;}
function libDiffPanel(id){
 const c=libDiffGet(id);
 const head='<div class="panel-header"><div><h2 id="lib-diff">Vergleich zur Vorversion</h2><p class="muted">Gespeicherter Absatzvergleich über Seitengrenzen hinweg</p></div></div>';
 if(c.busy)return `<section class="panel">${head}<p class="muted">Vergleich wird geladen …</p></section>`;
 if(c.error)return `<section class="panel">${head}<div class="note">Vergleich konnte nicht geladen werden: ${e(c.error)}</div></section>`;
 const d=c.data,changes=libList(d.changes);
 const accepted=new Set(libList(d.editorial_accepted).flatMap(a=>libList(a.change_ids)));
 const editorial=changes.filter(x=>x.classification==='redaktionell'&&!accepted.has(x.id));
 const affected=libList(d.affected_requirement_ids);
 const loc=(ref,l)=>[ref,l].filter(Boolean).join(' · ')||'—';
 const rows=changes.map(x=>`<article class="diff-change kind-${e(x.kind)}"><div class="diff-head"><span class="pill ${x.kind==='added'?'pass':x.kind==='removed'?'fail':'pending'}">${e(LIB_KIND[x.kind]||x.kind)}</span><small class="muted">${x.kind!=='added'?'Bisher: '+e(loc(x.old_ref,x.old_location)):''}${x.kind==='changed'?' → ':''}${x.kind!=='removed'?'Neu: '+e(loc(x.new_ref,x.new_location)):''}</small><span class="diff-class"><span class="pill ${x.classification==='fachlich'?'fail':x.classification==='redaktionell'?'approved':''}">${e(LIB_CLASS[x.classification]||'Einstufung offen')}</span>${accepted.has(x.id)?'<span class="pill approved">übernommen</span>':''}</span></div>${libSideBySide(x.kind==='added'?null:x.before,x.kind==='removed'?null:x.after,x.kind==='changed'?x.words:null)}<div class="diff-foot"><small class="muted">${e(LIB_CLASS_SRC[x.classification_source]||LIB_CLASS_SRC.keine)}${x.classification_reason?' · '+e(x.classification_reason):''}</small><span class="actions">${x.classification==='redaktionell'&&!accepted.has(x.id)?`<label class="diff-pick"><input type="checkbox" form="lib-editorial-form" name="change_ids" value="${e(x.id)}" checked> übernehmen</label>`:''}${x.classification!=='fachlich'&&!accepted.has(x.id)?btn('Als fachlich markieren','lib-reclassify',`data-diff="${e(d.id)}" data-change="${e(x.id)}"`,'small'):''}</span></div></article>`).join('');
 const done=libList(d.editorial_accepted).map(a=>`<li>${libList(a.change_ids).length} Änderungen übernommen von ${e(a.reviewer)} am ${e(custFmt(a.at))}${a.note?': '+e(a.note):''}${libList(a.skipped).length?` · nicht übernommen: ${libList(a.skipped).map(s=>e(s.id)+' ('+e(s.reason)+')').join(', ')}`:''}</li>`).join('');
 const bulk=editorial.length?`<form id="lib-editorial-form" class="cust-form lib-bulk"><input type="hidden" name="diff_id" value="${e(d.id)}"><h3>${editorial.length===1?'1 redaktionelle Änderung':editorial.length+' redaktionelle Änderungen'} übernehmen ${term('aenderung')}</h3><p class="muted">Die betroffenen Anforderungen erhalten eine neue Version, die ihre bisherige Freigabe übernimmt. Ohne diese Bestätigung wird keine Freigabe übernommen. Einzelne Änderungen lassen sich vorher als fachlich markieren.</p>${custPeople('lib-ed')}<button class="btn primary">Ausgewählte übernehmen</button></form>`:'';
 return `<section class="panel lib-diff">${head}<p><strong>${e(libDiffSummary(d.summary))}</strong></p>${changes.some(x=>!x.classification||x.classification==='offen')?'<div class="notice">Ohne KI-Schlüssel bleibt die Einstufung offen. Eine offene Änderung gilt nie als redaktionell; betroffene Anforderungen brauchen eine neue Freigabe.</div>':''}${affected.length?`<div class="lib-affected"><span class="muted">Betroffene Anforderungen:</span> ${affected.map(r=>`<a class="filter-chip" href="#requirements?id=${libEnc(r)}">${e(r)}</a>`).join(' ')}</div>`:''}${done?`<ul class="decision-list">${done}</ul>`:''}${changes.length?rows:'<p class="muted">Keine Änderungen.</p>'}${bulk}</section>`;
}

/* Text view (paragraph numbers) and original file */
async function libTextView(id,needles=[]){
 modal('<h2>Text wird geladen …</h2>');
 let data;try{data=await api('library/version/'+libEnc(id)+'/text');}
 catch(err){const d=state.documents.find(x=>x.id===id);if(!d){modal(`<h2>Text nicht verfügbar</h2><p>${e(err.message)}</p>`);return;}data={name:d.name,version_label:d.version,paragraphs:libList(d.sections).map((s,i)=>({ref:'¶'+(i+1),location:s.location||s.id,page:s.page||null,text:s.text}))};}
 const paras=libList(data.paragraphs);
 modal(`<div class="eyebrow">TEXTANSICHT</div><h2>${e(data.name||'Dokument')}</h2><p class="muted">${e(libVerName(data))} · ${paras.length} Absätze${needles.length?' · Markierungen der KI-Vorprüfung sind hervorgehoben':''}</p><div class="lib-text">${paras.map(p=>`<div class="lib-para"><span class="lib-ref">${e(p.ref||'')}${p.page?' · Seite '+e(p.page):p.location?' · '+e(p.location):''}</span><p>${libMark(p.text,needles)}</p></div>`).join('')||'<p class="muted">Kein Text.</p>'}</div>`);
 document.querySelector('#dialog mark')?.scrollIntoView({block:'center'});
}
async function libFileBlob(id,download){const r=await fetch('/api/library/version/'+libEnc(id)+'/file'+(download?'?download=1':''),{headers:token()?{Authorization:'Bearer '+token()}:{}});if(!r.ok){let m='Datei nicht verfügbar.';try{m=(await r.json()).error||m;}catch{}throw Error(m);}return r.blob();}
async function libOpenPdf(id){const w=window.open('','_blank');try{const blob=await libFileBlob(id,false);const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));if(w)w.location.href=url;else window.location.assign(url);setTimeout(()=>URL.revokeObjectURL(url),120000);}catch(err){if(w)w.close();throw err;}}
async function libDownload(id,name){const blob=await libFileBlob(id,true);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name||'dokument';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function libDeleteDialog(id){
 const doc=libAllDocs(libListing()).find(d=>d.library_id===id);if(!doc)throw Error('Dokument nicht gefunden.');
 const ids=new Set(doc.versions.map(v=>v.id));const reqs=state.requirements.filter(r=>ids.has(r.source_id));const reqIds=new Set(reqs.map(r=>r.id));
 const cases=state.cases.filter(c=>(c.requirement_ids||[]).some(x=>reqIds.has(x)));
 modal(`<div class="eyebrow">DOKUMENT LÖSCHEN</div><h2>${e(doc.title)}</h2><div class="note">Das Löschen kann nicht rückgängig gemacht werden. Im Prüfprotokoll bleibt vermerkt, wer was gelöscht hat.</div><p><strong>Gelöscht werden:</strong></p><ul class="lib-delete-list"><li>${doc.versions.length===1?'1 Version':doc.versions.length+' Versionen'} mit Originaldateien und gespeicherten Vergleichen</li><li>${reqs.length===1?'1 Anforderung':reqs.length+' Anforderungen'} aus diesem Dokument, mit Versionen und Freigaben${reqs.length?`<ul>${reqs.slice(0,8).map(r=>`<li>${e(String(r.title||r.id).slice(0,90))}</li>`).join('')}${reqs.length>8?`<li>und ${reqs.length-8} weitere</li>`:''}</ul>`:''}</li></ul>${cases.length?`<p class="muted">${cases.length===1?'1 Testfall prüft':cases.length+' Testfälle prüfen'} diese Anforderungen. Die Testfälle bleiben erhalten; für gelöschte Anforderungen liefern sie nur noch „nicht beurteilbar“.</p>`:''}<form id="lib-delete-form" class="cust-form"><input type="hidden" name="library_id" value="${e(id)}"><div class="field"><label for="lib-del-by">Dein Name</label><input id="lib-del-by" name="by" required maxlength="100" autocomplete="name" value="${e(custReviewer())}"></div><div class="field"><label for="lib-del-reason">Grund (optional)</label><input id="lib-del-reason" name="reason" maxlength="500"></div><button class="btn danger">Endgültig löschen</button></form>`);
}

/* Upload dialog with live steps */
function libUploadDialog(type){
 libUpload={phase:'form',steps:LIB_STEPS.map(()=>({status:'wait',detail:''})),analyse:null,result:null};
 const opts=Object.entries(LIB_TYPES).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${e(v)}</option>`).join('');
 modal(`<div class="eyebrow">QUELLEN & KI</div><h2>Dokument hochladen</h2><p class="muted">TXT, MD, PDF oder DOCX · immer vollständiger Import · keine automatische Freigabe.</p><form id="lib-upload-form" class="cust-form"><label class="drop-box" for="lib-file" data-drop="dialog"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><strong>Datei hierher ziehen</strong><span>oder klicken, um eine Datei auszuwählen</span><span class="drop-name" id="lib-file-name">Keine Datei ausgewählt</span><input id="lib-file" class="drop-input" name="file" type="file" accept=".txt,.md,.pdf,.docx" required></label><div class="form-row"><div class="field"><label for="lib-label">Versionsbezeichnung (Pflicht)</label><input id="lib-label" name="version_label" required maxlength="100" placeholder="z. B. 2027-01"><small>Die Anwendung errät die Version nie.</small></div><div class="field"><label for="lib-type">Dokumenttyp</label><select id="lib-type" name="doc_type"><option value="">Vorschlag nach Erkennung</option>${opts}</select></div></div><div class="form-row"><div class="field"><label for="lib-from">Gültig ab (optional)</label><input id="lib-from" name="valid_from" type="date"></div><div class="field"><label for="lib-until">Gültig bis (optional)</label><input id="lib-until" name="valid_until" type="date"></div></div><small class="muted">Ohne Datum gilt die Version ab dem Upload, läuft nicht ab und erhält den Hinweis „Gültigkeit nicht bestätigt“.</small><div class="field"><label for="lib-desc">Kurzbeschreibung (optional)</label><input id="lib-desc" name="description" maxlength="300" placeholder="Worum geht es in diesem Dokument?"><small>Erscheint in der Dokumentenliste. Leer lassen, um eine bestehende Beschreibung zu behalten.</small></div><div id="lib-dates"></div><div class="actions lib-upload-actions"><button class="btn primary" id="lib-analyse">Prüfen und weiter</button></div></form><ol class="lib-steps" id="lib-steps" aria-live="polite"></ol><div id="lib-choice"></div>`);
 libStepsRender();
}
function libStepsRender(){
 const el=document.getElementById('lib-steps');if(!el||!libUpload)return;
 const mark={wait:'',run:'…',ok:'✓',fail:'!',skip:'–'},text={wait:'wartet',run:'läuft',ok:'erledigt',fail:'Fehler',skip:'übersprungen'};
 el.innerHTML=LIB_STEPS.map((l,i)=>{const s=libUpload.steps[i];return `<li class="lib-step ${s.status}"><span class="lib-step-mark" aria-hidden="true">${mark[s.status]}</span><div><strong>${i+1}. ${e(l)}</strong> <span class="sr-only">(${text[s.status]})</span>${s.detail?`<small>${s.detail}</small>`:''}</div></li>`;}).join('');
}
const libStepState=s=>({ok:'ok',done:'ok',fertig:'ok',skipped:'skip','übersprungen':'skip',error:'fail',fehler:'fail',running:'run'}[s]||'ok');
function libSetStep(i,status,detail=''){if(!libUpload)return;libUpload.steps[i]={status,detail};libStepsRender();}
function libChoiceRender(){
 const el=document.getElementById('lib-choice');if(!el||!libUpload?.analyse)return;
 const a=libUpload.analyse,all=libAllDocs(libListing()).filter(d=>!String(d.library_id).startsWith('legacy:'));
 const others=all.filter(d=>d.library_id!==a.suggestion?.library_id);
 const pick=list=>`<div class="form-row lib-pick"><div class="field"><label for="lib-other">Bestehendes Dokument</label><select id="lib-other">${list.map(d=>`<option value="${e(d.library_id)}">${e(d.title)} · aktuell ${e(libVerName(d.current))}</option>`).join('')}</select></div><div class="field lib-pick-btn">${btn('Als neue Version übernehmen','lib-confirm','data-target="other"','primary')}</div></div>`;
 const newDoc=`<div class="form-row lib-pick"><div class="field"><label for="lib-title">Titel des neuen Dokuments</label><input id="lib-title" maxlength="200" value="${e(String(a.file_name||'').replace(/\.[^.]+$/,''))}"></div><div class="field lib-pick-btn">${btn('Neues Dokument anlegen','lib-confirm','data-target="new"',a.suggestion?'':'primary')}</div></div>`;
 el.innerHTML=a.suggestion?`<div class="lib-suggest"><p>Sieht aus wie eine neue Version von <strong>${e(a.suggestion.title)}</strong> (aktuell ${e(a.suggestion.current_version_no?'Version '+a.suggestion.current_version_no:libVerName({version_label:a.suggestion.current_version_label}))}${a.suggestion.current_version_label&&a.suggestion.current_version_no?' · '+e(a.suggestion.current_version_label):''}).</p><p class="muted">Ohne Bestätigung geht es nicht weiter. Es wird nie stillschweigend zusammengeführt.</p><div class="actions">${btn('Bestätigen','lib-confirm','data-target="suggestion"','primary')}${btn('Neues Dokument','lib-choice-new')}${others.length?btn('Anderes Dokument wählen','lib-choice-other'):''}</div><div id="lib-choice-extra"></div></div>`:`<div class="lib-suggest"><p>Kein ähnliches Dokument gefunden.</p>${newDoc}${others.length?`<details><summary>Doch einem bestehenden Dokument zuordnen</summary>${pick(others)}</details>`:''}</div>`;
 libUpload.pickHtml=pick(others);libUpload.newHtml=newDoc;
}
function libDatesRender(){
 const el=document.getElementById('lib-dates');const list=libList(libUpload?.analyse?.date_suggestions);if(!el)return;
 el.innerHTML=list.length?`<div class="lib-date-suggest"><strong>Im Text gefundene Daten</strong><p class="muted">Vorschläge per Mustererkennung. Nur übernehmen, wenn sie zur Quelle passen.</p>${list.map(s=>`<div class="lib-date-row"><span>„${e(s.excerpt||'')}“</span>${btn((s.field==='valid_until'?'Gültig bis ':'Gültig ab ')+dayDe(s.value)+' übernehmen','lib-date',`data-field="${e(s.field)}" data-value="${e(s.value)}"`,'small')}</div>`).join('')}</div>`:'';
}
async function libAnalyse(form){
 if(!libUpload||!['form','duplicate'].includes(libUpload.phase))return;
 const file=form.querySelector('#lib-file').files[0];const data=Object.fromEntries(new FormData(form));
 if(!file)throw Error('Bitte Datei auswählen.');if(!String(data.version_label||'').trim())throw Error('Versionsbezeichnung fehlt.');
 libUpload.steps=LIB_STEPS.map(()=>({status:'wait',detail:''}));libSetStep(0,'run','Datei wird geprüft …');libSetStep(1,'run','Text wird gelesen …');
 let a;
 try{a=await api('library/analyse',{name:file.name,base64:await file64(file,Infinity),version_label:String(data.version_label).trim(),doc_type:data.doc_type||undefined,valid_from:data.valid_from||undefined,valid_until:data.valid_until||undefined});}
 catch(err){const textErr=/OCR|Text|lesen|PDF|DOCX/i.test(err.message);if(textErr){libSetStep(0,'ok','Datei angenommen.');libSetStep(1,'fail',e(err.message));}else{libSetStep(0,'fail',e(err.message));libSetStep(1,'wait');}throw err;}
 libUpload.analyse=a;
 if(a.duplicate){const d=a.duplicate;const href='#sources?'+(d.library_id?'doc='+libEnc(d.library_id)+'&':'')+'version='+libEnc(d.document_id);libSetStep(0,'fail',`${e(d.message||`Diese Datei ist bereits als „${d.title}“ Version ${d.version_label} vorhanden.`)} <a href="${href}">Zum vorhandenen Eintrag</a>. Es wurde nichts gespeichert; Metadaten dort korrigieren.`);for(let i=1;i<LIB_STEPS.length;i++)libSetStep(i,'skip');libUpload.phase='duplicate';return;}
 libSetStep(0,'ok','Keine identische Datei vorhanden.');
 libSetStep(1,'ok',e((Number(a.paragraphs)||0)+' Absätze erkannt.'));
 libSetStep(2,'run',a.suggestion?'Treffer gefunden · Bestätigung nötig':'Kein Treffer · neues Dokument oder Zuordnung wählen');
 form.querySelector('#lib-file').disabled=true;form.querySelector('#lib-label').disabled=true;form.querySelector('#lib-analyse').hidden=true;
 const type=form.querySelector('#lib-type');if(!type.value)type.value=a.suggestion?.doc_type||'sonstige';
 libUpload.phase='choose';libDatesRender();libChoiceRender();
 document.getElementById('lib-choice')?.scrollIntoView({block:'nearest'});
}
async function libConfirm(target){
 const a=libUpload?.analyse;if(!a?.upload_id)throw Error('Zuerst eine Datei prüfen.');
 const form=document.getElementById('lib-upload-form');const data=Object.fromEntries(new FormData(form));
 let library_id=null,title;
 if(target==='suggestion')library_id=a.suggestion?.library_id;
 else if(target==='other')library_id=document.getElementById('lib-other')?.value||null;
 else{title=String(document.getElementById('lib-title')?.value||'').trim();if(!title)throw Error('Titel für das neue Dokument fehlt.');}
 const all=libAllDocs(libListing());const chosen=all.find(d=>d.library_id===library_id);
 libSetStep(2,'ok',e(library_id?`Neue Version von „${chosen?.title||a.suggestion?.title||library_id}“ bestätigt.`:`Neues Dokument „${title}“ gewählt.`));
 document.querySelectorAll('#lib-choice button').forEach(b=>b.disabled=true);
 for(const i of [3,4,5])libSetStep(i,'run');
 let res;
 try{res=await api('library/confirm',{upload_id:a.upload_id,library_id,title,doc_type:data.doc_type||undefined,valid_from:data.valid_from||null,valid_until:data.valid_until||null,description:data.description||undefined});}
 catch(err){libSetStep(3,'fail',e(err.message));libSetStep(4,'wait');libSetStep(5,'wait');document.querySelectorAll('#lib-choice button').forEach(b=>b.disabled=false);throw err;}
 libUpload.result=res;
 const steps=libList(res.steps);
 for(let i=3;i<6;i++){const s=steps.find(x=>x.label===LIB_STEPS[i]);if(s)libSetStep(i,libStepState(s.status),e(s.detail||''));else libSetStep(i,i===3?'ok':'skip',i===3?e('Version '+(res.document?.version_no||'')+' gespeichert.'):'');}
 const doc=res.document||{},lib=res.library_doc||{},diff=res.diff;
 const base='#sources?doc='+libEnc(lib.id||doc.library_id||'')+'&version='+libEnc(doc.id||'');
 const affected=libList(diff?.affected_requirement_ids);
 libSetStep(6,'ok',`${diff?e(res.summary||libDiffSummary(diff.summary)):'Erste Version gespeichert; kein Vergleich nötig.'}<span class="lib-links"><a href="${base}">Zur Version</a>${diff?` · <a href="${base}&diff=${libEnc(diff.id)}">Vergleich ansehen</a>`:''}${affected.length?' · Betroffen: '+affected.map(r=>`<a href="#requirements?id=${libEnc(r)}">${e(r)}</a>`).join(', '):''}</span>`);
 document.getElementById('lib-choice').innerHTML=`<div class="actions"><a class="btn primary" href="${base}">Fertig · zur Version</a></div>`;
 libUpload.phase='done';
 await libReload();
}
async function libReload(){libFetch={state:'idle'};for(const k of Object.keys(libDiffs))delete libDiffs[k];for(const k of Object.keys(libReqVersions))delete libReqVersions[k];await load();}

/* Requirement detail */
function libReqVersionsGet(id){if(!libReqVersions[id]){libReqVersions[id]={busy:true};api('requirements/'+libEnc(id)+'/versions').then(d=>{libReqVersions[id]={data:d};libRerender(['requirements']);}).catch(err=>{libReqVersions[id]={error:err.message};libRerender(['requirements']);});}return libReqVersions[id];}
const libLines=v=>libList(v).length?`<ul class="req-lines">${libList(v).map(x=>`<li>${e(x)}</li>`).join('')}</ul>`:'<span class="muted">keine</span>';
function libAiCard(r,doc){
 const a=r.ai_review;const rerun=btn(a?'Erneut vorprüfen':'KI-Vorprüfung starten','lib-prereview',`data-id="${e(r.id)}"`,'small');
 const head=`<div class="panel-header"><div><h2>KI-Vorprüfung ${term('ki_vorgeprueft')}</h2><p class="muted">Empfehlung, keine Freigabe. Die KI hat kein Vetorecht.</p></div><div class="actions">${a?.status==='läuft'?btn('Aktualisieren','lib-req-refresh','','small'):rerun}</div></div>`;
 if(!a)return `<section class="panel ai-card">${head}<p class="muted">Für diese Version liegt noch keine KI-Vorprüfung vor.</p></section>`;
 if(a.status==='läuft')return `<section class="panel ai-card">${head}<p class="ai-running"><span class="spinner" aria-hidden="true"></span>KI-Vorprüfung läuft im Hintergrund … Die Ansicht aktualisiert sich automatisch.</p></section>`;
 if(a.status==='nicht_verfügbar')return `<section class="panel ai-card">${head}<div class="notice"><strong>KI-Vorprüfung nicht verfügbar (kein Modell verbunden).</strong> Es gibt keine Empfehlung und keinen Ersatz durch Regeln. Bitte ohne KI-Hilfe fachlich prüfen.</div></section>`;
 if(a.status==='fehler')return `<section class="panel ai-card">${head}<div class="note"><strong>KI-Vorprüfung fehlgeschlagen.</strong> ${e(a.error||'Unbekannter Fehler.')} Es wird keine Antwort vorgetäuscht.</div></section>`;
 const recCls=a.recommendation==='freigabe_empfohlen'?'approved':a.recommendation==='ueberarbeitung_empfohlen'?'fail':'pending';
 const crit=a.criteria&&typeof a.criteria==='object'?`<div class="table-wrap"><table class="field-table ai-criteria"><thead><tr><th>Kriterium</th><th>Ergebnis</th><th>Hinweis</th></tr></thead><tbody>${LIB_CRITERIA.map(([k,l,q])=>{const c=a.criteria[k]||{};return `<tr><td><strong>${e(l)}</strong><br><small class="muted">${e(q)}</small></td><td>${c.ok===true?'<span class="pill pass">in Ordnung</span>':c.ok===false?'<span class="pill fail">Mangel</span>':'<span class="pill">nicht beurteilt</span>'}</td><td>${e(c.note||'—')}</td></tr>`;}).join('')}</tbody></table></div>`:'';
 const ev=a.evidence;const sc=a.suggested_change;
 return `<section class="panel ai-card">${head}<dl class="field-list lib-fields">${libField('KI-Empfehlung',`<span class="pill ${recCls}">${e(a.recommendation_label||a.recommendation||'—')}</span>`)}${libField('Begründung',e(a.reasoning||'—'))}${libField('Beleg',ev?`${e(ev.document_name||ev.document_id||'')} · ${e(libVerName(ev))}${ev.location?' · '+e(ev.location):''}${ev.excerpt?`<blockquote class="quote">${e(ev.excerpt)}</blockquote>`:''}`:'<span class="muted">—</span>')}${libField('Offene Frage',a.open_question?e(a.open_question):'<span class="muted">keine</span>')}${a.rejected_marks?libField('Markierungen',`<span class="pill stale">${Number(a.rejected_marks)===1?'1 KI-Markierung nicht belegbar':Number(a.rejected_marks)+' KI-Markierungen nicht belegbar'}</span> <small class="muted">verworfen, weil die Textstelle nicht in der Quelle steht</small>`):''}</dl>${crit}${sc&&sc.after?`<h3 class="cust-sub">Änderungsvorschlag · ${e(fieldLabel(sc.field||'criterion'))}</h3>${libSideBySide(sc.before??r[sc.field||'criterion'],sc.after,null,['Aktuell','Vorschlag der KI'])}<div class="actions">${btn('Vorschlag übernehmen','lib-accept',`data-id="${e(r.id)}"`,'small primary')}${btn('Anpassen','lib-adapt',`data-field="${e(sc.field||'criterion')}"`,'small')}<small class="muted">Eine Übernahme erzeugt eine neue Anforderungsversion, die erneut vorgeprüft wird.</small></div>`:''}<p class="muted ai-meta">${e([a.model&&'Modell '+a.model,a.prompt_version,a.created_at&&custFmt(a.created_at)].filter(Boolean).join(' · '))}</p></section>`;
}
function libVersionTable(vd,r){
 if(vd.busy)return '<p class="muted">Versionen werden geladen …</p>';
 if(vd.error)return `<p class="muted">Versionsliste nicht verfügbar: ${e(vd.error)}</p>`;
 const vs=libList(vd.data?.versions).slice().sort((a,b)=>(b.version_no||0)-(a.version_no||0));
 if(!vs.length)return '<p class="muted">Keine Versionen gespeichert.</p>';
 return `<div class="table-wrap"><table class="field-table"><thead><tr><th>Version</th><th>Herkunft</th><th>Änderungsgrund</th><th>KI-Vorprüfung</th><th>Fachliche Freigabe</th><th>Erstellt</th></tr></thead><tbody>${vs.map(v=>{const ap=v.approval;const doc=state.documents.find(d=>d.id===v.source_id);return `<tr><td><strong>v${e(v.version_no)}</strong>${v.version_no===r.version_no?' <span class="subtle-chip">aktuell</span>':''}${v.version_no===r.approved_version_no?' <span class="subtle-chip">freigegeben</span>':''}<br><small class="muted">${e(doc?doc.name+' · Version '+(doc.version_label||doc.version):v.source_id||'')}</small></td><td>${e(LIB_ORIGIN[v.origin]||v.origin||'—')}</td><td>${e(v.change_reason||'—')}</td><td>${v.ai_review?e(v.ai_review.recommendation_label||{läuft:'läuft',nicht_verfügbar:'nicht verfügbar',fehler:'fehlgeschlagen'}[v.ai_review.status]||v.ai_review.status):'—'}</td><td>${ap?`${ap.decision==='freigegeben'?'<span class="pill approved">Freigegeben</span>':'<span class="pill rejected">Abgelehnt</span>'}${ap.against_ai?' <span class="pill stale">entgegen KI-Empfehlung</span>':''}<br><small>${e(ap.reviewer)} · ${e(custFmt(ap.decided_at))}${ap.carried_from_version?' · übernommen von v'+e(ap.carried_from_version):''}</small>${ap.note?`<br><small class="muted">${e(ap.note)}</small>`:''}`:'<span class="muted">—</span>'}</td><td>${v.created_at?e(custFmt(v.created_at)):'—'}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function libApprovedDiff(vd,r){
 const vs=libList(vd.data?.versions);const ap=r.approved_version_no;
 if(!ap||ap===r.version_no)return '';
 const old=vs.find(v=>v.version_no===ap);
 if(!old)return vd.busy?'':'<section class="panel"><h2>Vergleich zur freigegebenen Version</h2><p class="muted">Freigegebene Version nicht geladen.</p></section>';
 const join=v=>Array.isArray(v)?v.join('\n'):v??'';
 const fields=[['title','Titel'],['criterion','Kriterium'],['conditions','Bedingungen'],['exceptions','Ausnahmen'],['source_excerpt','Quellenzitat']];
 const changed=fields.filter(([k])=>join(old[k])!==join(r[k]));
 return `<section class="panel"><div class="panel-header"><div><h2>Vergleich zur freigegebenen Version</h2><p class="muted">v${e(ap)} (freigegeben) → v${e(r.version_no)} (aktuell)</p></div></div>${changed.length?changed.map(([k,l])=>`<h3 class="cust-sub">${e(l)}</h3>${libSideBySide(join(old[k]),join(r[k]),null,['v'+ap+' freigegeben','v'+r.version_no+' aktuell'])}`).join(''):'<p class="muted">Text unverändert; nur Quelle oder Metadaten geändert.</p>'}</section>`;
}
function requirementDetail(id){
 const back='<div class="actions cust-back"><a class="btn small" href="#requirements">← Alle Anforderungen</a></div>';
 const r=state.requirements.find(x=>x.id===id);
 if(!r)return back+'<div class="panel cert-empty"><strong>Anforderung nicht gefunden.</strong><p>Zur Liste zurückkehren.</p></div>';
 const doc=state.documents.find(d=>d.id===r.source_id);const a=r.ai_review;
 const vd=libReqVersionsGet(id);const cur=libList(vd.data?.versions).find(v=>v.version_no===r.version_no);
 const reqMarks=f=>libList(a?.marks?.requirement).filter(m=>(m.field||'criterion')===f).map(m=>({text:m.text,cls:'ai-mark'}));
 const srcMarks=libList(a?.marks?.source).filter(m=>!m.document_id||m.document_id===r.source_id).map(m=>({text:m.excerpt,cls:'ai-mark'}));
 const sec=libList(doc?.sections).find(s=>s.id===r.section_id);
 const against=a?.status==='fertig'&&a.recommendation&&a.recommendation!=='freigabe_empfohlen';
 const banners=(r.change_flag?`<div class="note banner"><strong>${e(r.change_flag.text||'Quelle geändert – Prüfung nötig')}</strong>${r.change_flag.diff_id?` · <a href="#sources?diff=${libEnc(r.change_flag.diff_id)}">Vergleich ansehen</a>`:''}</div>`:'')+(r.approval_invalid?`<div class="note banner danger-banner"><strong>${e(r.approval_invalid.text||'Freigabe nicht mehr gültig')}</strong>${r.approval_invalid.since?' · seit '+e(dayDe(r.approval_invalid.since)):''}. Die frühere Freigabe bleibt in der Historie; die Anforderung braucht eine erneute Prüfung.</div>`:'');
 const curPanel=`<section class="panel"><div class="panel-header"><h2>Aktuelle Version${r.version_no?' · v'+e(r.version_no):''}</h2>${cur?.origin?`<span class="subtle-chip">${e(LIB_ORIGIN[cur.origin]||cur.origin)}</span>`:''}</div><dl class="field-list lib-fields">${libField('Kriterium',`<span class="req-text">${libMark(r.criterion,reqMarks('criterion'))}</span>`)}${libField('Bedingungen',libLines(r.conditions))}${libField('Ausnahmen',libLines(r.exceptions))}${r.questions?.length?libField('Offene Fragen',libLines(r.questions)):''}${libField('Quelle',`${e(doc?.name||r.source_id||'—')}${doc?' · Version '+e(doc.version_label||doc.version):''} · ${e(sec?.location||r.section_id||'—')} <button class="source-link" data-action="source" data-doc="${e(r.source_id)}" data-section="${e(r.section_id)}">In der Ablage öffnen ↗</button>`)}${libField('Zitatstatus',badge(r.citation_status)+(r.citation_status!=='verified'?' '+btn('Zitat prüfen','verify',`data-id="${e(r.id)}"`,'small'):''))}${cur?.change_reason?libField('Änderungsgrund',e(cur.change_reason)):''}</dl><h3 class="cust-sub">Quellenzitat</h3><blockquote class="quote">${libMark(r.source_excerpt,reqMarks('source_excerpt'))}</blockquote>${sec?`<details ${srcMarks.length?'open':''}><summary>Quellabschnitt mit Markierungen</summary><div class="source-text">${libMark(sec.text,[...srcMarks,{text:r.source_excerpt,cls:'cite-mark'}])}</div></details>`:''}<div class="actions">${btn('Ganzes Dokument mit Markierungen','lib-text',`data-id="${e(r.source_id)}" data-req="${e(r.id)}"`,'small')}<small class="muted"><mark class="cite-mark">Zitat</mark> <mark class="ai-mark">KI-Markierung</mark></small></div></section>`;
 const approval=`<section class="panel" id="req-approval"><h2>Fachliche Freigabe ${term('freigegeben')}</h2><p class="muted">Bestätige nur, was du fachlich geprüft hast. Die Freigabe gilt genau für Version ${e(r.version_no||1)} und ist keine offizielle Zertifizierung.</p>${r.citation_status!=='verified'?'<div class="note">Das Zitat ist nicht als gefunden bestätigt. Eine Freigabe ist erst nach bestandener Zitatprüfung möglich.</div>':''}${against?`<div class="note ai-against"><strong>Die KI empfiehlt: ${e(a.recommendation_label||a.recommendation)}.</strong> Eine Freigabe ist trotzdem möglich. Deine Begründung muss ${a.open_question?'die offene Frage':'die Begründung der KI'} beantworten (mindestens 20 Zeichen). Der Datensatz zeigt dann „Freigegeben entgegen KI-Empfehlung“.${a.open_question?`<blockquote class="quote">${e(a.open_question)}</blockquote>`:a.reasoning?`<blockquote class="quote">${e(a.reasoning)}</blockquote>`:''}</div>`:''}<form id="lib-approve-form" class="cust-form" data-against="${against?1:0}"><input type="hidden" name="id" value="${e(r.id)}">${custPeople('lib-ap',against?'Begründung (beantwortet die KI-Empfehlung)':'Begründung / geprüfte Grundlage')}<div class="actions"><button class="btn primary" name="decision" value="approve">Freigeben</button><button class="btn danger" name="decision" value="reject">Ablehnen</button></div></form>${r.reviewer?`<p class="muted">Letzte Entscheidung: ${e(r.reviewer)}${r.reviewed_at?' · '+e(custFmt(r.reviewed_at)):''}${r.review_note?' · '+e(r.review_note):''}</p>`:''}${custSelfDeclared}</section>`;
 const edit=`<section class="panel"><details id="req-edit"><summary>Neue Version von Hand erstellen</summary><p class="muted">Erzeugt Version ${e((r.version_no||1)+1)} mit Herkunft „Von Hand geändert“. Danach sind KI-Vorprüfung und Freigabe erneut nötig.</p><form id="lib-edit-form" class="cust-form"><input type="hidden" name="id" value="${e(r.id)}"><div class="field"><label for="req-title">Titel</label><input id="req-title" name="title" maxlength="200" value="${e(r.title)}"></div><div class="field"><label for="req-criterion">Kriterium</label><textarea id="req-criterion" name="criterion" rows="4" maxlength="4000">${e(r.criterion)}</textarea></div><div class="form-row"><div class="field"><label for="req-conditions">Bedingungen (eine pro Zeile)</label><textarea id="req-conditions" name="conditions" rows="3">${e(libList(r.conditions).join('\n'))}</textarea></div><div class="field"><label for="req-exceptions">Ausnahmen (eine pro Zeile)</label><textarea id="req-exceptions" name="exceptions" rows="3">${e(libList(r.exceptions).join('\n'))}</textarea></div></div><div class="field"><label for="req-excerpt">Quellenzitat (wörtlich aus der Quelle)</label><textarea id="req-excerpt" name="source_excerpt" rows="3" maxlength="4000">${e(r.source_excerpt)}</textarea></div><div class="field"><label for="req-reason">Änderungsgrund (Pflicht)</label><input id="req-reason" name="reason" required maxlength="500"></div><button class="btn primary">Neue Version speichern</button></form></details></section>`;
 const versions=`<section class="panel"><details class="req-versions"><summary>Versionen${vd.data?' ('+libList(vd.data.versions).length+')':''}</summary>${libVersionTable(vd,r)}</details></section>`;
 const curAp=cur?.approval;
 return back+`<div class="page-heading cust-head"><div><p class="cust-maker">${e(r.id)} · ${e(r.ruleset||'')}${r.version_no?' · Version '+e(r.version_no):''}</p><h1>${libMark(r.title,reqMarks('title'))}</h1><div class="lib-pills">${badge(r.citation_status)}${reqAiBadge(r)}${reqApprovalBadge(r)}${curAp?.against_ai&&curAp.decision==='freigegeben'?'<span class="pill stale">Freigegeben entgegen KI-Empfehlung</span>':''}</div></div></div>`+banners+
 `<div class="grid-even req-grid"><div>${curPanel}</div><div>${libAiCard(r,doc)}${approval}</div></div>`+libApprovedDiff(vd,r)+versions+edit+
 `<section class="panel">${techDetails({'Anforderungs-ID':r.id,'Quelle (Dokumentversion)':r.source_id,'Abschnitt':r.section_id,'Zuordnung':r.mapping,'Regelstand':r.ruleset,'Versionsnummer':r.version_no,'Freigegebene Version':r.approved_version_no,'Fachliche Prüfung':r.semantic_review,'KI-Modell':a?.model,'Prompt-Version':a?.prompt_version,'Nicht belegbare KI-Markierungen':a?.rejected_marks})}</section>`;
}
async function libPrereview(id){const res=await api('requirements/prereview',{id});delete libReqVersions[id];await load();toast(res?.ai_review?.status==='läuft'?'KI-Vorprüfung gestartet.':'KI-Vorprüfung aktualisiert.');}

/* Events */
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b||!b.dataset.action.startsWith('lib-'))return;
 const action=b.dataset.action;if(b.tagName==='BUTTON')b.disabled=true;
 try{
  if(action==='lib-upload')libUploadDialog(b.dataset.type);
  else if(action==='lib-open'){if(b.dataset.pdf==='1')await libOpenPdf(b.dataset.id);else await libTextView(b.dataset.id);}
  else if(action==='lib-download')await libDownload(b.dataset.id,b.dataset.name);
  else if(action==='lib-delete')libDeleteDialog(b.dataset.id);
  else if(action==='lib-text'){const r=state.requirements.find(x=>x.id===b.dataset.req);const marks=libList(r?.ai_review?.marks?.source).map(m=>({text:m.excerpt,cls:'ai-mark'}));await libTextView(b.dataset.id,[...marks,...(r?.source_excerpt?[{text:r.source_excerpt,cls:'cite-mark'}]:[])]);}
  else if(action==='lib-reclassify'){const reason=prompt('Warum ist diese Änderung fachlich? (optional)');if(reason===null)return;await api('requirements/reclassify',{diff_id:b.dataset.diff,change_id:b.dataset.change,classification:'fachlich',reason});delete libDiffs[b.dataset.diff];await libReload();toast('Änderung als fachlich markiert. Betroffene Anforderungen brauchen eine neue Freigabe.');}
  else if(action==='lib-date'){const el=document.getElementById(b.dataset.field==='valid_until'?'lib-until':'lib-from');if(el){el.value=b.dataset.value;el.focus();}}
  else if(action==='lib-choice-new'){document.getElementById('lib-choice-extra').innerHTML=libUpload.newHtml;document.getElementById('lib-title')?.focus();}
  else if(action==='lib-choice-other'){document.getElementById('lib-choice-extra').innerHTML=libUpload.pickHtml;document.getElementById('lib-other')?.focus();}
  else if(action==='lib-confirm')await libConfirm(b.dataset.target);
  else if(action==='lib-prereview')await libPrereview(b.dataset.id);
  else if(action==='lib-req-refresh'){await libReload();}
  else if(action==='lib-accept'){await api('requirements/accept-suggestion',{id:b.dataset.id,reviewer:custReviewer()||undefined});await libReload();toast('Vorschlag als neue Version übernommen. Freigabe ist erneut nötig.');}
  else if(action==='lib-adapt'){const r=state.requirements.find(x=>x.id===hashParams().get('id'));const sc=r?.ai_review?.suggested_change;const d=document.getElementById('req-edit');if(d&&sc){d.open=true;const f=document.getElementById(sc.field==='title'?'req-title':sc.field==='source_excerpt'?'req-excerpt':'req-criterion');if(f){f.value=sc.after;f.focus();}const reason=document.getElementById('req-reason');if(reason&&!reason.value)reason.value='KI-Änderungsvorschlag angepasst';d.scrollIntoView({block:'start'});}}
 }catch(err){toast(err.message);}finally{if(b.tagName==='BUTTON'&&document.contains(b)&&!(action==='lib-confirm'&&libUpload?.phase==='done'))b.disabled=false;}
});
document.addEventListener('click',event=>{const a=event.target.closest('#dialog a[href^="#"]');if(a)document.getElementById('dialog').close();});
document.addEventListener('submit',async event=>{
 const form=event.target,id=form.getAttribute('id')||'';if(!id.startsWith('lib-'))return;event.preventDefault();
 const data=Object.fromEntries(new FormData(form));const button=event.submitter;if(button)button.disabled=true;
 const close=()=>document.getElementById('dialog').close();
 try{
  if(data.reviewer!==undefined)custRemember(String(data.reviewer).trim());
  if(id==='lib-upload-form')await libAnalyse(form);
  else if(id==='lib-delete-form'){custRemember(String(data.by).trim());const r=await api('library/delete',{library_id:data.library_id,by:data.by,reason:data.reason});close();location.hash='#sources';await libReload();toast(`„${r.title}“ gelöscht · ${r.requirements.length===1?'1 Anforderung':r.requirements.length+' Anforderungen'} entfernt.`);}
  else if(id==='lib-editorial-form'){const ids=[...document.querySelectorAll('input[name="change_ids"][form="lib-editorial-form"]:checked')].map(x=>x.value);if(!ids.length)throw Error('Keine redaktionelle Änderung ausgewählt.');await api('requirements/editorial-accept',{diff_id:data.diff_id,reviewer:data.reviewer,note:data.note,change_ids:ids});await libReload();toast(ids.length===1?'1 redaktionelle Änderung übernommen.':ids.length+' redaktionelle Änderungen übernommen.');}
  else if(id==='lib-approve-form'){const approve=button?.value==='approve';if(approve&&form.dataset.against==='1'&&String(data.note||'').trim().length<20)throw Error('Begründung zur KI-Empfehlung erforderlich (offene Frage beantworten).');await api('review',{kind:'requirement',id:data.id,reviewer:data.reviewer,note:data.note,approve});await libReload();toast('Prüfentscheidung dokumentiert.');}
  else if(id==='lib-edit-form'){const lines=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);await api('requirements/edit',{id:data.id,title:data.title,criterion:data.criterion,conditions:lines(data.conditions),exceptions:lines(data.exceptions),source_excerpt:data.source_excerpt,reason:data.reason});await libReload();toast('Neue Version gespeichert. KI-Vorprüfung und Freigabe sind erneut nötig.');}
 }catch(err){toast(err.message);}finally{if(button&&document.contains(button))button.disabled=false;}
});
// Poll while a pre-review runs for the open requirement; skips while someone edits.
setInterval(async()=>{
 if(libPollBusy||!state||document.hidden||route()!=='requirements')return;
 const id=hashParams().get('id');const r=id&&state.requirements.find(x=>x.id===id);if(!r||r.ai_review?.status!=='läuft')return;
 libPollBusy=true;try{const fresh=await api('state');const nr=fresh.requirements.find(x=>x.id===id);if(JSON.stringify(nr?.ai_review)!==JSON.stringify(r.ai_review)){state=fresh;delete libReqVersions[id];libRerender(['requirements']);}}catch{}finally{libPollBusy=false;}
},2500);
if(state&&['sources','requirements'].includes(route()))render();

/* Drag and drop: the dialog box fills its file input; the page box opens the dialog with the file. */
function libSetFile(input,file){const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
function libPageFile(file){if(!file)return;libUploadDialog();const input=document.getElementById('lib-file');if(input)libSetFile(input,file);document.getElementById('lib-label')?.focus();}
document.addEventListener('change',event=>{
 if(event.target.id==='lib-file'){const n=document.getElementById('lib-file-name'),f=event.target.files[0];if(n)n.textContent=f?f.name:'Keine Datei ausgewählt';event.target.closest('.drop-box')?.classList.toggle('has-file',!!f);}
 else if(event.target.id==='lib-page-file'){libPageFile(event.target.files[0]);event.target.value='';}
});
document.addEventListener('dragover',event=>{const box=event.target.closest?.('.drop-box');if(!box||box.querySelector('input:disabled'))return;event.preventDefault();box.classList.add('dragging');});
document.addEventListener('dragleave',event=>{const box=event.target.closest?.('.drop-box');if(box&&!box.contains(event.relatedTarget))box.classList.remove('dragging');});
document.addEventListener('drop',event=>{
 const box=event.target.closest?.('.drop-box');if(!box)return;event.preventDefault();box.classList.remove('dragging');
 const file=event.dataTransfer?.files?.[0];if(!file||box.querySelector('input:disabled'))return;
 if(box.dataset.drop==='page')libPageFile(file);else libSetFile(box.querySelector('input'),file);
});
