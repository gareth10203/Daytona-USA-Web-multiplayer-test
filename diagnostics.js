import {BUILD_ID} from './room-settings.js';
// Local, bounded measurements. No telemetry is uploaded.
export class Diagnostics {
  constructor({clock=()=>performance.now(),read=()=>({}),network=()=>({}),render=()=>{}}={}) {
    Object.assign(this,{clock,read,network,render});
    this.enabled=false;this.history=[];this.latest=null;this.reset();
  }
  reset() {this.since=this.clock();this.steps=0;this.draws=0;this.cpu=[];this.discardedMs=0;this.audioResets=0;this.maxGap=0;this.previousStep=null;}
  step(ms) {if(!this.enabled)return;const now=this.clock();if(this.previousStep!==null)this.maxGap=Math.max(this.maxGap,now-this.previousStep);this.previousStep=now;this.steps++;this.cpu.push(ms);}
  draw() {if(this.enabled)this.draws++;}
  discard(ms) {if(this.enabled)this.discardedMs+=Math.max(0,ms);}
  audioReset() {if(this.enabled)this.audioResets++;}
  enable(on) {this.enabled=!!on;this.reset();this.render(null,this.enabled);}
  update(running) {
    if(!this.enabled)return;
    const now=this.clock(),seconds=(now-this.since)/1000;if(seconds<1)return;
    const sorted=this.cpu.sort((a,b)=>a-b);
    const sample={time:now,running,seconds,simulationHz:this.steps/seconds,drawHz:this.draws/seconds,
      cpuMeanMs:this.steps?sorted.reduce((a,b)=>a+b,0)/this.steps:0,
      cpuP95Ms:this.steps?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]:0,
      maxStepGapMs:this.maxGap,discardedMs:this.discardedMs,audioResets:this.audioResets,
      ...this.read(),network:this.network()};
    this.latest=sample;this.history.push(sample);if(this.history.length>300)this.history.shift();
    this.render(sample,true);this.reset();
  }
  report() {return {schema:1,build:BUILD_ID,createdAt:new Date().toISOString(),
    userAgent:globalThis.navigator?.userAgent||'',note:'Local measurements; application ping RTT includes browser scheduling, RTC RTT measures the selected pair. WASM heap is capacity, not live allocations. GPU time is not measured.',samples:this.history};}
}

export function mountDiagnostics({element,toggle,download,read,room}) {
  let lastPoll=0,polling=false;
  const diag=new Diagnostics({read,network:()=>room.diagnostics(),render:(s,on)=>{
    element.hidden=!on;
    if(!s){element.textContent='Diagnostics · collecting…';return;}
    const n=s.network,rtt=n.rttMs==null?'—':`${Math.round(n.rttMs)} ms`;
    element.textContent=`SIM ${s.simulationHz.toFixed(1)} / 57.5 Hz · DRAW ${s.drawHz.toFixed(0)} Hz\nCPU ${s.cpuMeanMs.toFixed(1)} ms · p95 ${s.cpuP95Ms.toFixed(1)} ms · gap ${s.maxStepGapMs.toFixed(0)} ms\nRTT ${rtt} · SEND ${(n.bufferedBytes/1024).toFixed(0)} KB · RECEIVE ${(s.receiveBytes/1024).toFixed(0)} KB\nWASM ${(s.heapBytes/1048576).toFixed(0)} MB · callbacks ${s.callbackSlots} · dropped ${s.discardedMs.toFixed(0)} ms`;
  }});
  toggle.addEventListener('change',()=>diag.enable(toggle.checked));
  download.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(diag.report(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='daytona-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const update=diag.update.bind(diag);
  diag.update=running=>{
    update(running);
    const now=performance.now();if(!diag.enabled||polling||now-lastPoll<2000)return;
    lastPoll=now;polling=true;room.pollDiagnostics().catch(()=>{}).finally(()=>{polling=false;});
  };
  return diag;
}
