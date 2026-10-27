'use strict';
/* "Ergebnisse & Abdeckung" (#results): replaces "Prüfberichte" and "Testabdeckung".
   Reads Review.results() (contract 3.5) from /api/state → results, falling back to GET /api/results.
   Charts are inline SVG with title/desc, text labels and a table view; no chart library. */
let resFetch={state:'idle'},resQuery='',resFilter='alle',resFilterParam=null;
const RES_DIST=[['bestanden','Bestanden','#20806a'],['fehlgeschlagen','Fehlgeschlagen','#d50032'],['nicht_beurteilbar','Nicht beurteilbar','#b77a19'],['veraltet','Veraltet','#78529e'],['nicht_ausgefuehrt','Nicht ausgeführt','#9aa1ac']];
const RES_COV=[['covered','Abgedeckt','#20806a','aktueller, bestandener Nachweis'],['open','Offen','#b77a19','Erwartung offen oder Ergebnis nicht bestanden'],['missing','Fehlend','#d50032','kein Testfall oder kein Ergebnis'],['outdated','Veraltet','#78529e','Nachweis zu älterer Version']];
const RES_STATE={aktuell:['Aktuell','approved'],fehlend:['Fehlend','fail'],offen:['Offen','pending'],veraltet:['Veraltet','res-stale']};
const RES_FILTERS=[['alle','Alle'],['luecken','Lücken'],['fehlend','Fehlend'],['offen','Offen'],['veraltet','Veraltet'],['aktuell','Aktuell']];
const RES_RUN={pass:'pass',fail:'fail',not_assessable:'not_assessable'};
const resN=v=>(Number(v)||0).toLocaleString('de-DE');
function resData(){
 if(state.results&&Array.isArray(state.results.rows))return state.results;
 if(resFetch.state==='idle'||(resFetch.state==='done'&&Date.now()-resFetch.at>15000)){const keep=resFetch.data;resFetch={state:'busy',data:keep};api('results').then(d=>{resFetch={state:'done',data:d,at:Date.now()};if(route()==='results'&&!document.getElementById('dialog').open)render();}).catch(err=>{resFetch={state:'failed',error:err.message,at:Date.now()};if(route()==='results')render();});}
 return Array.isArray(resFetch.data?.rows)?resFetch.data:null;
}
function resDistChart(dist){
 const rows=RES_DIST.map(([k,l,c])=>({k,l,c,n:Number(dist?.[k])||0}));const total=rows.reduce((s,x)=>s+x.n,0);const max=Math.max(1,...rows.map(x=>x.n));
 if(!total)return `<div class="chart-empty"><div class="empty-ring">${uiIcon('document')}</div><strong>Noch keine Testfälle mit Anforderung</strong><p>Sobald Testfälle mit freigegebenen Anforderungen verknüpft sind, erscheint hier die Verteilung.</p></div>`;
 const h=rows.length*36+8,lx=138,bw=262;
 const desc=rows.map(x=>`${x.l}: ${x.n}`).join(', ');
 return `<svg class="res-chart" viewBox="0 0 470 ${h}" role="img" aria-labelledby="res-dist-t res-dist-d"><title id="res-dist-t">Ergebnisverteilung über ${total} Testfall-Zuordnungen</title><desc id="res-dist-d">${e(desc)}</desc>${rows.map((x,i)=>{const y=i*36+8,w=x.n?Math.max(4,x.n/max*bw):0;return `<g class="res-bar"><title>${e(x.l)}: ${x.n} von ${total}</title><rect x="0" y="${y-4}" width="470" height="34" fill="transparent"/><text class="res-chart-label" x="0" y="${y+17}">${e(x.l)}</text><rect x="${lx}" y="${y+5}" width="${bw}" height="16" rx="4" class="res-track"/>${w?`<rect x="${lx}" y="${y+5}" width="${w.toFixed(1)}" height="16" rx="4" fill="${x.c}"/>`:''}<text class="res-chart-value" x="${lx+bw+10}" y="${y+17}">${resN(x.n)}</text></g>`;}).join('')}</svg>`;
}
function resCovChart(cov){
 const total=Number(cov?.total_approved)||0;
 if(!total)return `<div class="chart-empty"><div class="empty-ring">${uiIcon('check')}</div><strong>Noch keine freigegebenen Anforderungen</strong><p>Abdeckung zählt nur fachlich freigegebene Anforderungsversionen.</p></div>`;
 const parts=RES_COV.map(([k,l,c,d])=>({k,l,c,d,n:Number(cov?.[k])||0}));const covered=parts[0].n;const pct=Math.round(covered/total*100);
 let x=0;const W=440;const segs=parts.filter(p=>p.n).map(p=>{const w=p.n/total*W;const r=`<rect x="${(x+1).toFixed(1)}" y="0" width="${Math.max(2,w-2).toFixed(1)}" height="22" rx="4" fill="${p.c}"><title>${e(p.l)}: ${p.n} von ${total}</title></rect>`;x+=w;return r;}).join('');
 return `<div class="res-cov-head"><strong>${resN(covered)} von ${resN(total)}</strong><span>freigegebenen Anforderungen mit aktuellem, bestandenem Nachweis (${pct} %)</span></div><svg class="res-chart res-stack" viewBox="0 0 ${W} 22" role="img" aria-labelledby="res-cov-t res-cov-d"><title id="res-cov-t">Anforderungsabdeckung: ${covered} von ${total} abgedeckt</title><desc id="res-cov-d">${e(parts.map(p=>`${p.l}: ${p.n}`).join(', '))}</desc>${segs}</svg><ul class="chart-legend res-legend">${parts.map(p=>`<li><span class="legend-dot" style="background:${p.c}"></span><span>${e(p.l)}<small>${e(p.d)}</small></span><strong>${resN(p.n)}</strong></li>`).join('')}</ul>`;
}
function resMatch(row){
 const st=row.evidence_state;
 if(resFilter==='luecken'&&!['fehlend','offen','veraltet'].includes(st))return false;
 if(!['alle','luecken'].includes(resFilter)&&st!==resFilter)return false;
 const q=resQuery.trim().toLowerCase();if(!q)return true;
 return [row.requirement_id,row.title,row.source?.document_name,...libList(row.cases).map(c=>c.name)].some(x=>String(x||'').toLowerCase().includes(q));
}
function resLatestRun(row){return libList(row.cases).map(c=>c.latest).filter(Boolean).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0]||null;}
function resRow(row){
 const [stLabel,stCls]=RES_STATE[row.evidence_state]||[row.evidence_state||'—',''];
 const latest=resLatestRun(row);
 const cases=libList(row.cases);
 const caseItem=c=>{const l=c.latest;return `<li><div><strong>${e(c.name||c.case_id)}</strong>${c.outdated_text?` <span class="pill res-stale">${e(c.outdated_text)}</span>`:''}${c.usable?'':' <span class="pill">nicht verwendbar</span>'}</div><div class="res-result">${l?`<span class="pill ${RES_RUN[l.status]||''}">${e(labels[l.status]||l.status)}</span>${l.stale?' <span class="pill res-stale">veraltet</span>':''} <small class="muted">${l.created_at?e(fmt(l.created_at)):''}</small> <a class="source-link" href="#report/${libEnc(l.run_id)}">Bericht ↗</a>`:'<span class="muted">Noch kein Ergebnis</span>'}</div></li>`;};
 const shown=cases.filter(c=>c.latest||c.outdated_text),rest=cases.filter(c=>!(c.latest||c.outdated_text));
 const caseHtml=cases.length?(shown.length?`<ul class="res-cases">${shown.map(caseItem).join('')}</ul>`:'')+(rest.length?`<details class="res-more"><summary>${rest.length===1?'1 Testfall':rest.length+' Testfälle'} ohne Ergebnis</summary><ul class="res-cases">${rest.map(caseItem).join('')}</ul></details>`:''):'<span class="muted">Kein Testfall</span>';
 const src=row.source||{};
 return `<tr><td><a class="rule-link" href="#requirements?id=${libEnc(row.requirement_id)}"><strong>${e(row.requirement_id)}</strong></a> · Version ${e(row.version_no||'—')}<br><small>${e(row.title||'')}</small><div class="lib-pills">${row.approval_label?`<span class="pill ${row.approval_invalid?'fail':String(row.approval_label).startsWith('Freigegeben')?'approved':row.approval_label==='Abgelehnt'?'rejected':'pending'}">${e(row.approval_label)}</span>`:''}${row.ai_label?`<span class="pill ai">${e(row.ai_label)}</span>`:''}</div>${row.change_flag?`<small class="res-flag">${e(row.change_flag.text||'Quelle geändert – Prüfung nötig')}</small>`:''}</td><td><span class="pill ${stCls}">${e(stLabel)}</span></td><td>${caseHtml}</td><td>${e(src.document_name||src.document_id||'—')}${src.version_label?'<br><small>Version '+e(src.version_label)+'</small>':''}${src.location?'<br><small class="muted">'+e(src.location)+'</small>':''}</td><td>${latest?btn('Erklären','ws-explain',`data-kind="run" data-id="${e(latest.run_id)}" data-finding="${e(row.requirement_id)}"`,'small'):`<button class="btn small" disabled title="Ohne Ergebnis gibt es keinen Befund zum Erklären.">Erklären</button>`}</td></tr>`;
}
function resTable(data){
 const rows=libList(data.rows).filter(resMatch);
 if(!libList(data.rows).length)return '<div class="empty">Noch keine Anforderungen.<br>Unter Quellen & KI Anforderungen aus einer Quelle entwerfen.</div>';
 return rows.length?`<div class="table-wrap"><table class="res-table"><thead><tr><th>Anforderung</th><th>Nachweis</th><th>Testfälle → letztes Ergebnis</th><th>Quelle</th><th><span class="sr-only">Erklären</span></th></tr></thead><tbody>${rows.map(resRow).join('')}</tbody></table></div><small class="muted">${rows.length} von ${libList(data.rows).length} Anforderungen</small>`:`<div class="cert-empty"><strong>Keine Treffer.</strong><p>Filter oder Suche anpassen.</p>${btn('Filter zurücksetzen','res-clear','','small')}</div>`;
}
function resultsPage(){
 const params=hashParams();const fp=params.get('filter');if(fp!==resFilterParam){resFilterParam=fp;resFilter=RES_FILTERS.some(([k])=>k===fp)?fp:'alle';}
 const data=resData();
 const runs=`<section class="panel"><details id="res-runs" ${params.get('runs')==='1'?'open':''}><summary>Alle Prüfberichte (${state.runs.length})</summary><p class="muted">Jeder Bericht bewahrt den verwendeten Szenario- und Freigabestand.</p>${runTable(state.runs)}</details></section>`;
 const head=heading('Backend 2 · Ergebnisse & Abdeckung','Was ist tatsächlich nachgewiesen?','Ergebnisse, Abdeckung freigegebener Anforderungen und veraltete Nachweise an einem Ort.');
 if(!data)return head+`<div class="notice">${resFetch.state==='failed'?'Daten für „Ergebnisse & Abdeckung“ sind vom Backend noch nicht verfügbar ('+e(resFetch.error)+').':'Ergebnisse werden geladen …'} Prüfberichte bleiben unten erreichbar.</div>`+runs;
 const chips=RES_FILTERS.map(([k,l])=>`<button type="button" class="res-chip ${k===resFilter?'active':''}" data-action="res-filter" data-filter="${k}" aria-pressed="${k===resFilter}">${e(l)}</button>`).join('');
 return head+`<div class="notice">Nur fachlich freigegebene Anforderungsversionen ${term('freigegeben')} zählen für die Abdeckung ${term('abdeckung')}. Nicht beurteilbar ${term('nicht_beurteilbar')} zählt nie als bestanden; veraltete Nachweise ${term('veraltet')} bleiben sichtbar.</div>`+
 `<div class="grid-even res-charts"><section class="panel"><div class="panel-header"><div><h2>Ergebnisverteilung</h2><p class="muted">Letztes Ergebnis je Testfall und Anforderung</p></div></div>${resDistChart(data.distribution)}</section><section class="panel"><div class="panel-header"><div><h2>Anforderungsabdeckung</h2><p class="muted">Freigegebene Anforderungen nach Nachweisstand</p></div></div>${resCovChart(data.coverage)}</section></div>`+
 `<section class="panel"><div class="panel-header"><h2>Anforderungen, Testfälle und Ergebnisse</h2></div><div class="res-filters"><div class="res-chips" role="group" aria-label="Nach Nachweisstand filtern">${chips}</div><div class="field"><label for="res-search" class="sr-only">Suche</label><input id="res-search" type="search" placeholder="Anforderung, Testfall oder Quelle" value="${e(resQuery)}" autocomplete="off"></div></div><div id="res-table">${resTable(data)}</div></section>`+
 (libList(data.limitations).length?`<section class="panel"><h2>Grenzen</h2>${libList(data.limitations).map(s=>`<p class="muted">· ${e(s)}</p>`).join('')}</section>`:'')+runs;
}
document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b||!b.dataset.action.startsWith('res-'))return;
 if(b.dataset.action==='res-filter'){resFilter=b.dataset.filter;history.replaceState(null,'','#results'+(resFilter==='alle'?'':'?filter='+resFilter));resFilterParam=resFilter==='alle'?null:resFilter;render();}
 else if(b.dataset.action==='res-clear'){resFilter='alle';resQuery='';resFilterParam=null;history.replaceState(null,'','#results');render();}
});
document.addEventListener('input',event=>{if(event.target.id==='res-search'){resQuery=event.target.value;const data=resData();const t=document.getElementById('res-table');if(t&&data)t.innerHTML=resTable(data);}});
if(state&&route()==='results')render();
