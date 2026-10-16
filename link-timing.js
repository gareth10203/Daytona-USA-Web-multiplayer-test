// Four-timestamp clock observations. Offset uncertainty includes network
// asymmetry: no observation here can prove a one-way Internet delay.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const NATIVE_HZ=16000000/(656*424),TIMED_STATE_BYTES=3621+8*8;
export class LinkClock {
 constructor(){this.pending=new Map();this.observations=[];}
 sent(time){if(!finite(time))return;this.pending.set(time,true);while(this.pending.size>16)this.pending.delete(this.pending.keys().next().value);}
 observe(t0,t1,t2,t3){
  if(!this.pending.delete(t0)||![t0,t1,t2,t3].every(finite)||t3<t0||t2<t1||t3-t0>10000||t2-t1>1000)return false;
  const roundTrip=(t3-t0)-(t2-t1);if(roundTrip<-.01)return false;
  const uncertainty=Math.max(0,roundTrip)/2+1,offset=((t1-t0)+(t2-t3))/2;
  this.observations.push({at:t3,offset,uncertainty});this.observations=this.observations.filter(o=>t3-o.at<=30000).slice(-32);return true;
 }
 age(remoteTimestamp,now){
  if(!finite(remoteTimestamp)||!finite(now))return null;
  const candidates=this.observations.filter(o=>now>=o.at&&now-o.at<=30000).map(o=>({...o,uncertainty:o.uncertainty+(now-o.at)*.0002}));
  candidates.sort((a,b)=>a.uncertainty-b.uncertainty);const best=candidates[0];if(!best)return null;
  const ageMs=now-(remoteTimestamp-best.offset);
  if(ageMs < -best.uncertainty-5 || ageMs>10000 || best.uncertainty>250)return null;
  return {ageMs:Math.max(0,ageMs),uncertaintyMs:best.uncertainty};
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
