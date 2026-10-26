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
  ['3','Testpakete & Hersteller',generated.toLocaleString('de-DE')+' generierte Profile · '+active.length+' laufende Paketaufträge','dashboard',waiting.length+' Läufe warten auf Ergebnisimport'],
  ['4','Befunde & Nachweise',a.jobs.length+' Paketaufträge · '+state.runs.length+' historische Einzelberichte','reports','Berichte und Belege öffnen']
 ];
 return heading('Gemeinsamer Prüfplatz · AuditFlow 0.3.1','Von der Quelle zum nachvollziehbaren Befund.','Testfälle vorbereiten, Herstellerergebnisse übernehmen und Abweichungen nachvollziehen.',`<button class="btn primary" data-action="ws-prepare">Testpaket vorbereiten ↗</button>`)+
 `<section class="hero"><div class="copy"><div class="eyebrow">ITSG CHALLENGE · DEMO</div><h2>Ein Regelstand.<br>Tausende nachvollziehbare Tests.</h2><p>Vorlagen freigeben und Testpakete für Softwarehersteller erstellen. Die Hersteller führen die Tests aus; ihre Ergebnisse werden importiert und mit dem Soll verglichen.</p></div><a href="#help" class="btn">Ablauf kennenlernen →</a></section>`+
 `<div class="workspace-stages">${stages.map(([n,t,d,url,action])=>`<a class="stage-card" href="#${url}"><span class="stage-number">${n}</span><h2>${t}</h2><p>${e(d)}</p><small>${e(action)} →</small></a>`).join('')}</div>`+
 `<div class="stats"><div class="stat"><div class="label">SOFTWARE-PRÜFZIELE</div><div class="value">${a.projects.length}</div><small>Hersteller und Version</small></div><div class="stat"><div class="label">TESTFÄLLE GESAMT</div><div class="value">${(state.cases.length+generated).toLocaleString('de-DE')}</div><small>${state.cases.length} Einzelentwürfe + ${generated.toLocaleString('de-DE')} Vorlagenfälle</small></div><div class="stat"><div class="label">AKTIVE / WARTENDE LÄUFE</div><div class="value">${active.length} / ${waiting.length}</div><small>Paketerstellung / Ergebnisimport</small></div><div class="stat"><div class="label">HISTORISCHE ABWEICHUNGEN</div><div class="value">${historicalFailures.toLocaleString('de-DE')}</div><small>Automatikbefunde + abweichende Einzelprüfungen; inkl. älterer Läufe</small></div></div>`+
 manufacturerWorkspace()+
 `<section class="panel"><div class="panel-header"><h2>Bisherige Einzelberichte</h2><a class="source-link" href="#reports">Alle Berichte →</a></div>${runTable(state.runs.slice(0,5))}</section>`+
 `<section class="panel"><h2>Was benötigt Aufmerksamkeit?</h2><div class="attention-list"><a href="#requirements">${pendingRequirements} Einzelregelentwürfe benötigen eine Entscheidung</a><a href="#dashboard">${pendingPackages} Regelpakete benötigen eine Freigabe</a><a href="#dashboard">${waiting.length} Aufträge warten auf Herstellerergebnisse</a><a href="#coverage">${state.coverage.gaps.length} Lücken in der Einzelregel-Abdeckung prüfen</a></div><p class="muted">Diese Zahlen sind gespeicherte Zustände. Sie behaupten keine erfolgreiche KI-Auswertung und keine vollständige Konformität.</p></section>`+
 `<div class="notice"><strong>Prüfumfang:</strong> Hersteller führen die Tests in ihrer Software aus. AuditFlow erstellt Testpakete und wertet importierte Ergebnisse aus. Synthetische DBVO-Vorlagen, keine Lohn- oder Leistungsberechnung. Ein abgeschlossener Lauf ist keine Zulassung. Offene Ergebnisse bleiben offen. KI entwirft und erklärt; Menschen geben fachlich frei.</div>`;
}
function workspaceHelp(){
 return heading('Hilfe & Einstieg','So funktioniert der gemeinsame Ablauf.','Die zusätzlichen Ansichten aus dem ZIP sind an das lokale AuditFlow-Backend angepasst.')+
 `<section class="panel"><h2>Vom Testpaket zum Herstellerbericht</h2><ol class="help-steps"><li>Unter <a href="#sources">Quellen & KI</a> Unterlagen importieren, Regelentwürfe erstellen und Quellversionen vergleichen.</li><li>Anforderungen und synthetische Vorlagen fachlich prüfen und freigeben.</li><li>In der <a href="#dashboard">Übersicht</a> ein Software-Prüfziel anlegen und ein Testpaket mit Profilen und Fall-IDs vorbereiten.</li><li>Das Eingabepaket als JSON exportieren. Der Hersteller führt die Tests in seiner eigenen Software aus.</li><li>Die Ergebnisse des Herstellers importieren. AuditFlow vergleicht Soll und Ist; fehlende Ergebnisse bleiben nicht beurteilbar.</li><li>Bei Regeländerungen betroffene Fälle auswählen und ein neues Hersteller-Testpaket erstellen. Neue Ergebnisse importieren und Berichte mit Belegen exportieren.</li></ol></section>`+
 `<div class="grid-even"><section class="panel"><h2>Dokumente und KI</h2><p>Unter <a href="#sources">Quellen & KI</a> TXT, MD, PDF oder DOCX importieren. Für PDF optional einen Bereich mit Originalseitennummern auswählen.</p><p>Pro Abschnitt wörtliche Offline-Vorschläge oder KI-Entwürfe anfordern. Zitatabgleich und fachliche Freigabe bleiben getrennt. Neue Freitextregeln werden dadurch nicht ausführbar.</p><p>Der Modell-Key gehört serverseitig in <code>HAI_API_KEY</code>. Eine Konfiguration ist noch kein erfolgreicher Verbindungstest. Die Anwendung lädt eine .env-Datei nicht automatisch.</p></section><section class="panel"><h2>Erklärassistent</h2><p>In einem Einzelbericht oder einer Automatik-Ergebniszeile „Erklären“ wählen. Der Assistent liest die gespeicherten Belege des ausgewählten Laufs.</p><p><strong>Lokal:</strong> Evidenzanzeige und feste Prüfschritte ohne Modellaufruf. <strong>KI:</strong> beantwortet die Frage mit dem konfigurierten Modell. Fehler werden angezeigt; kein verdeckter Wechsel zu einer angeblichen KI-Antwort.</p><p>Der Assistent kann keine Freigaben erteilen, Befunde ändern oder Software zulassen.</p></section></div>`+
 `<section class="panel"><h2>Gemeinsamer Stand und Grenzen</h2><p>Die Übersicht bündelt Testpakete und Ergebnisimporte. Quellversionen werden direkt unter Quellen & KI verglichen. Die Oberfläche nutzt weiterhin ITSG-inspiriertes Rot.</p><p>Base44-Konten und Cloud-Dateiablage sind nicht verbunden. Die Anwendung bleibt lokal mit einem optionalen gemeinsamen Zugriffstoken. Eine echte Mehrbenutzerverwaltung ist nicht enthalten.</p><p>Unterstützt werden strukturierte synthetische C1-/C2-/C4-Vorlagen und die begrenzte Einzeldateiprüfung. Keine vollständige Lohnprüfung, amtliche Zertifizierung oder automatisch ausführbaren neuen Gesetze.</p></section>`;
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
  if(b.dataset.action==='ws-prepare'){workspaceSetupOpen=true;render();document.querySelector('#manufacturer-setup').open=true;document.querySelector('#manufacturer-workspace').scrollIntoView({behavior:'smooth',block:'start'});}

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
