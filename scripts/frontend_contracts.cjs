const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={console,uxItems:(v,x)=>x,uxToolbar:()=>'',uxEntry:()=>'',document:{addEventListener(){}},setInterval(){},fieldNames:{},labels:{},sessionStorage:{getItem(){return ''}},e,
 btn:(t,a,attrs='')=>`<button data-action="${a}" ${attrs}>${t}</button>`,icon:()=>'<svg></svg>',fmt:()=> 'Synthetic date',badge:x=>`<span>${e(x)}</span>`,reviewCard:()=>'<p>Untersuchung erforderlich</p>',markText:t=>e(t),
 readable:x=>e(JSON.stringify(x)),state:{workflow:{items:[],reports:[],mail_configured:false},documents:[],requirements:[],document_jobs:[]}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('auditflow/static/workflow.js','utf8'),ctx);
assert.equal(ctx.flowBoolean('Ja'),true);assert.equal(ctx.flowBoolean('Nein'),false);assert.throws(()=>ctx.flowBoolean('unbekannt'));
const w={id:'w',name:'<script>synthetic</script>',phase:'intake',mode:'offline',customer:{company:'Demo',contact:'Test',email:'test@example.invalid',software:'Demo',software_version:'1'},document_ids:[],reports:[],cases:[],case_cursor:0,requirement_snapshot:[{}],delivery:{status:'ready'},final_review:{decision:'accepted',reviewer:'Synthetic expert',at:'2026-10-27',note:'Test'},result:{counts:{pass:1,fail:0,not_assessable:0},rows:[{title:'Synthetic',expected:true,actual:true,status:'pass'}]}};
ctx.state.workflow.items=[w];
for(const phase of ['intake','sources','requirements','generation','case_review','delivery','results','final_review','closed']){
 w.phase=phase;const html=ctx.workflowDashboard();assert.ok(html.includes('flow-rail'));assert.ok(!html.includes('<script>synthetic'));assert.ok(html.includes('&lt;script&gt;synthetic'));assert.ok(!html.includes('<pre>'));
 if(phase==='intake')assert.ok(html.includes('flow-files'));
 if(phase==='requirements')assert.ok(html.includes('Keine Anforderung erkannt'));
 if(phase==='case_review')assert.ok(html.includes('flow-release-form'));
 if(phase==='results')assert.ok(html.includes('flow-results-form'));
 if(phase==='final_review')assert.ok(html.includes('flow-close-form'));
 if(phase==='closed')assert.ok(html.includes('Fachlich abgesegnet'));
}
ctx.state.workflow.reports=[{id:'r',workflow_id:'w',kind:'sources',title:'Zwischenbericht · Quellenabgleich'}];
assert.ok(ctx.flowReportButton(w,'sources').includes('aria-label="Zwischenbericht'));
const libContext={document:{addEventListener(){}},setInterval(){},labels:{},e};vm.createContext(libContext);vm.runInContext(fs.readFileSync('auditflow/static/library.js','utf8'),libContext);
assert.ok(libContext.markText('📄 Prüfe die Frist',{issues:[{target:'criterion',quote:'Frist',start:12,end:17,reason:'Test'}]},'criterion').includes('>Frist</mark>'));
assert.ok(!libContext.markText('Unchanged',{issues:[{target:'criterion',quote:'invented',start:0,end:7}]},'criterion').includes('<mark'));
console.log('Frontend contracts: all 9 conveyor phases, escaped input, report icons and Unicode marks passed.');

// Empty/filtered workflow lists must guide real customer work, never present demo tools as the primary action.
ctx.heading=(tag,title,desc,action='')=>`<h1>${title}</h1><p>${desc}</p>${action}`;
ctx.cases=()=>'<p>LEGACY DEMO TOOLS</p>';
let empty=ctx.workflowCasesPage();
assert.ok(empty.includes('data-action="flow-new"'));assert.ok(empty.includes('data-action="flow-select"'));assert.ok(empty.includes('class="panel"><summary>Unabhängige synthetische Demofälle'));
assert.ok(empty.indexOf('flow-select')<empty.indexOf('LEGACY DEMO TOOLS'));
ctx.state.workflow.items=[];empty=ctx.workflowCasesPage();assert.ok(empty.includes('Noch keine Vorgänge vorhanden.'));assert.ok(empty.includes('Herstellerergebnisse'));
// Source failures must stop the spinner and expose escaped errors and bounded progress.
ctx.state.document_jobs=[{document_id:'d',status:'failed',cursor:1,total:4,error:'Synthetic <script> error',location:'Page 2'}];
ctx.state.documents=[{id:'d',name:'Synthetic <img>.txt',version:'1'}];
const failedHtml=ctx.flowAnalysis({document_ids:['d'],phase:'sources',error:'Synthetic failure'});
assert.ok(!failedHtml.includes('class="spinner"'));assert.ok(failedHtml.includes('1 / 4'));assert.ok(failedHtml.includes('Fehlerursache:'));
assert.ok(failedHtml.includes('&lt;script&gt;'));assert.ok(!failedHtml.includes('<script>'));
ctx.state.document_jobs[0].status='running';ctx.state.document_jobs[0].stage='review';ctx.state.document_jobs[0].review_cursor=1;ctx.state.document_jobs[0].review_total=3;
const runningHtml=ctx.flowAnalysis({document_ids:['d'],phase:'sources'});assert.ok(runningHtml.includes('class="spinner"'));assert.ok(runningHtml.includes('KI-Vorprüfung'));assert.ok(runningHtml.includes('(1 / 3)'));

// Stable file card structure keeps long metadata separate from progress and exposes the shared source.
assert.ok(runningHtml.includes('class="flow-file-header"'));
assert.ok(runningHtml.includes('class="flow-file-meta"'));
assert.ok(runningHtml.includes('data-action="lib-source"'));
assert.ok(runningHtml.includes('<strong data-user-content>Synthetic &lt;img&gt;.txt</strong>'));
const css=fs.readFileSync('auditflow/static/style.css','utf8');
assert.ok(!/\.flow-file-list span\s*\{/.test(css));
ctx.state.document_jobs[0].status='completed';ctx.state.document_jobs[0].mode='offline';
assert.ok(ctx.flowFiles({document_ids:['d'],phase:'sources'}).includes('Lokal vorbereitet · ohne KI'));
ctx.state.documents=[];assert.ok(ctx.flowFiles({document_ids:['missing'],phase:'sources'}).includes('Quelldokument nicht verfügbar.'));
// Prepared demonstrations remain distinguishable from live model work in both views.
ctx.state.documents=[{id:'d',name:'Prepared original.pdf',version:'13.1',prepared_demo:'itsg-demo-v1'}];
ctx.state.document_jobs=[{document_id:'d',status:'completed',mode:'demo',cursor:2,total:2}];
assert.ok(ctx.flowFiles({document_ids:['d'],phase:'sources'}).includes('Demo-Vorbereitung abgeschlossen'));
assert.ok(ctx.flowObject({...w,mode:'demo',phase:'requirements',document_ids:['d']}).includes('Vorbereitete Demo · ohne Live-KI'));
assert.ok(fs.readFileSync('auditflow/static/workflow.js','utf8').includes('<option value="demo">Vorbereitete Challenge-Demo · ohne API</option>'));
libContext.fmt=()=> 'Synthetic date';
assert.ok(libContext.reviewCard({ai_review:{mode:'demo',recommendation:'clarify',reason:'Prepared recommendation',issues:[],created_at:'2026-10-27'}}).includes('Vorbereitete Demo-Empfehlung'));

// Keep independent expanded cases across render/polling and expose direct decisions.
const panel={dataset:{flowPanel:'w|c'},open:true};ctx.document.querySelectorAll=()=>[panel];ctx.flowRememberPanels();
const sampleCase={id:'c',title:'Synthetic case',expected:{field:'value',value:true,rationale:'Synthetic'},questions:[],steps:['Check'],profile:{kind:'synthetic'},inputs:{flag:true},review_status:'pending',generation_mode:'demo',precheck:{mode:'demo',reason:'Prepared check',issues:[],recommendation:'recommend_approval'}};
let caseHtml=ctx.flowCases({...w,id:'w',phase:'case_review',cases:[sampleCase]});
assert.ok(caseHtml.includes('data-flow-panel="w|c" open'));assert.ok(caseHtml.includes('flow-case-approve'));assert.ok(caseHtml.includes('flow-case-reject'));assert.ok(caseHtml.includes('Vorbereitete Demo-Vorprüfung'));
panel.open=false;ctx.flowRememberPanels();caseHtml=ctx.flowCases({...w,id:'w',phase:'case_review',cases:[sampleCase]});assert.ok(!caseHtml.includes('data-flow-panel="w|c" open'));
sampleCase.expected.value=null;caseHtml=ctx.flowCases({...w,id:'w',phase:'case_review',cases:[sampleCase]});assert.ok(/flow-case-approve[^>]*disabled/.test(caseHtml));

// Earlier stations are viewable; stepping back is offered only before customer handoff.
ctx.flowViews=vm.runInContext('flowViews',ctx);
sampleCase.expected.value=true;
const later={...w,id:'w',mode:'demo',phase:'delivery',document_ids:['d'],cases:[sampleCase],excluded_cases:[],delivery:{status:'ready'},requirement_snapshot:[{id:'r'}]};
let railHtml=ctx.flowObject(later);assert.ok(railHtml.includes('data-action="flow-view" data-id="w" data-step="0"'));assert.ok(railHtml.includes('data-action="flow-view-current" data-id="w" data-step="4"'));assert.ok(!railHtml.includes('data-step="5"'));
ctx.flowViews.set('w',3);railHtml=ctx.flowObject(later);assert.ok(railHtml.includes('RÜCKBLICK'));assert.ok(railHtml.includes('data-target="case_review"'));
ctx.flowViews.set('w',0);assert.ok(ctx.flowObject(later).includes('data-target="intake"'));
assert.ok(!ctx.flowObject({...later,phase:'results',delivery:{status:'manual'}}).includes('data-action="flow-back"'));ctx.flowViews.delete('w');
// One-click bulk approval needs an explicit checkbox; requirement holds expose an explicit continue.
ctx.state.documents[0].sections=[];
ctx.state.requirements=[{id:'r',source_id:'d',title:'Synthetic requirement',criterion:'Synthetic',status:'pending',ai_review:{recommendation:'clarify'}}];
const reqHtml=ctx.flowStation({...later,phase:'requirements',hold:true});assert.ok(reqHtml.includes('id="flow-bulk-req-form"'));assert.ok(/name="confirmed" type="checkbox" required/.test(reqHtml));assert.ok(reqHtml.includes('flow-advance'));assert.ok(reqHtml.includes('Klärungshinweise'));
const reviewHtml=ctx.flowStation({...later,phase:'case_review',cases:[{...sampleCase,review_status:'pending'}]});assert.ok(reviewHtml.includes('id="flow-bulk-case-form"'));
// Demo pacing is labelled as a presentation pause and shows a bounded progress bar.
const paced=ctx.flowAnalysis({...later,phase:'sources',demo_pacing:{started:Date.now()/1000-3,seconds:9}});
assert.ok(paced.includes('Präsentationspause'));assert.ok(paced.includes('role="progressbar"'));assert.ok(paced.includes('Analyse läuft'));
assert.ok(ctx.flowAnalysis({...later,phase:'sources',demo_pacing:{started:Date.now()/1000-20,seconds:9}}).includes('Analyse abgeschlossen'));
console.log('Frontend contracts: station review, guarded back navigation, bulk approval and labelled demo pacing passed.');
// Case attachments and checked imports.
const fileHtml=ctx.flowCases({...later,phase:'case_review',cases:[{...sampleCase,attachments:['instruction','reference']}]});
assert.ok(fileHtml.includes('data-kind="instruction"'));assert.ok(fileHtml.includes('data-kind="reference"'));assert.ok(fileHtml.includes('nicht für das Kundenpaket'));
assert.ok(!ctx.flowCases({...later,phase:'case_review',cases:[{...sampleCase,attachments:['instruction']}]}).includes('data-kind="reference"'));
assert.ok(ctx.flowStation({...later,phase:'requirements'}).includes('data-action="flow-import" data-kind="requirements" data-id="w"'));
assert.ok(ctx.flowStation({...later,phase:'case_review',cases:[sampleCase]}).includes('data-action="flow-import" data-kind="cases" data-id="w"'));
let dialog='';ctx.modal=html=>{dialog=html;};ctx.toast=()=>{};ctx.state.workflow.items=[{...later,phase:'case_review'}];
ctx.flowImportDialog('requirements','w');assert.ok(dialog.includes('id="flow-req-import-form"'));assert.ok(dialog.includes('name="document_id"'));
ctx.flowImportDialog('cases','w');assert.ok(dialog.includes('id="flow-case-import-form"'));assert.ok(dialog.includes('name="id" value="w"'));
ctx.flowImportDialog('cases');assert.ok(dialog.includes('<select name="id">'));
ctx.state.workflow.items=[{...later,phase:'case_review',cases:[sampleCase]}];assert.ok(ctx.workflowCasesPage().includes('data-action="flow-import" data-kind="cases"'));
console.log('Frontend contracts: case TXT attachments and checked imports passed.');

// Preparation ends at station five, with a later customer reply kept available.
const handoff=ctx.flowStation({...later,phase:'results',delivery:{status:'manual'}});
assert.ok(handoff.includes('Vorbereitung abgeschlossen'));assert.ok(handoff.includes('Kundenantwort später ergänzen'));assert.ok(handoff.includes('flow-results-form'));
assert.ok(ctx.flowStation({...later,phase:'case_review',cases:[sampleCase]}).includes('Alle genehmigen & weiter zu Schritt 5'));
assert.ok(fs.readFileSync('auditflow/static/workflow.js','utf8').includes('Sicher genehmigen? Überarbeitung empfohlen'));
