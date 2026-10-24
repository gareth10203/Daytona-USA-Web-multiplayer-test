// Four-timestamp clock observations. Offset uncertainty includes network
// asymmetry: no observation here can prove a one-way Internet delay.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const NATIVE_HZ=16000000/(656*424),TIMED_STATE_BYTES=3621+8*8;
// Bind a packet's original clock to the step that produced its contents.
// A step interval is honest about execution-time uncertainty, including during
// slow frames/catch-up. Neither a displayed RTT nor a fixed tick is a timestamp.
export class SourceTimeline {
 constructor(){this.reset();}
 reset(){this.steps=new Map();}
 record(clock,start,end){
  if(!Number.isInteger(clock)||clock<0||clock>0xffffffff||![start,end].every(finite)||end<start)return;
  this.steps.set(clock,{at:(start+end)/2,uncertaintyMs:(end-start)/2});
  while(this.steps.size>128)this.steps.delete(this.steps.keys().next().value);
 }
 publication(bytes,now){
  if(!(bytes instanceof Uint8Array)||bytes.length!==453||!finite(now))return null;
  const clock=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(449,true),step=this.steps.get(clock);
  return step&&now>=step.at&&now-step.at<=10000&&step.uncertaintyMs<=150?{...step}:null;
 }
}
export function sourceTiming(clockSync,publication,now){
 if(!publication||!finite(publication.at)||!finite(publication.uncertaintyMs)||publication.uncertaintyMs<0||publication.uncertaintyMs>150)return null;
 const transit=clockSync?.age(publication.at,now);
 return transit?{ageMs:transit.ageMs,uncertaintyMs:transit.uncertaintyMs+publication.uncertaintyMs}:null;
}
// At most one complete snapshot waits for the next simulation step. Keep its
// receipt time so waiting in the browser cannot masquerade as fresh data.
export class NativeStateInbox {
 constructor(){this.clear();}
 clear(){this.pending=null;}
 receive(bytes,timing,now){this.pending={bytes,timing,at:now};}
 take(now){
  const p=this.pending;this.clear();if(!p)return null;
  const elapsed=Math.max(0,now-p.at);
  return nativeTimedState(p.bytes,p.timing?.map(t=>t?{...t,ageMs:t.ageMs+elapsed}:null));
 }
}
export class LinkClock {
 constructor(){this.pending=new Map();this.observations=[];}
 sent(time){if(!finite(time))return;this.pending.set(time,true);while(this.pending.size>16)this.pending.delete(this.pending.keys().next().value);}
 observe(t0,t1,t2,t3){
  if(!this.pending.delete(t0)||![t0,t1,t2,t3].every(finite)||t3<t0||t2<t1||t3-t0>10000||t2-t1>1000)return false;
  const roundTrip=(t3-t0)-(t2-t1);if(roundTrip<-.01)return false;
  const uncertainty=Math.max(0,roundTrip)/2+1,offset=((t1-t0)+(t2-t3))/2;
  this.observations.push({at:t3,offset,uncertainty});this.observations=this.observations.filter(o=>t3-o.at<=30000).slice(-32);return true;
 }
 localTime(remoteTimestamp,now,maximumUncertainty=250){
  if(!finite(maximumUncertainty)||maximumUncertainty<0||maximumUncertainty>1000)return null;
  if(!finite(remoteTimestamp)||!finite(now))return null;
  const candidates=this.observations.filter(o=>now>=o.at&&now-o.at<=30000).map(o=>({...o,uncertainty:o.uncertainty+(now-o.at)*.0002}));
  candidates.sort((a,b)=>a.uncertainty-b.uncertainty);const best=candidates[0];if(!best)return null;
  if(best.uncertainty>maximumUncertainty)return null;
  return {at:remoteTimestamp-best.offset,uncertaintyMs:best.uncertainty};
 }
 age(remoteTimestamp,now,maximumUncertainty=250){
  const local=this.localTime(remoteTimestamp,now,maximumUncertainty);if(!local)return null;
  const ageMs=now-local.at;
  if(ageMs < -local.uncertaintyMs-5 || ageMs>10000 || local.uncertaintyMs>maximumUncertainty)return null;
  return {ageMs:Math.max(0,ageMs),uncertaintyMs:local.uncertaintyMs};
 }
}
export function normalizeSlotTiming(value,count){
 if(!value||value.version!==1||!finite(value.at)||!Array.isArray(value.slots)||value.slots.length!==count)return null;
 const slots=value.slots.map(s=>s&&Number.isInteger(s.clock)&&s.clock>=0&&s.clock<=0xffffffff&&finite(s.ageMs)&&s.ageMs>=0&&s.ageMs<=10000&&finite(s.uncertaintyMs)&&s.uncertaintyMs>=0&&s.uncertaintyMs<=500?{clock:s.clock,ageMs:s.ageMs,uncertaintyMs:s.uncertaintyMs}:null);
 return {version:1,at:value.at,slots};
}
export function receivedTiming(value,count,transit,elapsed=0){
 const checked=normalizeSlotTiming(value,count);if(!checked)return null;
 // If the receiver has not calibrated its host clock yet, keep the position
 // path conservative. Do not replace unknown transit by half a displayed RTT.
 return checked.slots.map(s=>s&&transit?{clock:s.clock,ageMs:s.ageMs+transit.ageMs+Math.max(0,elapsed),uncertaintyMs:s.uncertaintyMs+transit.uncertaintyMs}:null);
}
export function nativeTimedState(bytes,timing){
 if(!(bytes instanceof Uint8Array)||bytes.length!==3621)return bytes;
 const result=new Uint8Array(TIMED_STATE_BYTES);result.set(bytes);const view=new DataView(result.buffer),count=timing?.length||0;
 for(let slot=0;slot<8;slot++){
  const entry=count?timing[slot%count]:null,clock=view.getUint32(0xe05+slot*4,true);
  const valid=entry&&entry.clock===clock&&finite(entry.ageMs)&&entry.ageMs>=0&&entry.ageMs<=10000&&finite(entry.uncertaintyMs)&&entry.uncertaintyMs>=0&&entry.uncertaintyMs<=500;
  view.setFloat32(3621+slot*8,valid?entry.ageMs:NaN,true);view.setFloat32(3625+slot*8,valid?entry.uncertaintyMs:NaN,true);
 }
 return result;
}
