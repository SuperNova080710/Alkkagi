// CI-only Chromium runner. No production URL, credentials, or installed browser download.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const directory=resolve('.next/chess-feedback-fixture');
const output=resolve('artifacts/chess-feedback-browser');
const sizes=[[844,390],[1280,400],[320,720],[390,844],[1440,900]];
async function until(test,ms=20000) {
  const deadline=Date.now()+ms;
  while(Date.now()<deadline) {try {const value=await test();if(value)return value;}catch{} await sleep(80);}
  throw Error('Chromium fixture timed out');
}
class Cdp {
  constructor(ws){
    this.ws=ws;this.index=0;this.pending=new Map();
    ws.addEventListener('message',event=>{
      const message=JSON.parse(event.data), entry=this.pending.get(message.id);
      if(!entry)return;this.pending.delete(message.id);clearTimeout(entry.timeout);
      if(message.error)entry.reject(Error(JSON.stringify(message.error)));else entry.resolve(message.result||{});
    });
  }
  call(method,params={},sessionId){
    return new Promise((resolve,reject)=>{
      const id=++this.index,timeout=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout '+method));},15000);
      this.pending.set(id,{resolve,reject,timeout});
      this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
}
let chrome,cdp,server;
const profile=await mkdtemp(join(tmpdir(),'chess-feedback-'));
try {
  await mkdir(output,{recursive:true});
  server=createServer(async (request,response)=>{
    const name=new URL(request.url,'http://localhost').pathname;
    // Serve only the known compiled test files.
    if(!['/','/index.html','/chess-feedback.js','/chess.css','/chess-feedback.css'].includes(name)){response.writeHead(404).end();return;}
    try {
      response.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
      response.end(await readFile(join(directory,name==='/'?'index.html':name.slice(1))));
    }catch{response.writeHead(500).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const executable=[process.env.QA_CHROME_BIN,'google-chrome','google-chrome-stable','chromium']
    .filter(Boolean).find(name=>spawnSync(name,['--version'],{stdio:'ignore'}).status===0);
  if(!executable)throw Error('Preinstalled Chrome/Chromium is required');
  chrome=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const port=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]));
  const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
  const ws=new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  cdp=new Cdp(ws);
  const {targetId}=await cdp.call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});
  await cdp.call('Page.enable',{},sessionId);
  const reports=[];
  for(const [width,height] of sizes)for(const reduced of [false,true]){
    await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
    await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]},sessionId);
    await cdp.call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'},sessionId);
    const report=await until(async()=>{
      const result=await cdp.call('Runtime.evaluate',{expression:'document.documentElement.dataset.qaResult',returnByValue:true},sessionId);
      return result.result?.value?JSON.parse(result.result.value):null;
    });
    reports.push({...report,reduced});
    const name=width+'x'+height+'-'+(reduced?'reduced':'motion');
    const png=await cdp.call('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));
    console.log((report.passed?'PASS ':'FAIL ')+name+' board='+report.boardWidth+'px '+(report.error||report.checks.length+' checks'));
  }
  await writeFile(join(output,'results.json'),JSON.stringify(reports,null,2)+'\n');
  if(reports.some(report=>!report.passed))process.exitCode=1;
} finally {
  cdp?.ws.close();server?.closeAllConnections();server?.close();
  if(chrome && chrome.exitCode===null){
    const closed=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');
    await Promise.race([closed,sleep(1500)]);
  }
  await rm(profile,{recursive:true,force:true,maxRetries:6,retryDelay:250});
}
