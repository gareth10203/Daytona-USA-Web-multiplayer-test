// Application receipt window. RTC bufferedAmount does not cover data already
// handed to SCTP but not yet received. Bound both that flight and pending work.
export const SNAPSHOT_WINDOW=8, SNAPSHOT_BUFFER_LIMIT=16*1024;
export class SnapshotFlow {
 constructor(epoch,rttHintMs=0,observe=null){this.epoch=epoch;this.sent=0;this.acked=0;this.pending=null;this.coalesced=0;this.lastAckMs=null;this.lastAckAt=null;this.sentAt=new Map();this.rttEstimateMs=Number.isFinite(rttHintMs)?Math.max(0,rttHintMs):0;this.nextSendAt=0;this.observe=observe;this.pendingAt=null;this.waitingSince=null;this.gatedWindow=0;this.gatedBuffer=0;this.gatedPacer=0;}
 observed(kind,value){try{this.observe?.(kind,value);}catch{} }
 get intervalMs(){return this.rttEstimateMs>80?this.rttEstimateMs/(SNAPSHOT_WINDOW-2):0;}
 offer(data,now=performance.now()){if(data.epoch!==this.epoch)throw Error('Snapshot epoch mismatch.');if(this.pending)this.coalesced++;else this.waitingSince=now;this.pending=data;this.pendingAt=now;}
 flush(bufferedBytes,send,now=performance.now()){
  if(!this.pending)return false;
  if(this.sentAt.size>=SNAPSHOT_WINDOW){this.gatedWindow++;return false;}
  if(bufferedBytes>=SNAPSHOT_BUFFER_LIMIT){this.gatedBuffer++;return false;}
  if(now<this.nextSendAt){this.gatedPacer++;return false;}
  const data=this.pending,delivery=this.sent+1;send({...data,delivery});
  this.pending=null;this.sent=delivery;this.sentAt.set(delivery,now);this.nextSendAt=now+this.intervalMs;this.observed('pendingWait',Math.max(0,now-this.pendingAt));this.observed('creditWait',Math.max(0,now-this.waitingSince));this.pendingAt=this.waitingSince=null;return true;
 }
 acknowledge(delivery,now=performance.now()){
  if(!Number.isSafeInteger(delivery)||delivery<1||delivery>this.sent)throw Error('Invalid snapshot acknowledgment.');
  if(!this.sentAt.has(delivery))return false;
  this.lastAckMs=Math.max(0,now-this.sentAt.get(delivery));this.lastAckAt=now;this.rttEstimateMs=this.rttEstimateMs?this.rttEstimateMs*.75+this.lastAckMs*.25:this.lastAckMs;this.acked++;this.sentAt.delete(delivery);this.observed('receiptRtt',this.lastAckMs);
  return true;
 }
 oldestAgeMs(now=performance.now()){return this.sentAt.size?Math.max(0,now-this.sentAt.values().next().value):0;}
 // An old delivery may still be draining after SCTP recovery while later
 // receipts advance. Only a valid receipt grants credit or renews this watch.
 // Once the flight empties, a later send starts its own idle interval.
 ackProgressAgeMs(now=performance.now()){return this.sentAt.size?Math.max(0,now-Math.max(this.sentAt.values().next().value,this.lastAckAt??-Infinity)):0;}
 snapshot(now=performance.now()){return {inFlight:this.sentAt.size,pending:this.pending?1:0,pendingBytes:this.pending?.bytes.byteLength||0,coalesced:this.coalesced,ackRttMs:this.lastAckMs,sendIntervalMs:this.intervalMs,oldestAckAgeMs:this.oldestAgeMs(now),ackProgressAgeMs:this.ackProgressAgeMs(now),gatedWindow:this.gatedWindow,gatedBuffer:this.gatedBuffer,gatedPacer:this.gatedPacer};}
}
