#!/usr/bin/env node
// Chromium side-by-side DOMRect QA. Fixture routes exist only during CI.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const origin='http://127.0.0.1:3123';
const outdir=resolve(process.env.QA_OUTPUT_DIR || 'artifacts/omok-lobby-parity');
const sizes=[
  ['mobile-320x720',320,720,true],
  ['mobile-390x844',390,844,true],
  ['tablet-768x1024',768,1024,false],
  ['short-960x540',960,540,false],
  ['desktop-1280x800',1280,800,false],
  ['desktop-1440x900',1440,900,false],
  ['desktop-1920x1080',1920,1080,false],
];
async function until(fn,ms=30000){
  const stop=Date.now()+ms;
  while(Date.now()<stop) {
    try {if(await fn())return;}catch{/* not yet */}
    await sleep(170);
  }
  throw Error('fixture or Chrome not ready');
}
function chromeBinary(){
  for(const name of [process.env.QA_CHROME_BIN,'google-chrome','google-chrome-stable','chromium'].filter(Boolean)){
    try{execFileSync(name,['--version'],{stdio:'ignore',timeout:4500});return name;}catch{/*next*/}
  }
  throw Error('Chromium not installed');
}
class Cdp{
  constructor(ws){
    this.ws=ws;this.next=0;this.pending=new Map();
    ws.addEventListener('message',e=>{
      let m;try{m=JSON.parse(e.data)}catch{return}
      const p=this.pending.get(m.id);if(!p)return;
      clearTimeout(p.timeout);this.pending.delete(m.id);
      if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result||{});
    });
    ws.addEventListener('close',()=>{
      for(const p of this.pending.values()){clearTimeout(p.timeout);p.reject(Error('Chrome disconnected'))}
      this.pending.clear();
    });
  }
  call(method,params={},sessionId){
    return new Promise((resolve,reject)=>{
      const id=++this.next;
      const timeout=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout '+method))},15000);
      this.pending.set(id,{resolve,reject,timeout});
      this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  async eval(expression,sid){
    const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sid);
    if(r.exceptionDetails)throw Error('Browser JS: '+r.exceptionDetails.text);
    return r.result?.value;
  }
}
function metrics(){
  const round=n=>Math.round(n*10)/10;
  const rect=node=>{
    if(!node)return null;
    const r=node.getBoundingClientRect();
    return {left:round(r.left),top:round(r.top),width:round(r.width),height:round(r.height),
      right:round(r.right),bottom:round(r.bottom)};
  };
  const q=s=>document.querySelector(s);
  return {
    page:document.location.pathname,
    hero:rect(q('.arena-hero')),
    heading:rect(q('.arena-hero h1')),
    modes:rect(q('.arena-modes')),
    switcher:rect(q('.arena-game-switcher')),
    cards:[...document.querySelectorAll('.arena-modes > .arena-mode')].map(rect),
    buttons:[...document.querySelectorAll('.arena-modes > .arena-mode .arena-mode-actions > *')].map(rect),
    recovery:rect(q('.arena-recovery')),
    sidebar:rect(q('.arena-sidebar')),
    doc:{width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,
      horizontalOverflow:Math.max(0,Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-
        document.documentElement.clientWidth),
      verticalOverflow:Math.max(0,Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-
        document.documentElement.clientHeight)},
  };
}
function compare(a,b,width,height){
  const failures=[];
  const check=(name,ra,rb,fields=['left','top','width','height'])=>{
    if(!ra||!rb){failures.push(name+' missing');return}
    for(const field of fields){
      const d=Math.abs(ra[field]-rb[field]);
      if(d>1.5)failures.push(name+'.'+field+' mismatch '+ra[field]+' vs '+rb[field]+' ('+d+'px)');
    }
  };
  if(!a.hero||!b.hero||a.cards.length!==3||b.cards.length!==3)
    failures.push('Missing hero or three modes');
  check('hero',a.hero,b.hero);
  check('hero title',a.heading,b.heading);
  check('game switcher',a.switcher,b.switcher);
  check('mode grid',a.modes,b.modes);
  for(let i=0;i<3;i++){
    check('card '+i,a.cards[i],b.cards[i]);
    check('action '+i,a.buttons[i],b.buttons[i]);
  }
  for(const [name,page] of [['Alkkagi',a],['Omok',b]]){
    if(page.doc.horizontalOverflow>1)failures.push(name+' horizontal overflow '+page.doc.horizontalOverflow);
    if(width>=1200&&height>=768&&page.doc.verticalOverflow>1)
      failures.push(name+' desktop vertical overflow '+page.doc.verticalOverflow);
  }
  return failures;
}
async function main(){
  await mkdir(outdir,{recursive:true});
  const profile=await mkdtemp(join(tmpdir(),'omok-parity-'));
  const children=[];let cdp;
  try{
    const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3123'],
      {stdio:'ignore',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
    children.push(app);
    await until(async()=>app.exitCode===null&&(await fetch(origin+'/omok-lobby-parity-qa/alkkagi')).status===200,35000);
    const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-dev-shm-usage',
      '--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
      {stdio:'ignore'});
    children.push(chrome);
    let port=0;
    await until(async()=>{
      port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
      return port>0;
    });
    const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
    const ws=new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true})});
    cdp=new Cdp(ws);
    const {targetId}=await cdp.call('Target.createTarget',{url:'about:blank'});
    const {sessionId:sid}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});
    await cdp.call('Page.enable',{},sid);await cdp.call('Runtime.enable',{},sid);
    const results=[];
    for(const [name,width,height,mobile] of sizes){
      await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:mobile?2:1,mobile},sid);
      const measured=[];
      for(const game of ['alkkagi','omok']){
        await cdp.call('Page.navigate',{url:origin+'/omok-lobby-parity-qa/'+game},sid);
        await until(()=>cdp.eval(
          "document.readyState==='complete' && document.querySelectorAll('.arena-modes > .arena-mode').length===3",
          sid));
        await sleep(150);
        measured.push(await cdp.eval('('+metrics.toString()+')()',sid));
        const shot=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);
        await writeFile(join(outdir,name+'-'+game+'.png'),Buffer.from(shot.data,'base64'));
      }
      const failures=compare(measured[0],measured[1],width,height);
      results.push({name,width,height,alkkagi:measured[0],omok:measured[1],failures});
      console.log((failures.length?'FAIL ':'PASS ')+name+': '+(failures.join('; ')||'hero+3 cards match within 1.5px'));
    }
    const report={createdAt:new Date().toISOString(),
      policy:'Exact source components, same viewport, hero/cards/buttons DOMRects within 1.5px. Mobile scrolling allowed; standard desktop vertical<=1px.',
      zoomNote:'960x540 is CSS-size approximation, not browser zoom 200%.',
      results,passed:results.filter(x=>!x.failures.length).length,total:results.length};
    await writeFile(join(outdir,'results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('LOBBY PARITY QA '+report.passed+'/'+report.total);
    if(report.passed!==report.total)process.exitCode=1;
  }finally{
    if(cdp)cdp.ws.close();
    for(const child of children.reverse()){
      if(child.exitCode!==null||child.signalCode!==null)continue;
      const exited=new Promise(resolve=>child.once('exit',resolve));
      child.kill('SIGTERM');await Promise.race([exited,sleep(1500)]);
    }
    await rm(profile,{recursive:true,force:true,maxRetries:12,retryDelay:250});
  }
}
main().catch(e=>{console.error('Omok lobby parity QA:',e.stack||String(e));process.exitCode=1});
