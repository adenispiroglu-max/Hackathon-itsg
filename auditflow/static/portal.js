'use strict';
/* Demo login and manufacturer portal (.plans/hersteller-portal-contract.md, section 4).
   Demo-Anmeldung – keine Sicherheitsfunktion: the session cookie only selects a view. The server scopes the
   manufacturer data; this file never filters other manufacturers' data itself.
   Loads after app.js and locale.js. app.js awaits portalGate() before its first load():
   'pruefer' -> normal app, 'hersteller' -> this file owns #nav and #content, 'login' -> login page. */
let portalMode=null,portalAccount=null,portalData=null,portalError=null,portalPollTimer=null,portalPolls=0;
const portalParsed=new Map(); // job_id -> validated records of the chosen result file
const PORTAL_NOTICE='Demo-Anmeldung – keine Sicherheitsfunktion. Angaben werden nicht geprüft.';
const PORTAL_PAGES=[['portal','◫','Übersicht'],['portal-einreichungen','▤','Einreichungen'],['portal-testpakete','⊞','Testpakete'],['portal-entscheidungen','≡','Entscheidungen']];
const PORTAL_OPEN=['neu','in_pruefung','erneut_pruefen'];
const PORTAL_JOB_PILL={waiting_import:'pending',completed:'pass',failed:'fail',cancelled:'fail'};
const PORTAL_PREFS='auditflow.portal.prefs';
const PORTAL_MAX=5_000_000;
const PORTAL_UPLOAD_ICON='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
const portalIcon=name=>typeof uiIcon==='function'?uiIcon(name):'';
const portalDay=s=>typeof dayDe==='function'?dayDe(s):(/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''))||[]).slice(1).reverse().join('.')||'—';
const portalWhen=iso=>{const d=new Date(iso);return iso&&!Number.isNaN(d.getTime())?d.toLocaleString(portalPrefs().language==='en'?'en-GB':'de-DE',{dateStyle:'short',timeStyle:'short'}):portalDay(iso);};
const portalSize=n=>Number(n)>=1e6?(Number(n)/1e6).toLocaleString('de-DE',{maximumFractionDigits:1})+' MB':Math.max(1,Math.round(Number(n||0)/1e3)).toLocaleString('de-DE')+' kB';
const portalList=v=>Array.isArray(v)?v:[];
const portalPill=(cls,text)=>`<span class="pill ${e(cls||'')}">${e(text)}</span>`;
const portalUser=s=>`<span data-user-content>${e(s)}</span>`;

/* ---- API ---------------------------------------------------------------------------------- */
function portalHeaders(json){const h={},t=typeof token==='function'?token():'';if(t)h.Authorization='Bearer '+t;if(json)h['Content-Type']='application/json';return h;}
async function portalApi(path,body){
 const r=await fetch('/api/portal/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:portalHeaders(body!==undefined),body:body===undefined?undefined:JSON.stringify(body)});
 let data=null;try{data=await r.json();}catch{}
 if(!r.ok||data===null){const err=Error(data?.error||'Anfrage fehlgeschlagen');err.status=r.status;throw err;}
 return data;
}
function portalFileName(header){
 const h=String(header||''),star=/filename\*=UTF-8''([^;]+)/i.exec(h);
 if(star)try{return decodeURIComponent(star[1]);}catch{}
 const plain=/filename="([^"]+)"/i.exec(h);return plain?plain[1]:'';
}
async function portalDownload(path,fallback){
 const r=await fetch('/api/portal/'+path,{credentials:'same-origin',headers:portalHeaders(false)});
 if(!r.ok){let m='Download fehlgeschlagen.';try{m=(await r.json()).error||m;}catch{}throw Error(m);}
 const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');
 a.href=url;a.download=portalFileName(r.headers.get('Content-Disposition'))||fallback;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}

/* ---- Language and theme outside the reviewer view -------------------------------------------
   Workspace settings live in /api/state, which manufacturer sessions cannot read. Login and portal
   keep the choice in this browser only (localStorage) and translate with locale.js' dictionary. */
function portalPrefs(){
 try{const p=JSON.parse(localStorage.getItem(PORTAL_PREFS)||'{}');return {language:p.language==='en'?'en':'de',theme:['light','dark','system'].includes(p.theme)?p.theme:'light'};}
 catch{return {language:'de',theme:'light'};}
}
function portalSavePrefs(p){try{localStorage.setItem(PORTAL_PREFS,JSON.stringify({language:p?.language==='en'?'en':'de',theme:['light','dark','system'].includes(p?.theme)?p.theme:'light'}));}catch{}}
const portalDarkMq=matchMedia('(prefers-color-scheme: dark)');
const portalOwnsPage=()=>portalMode==='login'||portalMode==='hersteller';
const portalTextOrigins=new WeakMap(),portalAttrOrigins=new WeakMap(),portalAttrWritten=new WeakMap();
function portalTranslate(){
 if(!portalOwnsPage()||typeof uxTranslateString!=='function')return;
 const en=portalPrefs().language==='en',skip='script,style,textarea,code,[data-user-content]';
 const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while((n=walk.nextNode())){
  const p=n.parentElement;if(!p||p.closest(skip))continue;
  if(!portalTextOrigins.has(n))portalTextOrigins.set(n,n.nodeValue);
  const o=portalTextOrigins.get(n),next=en?uxTranslateString(o):o;if(n.nodeValue!==next)n.nodeValue=next;
 }
 for(const el of document.querySelectorAll('[aria-label],[title],[placeholder]')){
  if(el.closest('[data-user-content]'))continue;
  let o=portalAttrOrigins.get(el);if(!o){o={};portalAttrOrigins.set(el,o);}
  const w=portalAttrWritten.get(el)||{};
  for(const a of ['aria-label','title','placeholder']){
   const cur=el.getAttribute(a);if(cur===null)continue;
   if(o[a]===undefined||(cur!==w[a]&&cur!==o[a]))o[a]=cur; // a re-render wrote a new German value
   const next=en?uxTranslateString(o[a]):o[a];if(cur!==next){el.setAttribute(a,next);w[a]=next;}
  }
  portalAttrWritten.set(el,w);
 }
}
function portalApplyPrefs(){
 if(!portalOwnsPage())return;
 const p=portalPrefs(),root=document.documentElement;
 root.dataset.theme=p.theme==='system'?(portalDarkMq.matches?'dark':'light'):p.theme;root.lang=p.language;portalTranslate();
}
portalDarkMq.addEventListener?.('change',()=>{if(portalPrefs().theme==='system')portalApplyPrefs();});
// The locale.js settings dialog posts to /api/settings; outside the reviewer view it is saved locally instead.
// Window capture runs before locale.js' document capture listener.
window.addEventListener('submit',ev=>{
 if(!portalOwnsPage()||ev.target?.id!=='ux-settings-form')return;
 ev.preventDefault();ev.stopImmediatePropagation();
 portalSavePrefs(Object.fromEntries(new FormData(ev.target)));document.getElementById('dialog')?.close();portalApplyPrefs();
 if(portalMode==='hersteller')portalRender(true);
 toast('Einstellungen gespeichert.');
},true);
document.addEventListener('click',ev=>{
 if(!portalOwnsPage()||!ev.target.closest?.('.ux-settings-trigger'))return;
 const p=portalPrefs(),l=document.getElementById('ux-language'),t=document.getElementById('ux-theme');
 if(l)l.value=p.language;if(t)t.value=p.theme;
 document.querySelector('#ux-settings-form')?.insertAdjacentHTML('beforeend','<p class="muted">Ohne Prüfer-Anmeldung gilt die Einstellung nur in diesem Browser.</p>');
});

/* ---- Gate ----------------------------------------------------------------------------------- */
window.portalGate=async()=>{
 let me;
 // No portal on the server (old backend, access token missing, offline): keep the reviewer app working.
 try{me=await portalApi('me');}catch{portalMode='pruefer';return 'pruefer';}
 if(!me||typeof me!=='object'||!('account' in me)){portalMode='pruefer';return 'pruefer';}
 portalAccount=me.account&&typeof me.account==='object'?me.account:null;
 if(portalAccount?.role==='pruefer'){portalMode='pruefer';portalReviewer();return 'pruefer';}
 if(portalAccount?.role==='hersteller'){portalMode='hersteller';portalBoot();await portalStart();return 'hersteller';}
 portalAccount=null;portalMode='login';portalBoot();await portalLoginPage();return 'login';
};
function portalBoot(){
 const body=document.body;body.classList.add(portalMode==='login'?'login-mode':'portal-mode');
 for(const id of ['assistant-toggle','assistant-panel','access','model-status'])document.getElementById(id)?.setAttribute('hidden','');
 const refresh=document.getElementById('refresh');
 if(refresh)refresh.onclick=()=>portalMode==='hersteller'?portalLoad({force:true}):portalLoginPage();
 const brand=document.querySelector('.sidebar .brand');if(brand)brand.setAttribute('href',portalMode==='hersteller'?'#portal':'#');
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;portalTranslate();});})
  .observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
 portalApplyPrefs();
}
function portalCrumb(text){const c=document.getElementById('breadcrumb');if(c)c.textContent=text;}
function portalSession(){
 const right=document.querySelector('.header-right');if(!right||!portalAccount||right.querySelector('.portal-session'))return;
 const box=document.createElement('div');box.className='portal-session';
 box.innerHTML=`<span class="portal-who" title="${e(portalAccount.name)}" data-user-content>${e(portalAccount.name)}</span><button type="button" class="icon-button portal-logout" data-portal="logout" title="Demo-Anmeldung beenden">Abmelden</button>`;
 const label=right.querySelector('.itsg-label');if(label)label.after(box);else right.prepend(box);
}
function portalReviewer(){
 portalSession();
 // Pre-fill the reviewer name once; a name the reviewer typed earlier in this tab stays.
 const known=typeof custReviewer==='function'?custReviewer():'';
 if(!known&&typeof custRemember==='function')custRemember(portalAccount.name);
}
async function portalLogout(){
 // Keep the reviewer's theme and language for the login page that follows.
 if(portalMode==='pruefer'&&typeof state!=='undefined'&&state?.settings)portalSavePrefs(state.settings);
 await portalApi('logout',{});
 history.replaceState(null,'',location.pathname+location.search);location.reload();
}

/* ---- Login page ------------------------------------------------------------------------------ */
function portalInitials(name){return String(name||'?').replace(/\(.*?\)/g,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';}
async function portalLoginPage(){
 portalCrumb('Anmeldung');
 const c=document.getElementById('content');if(!c)return;
 c.innerHTML='<p class="loading">Konten werden geladen …</p>';
 let accounts=[],err='';
 try{accounts=await portalApi('accounts');if(!Array.isArray(accounts))throw Error('Ungültige Antwort vom Server.');}catch(x){err=x.message;}
 const mark=document.querySelector('.sidebar .brandmark')?.outerHTML||'';
 const button=a=>`<button type="button" class="portal-account" data-portal="login" data-id="${e(a.id)}"><span class="portal-account-mark" aria-hidden="true">${e(portalInitials(a.name))}</span><span class="portal-account-text"><strong data-user-content>${e(a.name)}</strong><small>${a.role==='pruefer'?'Prüfansicht mit allen Daten':'Nur eigene Software-Versionen'}</small></span><span class="portal-account-go" aria-hidden="true">→</span></button>`;
 const group=(title,list,empty)=>`<section class="portal-group"><h2>${title}</h2>${list.length?`<div class="portal-accounts">${list.map(button).join('')}</div>`:`<p class="muted">${empty}</p>`}</section>`;
 const reviewers=accounts.filter(a=>a?.role==='pruefer'),makers=accounts.filter(a=>a?.role==='hersteller');
 c.innerHTML=`<div class="portal-login"><div class="portal-login-card"><div class="portal-login-brand">${mark}<span>AuditFlow<small>PROTOTYP</small></span></div>`+
  `<div class="eyebrow">Demo-Anmeldung</div><h1>Konto wählen</h1><p class="portal-lead">Ohne Passwort. Herstellerkonten sehen nur die eigenen Daten.</p>`+
  `<div class="note portal-demo" role="note"><strong>Demo-Anmeldung – keine Sicherheitsfunktion.</strong> <span>Jede Person kann jedes Konto wählen. Demo-Hersteller sind fiktiv, selbst registrierte Angaben werden nicht geprüft.</span></div>`+
  (err?`<div class="note danger-banner"><strong>Konten konnten nicht geladen werden.</strong> <span data-user-content>${e(err)}</span></div><div class="actions"><button type="button" class="btn primary" data-portal="retry-login">Erneut versuchen</button></div>`:
   group('ITSG-Prüfung',reviewers,'Kein Prüfkonto verfügbar.')+group('Hersteller',makers,'Noch keine Hersteller registriert.'))+
  `<div class="portal-register-cta"><div><strong>Neu bei AuditFlow?</strong><p>Unternehmen und Software registrieren, die auf Eignung geprüft werden soll.</p></div><button type="button" class="btn primary" data-portal="show-register">Neues Konto erstellen</button></div>`+
  `</div></div>`;
}
function portalSoftwareRow(i,removable){
 return `<div class="portal-sw-row" data-row><div class="field"><label for="reg-sw-${i}">Softwarename</label><input id="reg-sw-${i}" name="software" required maxlength="160" placeholder="z. B. LohnPro"></div>`+
  `<div class="field"><label for="reg-ver-${i}">Version</label><input id="reg-ver-${i}" name="version" required maxlength="160" placeholder="z. B. 5.2"></div>`+
  `<div class="field portal-sw-note"><label for="reg-note-${i}">Kurzbeschreibung (optional)</label><input id="reg-note-${i}" name="note" maxlength="500" placeholder="Was soll geprüft werden?"></div>`+
  (removable?`<button type="button" class="btn small portal-sw-remove" data-portal="reg-remove-row" aria-label="Diese Software entfernen">Entfernen</button>`:'<span class="portal-sw-remove" aria-hidden="true"></span>')+`</div>`;
}
let portalRowSeq=1;
document.addEventListener('input',ev=>{const f=ev.target.closest?.('[data-portal-register],[data-portal-addsw]');const err=f?.querySelector('.portal-reg-error');if(err)err.hidden=true;});
function portalRegisterPage(){
 portalCrumb('Registrierung');
 const c=document.getElementById('content');if(!c)return;
 const mark=document.querySelector('.sidebar .brandmark')?.outerHTML||'';
 c.innerHTML=`<div class="portal-login"><div class="portal-login-card portal-register-card"><div class="portal-login-brand">${mark}<span>AuditFlow<small>PROTOTYP</small></span></div>`+
  `<div class="eyebrow">Neues Konto</div><h1>Unternehmen und Software registrieren</h1><p class="portal-lead">Nach der Registrierung sind Sie angemeldet. Jede Software-Version startet mit dem Status „Neu“; ITSG beginnt die Prüfung und stellt Testpakete bereit.</p>`+
  `<ol class="portal-reg-steps"><li><strong>1</strong> Unternehmen</li><li><strong>2</strong> Software zur Prüfung</li><li><strong>3</strong> Status im Portal verfolgen</li></ol>`+
  `<form id="portal-register-form" class="cust-form" data-portal-register novalidate><fieldset><legend>1 · Unternehmen</legend><div class="field"><label for="reg-company">Firmenname</label><input id="reg-company" name="company" required maxlength="160" autocomplete="organization" placeholder="z. B. Muster Lohn GmbH"></div>`+
  `<div class="form-row"><div class="field"><label for="reg-contact">Ansprechperson</label><input id="reg-contact" name="contact_name" required maxlength="100" autocomplete="name"></div><div class="field"><label for="reg-email">E-Mail (optional)</label><input id="reg-email" name="email" type="email" maxlength="200" autocomplete="email"></div></div></fieldset>`+
  `<fieldset><legend>2 · Software zur Prüfung</legend><p class="muted">Jede Version wird einzeln geprüft und freigegeben.</p><div id="portal-sw-rows">${portalSoftwareRow(0,false)}</div><button type="button" class="btn small" data-portal="reg-add-row">+ Weitere Software</button></fieldset>`+
  `<label class="portal-consent"><input type="checkbox" name="consent" required> <span>Mir ist bewusst: Dies ist eine Demo-Registrierung. Die Angaben werden nicht geprüft; bitte keine echten Personendaten verwenden.</span></label>`+
  `<p class="portal-reg-error" role="alert" hidden></p><div class="actions"><button class="btn primary">Konto erstellen und Software registrieren</button><button type="button" class="btn" data-portal="retry-login">Zurück zur Anmeldung</button></div></form></div></div>`;
 document.getElementById('reg-company')?.focus();
}
function portalSoftwareRows(form){return [...form.querySelectorAll('[data-row]')].map(r=>({software:r.querySelector('[name=software]').value.trim(),version:r.querySelector('[name=version]').value.trim(),note:r.querySelector('[name=note]').value.trim()}));}
function portalAddSoftwareDialog(){
 modal(`<div class="eyebrow">Herstellerportal</div><h2>Software registrieren</h2><p class="muted">Die neue Version startet mit dem Status „Neu“. ITSG beginnt die Prüfung.</p><form id="portal-addsw-form" class="cust-form" data-portal-addsw>${portalSoftwareRow(0,false)}<p class="portal-reg-error" role="alert" hidden></p><div class="actions"><button class="btn primary">Registrieren</button></div></form>`);
}
document.addEventListener('submit',async ev=>{
 const form=ev.target;if(!form?.matches?.('[data-portal-register],[data-portal-addsw]'))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const err=form.querySelector('.portal-reg-error'),button=form.querySelector('button:not([type=button])');
 const fail=m=>{if(err){err.textContent=m;err.hidden=false;}};
 if(err)err.hidden=true;
 const missing=[...form.querySelectorAll('[required]')].find(x=>x.type==='checkbox'?!x.checked:!x.value.trim());
 if(missing){fail(missing.type==='checkbox'?'Bitte den Demo-Hinweis bestätigen.':'Bitte alle Pflichtfelder ausfüllen.');missing.focus();return;}
 if(button)button.disabled=true;
 try{
  if(form.matches('[data-portal-register]')){
   const d=Object.fromEntries(new FormData(form));
   await portalApi('register',{company:d.company,contact_name:d.contact_name,email:d.email||'',software:portalSoftwareRows(form)});
   history.replaceState(null,'',location.pathname+location.search);location.reload();
  }else{
   const [row]=portalSoftwareRows(form);await portalApi('software',row);
   document.getElementById('dialog').close();toast('Software registriert. ITSG beginnt die Prüfung.');await portalLoad({force:true});
  }
 }catch(x){fail(x.message);if(button)button.disabled=false;}
},true);

async function portalLogin(id){
 await portalApi('login',{account_id:id});
 history.replaceState(null,'',location.pathname+location.search);location.reload();
}

/* ---- Manufacturer portal ----------------------------------------------------------------------- */
async function portalStart(){
 portalSession();
 const foot=document.querySelector('.sidebar-bottom');
 if(foot)foot.innerHTML=`<div class="avatar">${e(portalInitials(portalAccount.name))}</div><div><span data-user-content>${e(portalAccount.name)}</span><small>Herstellerportal · Demo</small></div>`;
 window.addEventListener('hashchange',()=>portalRender(true));
 await portalLoad({force:true});
}
const portalPage=()=>{const h=location.hash.slice(1).split('?')[0];return PORTAL_PAGES.some(p=>p[0]===h)?h:'portal';};
const portalBusyForm=()=>!!document.querySelector('#content .portal-drop.has-file,#content .portal-upload.busy');
async function portalLoad({force=false,poll=false}={}){
 clearTimeout(portalPollTimer);
 try{portalData=await portalApi('overview');portalError=null;}
 catch(err){if(!poll||err.status===401||err.status===403)portalError={message:err.message,status:err.status};}
 portalPolls=poll?portalPolls+1:0;
 // A poll never wipes a file the manufacturer has just chosen; the nav still updates.
 portalRender(force||!portalBusyForm());
 const running=portalVersions().some(v=>portalList(v.packages).some(p=>p.status==='queued'||p.status==='running'));
 if(running&&portalPolls<90)portalPollTimer=setTimeout(()=>portalLoad({poll:true}),2000);
}
const portalVersions=()=>portalList(portalData?.versions);
function portalRender(content=true){
 if(portalMode!=='hersteller')return;
 const page=portalPage();if(location.hash!=='#'+page)history.replaceState(null,'','#'+page);
 const vs=portalVersions();
 const pendingSubs=vs.reduce((n,v)=>n+portalList(v.submissions).filter(s=>s.status==='pending').length,0);
 const waiting=vs.reduce((n,v)=>n+portalList(v.packages).filter(p=>p.waiting).length,0);
 const counts={'portal-einreichungen':pendingSubs,'portal-testpakete':waiting};
 const nav=document.getElementById('nav');
 if(nav)nav.innerHTML=PORTAL_PAGES.map(([id,g,t])=>`<a class="nav-item ${id===page?'active':''}" href="#${id}"${id===page?' aria-current="page"':''}><span class="glyph">${g}</span>${t}${counts[id]?`<small class="nav-alert" title="${id==='portal-testpakete'?'Testpakete warten auf Ihre Ergebnisse':'Einreichungen warten auf Entscheidung'}">${counts[id]}</small>`:''}</a>`).join('');
 portalCrumb('Herstellerportal / '+PORTAL_PAGES.find(p=>p[0]===page)[2]);
 if(!content)return;
 const c=document.getElementById('content');if(!c)return;
 const pages={portal:portalOverviewPage,'portal-einreichungen':portalSubmissionsPage,'portal-testpakete':portalPackagesPage,'portal-entscheidungen':portalDecisionsPage};
 c.innerHTML=portalError?portalErrorView():portalData?pages[page]():'<p class="loading">Daten werden geladen …</p>';
}
function portalErrorView(){
 const expired=portalError.status===401||portalError.status===403;
 return `<div class="panel cert-empty">${portalIcon('people')}<strong>${expired?'Die Demo-Sitzung ist nicht mehr gültig.':'Daten konnten nicht geladen werden.'}</strong><p data-user-content>${e(portalError.message)}</p><div class="actions">${expired?'<button type="button" class="btn primary" data-portal="relogin">Neu anmelden</button>':'<button type="button" class="btn primary" data-portal="reload">Erneut versuchen</button>'}</div></div>`;
}
function portalHead(title,desc){
 const name=portalData?.manufacturer?.name||portalAccount?.name||'';
 return `<div class="page-heading portal-head"><div><div class="eyebrow"><span>Herstellerportal</span> · <span data-user-content>${e(name)}</span></div><h1>${title}</h1><p>${desc}</p></div></div>`+
  `<div class="notice portal-notice"><span>${e(portalData?.notice||PORTAL_NOTICE)}</span> <span>Jede Freigabe entscheidet ITSG. Keine automatische Zulassung.</span></div>`;
}
const portalNoVersions=()=>`<div class="panel cert-empty">${portalIcon('building')}<strong>Noch keine Software-Version.</strong><p>Registrieren Sie die Software, die geprüft werden soll.</p></div>`;
const portalVersionTitle=v=>`<h2 class="portal-vtitle">${portalUser(v.software+' '+v.version)}</h2>${v.description?`<p class="portal-vdesc" data-user-content>${e(v.description)}</p>`:''}`;
function portalWaiting(v){return PORTAL_OPEN.includes(v.status)&&v.waiting_since?`<span class="portal-sep" aria-hidden="true">·</span><span>wartet seit ${e(portalDay(v.waiting_since))}</span>`:'';}

function portalOverviewPage(){
 const vs=portalVersions();
 return portalHead('Status Ihrer Software','Status, offene Punkte und Entscheidungen von ITSG je Software-Version.')+`<div class="actions portal-add-sw"><button type="button" class="btn primary" data-portal="add-software">+ Software registrieren</button></div>`+(vs.length?vs.map(v=>{
  const missing=portalList(v.missing),subs=portalList(v.submissions),packs=portalList(v.packages),dec=portalTimeline(v);
  const open=subs.filter(s=>s.status==='pending').length,waiting=packs.filter(p=>p.waiting).length;
  const empty=v.status==='freigegeben'?'Diese Version ist freigegeben.':v.status==='abgelehnt'?'Diese Version ist abgelehnt. Die Begründung steht unter Entscheidungen.':'Von Ihrer Seite fehlt nichts. ITSG prüft und entscheidet.';
  const last=dec[0];
  return `<section class="panel portal-version"><div class="portal-version-head"><div>${portalVersionTitle(v)}<p class="portal-hint"><span>${e(v.hint_text||'')}</span>${portalWaiting(v)}</p></div>${portalPill(v.status,v.status_label||v.status)}</div>`+
  `<div class="portal-columns"><div><h3 class="cust-sub">Was noch fehlt</h3>${missing.length?`<ul class="portal-missing">${missing.map(m=>`<li><span class="portal-mark" aria-hidden="true">!</span><span>${e(m)}</span></li>`).join('')}</ul>`:`<p class="portal-ok"><span class="portal-mark ok" aria-hidden="true">✓</span><span>${empty}</span></p>`}</div>`+
  `<div><h3 class="cust-sub">Letzte Entscheidung von ITSG</h3>${last?portalTimelineList([last]):'<p class="muted">Noch keine Entscheidung von ITSG.</p>'}</div></div>`+
  `<div class="portal-facts"><a href="#portal-einreichungen"><strong>${subs.length}</strong><span>Einreichungen</span>${open?`<small>${open} offen</small>`:''}</a><a href="#portal-testpakete"><strong>${packs.length}</strong><span>Testpakete</span>${waiting?`<small>${waiting} warten auf Sie</small>`:''}</a><a href="#portal-entscheidungen"><strong>${dec.length}</strong><span>Entscheidungen</span></a></div></section>`;
 }).join(''):portalNoVersions());
}

function portalSubmissionsPage(){
 const vs=portalVersions();
 return portalHead('Einreichungen','Unterlagen zu Ihren Software-Versionen einreichen. ITSG nimmt jede Einreichung an oder lehnt sie ab.')+(vs.length?vs.map(v=>{
  const subs=portalList(v.submissions).slice().sort((a,b)=>String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
  const rows=subs.length?`<div class="portal-rows">${subs.map(s=>{const ds=portalList(s.decisions).slice().reverse();return `<div class="portal-row"><span class="portal-row-icon">${portalIcon('document')}</span><div class="portal-row-main"><strong>${portalUser(s.name)}</strong><small><span>${e(portalSize(s.size))}</span> <span class="portal-sep" aria-hidden="true">·</span> <span>hochgeladen am ${e(portalDay(s.uploaded_at))}</span>${s.uploaded_by?` <span class="portal-sep" aria-hidden="true">·</span> ${portalUser(s.uploaded_by)}`:''}</small>${ds.length?`<ul class="portal-decisions">${ds.map(d=>`<li>${portalPill(d.label==='Angenommen'?'approved':'rejected',d.label)}<small>${e(portalWhen(d.at))}</small>${d.note?`<p data-user-content>${e(d.note)}</p>`:''}</li>`).join('')}</ul>`:''}</div><div class="portal-row-side">${portalPill(s.status,s.status_label||s.status)}<button type="button" class="btn small" data-portal="download-sub" data-id="${e(s.id)}" data-name="${e(s.name)}">Herunterladen</button></div></div>`;}).join('')}</div>`:'<div class="cert-empty"><p>Noch keine Einreichungen zu dieser Version.</p></div>';
  return `<section class="panel portal-version"><div class="portal-version-head"><div>${portalVersionTitle(v)}<p class="portal-hint"><span>${e(v.status_label||v.status)}</span></p></div>${subs.length?`<span class="subtle-chip">${subs.length===1?'1 Einreichung':subs.length+' Einreichungen'}</span>`:''}</div>${rows}`+
  `<form class="portal-upload" data-portal-form="submission" data-version="${e(v.id)}"><label class="drop-box portal-drop">${PORTAL_UPLOAD_ICON}<strong>Datei hierher ziehen</strong><span>oder klicken zum Auswählen · PDF, DOCX oder TXT · maximal 5 MB</span><input class="drop-input portal-input" type="file" accept=".pdf,.docx,.txt"><span class="portal-file-name"></span></label><div class="portal-check" role="status" aria-live="polite"></div><div class="actions"><button class="btn primary" disabled>Einreichen</button><small class="muted">Der Inhalt wird nicht automatisch ausgewertet.</small></div></form></section>`;
 }).join(''):portalNoVersions());
}

function portalPackagesPage(){
 const vs=portalVersions();
 const intro=`<section class="panel portal-howto"><h2>So funktioniert es</h2><ol class="portal-steps"><li><strong>Testpaket herunterladen</strong><span>Eine JSON-Datei mit synthetischen Testfällen.</span></li><li><strong>Tests in Ihrer Software ausführen</strong><span>Für jeden Testfall festhalten, ob eine Anfrage entsteht.</span></li><li><strong>Ergebnisse hochladen</strong><span>Eine JSON-Datei je Testpaket. ITSG bewertet die Ergebnisse.</span></li></ol>`+
  `<details class="portal-format"><summary>Format der Ergebnisdatei</summary><p>Ein JSON-Objekt mit der Liste <code>records</code>, ein Eintrag je Testfall:</p><code class="portal-code">{"records":[{"case_id":"…","observed":{"message_present":true}}]}</code><ul><li><span><code>case_id</code>: die ID aus dem Testpaket, jede ID nur einmal.</span></li><li><span><code>message_present</code>: <code>true</code> = Anfrage erzeugt, <code>false</code> = keine Anfrage, <code>null</code> = nicht feststellbar.</span></li><li><span>Testfälle ohne Eintrag gelten als nicht beurteilbar.</span></li><li><span>Je Testpaket ist ein Upload möglich. Ergebnisse sind Nachweise, keine Freigabe.</span></li></ul></details></section>`;
 return portalHead('Testpakete','Testpakete herunterladen, in Ihrer Software ausführen und die Ergebnisse hochladen.')+intro+(vs.length?vs.map(v=>{
  const packs=portalList(v.packages).slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return `<section class="panel portal-version"><div class="portal-version-head"><div>${portalVersionTitle(v)}<p class="portal-hint"><span>${e(v.status_label||v.status)}</span></p></div></div>${packs.length?`<div class="portal-rows">${packs.map(portalPackage).join('')}</div>`:'<div class="cert-empty"><p>Noch kein Testpaket bereitgestellt. ITSG stellt es bereit.</p></div>'}</section>`;
 }).join(''):portalNoVersions());
}
function portalPackage(p){
 const c=p.counts&&typeof p.counts==='object'?p.counts:null;
 let body='';
 if(p.waiting)body=`<div class="actions portal-package-actions"><button type="button" class="btn" data-portal="download-package" data-id="${e(p.job_id)}">Testpaket herunterladen (JSON)</button></div>`+
  `<form class="portal-upload" data-portal-form="import" data-job="${e(p.job_id)}" data-total="${e(Number(p.total)||0)}"><label class="drop-box portal-drop">${PORTAL_UPLOAD_ICON}<strong>Ergebnisdatei hierher ziehen</strong><span>oder klicken zum Auswählen · JSON-Datei</span><input class="drop-input portal-input" type="file" accept=".json,application/json"><span class="portal-file-name"></span></label><div class="portal-check" role="status" aria-live="polite"></div><div class="actions"><button class="btn primary" disabled>Ergebnisse hochladen (JSON)</button></div></form>`;
 else if(p.status==='completed'&&c)body=`<div class="portal-counts"><span class="portal-count pass"><strong>${e(Number(c.pass)||0)}</strong><span>bestanden</span></span><span class="portal-count fail"><strong>${e(Number(c.fail)||0)}</strong><span>fehlgeschlagen</span></span><span class="portal-count not_assessable"><strong>${e(Number(c.not_assessable)||0)}</strong><span>nicht beurteilbar</span></span></div><p class="muted portal-small">Ergebnisse sind Nachweise, keine Freigabe. Die Entscheidung trifft ITSG.</p>`;
 else if(p.status==='queued'||p.status==='running')body='<p class="muted portal-small">Ergebnisse werden ausgewertet …</p>';
 else if(p.status==='failed')body='<p class="muted portal-small">Die Auswertung ist fehlgeschlagen.</p>';
 return `<div class="portal-package"><div class="portal-row"><span class="portal-row-icon">${portalIcon('package')}</span><div class="portal-row-main"><strong>${portalUser(p.name)}</strong><small><span>bereitgestellt am ${e(portalDay(p.created_at))}</span>${Number(p.total)?` <span class="portal-sep" aria-hidden="true">·</span> <span>${Number(p.total)===1?'1 Testfall':e(Number(p.total))+' Testfälle'}</span>`:''}</small></div><div class="portal-row-side">${portalPill(PORTAL_JOB_PILL[p.status]||'',p.status_label||p.status)}</div></div>${body}</div>`;
}

/* Decisions: version transitions with a note plus ITSG decisions on submissions, newest first. */
function portalTimeline(v){
 const out=portalList(v.decisions).map(d=>({at:d.at,label:d.label,note:d.note,by:d.by,cls:/Freigegeben/.test(d.label)?'approved':/Abgelehnt/.test(d.label)?'rejected':''}));
 for(const s of portalList(v.submissions))for(const d of portalList(s.decisions))out.push({at:d.at,label:d.label,note:d.note,doc:s.name,cls:d.label==='Angenommen'?'approved':'rejected'});
 return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
function portalTimelineList(items){
 return `<ol class="portal-timeline">${items.map(x=>`<li class="${e(x.cls)}"><span class="portal-dot" aria-hidden="true"></span><div><div class="portal-tl-top"><strong>${e(x.label)}</strong>${x.doc?`<small><span>Einreichung</span> ${portalUser(x.doc)}</small>`:''}</div><small><span>${e(portalWhen(x.at))}</span>${x.by?` <span class="portal-sep" aria-hidden="true">·</span> ${portalUser(x.by)}`:''}</small>${x.note?`<p data-user-content>${e(x.note)}</p>`:''}</div></li>`).join('')}</ol>`;
}
function portalDecisionsPage(){
 const vs=portalVersions();
 return portalHead('Entscheidungen','Entscheidungen von ITSG zu Ihren Versionen und Einreichungen, neueste zuerst.')+(vs.length?vs.map(v=>{
  const t=portalTimeline(v);
  return `<section class="panel portal-version"><div class="portal-version-head"><div>${portalVersionTitle(v)}</div>${portalPill(v.status,v.status_label||v.status)}</div>${t.length?portalTimelineList(t):'<div class="cert-empty"><p>Noch keine Entscheidungen von ITSG.</p></div>'}</section>`;
 }).join(''):portalNoVersions());
}

/* ---- Uploads: own drag-and-drop handlers. Window capture keeps library.js' document handlers away. -- */
function portalSetFile(input,file){const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
for(const type of ['dragover','dragleave','drop'])window.addEventListener(type,ev=>{
 const box=ev.target?.closest?.('.portal-drop');if(!box)return;
 ev.stopPropagation();const input=box.querySelector('input');
 if(type==='dragleave'){if(!box.contains(ev.relatedTarget))box.classList.remove('dragging');return;}
 ev.preventDefault();if(!input||input.disabled)return;
 if(type==='dragover'){box.classList.add('dragging');return;}
 box.classList.remove('dragging');const f=ev.dataTransfer?.files?.[0];if(f)portalSetFile(input,f);
},true);
function portalCheck(form,text,ok){const el=form.querySelector('.portal-check');if(el){el.className='portal-check '+(text?ok?'ok':'error':'');el.textContent=text||'';}}
function portalCheckResults(text,jobId,total){
 let data;try{data=JSON.parse(text);}catch{return {error:'Die Datei ist kein gültiges JSON.'};}
 if(data&&typeof data==='object'&&!Array.isArray(data)&&Array.isArray(data.cases)&&!data.records)return {error:'Das ist das Testpaket selbst. Bitte die Ergebnisdatei hochladen.'};
 if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.records))return {error:'Es fehlt die Liste „records“.'};
 if(typeof data.job_id==='string'&&data.job_id!==jobId)return {error:'Die Datei gehört zu einem anderen Testpaket.'};
 const rs=data.records;if(!rs.length)return {error:'Die Liste „records“ ist leer.'};
 if(rs.length>4000)return {error:'Höchstens 4.000 Einträge je Datei.'};
 const seen=new Set();
 for(let i=0;i<rs.length;i++){
  const r=rs[i],n=i+1;
  if(!r||typeof r!=='object'||Array.isArray(r))return {error:`Eintrag ${n}: Kein Objekt.`};
  if(typeof r.case_id!=='string'||!r.case_id)return {error:`Eintrag ${n}: case_id fehlt.`};
  if(seen.has(r.case_id))return {error:`Eintrag ${n}: case_id kommt doppelt vor.`};seen.add(r.case_id);
  const o=r.observed;
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==1||!('message_present' in o))return {error:`Eintrag ${n}: observed braucht genau message_present.`};
  if(o.message_present!==null&&typeof o.message_present!=='boolean')return {error:`Eintrag ${n}: message_present muss true, false oder null sein.`};
 }
 const missing=total>rs.length?total-rs.length:0;
 return {records:rs.map(r=>({case_id:r.case_id,observed:{message_present:r.observed.message_present}})),
  message:`Datei geprüft: ${rs.length} Ergebnisse.`+(missing?` ${missing} Testfälle ohne Eintrag gelten als nicht beurteilbar.`:'')};
}
async function portalFileChosen(input){
 const form=input.closest('form'),box=input.closest('.portal-drop'),f=input.files?.[0],button=form?.querySelector('button:not([type=button])');
 if(!form)return;
 box?.classList.toggle('has-file',!!f);
 const name=form.querySelector('.portal-file-name');if(name)name.innerHTML=f?`<span data-user-content>${e(f.name)}</span> · ${e(portalSize(f.size))}`:'';
 if(button)button.disabled=true;portalCheck(form,'');
 if(!f)return;
 if(form.dataset.portalForm==='submission'){
  if(!/\.(pdf|docx|txt)$/i.test(f.name))return portalCheck(form,'Nur PDF, DOCX oder TXT.',false);
  if(f.size>PORTAL_MAX)return portalCheck(form,'Datei ist zu groß. Höchstens 5 MB.',false);
  if(!f.size)return portalCheck(form,'Die Datei ist leer.',false);
  portalCheck(form,'Bereit zum Einreichen.',true);if(button)button.disabled=false;return;
 }
 const job=form.dataset.job;portalParsed.delete(job);
 if(!/\.json$/i.test(f.name)&&f.type!=='application/json')return portalCheck(form,'Bitte eine JSON-Datei wählen.',false);
 if(f.size>PORTAL_MAX)return portalCheck(form,'Datei ist zu groß. Höchstens 5 MB.',false);
 let text;try{text=await f.text();}catch{return portalCheck(form,'Die Datei konnte nicht gelesen werden.',false);}
 if(input.files?.[0]!==f)return; // another file was chosen meanwhile
 const r=portalCheckResults(text,job,Number(form.dataset.total)||0);
 if(r.error)return portalCheck(form,r.error,false);
 portalParsed.set(job,r.records);portalCheck(form,r.message,true);if(button)button.disabled=false;
}
document.addEventListener('change',ev=>{if(ev.target?.matches?.('.portal-input'))portalFileChosen(ev.target);});
document.addEventListener('submit',async ev=>{
 const form=ev.target,kind=form?.dataset?.portalForm;if(!kind)return;
 ev.preventDefault();
 const button=form.querySelector('button:not([type=button])'),input=form.querySelector('.portal-input'),f=input?.files?.[0];
 if(!f||form.classList.contains('busy'))return;
 const label=button?.textContent;form.classList.add('busy');if(button){button.disabled=true;button.textContent=kind==='import'?'Ergebnisse werden hochgeladen …':'Wird hochgeladen …';}
 if(input)input.disabled=true;
 try{
  if(kind==='submission'){
   const base64=await file64(f,PORTAL_MAX);
   await portalApi('submission',{version_id:form.dataset.version,name:f.name,base64});
   toast('Einreichung gespeichert. ITSG entscheidet darüber.');
  }else{
   const records=portalParsed.get(form.dataset.job);if(!records)throw Error('Bitte die Datei erneut auswählen.');
   await portalApi('import',{job_id:form.dataset.job,records});portalParsed.delete(form.dataset.job);
   toast('Ergebnisse hochgeladen. Die Auswertung läuft.');
  }
  await portalLoad({force:true});
 }catch(err){
  form.classList.remove('busy');if(input)input.disabled=false;if(button){button.disabled=false;button.textContent=label;}
  portalCheck(form,err.message,false);toast(err.message);
 }
});

/* ---- Buttons ---------------------------------------------------------------------------------- */
document.addEventListener('click',async ev=>{
 const el=ev.target.closest?.('[data-portal]');if(!el||el.disabled)return;
 ev.preventDefault();el.disabled=true;
 try{
  const a=el.dataset.portal;
  if(a==='login')await portalLogin(el.dataset.id);
  else if(a==='logout'||a==='relogin')await portalLogout();
  else if(a==='retry-login')await portalLoginPage();
  else if(a==='show-register')portalRegisterPage();
  else if(a==='reg-add-row'){const rows=document.getElementById('portal-sw-rows');if(rows&&rows.children.length<10){rows.insertAdjacentHTML('beforeend',portalSoftwareRow(portalRowSeq++,true));rows.lastElementChild.querySelector('input')?.focus();}else toast('Höchstens zehn Software-Versionen pro Registrierung.');}
  else if(a==='reg-remove-row')el.closest('[data-row]')?.remove();
  else if(a==='add-software')portalAddSoftwareDialog();
  else if(a==='reload')await portalLoad({force:true});
  else if(a==='download-package')await portalDownload('package/'+encodeURIComponent(el.dataset.id),'AuditFlow-Testpaket-'+el.dataset.id+'.json');
  else if(a==='download-sub')await portalDownload('submission/'+encodeURIComponent(el.dataset.id),el.dataset.name||'Einreichung');
 }catch(err){toast(err.message);}
 finally{el.disabled=false;}
});

/* ---- English interface strings (locale.js translates authored German text through UX_EN) ------- */
if(typeof UX_EN==='object'){
 Object.assign(UX_EN,{
  'Neu bei AuditFlow?':'New to AuditFlow?','Unternehmen und Software registrieren, die auf Eignung geprüft werden soll.':'Register your company and the software to be assessed for eligibility.',
  'Neues Konto erstellen':'Create new account','Registrierung':'Registration','Neues Konto':'New account','Unternehmen und Software registrieren':'Register company and software',
  'Nach der Registrierung sind Sie angemeldet. Jede Software-Version startet mit dem Status „Neu“; ITSG beginnt die Prüfung und stellt Testpakete bereit.':'After registering you are signed in. Each software version starts with the status “New”; ITSG starts the assessment and provides test packages.',
  'Unternehmen':'Company','Software zur Prüfung':'Software to assess','Status im Portal verfolgen':'Track the status in the portal','1 · Unternehmen':'1 · Company','2 · Software zur Prüfung':'2 · Software to assess',
  'Firmenname':'Company name','Ansprechperson':'Contact person','E-Mail (optional)':'Email (optional)','Softwarename':'Software name','Version':'Version','Kurzbeschreibung (optional)':'Short description (optional)',
  'Jede Version wird einzeln geprüft und freigegeben.':'Each version is assessed and approved separately.','+ Weitere Software':'+ Add software','Entfernen':'Remove',
  'Mir ist bewusst: Dies ist eine Demo-Registrierung. Die Angaben werden nicht geprüft; bitte keine echten Personendaten verwenden.':'I understand: this is a demo registration. The details are not verified; please do not use real personal data.',
  'Konto erstellen und Software registrieren':'Create account and register software','Zurück zur Anmeldung':'Back to sign-in','Bitte alle Pflichtfelder ausfüllen.':'Please fill in all required fields.','Bitte den Demo-Hinweis bestätigen.':'Please confirm the demo notice.',
  '+ Software registrieren':'+ Register software','Software registrieren':'Register software','Registrieren':'Register','Die neue Version startet mit dem Status „Neu“. ITSG beginnt die Prüfung.':'The new version starts with the status “New”. ITSG starts the assessment.',
  'Software registriert. ITSG beginnt die Prüfung.':'Software registered. ITSG starts the assessment.','Hersteller':'Manufacturers','Noch keine Hersteller registriert.':'No manufacturers registered yet.',
  'Jede Person kann jedes Konto wählen. Demo-Hersteller sind fiktiv, selbst registrierte Angaben werden nicht geprüft.':'Anyone can choose any account. Demo manufacturers are fictional; self-registered details are not verified.',
  'Registrieren Sie die Software, die geprüft werden soll.':'Register the software to be assessed.','Höchstens zehn Software-Versionen pro Registrierung.':'At most ten software versions per registration.',
  'Abmelden':'Sign out','Demo-Anmeldung beenden':'End demo sign-in','Anmeldung':'Sign-in','Konten werden geladen …':'Loading accounts …',
  'Demo-Anmeldung':'Demo sign-in','Konto wählen':'Choose an account','Ohne Passwort. Herstellerkonten sehen nur die eigenen Daten.':'No password. Manufacturer accounts see only their own data.',
  'Demo-Anmeldung – keine Sicherheitsfunktion.':'Demo sign-in – not a security feature.','Demo-Anmeldung – keine Sicherheitsfunktion. Angaben werden nicht geprüft.':'Demo sign-in – not a security feature. Details are not verified.',
  'Jede Person kann jedes Konto wählen. Alle Hersteller sind fiktiv.':'Anyone can choose any account. All manufacturers are fictional.',
  'ITSG-Prüfung':'ITSG review','Hersteller (fiktiv)':'Manufacturers (fictional)','Prüfansicht mit allen Daten':'Review view with all data','Nur eigene Software-Versionen':'Own software versions only',
  'Kein Prüfkonto verfügbar.':'No reviewer account available.','Noch keine Hersteller angelegt. Hersteller legt ITSG unter Kunden & Software an.':'No manufacturers yet. ITSG creates manufacturers under Customers & software.',
  'Konten konnten nicht geladen werden.':'Accounts could not be loaded.','Erneut versuchen':'Try again',
  'Ohne Prüfer-Anmeldung gilt die Einstellung nur in diesem Browser.':'Without a reviewer sign-in, this setting applies to this browser only.',
  'Herstellerportal':'Manufacturer portal','Herstellerportal · Demo':'Manufacturer portal · demo','Entscheidungen':'Decisions',
  'Herstellerportal / Übersicht':'Manufacturer portal / Overview','Herstellerportal / Einreichungen':'Manufacturer portal / Submissions','Herstellerportal / Testpakete':'Manufacturer portal / Test packages','Herstellerportal / Entscheidungen':'Manufacturer portal / Decisions',
  'Testpakete warten auf Ihre Ergebnisse':'Test packages are waiting for your results','Einreichungen warten auf Entscheidung':'Submissions are waiting for a decision',
  'Die Demo-Sitzung ist nicht mehr gültig.':'The demo session is no longer valid.','Daten konnten nicht geladen werden.':'Data could not be loaded.','Neu anmelden':'Sign in again','Daten werden geladen …':'Loading data …',
  'Jede Freigabe entscheidet ITSG. Keine automatische Zulassung.':'ITSG decides every approval. No automatic certification.',
  'Noch keine Software-Version.':'No software version yet.','ITSG legt Ihre Software-Versionen an. Danach erscheinen sie hier.':'ITSG creates your software versions. They then appear here.',
  'Status Ihrer Software':'Status of your software','Status, offene Punkte und Entscheidungen von ITSG je Software-Version.':'Status, open items and ITSG decisions per software version.',
  'Was noch fehlt':'What is still missing','Letzte Entscheidung von ITSG':'Latest ITSG decision','Noch keine Entscheidung von ITSG.':'No ITSG decision yet.',
  'Diese Version ist freigegeben.':'This version is approved.','Diese Version ist abgelehnt. Die Begründung steht unter Entscheidungen.':'This version is rejected. The reason is listed under Decisions.',
  'Von Ihrer Seite fehlt nichts. ITSG prüft und entscheidet.':'Nothing is missing from your side. ITSG reviews and decides.',
  'Wartet auf Prüfbeginn durch ITSG':'Waiting for ITSG to start the review','Wartet auf Entscheidung durch ITSG':'Waiting for an ITSG decision',
  'Unklare Ergebnisse werden von ITSG bewertet':'ITSG is assessing unclear results','Einreichungen warten auf Entscheidung durch ITSG':'Submissions are waiting for an ITSG decision',
  'Herstellerergebnisse fehlen. ITSG stellt dafür ein Testpaket bereit.':'Manufacturer results missing. ITSG will provide a test package.',
  'Herstellerergebnisse fehlen: Testpaket herunterladen und Ergebnisse hochladen.':'Manufacturer results are missing: download the test package and upload the results.',
  'Unklare Ergebnisse werden von ITSG fachlich bewertet.':'ITSG is assessing unclear results.',
  'warten auf Sie':'waiting for you',
  'Unterlagen zu Ihren Software-Versionen einreichen. ITSG nimmt jede Einreichung an oder lehnt sie ab.':'Submit documents for your software versions. ITSG accepts or rejects every submission.',
  'Noch keine Einreichungen zu dieser Version.':'No submissions for this version yet.','1 Einreichung':'1 submission','Datei hierher ziehen':'Drag a file here',
  'oder klicken zum Auswählen · PDF, DOCX oder TXT · maximal 5 MB':'or click to choose · PDF, DOCX or TXT · maximum 5 MB','Einreichen':'Submit',
  'Der Inhalt wird nicht automatisch ausgewertet.':'The content is not analysed automatically.','Herunterladen':'Download','Angenommen':'Accepted','Wartet auf Entscheidung':'Waiting for a decision',
  'Nur PDF, DOCX oder TXT.':'PDF, DOCX or TXT only.','Datei ist zu groß. Höchstens 5 MB.':'File is too large. Maximum 5 MB.','Die Datei ist leer.':'The file is empty.','Bereit zum Einreichen.':'Ready to submit.',
  'Wird hochgeladen …':'Uploading …','Einreichung gespeichert. ITSG entscheidet darüber.':'Submission saved. ITSG will decide on it.','Einreichung':'Submission',
  'Testpakete herunterladen, in Ihrer Software ausführen und die Ergebnisse hochladen.':'Download test packages, run them in your software and upload the results.',
  'So funktioniert es':'How it works','Testpaket herunterladen':'Download test package','Eine JSON-Datei mit synthetischen Testfällen.':'A JSON file with synthetic test cases.',
  'Tests in Ihrer Software ausführen':'Run the tests in your software','Für jeden Testfall festhalten, ob eine Anfrage entsteht.':'Record for each test case whether a request is created.',
  'Ergebnisse hochladen':'Upload results','Eine JSON-Datei je Testpaket. ITSG bewertet die Ergebnisse.':'One JSON file per test package. ITSG assesses the results.',
  'Format der Ergebnisdatei':'Format of the result file','Ein JSON-Objekt mit der Liste':'A JSON object with the list',', ein Eintrag je Testfall:':', one entry per test case:',
  ': die ID aus dem Testpaket, jede ID nur einmal.':': the ID from the test package, each ID only once.',
  '= Anfrage erzeugt,':'= request created,','= keine Anfrage,':'= no request,','= nicht feststellbar.':'= cannot be determined.',
  'Testfälle ohne Eintrag gelten als nicht beurteilbar.':'Test cases without an entry count as not assessable.','Je Testpaket ist ein Upload möglich. Ergebnisse sind Nachweise, keine Freigabe.':'One upload is possible per test package. Results are evidence, not an approval.',
  'Noch kein Testpaket bereitgestellt. ITSG stellt es bereit.':'No test package provided yet. ITSG provides it.',
  'Testpaket herunterladen (JSON)':'Download test package (JSON)','Ergebnisse hochladen (JSON)':'Upload results (JSON)','Ergebnisdatei hierher ziehen':'Drag the result file here','oder klicken zum Auswählen · JSON-Datei':'or click to choose · JSON file',
  'bestanden':'passed','fehlgeschlagen':'failed','nicht beurteilbar':'not assessable','Ergebnisse sind Nachweise, keine Freigabe. Die Entscheidung trifft ITSG.':'Results are evidence, not an approval. ITSG makes the decision.',
  'Ergebnisse werden ausgewertet …':'Results are being assessed …','Die Auswertung ist fehlgeschlagen.':'The assessment failed.','1 Testfall':'1 test case',
  'Wartet auf Ihre Ergebnisse':'Waiting for your results','In Vorbereitung':'In preparation','Wird verarbeitet':'Processing','Abgeschlossen':'Completed','Abgebrochen':'Cancelled','Fehlgeschlagen':'Failed',
  'Bitte eine JSON-Datei wählen.':'Please choose a JSON file.','Die Datei konnte nicht gelesen werden.':'The file could not be read.','Die Datei ist kein gültiges JSON.':'The file is not valid JSON.',
  'Das ist das Testpaket selbst. Bitte die Ergebnisdatei hochladen.':'This is the test package itself. Please upload the result file.','Es fehlt die Liste „records“.':'The list “records” is missing.',
  'Die Datei gehört zu einem anderen Testpaket.':'The file belongs to another test package.','Die Liste „records“ ist leer.':'The list “records” is empty.','Höchstens 4.000 Einträge je Datei.':'At most 4,000 entries per file.',
  'Kein Objekt.':'Not an object.','case_id fehlt.':'case_id is missing.','case_id kommt doppelt vor.':'case_id appears twice.','observed braucht genau message_present.':'observed needs exactly message_present.',
  'message_present muss true, false oder null sein.':'message_present must be true, false or null.','Ergebnisse werden hochgeladen …':'Uploading results …',
  'Ergebnisse hochgeladen. Die Auswertung läuft.':'Results uploaded. The assessment is running.','Bitte die Datei erneut auswählen.':'Please choose the file again.',
  'Entscheidungen von ITSG zu Ihren Versionen und Einreichungen, neueste zuerst.':'ITSG decisions on your versions and submissions, newest first.','Noch keine Entscheidungen von ITSG.':'No ITSG decisions yet.',
  'Prüfung begonnen':'Review started','Prüfung wieder aufgenommen':'Review resumed','Erneute Prüfung erforderlich':'Review required again','Statusänderung':'Status change','Download fehlgeschlagen.':'Download failed.',
  'Anfrage fehlgeschlagen':'Request failed','Ungültige Antwort vom Server.':'Invalid response from the server.'
 });
}
if(typeof UX_RULES==='object'&&Array.isArray(UX_RULES))UX_RULES.push(
 [/^(\d+) warten auf Sie$/,'$1 waiting for you'],[/^(\d+) Einreichungen$/,'$1 submissions'],[/^(\d+) Testfälle$/,'$1 test cases'],
 [/^hochgeladen am (.+)$/,'uploaded on $1'],[/^bereitgestellt am (.+)$/,'provided on $1'],
 [/^Eintrag (\d+): (.+)$/,(m,n,rest)=>`Entry ${n}: ${UX_EN[rest]||rest}`],
 [/^Datei geprüft: (\d+) Ergebnisse\.(?: (\d+) Testfälle ohne Eintrag gelten als nicht beurteilbar\.)?$/,(m,n,miss)=>`File checked: ${n} results.`+(miss?` ${miss} test cases without an entry count as not assessable.`:'')],
 [/^Fehler im letzten Ergebnis: (\d+) Fehler im letzten Importlauf\.$/,'Failures in the latest result: $1 failure(s) in the latest import run.'],
 [/^Einreichungen warten auf Entscheidung: (\d+) Einreichung(?:en)? offen\.$/,'Submissions are waiting for a decision: $1 open.']);
