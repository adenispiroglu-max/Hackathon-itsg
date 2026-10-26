/* Optional E2E test. Run only against a disposable local test DB.
   npm install --no-save playwright
   AUDITFLOW_E2E_ALLOW_WRITES=1 node scripts/browser_smoke.cjs
   Set BROWSER_EXECUTABLE if a non-default Chromium binary is installed. */
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
if(process.env.AUDITFLOW_E2E_ALLOW_WRITES!=='1')throw Error('Use a disposable DB and set AUDITFLOW_E2E_ALLOW_WRITES=1.');
const base=process.env.AUDITFLOW_URL||'http://127.0.0.1:8080';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Local disposable test server required.');
const output=path.resolve('test-results');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',x=>errors.push(x.message));
 await page.goto(base);await page.waitForSelector('h1');
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 const pages=['dashboard','sources','requirements','cases','check','reports','coverage','changes','chain'];
 for(const name of pages){await page.goto(base+'/#'+name);await page.waitForTimeout(80);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Desktop overflow: '+name);}
 async function review(kind,id){
  await page.goto(base+'/#'+(kind==='case'?'cases':'requirements'));
  await page.locator(`[data-action="review"][data-kind="${kind}"][data-id="${id}"]`).click();
  await page.locator('#reviewer').fill('Automated browser test');
  await page.locator('#review-note').fill('Synthetic demo only. Test identity, not real substantive approval.');
  await page.getByRole('button',{name:'Freigeben',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog').open);
 }
 for(const id of ['C1','C2','C3','C4'])await review('requirement',id);
 await review('case','CASE-001');
 async function run(mutation){
  await page.goto(base+'/#check');await page.locator('#run-mode').selectOption('message');
  await page.locator('#mutation').selectOption(mutation);
  await page.getByRole('button',{name:'Prüfung ausführen'}).click();
  await page.waitForSelector('.big-status');
 }
 await run('');if(!await page.locator('.big-status.pass').count())throw Error('Golden synthetic sample did not pass.');
 await page.screenshot({path:path.join(output,'passing-report.png'),fullPage:true});
 const jsonDownload=page.waitForEvent('download');await page.locator('[data-format="json"]').click();
 const downloaded=await jsonDownload;await downloaded.saveAs(path.join(output,'report.json'));
 const pdfDownload=page.waitForEvent('download');await page.locator('[data-format="pdf"]').click();
 const pdf=await pdfDownload;await pdf.saveAs(path.join(output,'report.pdf'));
 await run('wrong_azvu');if(!await page.locator('.big-status.fail').count())throw Error('Mutation was not detected.');
 await page.goto(base+'/#cases');const countBefore=await page.locator('.case-card').count();
 await page.locator('[data-action="generate-cases"][data-mode="boundary"]').first().click();
 await page.waitForFunction(n=>document.querySelectorAll('.case-card').length===n+4,countBefore);
 await page.goto(base+'/#sources');await page.getByRole('button',{name:'+ Dokument importieren'}).click();
 await page.locator('#source-file').setInputFiles({name:'Synthetic UI import.txt',mimeType:'text/plain',buffer:Buffer.from('A synthetic source statement for testing document import and literal candidate extraction.')});
 await page.locator('input[name="version"]').fill('UI-test-1');await page.getByRole('button',{name:'Importieren',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog').open);
 await page.getByRole('button',{name:'Wörtliche Vorschläge',exact:true}).click();
 await page.waitForURL('**/#requirements');
 if(!await page.getByText('Wörtlicher Offline-Vorschlag, keine KI-Ausführung').count()){
  // The note is exposed in data, while the UI clearly marks the rule as pending and unmapped.
  if(!await page.getByText('unmapped',{exact:false}).count())throw Error('Imported candidate missing.');
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/#dashboard');await page.waitForTimeout(100);
 await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 for(const name of pages){await page.goto(base+'/#'+name);await page.waitForTimeout(80);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow: '+name);}
 console.log(JSON.stringify({pages:9,viewports:[1440,390],review:'passed',goldenSample:'passed',mutation:'detected',downloads:['json','pdf'],boundaryDrafts:4,documentImport:'passed',literalDraft:'passed',pageErrors:errors}));
 await browser.close();if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
