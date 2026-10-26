'use strict';
/* Selected interaction patterns from the supplied Base44 app, adapted to AuditFlow's
   local API. No Base44 account, SDK, hosted data or original sample is copied. */
const testTypes={positive:'Positivfall',negative:'Negativfall',boundary:'Grenzfall',missing_data:'Fehlende Daten',custom:'Eigener Fall'};
const testTypeLabel=t=>testTypes[t]||t;
let assistantRef=null,assistantBusy=false;
function workspaceDashboard(){
 const a=state.automation||{jobs:[],suites:[],projects:[],packages:[]};
 const generated=a.suites.reduce((n,s)=>n+s.generated,0);
 const legacyApproved=state.requirements.filter(r=>r.status==='approved').length;
 const packageApproved=a.packages.filter(p=>p.status==='approved').length;
 const active=a.jobs.filter(j=>['queued','running'].includes(j.status));
 const waiting=a.jobs.filter(j=>j.status==='waiting_import');
 const pendingRequirements=state.requirements.filter(r=>r.status==='pending').length;
 const pendingPackages=a.packages.filter(p=>p.status==='pending').length;
 const draftCount=pendingRequirements+pendingPackages;
 const historicalFailures=a.jobs.reduce((n,j)=>n+j.counts.fail+j.counts.technical_error,0)+state.runs.filter(r=>['fail','technical_error'].includes(r.overall_status)).length;
 const stages=[
  ['1','Quellenbestand',state.documents.length+' Dokumente mit Version und Fundstellen','sources',state.documents.length?'Quellen prüfen':'Dokument importieren'],
  ['2','Fachliche Freigaben',legacyApproved+' Einzelregeln · '+packageApproved+' Vorlagenpakete freigegeben','requirements',draftCount+' Regel-/Paketentwürfe offen'],
  ['3','Profile & Ausführung',generated.toLocaleString('de-DE')+' generierte Profile · '+active.length+' aktive Automatikläufe','automation',waiting.length+' Läufe warten auf Ergebnisimport'],
  ['4','Befunde & Nachweise',a.jobs.length+' Automatikläufe · '+state.runs.length+' Einzelprüfungen','reports','Berichte und Belege öffnen']
 ];
 return heading('Gemeinsamer Prüfplatz · AuditFlow 0.3','Von der Quelle zum nachvollziehbaren Befund.','Dokumente, Freigaben, Massenprüfungen und Erklärungen auf einer Arbeitsfläche.',`<a class="btn primary" href="#automation">Prüfauftrag starten ↗</a>`)+
 `<section class="hero"><div class="copy"><div class="eyebrow">ITSG CHALLENGE · DEMO</div><h2>Ein Regelstand.<br>Tausende nachvollziehbare Tests.</h2><p>Vorlagen freigeben, Profile erzeugen und Soll mit Ist vergleichen. Bei einer Regeländerung werden betroffene Fälle gezielt erneut geprüft.</p></div><a href="#help" class="btn">Ablauf kennenlernen →</a></section>`+
 `<div class="workspace-stages">${stages.map(([n,t,d,url,action])=>`<a class="stage-card" href="#${url}"><span class="stage-number">${n}</span><h2>${t}</h2><p>${e(d)}</p><small>${e(action)} →</small></a>`).join('')}</div>`+
 `<div class="stats"><div class="stat"><div class="label">SOFTWARE-PRÜFZIELE</div><div class="value">${a.projects.length}</div><small>Hersteller und Version</small></div><div class="stat"><div class="label">TESTFÄLLE GESAMT</div><div class="value">${(state.cases.length+generated).toLocaleString('de-DE')}</div><small>${state.cases.length} Einzelentwürfe + ${generated.toLocaleString('de-DE')} Vorlagenfälle</small></div><div class="stat"><div class="label">AKTIVE / WARTENDE LÄUFE</div><div class="value">${active.length} / ${waiting.length}</div><small>Automatik / Ergebnisimport</small></div><div class="stat"><div class="label">HISTORISCHE ABWEICHUNGEN</div><div class="value">${historicalFailures.toLocaleString('de-DE')}</div><small>Automatikbefunde + abweichende Einzelprüfungen; inkl. älterer Läufe</small></div></div>`+
 `<div class="grid-even"><section class="panel"><div class="panel-header"><h2>Letzte Automatikläufe</h2><a class="source-link" href="#automation">Alle öffnen →</a></div>${a.jobs.length?`<div class="table-wrap"><table><thead><tr><th>Software / Regelstand</th><th>Status / Fortschritt</th><th></th></tr></thead><tbody>${a.jobs.slice(0,5).map(j=>`<tr><td><strong>${e(j.project.software)} ${e(j.project.software_version)}</strong><br><small>${e(j.package.name)} · ${j.mode==='simulation'?'Simulation':'Import'}</small></td><td>${badge(j.status)}<br><small>${j.completed} / ${j.total} geprüft</small><br><small>${j.counts.fail} Abweichungen · ${j.counts.not_assessable} offen</small></td><td>${btn('Öffnen','ws-job',`data-id="${e(j.id)}"`,'small')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Noch kein Automatiklauf.<br><a href="#automation">Mit 36 Fällen starten →</a></div>'}</section><section class="panel"><div class="panel-header"><h2>Letzte Einzelprüfungen</h2><a class="source-link" href="#reports">Alle öffnen →</a></div>${runTable(state.runs.slice(0,5))}</section></div>`+
 `<section class="panel"><h2>Was benötigt Aufmerksamkeit?</h2><div class="attention-list"><a href="#requirements">${pendingRequirements} Einzelregelentwürfe benötigen eine Entscheidung</a><a href="#automation">${pendingPackages} Regelpakete benötigen eine Freigabe</a><a href="#automation">${waiting.length} Automatikläufe warten auf Softwareergebnisse</a><a href="#coverage">${state.coverage.gaps.length} Lücken in der Einzelregel-Abdeckung prüfen</a></div><p class="muted">Diese Zahlen sind gespeicherte Zustände. Sie behaupten keine erfolgreiche KI-Auswertung und keine vollständige Konformität.</p></section>`+
 `<div class="notice"><strong>Prüfumfang:</strong> Synthetische DBVO-Vorlagen, keine Lohn- oder Leistungsberechnung. Ein abgeschlossener Lauf ist keine Zulassung. Offene Ergebnisse bleiben offen. KI entwirft und erklärt; Menschen geben fachlich frei.</div>`;
}
function workspaceGlossary(){
 const entries=[['AU','Arbeitsunfähigkeit. Im Profil werden Beginn, Ende und Nachweisstatus erfasst.'],['DBVO','Datenbaustein Vorerkrankungen im DTA-EEL-Verfahren. Die Demo betrachtet einen begrenzten Ausschnitt.'],['DTA EEL','Datenaustausch zu Entgeltersatzleistungen. Die Anwendung bildet keine vollständige EEL-Zertifizierung ab.'],['Abgabegrund 41','Vorerkrankungsanfrage; in dieser Demo das betrachtete Nachrichtenverhalten.'],['Soll / Ist','Soll: die freigegebene Erwartung. Ist: das beobachtete Ergebnis aus Simulation oder Import.'],['Negativfall','Ein Fall, in dem eine Anfrage unterbleiben soll. Unterbleibt sie korrekt, kann der Verhaltenstest bestehen.'],['Nicht beurteilbar','Eine Erwartung, ein Ergebnis, eine Eingabe oder eine erforderliche Freigabe fehlt bzw. ist ungeklärt. Kein Bestehen.'],['Regelpaket','Versionierte strukturierte Demoregeln mit Vorlagen und dokumentierter Freigabe.'],['Regressionstest','Wiederholungsprüfung bestehender Fälle nach einer Änderung.'],['Zitatabgleich','Prüft, ob ein Zitat im verknüpften Quellabschnitt vorkommt. Bestätigt keine fachliche Richtigkeit.'],['Simulation','Ausführung gegen eine synthetische Zielsoftware im Prototyp. Kein echter Herstelleranschluss.'],['Profil','Synthetische Person mit Testdaten. Entgelt, Stunden und Beschäftigungsart sind derzeit Metadaten.']];
 return heading('Nachschlagen','Begriffe verständlich erklärt.','Die Bedeutung der Begriffe innerhalb dieses Prototyps.')+`<section class="panel glossary-list">${entries.map(([term,definition])=>`<details><summary>${e(term)}</summary><p>${e(definition)}</p></details>`).join('')}</section>`;
}
function workspaceHelp(){
 return heading('Hilfe & Einstieg','So funktioniert der gemeinsame Ablauf.','Die zusätzlichen Ansichten aus dem ZIP sind an das lokale AuditFlow-Backend angepasst.')+
 `<section class="panel"><h2>Eine kurze Vorführung</h2><ol class="help-steps"><li><a href="#automation">Automatisierung öffnen</a> und ein Software-Prüfziel anlegen. Die automatische Folgeprüfung bei Regeländerungen aktivieren.</li><li>Das synthetische Regelpaket prüfen und mit eigener Begründung freigeben.</li><li>36 Fälle erzeugen. Für die Änderungsdemo das Verhalten „alte 30-Tage-Grenze beibehalten“ auswählen.</li><li>Ein Ergebnis öffnen, Profil ansehen und über „Erklären“ den gespeicherten Befund nachvollziehen.</li><li>Die ausdrücklich fiktive Änderung „Grenze +2 Tage“ erstellen und prüfen. Nach Freigabe startet beim aktivierten Projekt eine gezielte Folgeprüfung.</li><li>Auswahlgründe und Abweichungen prüfen und den JSON-/CSV-Bericht exportieren.</li></ol></section>`+
 `<div class="grid-even"><section class="panel"><h2>Dokumente und KI</h2><p>Unter <a href="#sources">Quellen & KI</a> TXT, MD, PDF oder DOCX importieren. Für PDF optional einen Bereich mit Originalseitennummern auswählen.</p><p>Pro Abschnitt wörtliche Offline-Vorschläge oder KI-Entwürfe anfordern. Zitatabgleich und fachliche Freigabe bleiben getrennt. Neue Freitextregeln werden dadurch nicht ausführbar.</p><p>Der Modell-Key gehört serverseitig in <code>HAI_API_KEY</code>. Eine Konfiguration ist noch kein erfolgreicher Verbindungstest. Die Anwendung lädt eine .env-Datei nicht automatisch.</p></section><section class="panel"><h2>Erklärassistent</h2><p>In einem Einzelbericht oder einer Automatik-Ergebniszeile „Erklären“ wählen. Der Assistent liest die gespeicherten Belege des ausgewählten Laufs.</p><p><strong>Lokal:</strong> Evidenzanzeige und feste Prüfschritte ohne Modellaufruf. <strong>KI:</strong> beantwortet die Frage mit dem konfigurierten Modell. Fehler werden angezeigt; kein verdeckter Wechsel zu einer angeblichen KI-Antwort.</p><p>Der Assistent kann keine Freigaben erteilen, Befunde ändern oder Software zulassen.</p></section></div>`+
 `<section class="panel"><h2>Gemeinsamer Stand und Grenzen</h2><p>Übernommen wurden die Bedienmuster für Fortschrittskarten, Befund-Assistent, Testfallarten, PDF-Seitenbereiche, Glossar und Hilfe. Die Oberfläche nutzt weiterhin ITSG-inspiriertes Rot.</p><p>Base44-Konten und Cloud-Dateiablage sind nicht verbunden. Die Anwendung bleibt lokal mit einem optionalen gemeinsamen Zugriffstoken. Eine echte Mehrbenutzerverwaltung ist nicht enthalten.</p><p>Unterstützt werden strukturierte synthetische C1-/C2-/C4-Vorlagen und die begrenzte Einzeldateiprüfung. Keine vollständige Lohnprüfung, amtliche Zertifizierung oder automatisch ausführbaren neuen Gesetze.</p></section>`;
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
  if(b.dataset.action==='ws-job'){autoSelected=b.dataset.id;autoOffset=0;await autoFetchRows();navigate('automation');render();}
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
    const r=await api('assistant/explain',{...data,ref:assistantRef});
    target.innerHTML=`<p class="pill">${r.mode==='live'?'KI · '+e(r.model_id):'Lokale Erklärung · ohne KI'}</p><div class="assistant-prose">${e(r.answer)}</div><h3>Nächste Prüfschritte</h3><ol>${r.next_steps.map(s=>`<li>${e(s)}</li>`).join('')}</ol><details><summary>Verwendete gespeicherte Belege</summary><pre>${pretty(r.evidence)}</pre></details><p class="muted">${e(r.note)} · ${e(r.prompt_version)}</p>`;
   }catch(err){target.textContent='Erklärung fehlgeschlagen: '+err.message;}
   finally{assistantBusy=false;}
  }
 }catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});

let dashboardPolling=false;
setInterval(async()=>{
 if(dashboardPolling||!state||route()!=='dashboard'||document.querySelector('dialog').open)return;
 dashboardPolling=true;
 try{const fresh=await api('automation/state');if(route()==='dashboard'&&JSON.stringify(fresh)!==JSON.stringify(state.automation)){state.automation=fresh;render();}}
 catch(err){toast(err.message);}finally{dashboardPolling=false;}
},3500);
