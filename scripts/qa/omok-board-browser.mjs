#!/usr/bin/env node
// Actual Chromium UI check for the CI-only Omok fixture. No production URL.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const origin = 'http://127.0.0.1:3121';
const path = '/omok-browser-qa-fixture';
const outdir = resolve(process.env.QA_OUTPUT_DIR || 'artifacts/omok-board-qa');
const sizes = [
  ['mobile-320x720',320,720,true],
  ['mobile-390x844',390,844,true],
  ['tablet-768x1024',768,1024,false],
  ['zoom-width-equivalent-960x540',960,540,false],
  ['desktop-1280x800',1280,800,false],
  ['desktop-1440x900',1440,900,false],
  ['desktop-1920x1080',1920,1080,false],
];
async function until(fn, ms=25000) {
  const end=Date.now()+ms;
  while(Date.now()<end) {
    try { if(await fn()) return; } catch { /* not ready */ }
    await sleep(150);
  }
  throw Error('Next/Chromium did not become ready');
}
function binary() {
  for(const name of [process.env.QA_CHROME_BIN,'google-chrome','google-chrome-stable','chromium'].filter(Boolean)) {
    try { execFileSync(name,['--version'],{stdio:'ignore',timeout:5000}); return name; }
    catch { /* next executable */ }
  }
  throw Error('Preinstalled Chrome/Chromium required');
}
class Cdp {
  constructor(ws) {
    this.ws=ws; this.index=0; this.pending=new Map();
    ws.addEventListener('message',e=>{
      let m; try { m=JSON.parse(e.data); } catch { return; }
      const p=this.pending.get(m.id); if(!p)return;
      clearTimeout(p.timeout); this.pending.delete(m.id);
      if(m.error)p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result||{});
    });
    ws.addEventListener('close',()=>{
      for(const p of this.pending.values()) { clearTimeout(p.timeout);p.reject(Error('Chrome closed')); }
      this.pending.clear();
    });
  }
  call(method,params={},sessionId){
    return new Promise((yes,no)=>{
      const id=++this.index;
      const timeout=setTimeout(()=>{this.pending.delete(id);no(Error('CDP timeout '+method));},15000);
      this.pending.set(id,{resolve:yes,reject:no,timeout});
      this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  async eval(expr,sessionId){
    const data=await this.call('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true},sessionId);
    if(data.exceptionDetails)throw Error('Browser evaluation: '+data.exceptionDetails.text);
    return data.result?.value;
  }
}
function dimensions() {
  const root=document.documentElement, body=document.body;
  const board=document.querySelector('.arena-omok-board-frame');
  const grid=document.querySelector('[role="grid"]');
  const cells=[...document.querySelectorAll('[role="gridcell"]')];
  const select=document.querySelector('.arena-omok-coordinate-entry select');
  const button=document.querySelector('.arena-omok-coordinate-entry button');
  const rect=board?.getBoundingClientRect();
  const header=document.querySelector('.arena-header');
  const footer=document.querySelector('.arena-footer');
  const back=document.querySelector('.arena-omok-overview > .arena-button');
  const match=document.querySelector('.arena-omok-match-panel');
  const shell=document.querySelector('.arena-wrap');
  return {
    viewport:[root.clientWidth,root.clientHeight],
    horizontalOverflow:Math.max(0,Math.max(root.scrollWidth,body.scrollWidth)-root.clientWidth),
    verticalOverflow:Math.max(0,Math.max(root.scrollHeight,body.scrollHeight)-root.clientHeight),
    shellReady:!!(header&&footer&&back&&match&&shell),
    chrome: {
      headerHeight:header?.getBoundingClientRect().height,
      footerHeight:footer?.getBoundingClientRect().height,
      backHeight:back?.getBoundingClientRect().height,
      panelBottom:match?.getBoundingClientRect().bottom,
      footerBottom:footer?.getBoundingClientRect().bottom,
    },
    rowCount:grid?.querySelectorAll('[role="row"]').length,
    cellCount:cells.length,
    tabStops:cells.filter(x=>x.tabIndex===0).length,
    lastMoveMarkers:document.querySelectorAll('[data-omok-last="true"]').length,
    boardRect:rect?{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height}:null,
    alternativeSelectHeight:select?.getBoundingClientRect().height,
    alternativeButtonHeight:button?.getBoundingClientRect().height,
  };
}
function rankedMetrics() {
  const wrap=document.querySelector('.arena-omok-ranked-table-scroll');
  const table=wrap?.querySelector('table');
  const head=table?.querySelectorAll('thead th')||[];
  const rows=table?.querySelectorAll('tbody tr')||[];
  const last=rows[rows.length-1]?.querySelector('td:last-child');
  const longNames=[...(table?.querySelectorAll('.arena-omok-ranked-nickname')||[])];
  const records=[...(table?.querySelectorAll('.arena-omok-ranked-record')||[])];
  const wr=wrap?.getBoundingClientRect();
  const tr=table?.getBoundingClientRect();
  const lr=last?.getBoundingClientRect();
  return {
    columns:head.length,rows:rows.length,records:records.length,
    wrapperWidth:wrap?.clientWidth||0,wrapperScrollWidth:wrap?.scrollWidth||0,
    tableWidth:tr?.width||0,tableRight:tr?.right||0,wrapperRight:wr?.right||0,
    rpRight:lr?.right||0,tableLayout:table?getComputedStyle(table).tableLayout:null,
    clippedNicknames:longNames.filter(n=>n.scrollWidth>n.clientWidth+1).length,
    clippedRecords:records.filter(n=>n.scrollWidth>n.clientWidth+1).length,
    bodyHorizontalOverflow:Math.max(0,Math.max(document.body.scrollWidth,
      document.documentElement.scrollWidth)-document.documentElement.clientWidth),
    verticalScroll:!!wrap&&wrap.scrollHeight>wrap.clientHeight+1,
  };
}
async function press(cdp,sid,key,vk,code=key){
  const opts={key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk};
  await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',...opts},sid);
  await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',...opts},sid);
  await sleep(110);
}
async function main(){
  await mkdir(outdir,{recursive:true});
  const dir=await mkdtemp(join(tmpdir(),'omok-qa-'));
  const children=[];
  let cdp;
  try{
    const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3121'],
      {stdio:'ignore',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
    children.push(app);
    await until(async()=>app.exitCode===null && (await fetch(origin+path)).status===200,35000);
    const chrome=spawn(binary(),['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
      '--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
    children.push(chrome);
    let port=0;
    await until(async()=>{
      port=Number((await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);
      return port>0;
    });
    const version=await (await fetch('http://127.0.0.1:'+port+'/json/version')).json();
    const ws=new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
    cdp=new Cdp(ws);
    const {targetId}=await cdp.call('Target.createTarget',{url:'about:blank'});
    const {sessionId:sid}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});
    await cdp.call('Page.enable',{},sid);
    await cdp.call('Runtime.enable',{},sid);
    const results=[];
    for(const [name,width,height,mobile] of sizes){
      await cdp.call('Emulation.setDeviceMetricsOverride',
        {width,height,deviceScaleFactor:mobile?2:1,mobile},sid);
      await cdp.call('Page.navigate',{url:origin+path},sid);
      await until(()=>cdp.eval("document.readyState==='complete' && document.documentElement.dataset.omokQaReady==='true'",sid));
      await sleep(90);
      const dims=await cdp.eval('('+dimensions.toString()+')()',sid);
      const failures=[];
      if(dims.horizontalOverflow>1)failures.push('horizontal overflow '+dims.horizontalOverflow);
      if(!dims.shellReady)failures.push('actual ArenaShell/header/footer/back-link missing');
      const standardDesktop=width>=1200 && height>=768;
      if(standardDesktop && dims.verticalOverflow>1)failures.push(
        'full match page vertical overflow '+dims.verticalOverflow+
        'px including ArenaShell header/footer');
      if(dims.rowCount!==15||dims.cellCount!==225)failures.push('board is not 15x15');
      if(dims.tabStops!==1)failures.push('incorrect keyboard Tab stops');
      if(dims.lastMoveMarkers!==1)failures.push('recent move marker missing');
      const br=dims.boardRect;
      if(!br||br.left< -1||br.right>width+1)failures.push('board outside viewport');
      if(standardDesktop && br && br.bottom>height+1)failures.push(
        'board extends below viewport '+br.bottom+' > '+height);
      // Phones and short/high-zoom viewports must remain scrollable rather than
      // hiding overflowing controls/footers or shrinking 225 cells to unusable size.
      if(br&&br.width>510+1)failures.push('board exceeds 510px game-layout cap '+br.width);
      if(br&&Math.abs(br.width-br.height)>2)failures.push('board not square');
      if((dims.alternativeSelectHeight||0)<44||(dims.alternativeButtonHeight||0)<44)failures.push('alternative input under 44px');
      const png=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);
      await writeFile(join(outdir,name+'.png'),Buffer.from(png.data,'base64'));
      await cdp.eval("document.querySelector('[data-omok-row=\"7\"][data-omok-col=\"7\"]').focus()",sid);
      await press(cdp,sid,'Enter',13);
      const occupied=await cdp.eval("document.getElementById('qa-moves').textContent",sid);
      if(occupied!=='[]')failures.push('occupied cell accepted Enter');
      await press(cdp,sid,'ArrowRight',39);
      const focus=await cdp.eval("({row:document.activeElement?.dataset.omokRow,col:document.activeElement?.dataset.omokCol})",sid);
      if(focus?.row!=='7'||focus?.col!=='8')failures.push('ArrowRight focus invalid '+JSON.stringify(focus));
      await press(cdp,sid,'Enter',13);
      const first=await cdp.eval("document.getElementById('qa-moves').textContent",sid);
      if(first!=='[{"row":7,"col":8}]')failures.push('Enter did not submit selected empty cell: '+first);
      await press(cdp,sid,'Enter',13);
      const twice=await cdp.eval("document.getElementById('qa-moves').textContent",sid);
      if(twice!==first)failures.push('occupied cell submitted twice');
      await press(cdp,sid,'ArrowUp',38);
      const spaceFocus=await cdp.eval("({row:document.activeElement?.dataset.omokRow,col:document.activeElement?.dataset.omokCol})",sid);
      if(spaceFocus?.row!=='6'||spaceFocus?.col!=='8')failures.push('ArrowUp focus invalid before Space');
      const beforeSpaceScroll=await cdp.eval('window.scrollY',sid);
      await press(cdp,sid,' ',32,'Space');
      const space=await cdp.eval("document.getElementById('qa-moves').textContent",sid);
      if(space!=='[{"row":7,"col":8},{"row":6,"col":8}]')failures.push('Space did not submit selected empty cell: '+space);
      const afterSpaceScroll=await cdp.eval('window.scrollY',sid);
      if(afterSpaceScroll!==beforeSpaceScroll)failures.push('Space scrolled document while placing a stone');
      await press(cdp,sid,' ',32,'Space');
      const spaceTwice=await cdp.eval("document.getElementById('qa-moves').textContent",sid);
      if(spaceTwice!==space)failures.push('Space allowed occupied cell duplicate');
      await press(cdp,sid,'End',35);
      const ended=await cdp.eval("document.activeElement?.dataset.omokCol",sid);
      if(ended!=='14')failures.push('End not last column');
      await press(cdp,sid,'Home',36);
      const homed=await cdp.eval("document.activeElement?.dataset.omokCol",sid);
      if(homed!=='0')failures.push('Home not first column');
      // Test the real shared ranked-grid/table DOM with 100 rows, not CSS strings.
      await cdp.call('Page.navigate',{url:origin+'/omok-ranked-width-qa'},sid);
      await until(()=>cdp.eval(
        "document.readyState==='complete' && document.querySelectorAll('.arena-omok-ranked-table tbody tr').length===100",sid));
      await sleep(110);
      const rank=await cdp.eval('('+rankedMetrics.toString()+')()',sid);
      if(rank.columns!==3||rank.rows!==100||rank.records!==100)
        failures.push('ranked columns/rows/records incorrect: '+JSON.stringify(rank));
      if(rank.tableLayout!=='fixed')failures.push('ranked table-layout must be fixed');
      if(rank.wrapperScrollWidth>rank.wrapperWidth+1)
        failures.push('ranked horizontal overflow '+(rank.wrapperScrollWidth-rank.wrapperWidth)+'px');
      if(rank.tableRight>rank.wrapperRight+1||rank.rpRight>rank.wrapperRight+1)
        failures.push('ranked RP column clipped outside container');
      if(rank.clippedNicknames>0||rank.clippedRecords>0)
        failures.push('ranked nickname or W/L/D text clipped: '+JSON.stringify(rank));
      if(rank.bodyHorizontalOverflow>1)
        failures.push('ranked document horizontal overflow '+rank.bodyHorizontalOverflow+'px');
      if(!rank.verticalScroll)failures.push('ranked 100 rows must retain vertical scrolling');
      const rankShot=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);
      await writeFile(join(outdir,name+'-ranked-top100.png'),Buffer.from(rankShot.data,'base64'));
      results.push({name,dims,rank,actions:{occupiedBlocked:occupied==='[]',focus,placed:first,
        duplicateBlocked:twice===first,spacePlaced:space,
        spaceDuplicateBlocked:spaceTwice===space,spacePreventedScroll:afterSpaceScroll===beforeSpaceScroll,
        end:ended,home:homed},failures});
      console.log((failures.length?'FAIL ':'PASS ')+name+
        ' widthOverflow='+dims.horizontalOverflow+'px verticalOverflow='+dims.verticalOverflow+'px; '+
        (failures.length?failures.join('; '):'keyboard/225 cells/44px PASS'));
    }
    const report={generatedAt:new Date().toISOString(),
      fixture:'Generated only in GitHub Actions; no permanent route',
      rankedPolicy:'100 long-name rows, 3 columns, all W/L/D data retained, no viewport or table horizontal scroll.',
      zoomNote:'960x540 is a CSS layout equivalent, NOT real Chrome 200% browser Zoom.',
      verticalPolicy:'Standard desktop width>=1200 and height>=768 requires <=1px full-shell vertical overflow. Mobile and short/zoom widths may scroll without clipping.',
      total:results.length,failed:results.filter(x=>x.failures.length).length,results};
    await writeFile(join(outdir,'results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('OMOK BROWSER QA '+(report.total-report.failed)+'/'+report.total);
    if(report.failed)process.exitCode=1;
  }finally{
    if(cdp)cdp.ws.close();
    // Wait for Chrome to release its profile before deleting cache files.
    for(const child of children.reverse()){
      if(child.exitCode!==null || child.signalCode!==null)continue;
      const exited=new Promise(resolve=>child.once('exit',resolve));
      child.kill('SIGTERM');
      await Promise.race([exited,sleep(1500)]);
    }
    await rm(dir,{recursive:true,force:true,maxRetries:12,retryDelay:250});
  }
}
main().catch(e=>{console.error('Omok browser QA error:',e.stack||String(e));process.exitCode=1;});
