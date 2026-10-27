'use strict';
/* "Kunden & Software" (spec 7): manufacturers, software versions, certification status,
   evidence, submissions and reminder dialogs. Nothing here approves automatically;
   every decision posts a self-declared reviewer name and a reason to the backend. */
let custQuery='',custStatus='',custStatusParam=null,custDetail=null,custDetailBusy=false,custPollBusy=false,custPollPending=false;
const CUST_LIMIT=25;
const custActions={start:'Prüfung starten',approve:'Freigeben',reject:'Ablehnen',reopen:'Wieder öffnen'};
const custAllowed={neu:['start'],erneut_pruefen:['start'],in_pruefung:['approve','reject'],abgelehnt:['reopen'],freigegeben:[]};
const custHistoryLabels={create:'Angelegt',created:'Angelegt',start:'Prüfung gestartet',approve:'Freigegeben',reject:'Abgelehnt',reopen:'Wieder geöffnet',accept:'Fachlich akzeptiert',recheck:'Erneut prüfen',migrate:'Aus Prüfziel übernommen',reminder_effect:'Hinweis aus Erinnerung'};
const custReviewer=()=>{try{return sessionStorage.getItem('auditflow-reviewer')||'';}catch{return '';}};
const custRemember=name=>{try{if(name)sessionStorage.setItem('auditflow-reviewer',name);}catch{}};
const custFmt=iso=>{const d=new Date(iso);return iso&&!Number.isNaN(d.getTime())?fmt(iso):dayDe(iso);};
const custSize=n=>Number(n)>=1e6?(Number(n)/1e6).toLocaleString('de-DE',{maximumFractionDigits:1})+' MB':Math.max(1,Math.round(Number(n||0)/1e3)).toLocaleString('de-DE')+' kB';
function custPeople(prefix,noteLabel='Begründung',nameLabel='Dein Name'){
 return `<div class="field"><label for="${prefix}-reviewer">${nameLabel}</label><input id="${prefix}-reviewer" name="reviewer" required maxlength="100" autocomplete="name" value="${e(custReviewer())}"></div>`+
 (noteLabel?`<div class="field"><label for="${prefix}-note">${noteLabel}</label><textarea id="${prefix}-note" name="note" required maxlength="2000" rows="4"></textarea></div>`:'');
}
const custSelfDeclared='<p class="muted">Namen sind selbst angegeben. Die Vier-Augen-Regel ist eine Prozessvorgabe, keine Sicherheitskontrolle.</p>';

/* List */
function custMatches(v){
 if(custStatus==='open')return certOpenStatus.includes(v.status);
 return !custStatus||v.status===custStatus;
}
function custList(){
 const c=cert();
 if(!c.manufacturers.length&&!c.versions.length)return `<div class="panel cert-empty">${uiIcon('building')}<strong>Noch keine Hersteller.</strong><p>Lege den ersten Hersteller mit Software und Version an.</p>${btn('+ Hersteller / Software','cust-new','','small primary')}</div>`;
 const q=custQuery.trim().toLowerCase(),filtered=!!(q||custStatus);
 const groups=new Map();
 for(const m of c.manufacturers)groups.set(m.id,{name:m.name,items:[]});
 for(const v of c.versions){const key=v.manufacturer_id||v.manufacturer_name;if(!groups.has(key))groups.set(key,{name:v.manufacturer_name,items:[]});groups.get(key).items.push(v);}
 const cards=[...groups.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'de')).map(g=>{
  const nameHit=!q||String(g.name).toLowerCase().includes(q);
  const items=g.items.filter(v=>custMatches(v)&&(nameHit||`${v.software} ${v.version}`.toLowerCase().includes(q))).sort((a,b)=>`${a.software} ${a.version}`.localeCompare(`${b.software} ${b.version}`,'de',{numeric:true}));
  if(filtered&&!items.length)return '';
  return `<section class="panel cust-card"><div class="panel-header"><h2>${e(g.name)}</h2><span class="subtle-chip">${g.items.length===1?'1 Version':g.items.length+' Versionen'}</span></div>${items.length?items.map(v=>certRow(v,c.today)).join(''):'<p class="muted">Noch keine Software-Version.</p>'}</section>`;
 }).filter(Boolean);
 return cards.length?cards.join(''):`<div class="panel cert-empty"><strong>Keine Treffer.</strong><p>Suche oder Statusfilter anpassen.</p>${btn('Filter zurücksetzen','cust-clear-filter','','small')}</div>`;
}
function customersPage(){
 const params=hashParams(),id=params.get('version');
 if(id)return custVersionPage(id);
 const st=params.get('status');if(st!==custStatusParam){custStatusParam=st;custStatus=st||'';}
 const c=cert();
 const options=[['','Alle Status'],['open','Offen · Neu, In Prüfung, Erneut prüfen'],...['neu','in_pruefung','freigegeben','abgelehnt','erneut_pruefen'].map(s=>[s,labels[s]])];
 return heading('Kunden & Software','Hersteller und ihre Software.','Status, Nachweise und Freigaben je Software-Version. Keine automatische Zulassung.',btn('+ Hersteller / Software','cust-new','','primary'))+
 (c.available?'':'<div class="notice">Zertifizierungsdaten sind noch nicht verfügbar. Das Backend liefert keinen Bereich <code>certification</code>.</div>')+
 `<div class="cust-filters"><div class="field"><label for="cust-search">Suche nach Name</label><input id="cust-search" type="search" placeholder="Hersteller oder Software" value="${e(custQuery)}" autocomplete="off"></div><div class="field"><label for="cust-status">Status</label><select id="cust-status">${options.map(([v,t])=>`<option value="${v}" ${v===custStatus?'selected':''}>${e(t)}</option>`).join('')}</select></div></div><div id="cust-list">${custList()}</div>`;
}

/* Version detail */
async function custFetchDetail(id,offset=0){
 if(custDetailBusy)return;custDetailBusy=true;
 try{const data=await api('cert/version/'+encodeURIComponent(id)+'?offset='+offset+'&limit='+CUST_LIMIT);custDetail={id,offset,data,error:null,stale:false};}
 catch(err){custDetail={id,offset,data:custDetail?.id===id?custDetail.data:null,error:err.message,stale:false};}
 finally{custDetailBusy=false;}
 if(route()==='customers'&&hashParams().get('version')===id&&!custEditing())render();
}
function custHistory(v){
 const h=certList(v.history).slice().reverse();
 if(!h.length)return '<p class="muted">Noch keine Einträge.</p>';
 return `<ol class="history-list">${h.map(x=>`<li><div class="history-top"><strong>${e(custHistoryLabels[x.action]||x.action)}</strong>${x.derived?'<span class="subtle-chip">automatisch abgeleitet</span>':''}${x.from&&x.to&&x.from!==x.to?`<span class="history-move">${badge(x.from)}<span aria-hidden="true">→</span>${badge(x.to)}</span>`:''}</div><small>${e(custFmt(x.at))}${x.reviewer?' · '+e(x.reviewer):''}</small>${x.note?`<p>${e(x.note)}</p>`:''}${x.ref?`<small class="muted" title="${e(x.ref)}">Bezug: Importlauf ${e(String(x.ref).slice(0,8))}</small>`:''}</li>`).join('')}</ol>`;
}
function custGate(v){
 const items=certList(v.gate?.items);
 if(!items.length)return '<p class="muted">Keine Gate-Angaben vom Backend.</p>';
 return `<ul class="gate-list">${items.map(i=>`<li class="${i.ok?'ok':'blocked'}"><span class="gate-mark" aria-hidden="true">${i.ok?uiIcon('check'):'!'}</span><div><strong>${e(i.label)}</strong>${i.detail?`<small>${e(i.detail)}</small>`:''}</div><span class="pill ${i.ok?'pass':'fail'}">${i.ok?'Erfüllt':'Blockiert'}</span></li>`).join('')}</ul>`;
}
function custEvidence(v,d){
 const ev=v.evidence||{},lj=ev.latest_import_job;
 const full=lj&&state.automation?.jobs?.find(j=>j.id===lj.id);
 const graphic=lj?resultGraphic(full||{id:lj.id,counts:lj.counts||{},project:{software:v.software},package:{name:'Herstellerimport'}}):resultGraphic(null);
 const total=Number(ev.unclear_total)||0,accepted=Number(ev.unclear_accepted)||0;
 let unclear;
 if(!d||(!d.data&&!d.error))unclear='<p class="muted">Unklare Ergebnisse werden geladen …</p>';
 else if(!d.data)unclear=`<div class="note">Unklare Ergebnisse konnten nicht geladen werden: ${e(d.error)}</div>`;
 else{
  const rows=certList(d.data.unclear),all=Number(d.data.unclear_total)||rows.length,offset=d.offset||0;
  unclear=rows.length?`<div class="unclear-list">${rows.map(u=>`<div class="unclear-row"><div class="cert-row-main"><strong>${u.summary?certText(u.summary):e(u.case_id)}</strong><small class="muted" title="${e(u.case_id)}">Fall ${e(String(u.case_id).split(':').pop())}</small>${u.accepted?`<small>Fachlich akzeptiert von ${e(u.accepted.reviewer)} · ${e(custFmt(u.accepted.at))}${u.accepted.note?' · '+e(u.accepted.note):''}</small>`:''}</div><div class="cert-row-side">${u.accepted?'<span class="pill approved">Akzeptiert</span>':!certOpenStatus.includes(v.status)?'<span class="pill">Offen</span>':btn('Akzeptieren','cust-accept',`data-job="${e(u.job_id)}" data-case="${e(u.case_id)}"`,'small')}</div></div>`).join('')}</div>${all>CUST_LIMIT?`<div class="actions">${btn('← Zurück','cust-unclear-page','data-direction="-1"','small')}${btn('Weiter →','cust-unclear-page','data-direction="1"','small')}<small class="muted">${offset+1}–${Math.min(offset+rows.length,all)} von ${all}</small></div>`:''}`:'<p class="muted">Keine unklaren Ergebnisse im letzten Import.</p>';
 }
 const sims=certList(d?.data?.simulation_jobs);
 return `<section class="panel"><div class="panel-header"><div><h2>Nachweise</h2><p class="muted">Letzter abgeschlossener Herstellerimport${lj?' · '+e(custFmt(lj.created_at)):''}</p></div>${lj?badge(lj.status):''}</div>${graphic}`+
 `<h3 class="cust-sub">Unklare Ergebnisse${total?` · ${accepted} von ${total} akzeptiert`:''}</h3><p class="muted">Jedes nicht beurteilbare Ergebnis einzeln mit Name und Begründung fachlich akzeptieren. Akzeptanzen gelten nur für diesen Import.</p>${unclear}`+
 `<h3 class="cust-sub">Simulationen</h3>${sims.length?sims.map(j=>`<div class="unclear-row"><div class="cert-row-main"><strong>${e(String(j.id).slice(0,8))}</strong><small>${e(custFmt(j.created_at))}</small></div><div class="cert-row-side"><span class="pill sim-label">Simulation · keine Freigabegrundlage</span>${badge(j.status)}${btn('Öffnen','auto-open',`data-id="${e(j.id)}"`,'small')}</div></div>`).join(''):'<p class="muted">Keine Simulationen. Simulationen zählen nie als Nachweis.</p>'}</section>`;
}
function custSubmissions(v){
 const subs=cert().submissions.filter(s=>s.version_id===v.id);
 const rows=subs.length?subs.map(s=>{const decisions=certList(s.decisions);return `<div class="sub-row"><div class="cert-row-main"><strong>${e(s.name)}</strong><small>${e(custSize(s.size))} · ${e(s.mime)} · hochgeladen von ${e(s.uploaded_by)} am ${e(dayDe(s.uploaded_at))}</small><small class="muted">SHA-256 <code>${e(String(s.sha256||'').slice(0,16))}</code></small>${decisions.length?`<details><summary>${decisions.length===1?'1 Entscheidung':decisions.length+' Entscheidungen'}</summary><ul class="decision-list">${decisions.slice().reverse().map(x=>`<li><strong>${x.approve?'Freigegeben':'Abgelehnt'}</strong> · ${e(x.reviewer)} · ${e(custFmt(x.at))}${x.note?`<br>${e(x.note)}`:''}</li>`).join('')}</ul></details>`:''}</div><div class="cert-row-side">${badge(s.status)}<div class="actions">${btn('Herunterladen','cust-download',`data-id="${e(s.id)}" data-name="${e(s.name)}"`,'small')}${btn(s.status==='pending'?'Entscheiden':'Entscheidung ändern','cust-subreview',`data-id="${e(s.id)}"`,'small'+(s.status==='pending'?' primary':''))}</div></div></div>`;}).join(''):'<p class="muted">Noch keine Einreichungen.</p>';
 return `<section class="panel"><div class="panel-header"><div><h2>Einreichungen</h2><p class="muted">Unterlagen des Herstellers zu dieser Version</p></div></div>${rows}<form id="cust-submission-form" class="cust-form cust-upload"><input type="hidden" name="version_id" value="${e(v.id)}"><div class="field"><label for="cust-sub-file">Datei hinzufügen</label><input id="cust-sub-file" name="file" type="file" accept=".pdf,.docx,.txt" required><small>PDF, DOCX oder TXT · maximal 5 MB · keine Textauswertung</small></div>${custPeople('cust-sub','','Hochgeladen von')}<button class="btn">Hochladen</button></form></section>`;
}
function custPackages(v){
 const a=state.automation;
 if(!v.project_id)return `<section class="panel"><h2>Testpakete</h2><div class="note">Diese Version ist mit keinem Software-Prüfziel verknüpft. Testpakete und Herstellerimporte stehen erst nach der Verknüpfung zur Verfügung.</div></section>`;
 if(!a)return `<section class="panel"><h2>Testpakete</h2><p class="muted">Automatisierung ist nicht verfügbar.</p></section>`;
 const jobs=certList(a.jobs).filter(j=>j.project?.id===v.project_id);
 const selected=typeof autoSelected!=='undefined'?jobs.find(j=>j.id===autoSelected):null;
 const approved=certList(a.packages).filter(p=>p.status==='approved').slice().reverse();
 const list=jobs.length?`<div class="package-rows">${jobs.map(j=>`<div class="package-row"><span class="package-row-icon">${uiIcon('package')}</span><div class="package-row-main"><strong>${e(j.package?.name)}</strong><small>${e(custFmt(j.created_at))}${j.mode==='simulation'?' · Simulation · keine Freigabegrundlage':''}${j.selection==='impact'?' · Teilprüfung':''}</small></div><div class="package-row-status">${badge(j.status)}<small>${j.status==='waiting_import'?'Beim Hersteller':`${Number(j.completed)||0} / ${Number(j.total)||0} ausgewertet`}</small></div>${btn('Öffnen','auto-open',`data-id="${e(j.id)}"`,'small')}</div>`).join('')}</div>`:'<p class="muted">Noch kein Testpaket für diese Version.</p>';
 const launch=`<form id="auto-start-form" class="cust-form"><input name="mode" type="hidden" value="import"><input name="behavior" type="hidden" value="healthy"><input name="project_id" type="hidden" value="${e(v.project_id)}">${approved.length?'':'<div class="note">Zuerst ein synthetisches Regel- und Vorlagenpaket prüfen und freigeben.</div>'}<div class="form-row"><div class="field"><label for="cust-pack">Freigegebenes Regelpaket</label><select id="cust-pack" name="package_id" required>${approved.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('')}</select></div><div class="field"><label for="cust-count">Anzahl Testfälle und Profile (1–4.000)</label><input id="cust-count" name="count" type="number" min="1" max="4000" value="36" required></div></div><p class="muted">AuditFlow erstellt das Eingabepaket. Der Hersteller führt die Tests aus und liefert die Ergebnisse als JSON zurück.</p><button class="btn primary" ${approved.length?'':'disabled'}>Testpaket erstellen</button></form>`;
 const packs=certList(a.packages).map(p=>`<div class="auto-package"><div><strong>${e(p.name)}</strong><div class="muted">Version ${e(p.version)}</div><small class="muted">${p.reviewer?'Freigabe: '+e(p.reviewer):'Noch nicht freigegeben'}</small></div><div class="actions">${badge(p.status)}${p.status!=='approved'?btn('Paket prüfen','auto-approve',`data-id="${e(p.id)}"`,'small primary'):''}${btn('Neue Version','auto-version',`data-id="${e(p.id)}"`,'small')}</div></div>`).join('');
 const changes=typeof autoChanges==='function'?autoChanges({...a,suites:certList(a.suites).filter(s=>s.project_id===v.project_id)}):'';
 return `${selected&&typeof autoDetail==='function'?autoDetail(selected):''}<section class="panel package-list"><div class="panel-header"><h2>Testpakete</h2><span class="pill">SYNTHETISCHE DEMO</span></div>${list}</section><div class="workspace-tools"><details id="manufacturer-setup" ${typeof workspaceSetupOpen!=='undefined'&&workspaceSetupOpen?'open':''}><summary>${uiIcon('package')} Testpaket vorbereiten</summary><div class="cust-tool">${launch}<h3 class="cust-sub">Regel- und Vorlagenpakete</h3>${packs||'<p class="muted">Keine Pakete vorhanden.</p>'}</div></details><details id="manufacturer-change-setup" ${typeof workspaceChangesOpen!=='undefined'&&workspaceChangesOpen?'open':''}><summary>${uiIcon('document')} Regeländerung übernehmen</summary>${changes}</details></div>`;
}
function custVersionPage(id){
 const c=cert(),v=c.versions.find(x=>x.id===id);
 const back='<div class="actions cust-back"><a class="btn small" href="#customers">← Alle Hersteller</a></div>';
 if(!v)return back+`<div class="panel cert-empty"><strong>${c.available?'Version nicht gefunden.':'Zertifizierungsdaten sind noch nicht verfügbar.'}</strong><p>Zur Liste zurückkehren und eine Version auswählen.</p></div>`;
 if(!custDetail||custDetail.id!==id||custDetail.stale)custFetchDetail(id,custDetail?.id===id?custDetail.offset:0);
 const d=custDetail?.id===id?custDetail:null;
 const actions=(custAllowed[v.status]||[]).map(a=>btn(custActions[a],'cust-transition',`data-id="${e(v.id)}" data-step="${a}"`,a==='approve'||a==='start'?'primary':a==='reject'?'danger':'')).join('');
 return back+`<div class="page-heading cust-head"><div><p class="cust-maker">${e(v.manufacturer_name)}</p><h1>${e(v.software)} ${e(v.version)} ${badge(v.status)}</h1><p>${v.hint?.text?e(v.hint.text):''}${certOpenStatus.includes(v.status)?' · '+e(waitingText(v,c.today)):''}</p></div><div class="actions">${actions}</div></div>`+
 (v.recheck?`<div class="note">Freigegeben · betroffen von Erinnerung „${e(v.recheck.title)}“ ab ${e(dayDe(v.recheck.effective_date))}. Die frühere Freigabe bleibt in der Historie. Prüfung erneut starten.</div>`:'')+
 '<div class="notice">Testergebnisse sind Nachweise, keine Entscheidung. Nichts wird automatisch freigegeben.</div>'+
 `<div class="grid-even"><section class="panel"><div class="panel-header"><h2>Freigabe-Voraussetzungen</h2>${v.gate?`<span class="pill ${v.gate.ok?'pass':'fail'}">${v.gate.ok?'Erfüllt':'Blockiert'}</span>`:''}</div>${custGate(v)}</section><section class="panel"><h2>Historie</h2>${custHistory(v)}</section></div>`+
 custEvidence(v,d)+custSubmissions(v)+custPackages(v);
}

/* Dialogs */
function custNewDialog(){
 const c=cert();
 modal(`<h2>Hersteller / Software anlegen</h2><p class="muted">Bestehenden Hersteller wählen oder neuen Namen eingeben. Doppelte Versionen werden abgelehnt.</p><form id="cust-version-form" class="cust-form"><div class="field"><label for="cust-maker">Hersteller</label><input id="cust-maker" name="manufacturer" list="cust-makers" required maxlength="160" placeholder="z. B. Demo Lohn GmbH (fiktiv)" autocomplete="off"><datalist id="cust-makers">${c.manufacturers.map(m=>`<option value="${e(m.name)}"></option>`).join('')}</datalist><small>${c.manufacturers.length?c.manufacturers.length+' Hersteller vorhanden · Auswahl aus der Liste oder neuer Name':'Noch keine Hersteller vorhanden'}</small></div><div class="form-row"><div class="field"><label for="cust-software">Software</label><input id="cust-software" name="software" required maxlength="160" placeholder="z. B. LohnPro"></div><div class="field"><label for="cust-ver">Version</label><input id="cust-ver" name="version" required maxlength="60" placeholder="z. B. 5.2"></div></div>${custPeople('cust-new','')}<button class="btn primary">Anlegen</button></form>`);
}
function custTransitionDialog(id,step){
 const v=cert().versions.find(x=>x.id===id);if(!v)throw Error('Version nicht gefunden.');
 const blocking=certList(v.gate?.items).filter(i=>!i.ok);
 const intro={start:'Die Prüfung beginnt manuell. Ergebnisse bleiben Nachweise, keine Entscheidung.',approve:'Die Freigabe ist nur möglich, wenn alle Voraussetzungen erfüllt sind. Das Backend prüft sie erneut.',reject:'Die Ablehnung bleibt mit Begründung in der Historie.',reopen:'Die Ablehnung bleibt in der Historie. Die Prüfung beginnt erneut.'}[step]||'';
 modal(`<div class="eyebrow">MENSCHLICHE ENTSCHEIDUNG</div><h2>${e(custActions[step]||step)}</h2><p>${e(v.manufacturer_name)} · ${e(v.software)} ${e(v.version)}</p><p class="muted">${intro}</p>${step==='approve'&&blocking.length?`<div class="note"><strong>Noch blockiert:</strong><br>${blocking.map(i=>e(i.label)+(i.detail?' · '+e(i.detail):'')).join('<br>')}</div>`:''}${step==='approve'?custSelfDeclared:''}<form id="cust-transition-form" class="cust-form"><input type="hidden" name="version_id" value="${e(id)}"><input type="hidden" name="action" value="${e(step)}">${custPeople('cust-tr')}<button class="btn ${step==='reject'?'danger':'primary'}">${e(custActions[step]||step)}</button></form>`);
}
function custAcceptDialog(job,caseId){
 const v=cert().versions.find(x=>x.id===hashParams().get('version'));if(!v)throw Error('Version nicht gefunden.');
 modal(`<div class="eyebrow">FACHLICHE AKZEPTANZ</div><h2>Unklares Ergebnis akzeptieren</h2><p>${e(v.software)} ${e(v.version)} · Fall <code>${e(caseId)}</code></p><p class="muted">Die Akzeptanz gilt nur für diesen Import und erscheint im Bericht. Wer akzeptiert, darf die Version nicht selbst freigeben.</p><form id="cust-accept-form" class="cust-form"><input type="hidden" name="version_id" value="${e(v.id)}"><input type="hidden" name="job_id" value="${e(job)}"><input type="hidden" name="case_id" value="${e(caseId)}">${custPeople('cust-acc','Begründung / geprüfte Grundlage')}<button class="btn primary">Fachlich akzeptieren</button></form>`);
}
function custSubReviewDialog(id){
 const s=cert().submissions.find(x=>x.id===id);if(!s)throw Error('Einreichung nicht gefunden.');
 modal(`<div class="eyebrow">EINREICHUNG</div><h2>${s.status==='pending'?'Einreichung entscheiden':'Entscheidung ändern'}</h2><p>${e(s.name)} · ${badge(s.status)}</p><p class="muted">${s.status==='pending'?'Datei vorher herunterladen und prüfen.':'Eine Änderung braucht eine neue Begründung. Jede Entscheidung wird protokolliert.'}</p><form id="cust-subreview-form" class="cust-form"><input type="hidden" name="id" value="${e(id)}">${custPeople('cust-sr')}<div class="actions"><button class="btn primary" name="decision" value="approve">Freigeben</button><button class="btn danger" name="decision" value="reject">Ablehnen</button></div></form>`);
}
function custReminderDialog(){
 modal(`<h2>Erinnerung anlegen</h2><p class="muted">Nur mit belegbarer Quelle. AuditFlow erfindet keine Rechtsdaten.</p><form id="cust-reminder-form" class="cust-form"><div class="field"><label for="cust-rem-title">Titel</label><input id="cust-rem-title" name="title" required maxlength="200" placeholder="z. B. Spezifikation 13.5 gültig"></div><div class="field"><label for="cust-rem-date">Wirksam ab</label><input id="cust-rem-date" name="effective_date" type="date" required></div><div class="field"><label for="cust-rem-source">Quelle</label><textarea id="cust-rem-source" name="source_note" required maxlength="2000" rows="3" placeholder="Dokument und Abschnitt"></textarea></div>${custPeople('cust-rem','')}<button class="btn primary">Erinnerung speichern</button></form>`);
}
function custAffectedDialog(id){
 const c=cert(),r=c.reminders.find(x=>x.id===id);if(!r)throw Error('Erinnerung nicht gefunden.');
 const chosen=r.affected?new Set(certList(r.affected.version_ids)):null;
 const isApproved=v=>(v.stored_status||v.status)==='freigegeben'||v.status==='freigegeben';
 const versions=c.versions.slice().sort((a,b)=>`${a.manufacturer_name} ${a.software} ${a.version}`.localeCompare(`${b.manufacturer_name} ${b.software} ${b.version}`,'de',{numeric:true}));
 modal(`<div class="eyebrow">ERINNERUNG</div><h2>Betroffene Software bestätigen</h2><p>${e(r.title)} · wirksam ab ${e(dayDe(r.effective_date))}</p>${r.source?.note?`<p class="muted">Quelle: ${e(r.source.note)}</p>`:''}<p class="muted">${chosen?'Bisherige Auswahl ist markiert. Jede Änderung wird protokolliert.':'Vorschlag: alle freigegebenen Versionen.'} Bestätigte Versionen zeigen ab dem Stichtag „Erneut prüfen“. Die Freigabe wird nicht widerrufen.</p><form id="cust-affected-form" class="cust-form"><input type="hidden" name="reminder_id" value="${e(id)}">${versions.length?`<fieldset class="version-check"><legend>Software-Versionen</legend>${versions.map(v=>`<label><input type="checkbox" name="version_ids" value="${e(v.id)}" ${(chosen?chosen.has(v.id):isApproved(v))?'checked':''}><span>${e(v.manufacturer_name)} · ${e(v.software)} ${e(v.version)}</span>${badge(v.status)}</label>`).join('')}</fieldset>`:'<p class="muted">Noch keine Versionen. Eine leere Bestätigung bedeutet: keine Software betroffen.</p>'}${custPeople('cust-aff')}<button class="btn primary">Bestätigen</button></form>`);
}
async function custDownload(id,name){
 const r=await fetch('/api/cert/submission/'+encodeURIComponent(id),{headers:token()?{Authorization:'Bearer '+token()}:{}});
 if(!r.ok){let msg='Download fehlgeschlagen.';try{msg=(await r.json()).error||msg;}catch{}throw Error(msg);}
 const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=name||('Einreichung-'+id);a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function custReload(){if(custDetail)custDetail.stale=true;await load();}
const custEditing=()=>document.getElementById('dialog').open||!!document.activeElement?.closest('form,.cust-filters');

/* Events */
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b||!b.dataset.action.startsWith('cust-'))return;
 const action=b.dataset.action;b.disabled=true;
 try{
  if(action==='cust-new')custNewDialog();
  else if(action==='cust-transition')custTransitionDialog(b.dataset.id,b.dataset.step);
  else if(action==='cust-accept')custAcceptDialog(b.dataset.job,b.dataset.case);
  else if(action==='cust-subreview')custSubReviewDialog(b.dataset.id);
  else if(action==='cust-download')await custDownload(b.dataset.id,b.dataset.name);
  else if(action==='cust-reminder-new')custReminderDialog();
  else if(action==='cust-affected')custAffectedDialog(b.dataset.id);
  else if(action==='cust-clear-filter'){custQuery='';custStatus='';if(hashParams().get('status'))navigate('customers');else render();}
  else if(action==='cust-unclear-page'&&custDetail?.data){const offset=(custDetail.offset||0)+Number(b.dataset.direction)*CUST_LIMIT;if(offset>=0&&offset<(Number(custDetail.data.unclear_total)||0))await custFetchDetail(custDetail.id,offset);}
 }catch(err){toast(err.message);}finally{b.disabled=false;}
});
document.addEventListener('input',event=>{if(event.target.id==='cust-search'){custQuery=event.target.value;const list=document.getElementById('cust-list');if(list)list.innerHTML=custList();}});
document.addEventListener('change',event=>{if(event.target.id==='cust-status'){custStatus=event.target.value;const list=document.getElementById('cust-list');if(list)list.innerHTML=custList();}});
document.addEventListener('submit',async event=>{
 const form=event.target,id=form.getAttribute('id')||'';if(!id.startsWith('cust-'))return;event.preventDefault();
 const data=Object.fromEntries(new FormData(form));const button=event.submitter;if(button)button.disabled=true;
 const close=()=>document.getElementById('dialog').close();
 try{
  if(data.reviewer!==undefined)custRemember(String(data.reviewer).trim());
  if(id==='cust-version-form'){
   const name=String(data.manufacturer||'').trim(),match=cert().manufacturers.find(m=>String(m.name).trim().toLowerCase()===name.toLowerCase());
   const created=await api('cert/version',{...(match?{manufacturer_id:match.id}:{manufacturer_name:name}),software:data.software,version:data.version,reviewer:data.reviewer});
   close();await custReload();toast('Software-Version angelegt. Status: Neu.');
   const newId=created?.id||created?.version?.id;if(newId)location.hash='customers?version='+encodeURIComponent(newId);
  }else if(id==='cust-transition-form'){await api('cert/transition',{version_id:data.version_id,action:data.action,reviewer:data.reviewer,note:data.note});close();await custReload();toast((custActions[data.action]||'Entscheidung')+' · dokumentiert.');}
  else if(id==='cust-accept-form'){await api('cert/accept',{version_id:data.version_id,job_id:data.job_id,case_id:data.case_id,reviewer:data.reviewer,note:data.note});close();await custReload();toast('Ergebnis fachlich akzeptiert.');}
  else if(id==='cust-subreview-form'){await api('cert/submission/review',{id:data.id,approve:button?.value==='approve',reviewer:data.reviewer,note:data.note});close();await custReload();toast('Entscheidung zur Einreichung dokumentiert.');}
  else if(id==='cust-submission-form'){
   const file=form.querySelector('input[type=file]').files[0];
   if(file&&!/\.(pdf|docx|txt)$/i.test(file.name))throw Error('Nur PDF, DOCX oder TXT.');
   await api('cert/submission',{version_id:data.version_id,name:file?.name,base64:await file64(file),reviewer:data.reviewer});await custReload();toast('Einreichung hochgeladen. Entscheidung offen.');
  }else if(id==='cust-reminder-form'){await api('cert/reminder',{title:data.title,effective_date:data.effective_date,source_note:data.source_note,reviewer:data.reviewer});close();await custReload();toast('Erinnerung gespeichert. Betroffene Software noch bestätigen.');}
  else if(id==='cust-affected-form'){const ids=[...form.querySelectorAll('input[name="version_ids"]:checked')].map(x=>x.value);await api('cert/reminder/affected',{reminder_id:data.reminder_id,version_ids:ids,reviewer:data.reviewer,note:data.note});close();await custReload();toast(ids.length===1?'1 Version als betroffen bestätigt.':ids.length+' Versionen als betroffen bestätigt.');}
 }catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});
// Keep overview and version detail current (job progress, imports, derived status). Skips while someone is editing.
setInterval(async()=>{
 const page=route();if(custPollBusy||!state||document.hidden||(page!=='dashboard'&&page!=='customers'))return;
 custPollBusy=true;try{
  const fresh=await api('state');
  const changed=JSON.stringify([fresh.certification,fresh.automation])!==JSON.stringify([state.certification,state.automation]);
  if(changed){
   const before=typeof autoSelected!=='undefined'&&autoSelected?state.automation?.jobs?.find(j=>j.id===autoSelected):null;
   state=fresh;if(custDetail)custDetail.stale=true;
   const job=before&&fresh.automation?.jobs?.find(j=>j.id===before.id);
   if(job&&(job.completed!==before.completed||job.status!==before.status)&&typeof autoFetchRows==='function')await autoFetchRows();
   custPollPending=true;
  }
  if(custPollPending&&!custEditing()&&['dashboard','customers'].includes(route())){custPollPending=false;render();}
 }catch(err){/* Keep the last observed state during a temporary disconnect. */}finally{custPollBusy=false;}
},4000);
if(state&&route()==='customers')render();
