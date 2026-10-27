'use strict';
/* Selected interaction patterns from the supplied Base44 app, adapted to AuditFlow's
   local API. No Base44 account, SDK, hosted data or original sample is copied. */
const testTypes={positive:'Positivfall',negative:'Negativfall',boundary:'Grenzfall',missing_data:'Fehlende Daten',custom:'Eigener Fall'};
const testTypeLabel=t=>testTypes[t]||t;
let assistantRef=null,assistantBusy=false;
const uiIcons={
 package:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5.65"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z"/>',
 document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
 building:'<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 9h3a2 2 0 0 1 2 2v10M2.5 21h19M8 7.5h3M8 11.5h3M8 15.5h3"/>',
 calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2"/>'
};
const uiIcon=(name,cls='')=>`<svg class="ui-icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${uiIcons[name]||uiIcons.package}</svg>`;
function resultGraphic(job){
 if(!job)return `<div class="chart-empty"><div class="empty-ring">${uiIcon('document')}</div><strong>Noch keine Ergebnisse</strong><p>Nach dem ersten Herstellerimport erscheint hier die Auswertung.</p></div>`;
 const colors={pass:'#20806a',fail:'#d50032',not_assessable:'#b77a19',technical_error:'#727987'};
 const rows=['pass','fail','not_assessable','technical_error'].map(status=>({status,count:job.counts[status]||0}));
 const total=rows.reduce((n,x)=>n+x.count,0);
 let offset=0;
 const rings=rows.filter(x=>x.count>0).map(x=>{const length=x.count/Math.max(total,1)*100;const circle=`<circle class="result-segment" cx="60" cy="60" r="48" pathLength="100" fill="none" stroke="${colors[x.status]}" stroke-width="10" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;offset+=length;return circle;}).join('');
 return `<div class="result-visual"><div class="ring-wrap"><svg class="result-ring" viewBox="0 0 120 120" role="img" aria-label="${e(rows.map(x=>(labels[x.status]||x.status)+': '+x.count).join(', '))}"><circle cx="60" cy="60" r="48" fill="none" stroke="#edf0f2" stroke-width="10"/>${rings}</svg><div class="ring-caption"><strong>${total.toLocaleString('de-DE')}</strong><span>ausgewertet</span></div></div><ul class="chart-legend">${rows.filter(x=>x.status!=='technical_error'||x.count>0).map(x=>`<li><span class="legend-dot legend-${x.status}"></span><span>${e(labels[x.status])}</span><strong>${x.count.toLocaleString('de-DE')}</strong></li>`).join('')}</ul></div><div class="chart-foot"><span>${e(job.project.software)} · ${e(job.package.name)}${job.selection==='impact'?' · Teilprüfung':''}</span>${btn('Ansehen '+uiIcon('arrow'),'auto-open',`data-id="${e(job.id)}"`,'small')}</div>`;
}
/* Certification overview (spec 6). Reads state.certification; renders empty states when it is missing. */
Object.assign(labels,{neu:'Neu',in_pruefung:'In Prüfung',freigegeben:'Freigegeben',abgelehnt:'Abgelehnt',erneut_pruefen:'Erneut prüfen',upcoming:'Geplant',soon:'Bald wirksam',overdue:'Überfällig',unconfirmed:'Unbestätigt',done:'Erledigt'});
const certOpenStatus=['neu','in_pruefung','erneut_pruefen'];
const certList=v=>Array.isArray(v)?v:[];
function cert(){const c=state&&state.certification;return {available:!!c,today:c?.today||'',manufacturers:certList(c?.manufacturers),versions:certList(c?.versions),submissions:certList(c?.submissions),reminders:certList(c?.reminders),documents_pending:certList(c?.documents_pending)};}
const certText=v=>v!==null&&typeof v==='object'?fieldValue(v):e(v);
function dayDe(s){const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?`${m[3]}.${m[2]}.${m[1]}`:'—';}
function monthDe(s){const m=/^(\d{4})-(\d{2})/.exec(String(s||''));return m?new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'}):'Ohne Datum';}
function dayDiff(from,to){const p=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])):NaN;};const d=Math.round((p(to)-p(from))/864e5);return Number.isFinite(d)?d:null;}
function waitingText(v,today){const since=v.waiting_since||v.created_at;const d=dayDiff(since,today);if(d===null)return since?'wartet seit '+dayDe(since):'';return d<=0?'wartet seit heute':d===1?'wartet seit 1 Tag':`wartet seit ${d} Tagen`;}
function dueText(r){const d=r.days_until;if(typeof d!=='number')return dayDe(r.effective_date);if(d<0)return `seit ${dayDe(r.effective_date)} wirksam`;if(d===0)return 'heute wirksam';if(d===1)return 'morgen wirksam';return `in ${d} Tagen · ${dayDe(r.effective_date)}`;}
// Badge on "Übersicht": soon and overdue reminders. An unconfirmed reminder inside the 14-day window counts as soon.
function reminderAlert(r){return r.state==='overdue'||r.state==='soon'||(r.state==='unconfirmed'&&typeof r.days_until==='number'&&r.days_until>=0&&r.days_until<=14);}
function certAlertCount(){return cert().reminders.filter(reminderAlert).length;}
function remindersShown(){return cert().reminders.filter(r=>r.state!=='done'&&(typeof r.days_until!=='number'||r.days_until<=90)).sort((a,b)=>(a.state==='overdue'?0:1)-(b.state==='overdue'?0:1)||(a.days_until??1e9)-(b.days_until??1e9));}
const versionHref=id=>'#customers?version='+encodeURIComponent(id);
function certWaiting(){return cert().versions.filter(v=>certOpenStatus.includes(v.status)).sort((a,b)=>String(a.waiting_since||a.created_at||'').localeCompare(String(b.waiting_since||b.created_at||'')));}
function certRow(v,today,showWait=true){return `<a class="cert-row" href="${versionHref(v.id)}"><div class="cert-row-main"><strong>${e(v.software)} <span>${e(v.version)}</span></strong>${v.hint?.text?`<small>${e(v.hint.text)}</small>`:''}</div><div class="cert-row-side">${badge(v.status)}${showWait&&certOpenStatus.includes(v.status)?`<small>${e(waitingText(v,today))}</small>`:''}</div></a>`;}
function certGroups(versions){const groups=new Map();for(const v of versions){const key=v.manufacturer_id||v.manufacturer_name;if(!groups.has(key))groups.set(key,{name:v.manufacturer_name,items:[]});groups.get(key).items.push(v);}return [...groups.values()];}
function reminderRow(r){
 const cls=r.state==='overdue'?'overdue':reminderAlert(r)?'soon':'';
 const n=certList(r.affected?.version_ids).length;
 const affected=r.affected?`<small>${n===1?'1 Version':n+' Versionen'} betroffen · bestätigt von ${e(r.affected.confirmed_by)}</small>${btn('Bearbeiten','cust-affected',`data-id="${e(r.id)}"`,'small')}`:btn('Betroffene Software bestätigen','cust-affected',`data-id="${e(r.id)}"`,'small rem-confirm');
 return `<div class="rem-row ${cls}"><div class="rem-main"><strong>${e(r.title)}</strong><small>${e(dueText(r))}${r.source?.note?' · Quelle: '+e(r.source.note):''}</small></div><div class="rem-side">${cls?badge(r.state):''}${affected}</div></div>`;
}
function dateList(reminders){
 const items=reminders.filter(r=>typeof r.days_until==='number'&&r.days_until>=0&&r.days_until<=90).sort((a,b)=>String(a.effective_date).localeCompare(String(b.effective_date)));
 if(!items.length)return '<p class="muted date-empty">Keine anstehenden Termine in den nächsten 90 Tagen.</p>';
 const months=new Map();for(const r of items){const k=String(r.effective_date).slice(0,7);if(!months.has(k))months.set(k,[]);months.get(k).push(r);}
 return `<div class="date-list">${[...months].map(([k,rs])=>`<div class="date-month"><h3>${e(monthDe(k))}</h3><ul>${rs.map(r=>`<li><time datetime="${e(r.effective_date)}">${e(dayDe(r.effective_date))}</time><span>${e(r.title)}</span></li>`).join('')}</ul></div>`).join('')}</div>`;
}
// Ring of all registered software versions by stored status.
const softwareStatusColors={neu:'#8a93a3',in_pruefung:'#b77a19',erneut_pruefen:'#7b5cc4',freigegeben:'#20806a',abgelehnt:'#d50032'};
function softwareRing(versions){
 const rows=['neu','in_pruefung','erneut_pruefen','freigegeben','abgelehnt'].map(status=>({status,count:versions.filter(v=>v.status===status).length}));
 const total=versions.length;let offset=0;
 const rings=rows.filter(x=>x.count>0).map(x=>{const length=x.count/Math.max(total,1)*100;const circle=`<circle class="result-segment" cx="60" cy="60" r="48" pathLength="100" fill="none" stroke="${softwareStatusColors[x.status]}" stroke-width="10" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;offset+=length;return circle;}).join('');
 return `<div class="result-visual software-visual"><div class="ring-wrap"><svg class="result-ring" viewBox="0 0 120 120" role="img" aria-label="${e(rows.map(x=>(labels[x.status]||x.status)+': '+x.count).join(', '))}"><circle class="ring-track" cx="60" cy="60" r="48" fill="none" stroke="#edf0f2" stroke-width="10"/>${rings}</svg><div class="ring-caption"><strong>${total.toLocaleString('de-DE')}</strong><span>registriert</span></div></div><ul class="chart-legend">${rows.map(x=>`<li><span class="legend-dot legend-sw-${x.status}"></span><span>${e(labels[x.status]||x.status)}</span><strong>${x.count.toLocaleString('de-DE')}</strong></li>`).join('')}</ul></div>`;
}
function workspaceDashboard(){
 const c=cert(),n=v=>v.toLocaleString('de-DE');
 const waiting=certWaiting(),reminders=remindersShown();
 const kpi=(icon,value,title,note,attrs)=>`<a class="dashboard-kpi" ${attrs}><span class="kpi-icon">${uiIcon(icon)}</span><div><span class="kpi-label">${title}</span><strong>${value}</strong><small>${note}</small></div></a>`;
 const softwarePanel=`<a class="panel software-panel" href="#customers"><div class="panel-header"><div><h2>Registrierte Software</h2><p>Alle Software-Versionen auf der Plattform nach Status</p></div></div>${c.versions.length?softwareRing(c.versions):'<div class="cert-empty"><strong>Noch keine Software registriert.</strong><p>Hersteller und Version unter Kunden & Software anlegen.</p></div>'}</a>`;
 const remPanel=`<section class="panel rem-panel"><div class="panel-header"><div><h2>Erinnerungen & Termine</h2><p>Gesetzes- und Spezifikationsänderungen mit Quelle</p></div>${btn('+ Erinnerung','cust-reminder-new','','small')}</div>${reminders.length?`<div class="rem-list">${reminders.map(reminderRow).join('')}</div>`:'<div class="cert-empty"><strong>Keine offenen Erinnerungen.</strong><p>Änderungen mit Quelle über „+ Erinnerung“ erfassen oder ein Dokument mit Gültigkeitsdatum importieren.</p></div>'}<h3 class="date-heading">${uiIcon('calendar')} Anstehende Termine</h3>${dateList(reminders)}</section>`;
 return `<div class="dashboard-heading"><div><div class="eyebrow">ÜBERSICHT</div><h1>Alles Wichtige im Blick.</h1><p>Hersteller, registrierte Software und anstehende Termine.</p></div></div>`+
 (c.available?'':'<div class="notice">Zertifizierungsdaten sind noch nicht verfügbar. Das Backend liefert keinen Bereich <code>certification</code>.</div>')+
 `<div class="cert-top">${softwarePanel}<div class="cert-kpi-stack">${kpi('building',n(c.manufacturers.length),'Hersteller','Kunden insgesamt','href="#customers"')}${kpi('clock',n(waiting.length),'Offene Zertifizierungen','Neu, in Prüfung, erneut prüfen','href="#customers?status=open"')}</div></div>`+
 remPanel+
 `<p class="scope-caption">Synthetische Demo · Hersteller führen die Tests aus · Keine automatische Zulassung</p>`;
}
function workspaceHelp(){
 return heading('Hilfe & Einstieg','So funktioniert der gemeinsame Ablauf.','Die zusätzlichen Ansichten aus dem ZIP sind an das lokale AuditFlow-Backend angepasst.')+
 `<section class="panel"><h2>Vom Testpaket zum Herstellerbericht</h2><ol class="help-steps"><li>Unter <a href="#sources">Quellen & KI</a> Dokumente hochladen. Neue Versionen werden erkannt und automatisch mit dem bisherigen Stand verglichen. Aus Abschnitten Regelentwürfe erstellen.</li><li>Anforderungen und synthetische Vorlagen fachlich prüfen und freigeben.</li><li>Unter <a href="#customers">Kunden & Software</a> Hersteller und Version anlegen und in der Version ein Testpaket mit Profilen und Fall-IDs vorbereiten.</li><li>Das Eingabepaket als JSON exportieren. Der Hersteller führt die Tests in seiner eigenen Software aus.</li><li>Die Ergebnisse des Herstellers importieren. AuditFlow vergleicht Soll und Ist; fehlende Ergebnisse bleiben nicht beurteilbar.</li><li>Bei Regeländerungen betroffene Fälle auswählen und ein neues Hersteller-Testpaket erstellen. Neue Ergebnisse importieren und Berichte mit Belegen exportieren.</li></ol></section>`+
 `<div class="grid-even"><section class="panel"><h2>Dokumente und KI</h2><p>Unter <a href="#sources">Quellen & KI</a> TXT, MD, PDF oder DOCX hochladen. Die Versionsbezeichnung ist Pflicht; identische Dateien werden als Duplikat erkannt. Ein PDF wird immer vollständig importiert. Versionen werden nie gelöscht, nur mit Begründung zurückgezogen.</p><p>Pro Abschnitt wörtliche Offline-Vorschläge oder KI-Entwürfe anfordern. Zitatabgleich und fachliche Freigabe bleiben getrennt. Neue Freitextregeln werden dadurch nicht ausführbar.</p><p>Der Modell-Key gehört serverseitig in <code>HAI_API_KEY</code>. Eine Konfiguration ist noch kein erfolgreicher Verbindungstest. Alternativ liest der Server ihn aus einer lokalen, nicht eingecheckten .env-Datei.</p></section><section class="panel"><h2>Erklärassistent</h2><p>In einem Einzelbericht oder einer Automatik-Ergebniszeile „Erklären“ wählen. Der Assistent liest die gespeicherten Belege des ausgewählten Laufs.</p><p><strong>Lokal:</strong> Evidenzanzeige und feste Prüfschritte ohne Modellaufruf. <strong>KI:</strong> beantwortet die Frage mit dem konfigurierten Modell. Fehler werden angezeigt; kein verdeckter Wechsel zu einer angeblichen KI-Antwort.</p><p>Der Assistent kann keine Freigaben erteilen, Befunde ändern oder Software zulassen.</p></section></div>`+
 `<section class="panel"><h2>Gemeinsamer Stand und Grenzen</h2><p>Die Übersicht bündelt Hersteller, registrierte Software, offene Zertifizierungen und Erinnerungen. Testpakete und Ergebnisimporte liegen in der jeweiligen Version unter Kunden & Software. Der Vergleich zur Vorversion wird beim Upload unter Quellen & KI gespeichert. Ergebnisse, Abdeckung und Prüfberichte stehen unter <a href="#results">Ergebnisse & Abdeckung</a>. Die Oberfläche nutzt weiterhin ITSG-inspiriertes Rot.</p><p>Base44-Konten und Cloud-Dateiablage sind nicht verbunden. Die Anwendung bleibt lokal mit einem optionalen gemeinsamen Zugriffstoken. Eine echte Mehrbenutzerverwaltung ist nicht enthalten.</p><p>Unterstützt werden strukturierte synthetische C1-/C2-/C4-Vorlagen und die begrenzte Einzeldateiprüfung. Keine vollständige Lohnprüfung, amtliche Zertifizierung oder automatisch ausführbaren neuen Gesetze.</p></section>`;
}
function generationDialog(){
 modal(`<h2>Gezielte Testentwürfe</h2><p>Die ausgewählte Fallart wird mit den freigegebenen C1-/C2-/C4-Demoregeln verknüpft. Vorlagenfälle verwenden feste synthetische Daten aus 2026; Grenzfälle und KI-Entwürfe nutzen den Ausgangsfall. Alle Erwartungen bleiben fachlich zu prüfen.</p><form id="ws-generate-form"><div class="field"><label for="draft-baseline">Ausgangsfall / Regelstand</label><select id="draft-baseline" name="case_id">${state.cases.map(c=>`<option value="${e(c.id)}">${e(c.name)} · ${e(c.ruleset)}</option>`).join('')}</select></div><div class="field"><label for="draft-type">Testfallart</label><select id="draft-type" name="test_type">${Object.entries(testTypes).filter(([k])=>k!=='custom').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label for="draft-mode">Erzeugung</label><select id="draft-mode" name="mode"><option value="template">Synthetische Vorlage · ohne KI</option><option value="live">KI-Entwurf · Modellverbindung erforderlich</option></select></div><div class="note">Fehlender Nachweisstatus bleibt unbekannt. Negative Fälle erwarten korrekt keine Anfrage. Grenzfälle enthalten bewusst offene Erwartungen.</div><button class="btn primary">Entwürfe erstellen</button></form>`);
}
function showAssistant(ref){
 if(assistantBusy)return toast('Bitte die laufende Erklärung abwarten.');
 if(ref)assistantRef=ref;
 const panel=document.getElementById('assistant-panel');panel.hidden=false;
 document.getElementById('assistant-toggle').setAttribute('aria-expanded','true');
 document.getElementById('assistant-toggle').hidden=true;
 if(ref){document.getElementById('assistant-answer').textContent='';document.getElementById('assistant-context').textContent=(ref.kind==='run'?'Einzelbericht '+ref.id+(ref.finding_id?' · '+ref.finding_id:''):'Automatiklauf '+ref.job_id+' · Fall '+ref.case_id);}
 document.getElementById('assistant-question').focus();
}
function closeAssistant(){document.getElementById('assistant-panel').hidden=true;document.getElementById('assistant-toggle').hidden=false;document.getElementById('assistant-toggle').setAttribute('aria-expanded','false');document.getElementById('assistant-toggle').focus();}
document.getElementById('assistant-toggle').onclick=()=>showAssistant(null);
document.getElementById('assistant-close').onclick=closeAssistant;
document.getElementById('assistant-panel').addEventListener('keydown',event=>{if(event.key==='Escape')closeAssistant();});
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b||!b.dataset.action.startsWith('ws-'))return;
 b.disabled=true;try{
  if(b.dataset.action==='ws-generate')generationDialog();
  if(b.dataset.action==='ws-all-jobs'){workspaceAllJobs=!workspaceAllJobs;render();}
  if(b.dataset.action==='ws-waiting'){const job=state.automation.jobs.find(j=>j.mode==='import'&&j.status==='waiting_import');if(job){autoSelected=job.id;autoOffset=0;await autoFetchRows();render();document.querySelector('.auto-detail')?.scrollIntoView({block:'start'});document.querySelector('.auto-detail [data-action="auto-import"]')?.click();}}
  // Test packages now live in the version detail on "Kunden & Software".
  if(b.dataset.action==='ws-prepare'){workspaceSetupOpen=true;navigate('customers');}

  if(b.dataset.action==='ws-explain')showAssistant(b.dataset.kind==='run'?{kind:'run',id:b.dataset.id,...(b.dataset.finding?{finding_id:b.dataset.finding}:{})}:{kind:'automation',job_id:b.dataset.job,case_id:b.dataset.case});
 }catch(err){toast(err.message);}finally{b.disabled=false;}
});
document.addEventListener('submit',async event=>{
 const form=event.target;const id=form.getAttribute('id');if(!id?.startsWith('ws-'))return;event.preventDefault();
 const data=Object.fromEntries(new FormData(form));const button=event.submitter;if(button)button.disabled=true;
 try{
  if(id==='ws-generate-form'){const created=await api('generate',data);document.getElementById('dialog').close();await load();toast(created.length+' verknüpfte Testentwürfe gespeichert.');}
  if(id==='ws-assistant-form'){
   if(!assistantRef)throw Error('Zuerst in einem Bericht oder einer Ergebniszeile „Erklären“ wählen.');
   if(assistantBusy)return;assistantBusy=true;
   const target=document.getElementById('assistant-answer');target.textContent='Erklärung wird geladen …';
   try{
    const r=await api('assistant/explain',{...data,mode:state.model?.configured?'live':'offline',ref:assistantRef});
    target.innerHTML=`<p class="pill">${r.mode==='live'?'KI · '+e(r.model_id):'Lokale Erklärung · ohne KI'}</p><div class="assistant-prose">${e(r.answer)}</div><h3>Nächste Prüfschritte</h3><ol>${r.next_steps.map(s=>`<li>${e(s)}</li>`).join('')}</ol><details><summary>Verwendete gespeicherte Belege</summary>${fieldValue(r.evidence)}</details><p class="muted">${e(r.note)} · ${e(r.prompt_version)}</p>`;
   }catch(err){target.textContent='Erklärung fehlgeschlagen: '+err.message;}
   finally{assistantBusy=false;}
  }
 }catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});
