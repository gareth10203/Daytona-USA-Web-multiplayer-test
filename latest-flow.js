// Latest-state delivery: receipts measure progress, never hold a credit window.
// Submit at most one state to RTC at a time; newer states replace the local
// pending one while RTC drains. This is independent of round-trip credit.
export const MOTION_BUFFER_LIMIT=1,MOTION_MAX_RECEIPTS=256,MOTION_MAX_HZ=60,MOTION_MIN_HZ=15;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export class LatestFlow {
 constructor(epoch,rttHintMs=0,observe=null){
  this.epoch=epoch;this.observe=observe;this.pending=null;this.pendingAt=null;this.waitingSince=null;this.sent=0;this.acked=0;this.highestAck=0;this.coalesced=0;this.sentAt=new Map();this.feedback=new Map();this.receiptWindow=[];this.receiptFeedbackUnknown=0;this.feedbackNew=0;this.lastFeedbackReduction=-Infinity;this.lastAckMs=null;this.lastAckAt=null;this.firstSentAt=null;this.nextSendAt=0;this.rateHz=MOTION_MAX_HZ;this.rttEstimateMs=finite(rttHintMs)?rttHintMs:0;this.jitterMs=0;this.rttSamples=[];this.lastRttSample=-Infinity;this.lastAdjust=null;this.lastPressure=-Infinity;this.bufferPressure=false;this.gatedWindow=0;this.gatedBuffer=0;this.gatedPacer=0;this.expiredReceipts=0;this.supersededReceipts=0;this.expiredPending=0;this.rateReductions=0;
 }
 observed(kind,value){try{this.observe?.(kind,value);}catch{}}
 get intervalMs(){return 1000/this.rateHz;}
 get baselineMs(){return this.rttSamples.length?Math.min(...this.rttSamples.map(s=>s.ms)):this.rttEstimateMs;}
 get receiptGapFraction(){return this.receiptWindow.length?this.receiptWindow.reduce((a,b)=>a+b,0)/this.receiptWindow.length:null;}
 offer(data,now=performance.now()){if(data.epoch!==this.epoch)throw Error('Snapshot epoch mismatch.');if(this.pending)this.coalesced++;else this.waitingSince=now;this.pending=data;this.pendingAt=now;}
 maintain(now){
  const ttl=Math.min(10000,Math.max(5000,this.rttEstimateMs*4+this.jitterMs*4));
  for(const [id,at] of this.sentAt){if(now-at<=ttl&&this.sentAt.size<=MOTION_MAX_RECEIPTS)break;this.sentAt.delete(id);this.expiredReceipts++;}
  this.rttSamples=this.rttSamples.filter(s=>now-s.at<=10000);
  if(this.lastAdjust===null){this.lastAdjust=now;return;}if(now-this.lastAdjust<500)return;
  const starved=this.sent>this.highestAck&&now-(this.lastAckAt??this.firstSentAt)>Math.max(1000,this.rttEstimateMs*4+this.jitterMs*4);
  // A high or newly changed RTT alone is not evidence of congestion.
  const gaps=this.receiptWindow.length>=32&&this.feedbackNew>=16&&this.receiptGapFraction>.18&&now-this.lastFeedbackReduction>=1000;
  if(this.bufferPressure||starved||gaps){const next=Math.max(MOTION_MIN_HZ,this.rateHz*((this.bufferPressure||starved)? .75:.85));if(next<this.rateHz)this.rateReductions++;this.rateHz=next;this.lastPressure=now;if(gaps){this.feedbackNew=0;this.lastFeedbackReduction=now;}}
  else if(now-this.lastPressure>=1000&&this.lastAckAt!==null&&now-this.lastAckAt<Math.max(1000,this.rttEstimateMs*3))this.rateHz=Math.min(MOTION_MAX_HZ,this.rateHz+6*(now-this.lastAdjust)/1000);
  this.bufferPressure=false;this.lastAdjust=now;
 }
 flush(bufferedBytes,send,now=performance.now()){
  this.maintain(now);if(!this.pending)return false;
  if(now-this.pendingAt>Math.max(150,this.intervalMs*3)){this.pending=null;this.pendingAt=this.waitingSince=null;this.expiredPending++;return false;}
  if(bufferedBytes>=MOTION_BUFFER_LIMIT){if(this.bufferBlockedSince==null)this.bufferBlockedSince=now;if(now-this.bufferBlockedSince>=Math.max(35,this.intervalMs*2))this.bufferPressure=true;this.gatedBuffer++;return false;}
  this.bufferBlockedSince=null;
  // One interval of timing credit absorbs OS timer jitter. Otherwise a 16 ms
  // wakeup just before a 16.67 ms deadline can accidentally halve a 60 Hz feed.
  // The envelope allows at most two immediate sends, never a backlog burst.
  if(now<this.nextSendAt-this.intervalMs){this.gatedPacer++;return false;}
  const wasIdle=this.sent===this.highestAck,delivery=this.sent+1;if(!Number.isSafeInteger(delivery))throw Error('Motion sequence exhausted.');
  send({...this.pending,delivery,sentAt:now});
  this.pending=null;this.sent=delivery;this.sentAt.set(delivery,now);if(this.firstSentAt===null||wasIdle)this.firstSentAt=now;this.nextSendAt=Math.max(now,this.nextSendAt)+this.intervalMs;
  this.feedback.set(delivery,false);while(this.feedback.size>MOTION_MAX_RECEIPTS){this.feedback.delete(this.feedback.keys().next().value);this.receiptFeedbackUnknown++;}
  while(this.sentAt.size>MOTION_MAX_RECEIPTS){this.sentAt.delete(this.sentAt.keys().next().value);this.expiredReceipts++;}
  this.observed('pendingWait',Math.max(0,now-this.pendingAt));this.observed('creditWait',Math.max(0,now-this.waitingSince));this.pendingAt=this.waitingSince=null;return true;
 }
 acknowledge(delivery,now=performance.now(),receiptMask=1){
  if(!Number.isSafeInteger(delivery)||delivery<1||delivery>this.sent)throw Error('Invalid motion receipt.');
  if(!Number.isInteger(receiptMask)||receiptMask<0||receiptMask>0xffffffff||!(receiptMask&1))throw Error('Invalid motion receipt mask.');
  for(let bit=0;bit<32;bit++){const id=delivery-bit;if(id<1)break;if(receiptMask>>bit&1&&this.feedback.has(id))this.feedback.set(id,true);}
  // Allow 16 newer deliveries for reordering. A feedback blackout longer than
  // the bitmap coverage creates unknown observations, not fictitious UDP loss.
  for(const [id,seen] of this.feedback){if(id>delivery-16)break;this.feedback.delete(id);if(!seen&&delivery-id>=32){this.receiptFeedbackUnknown++;continue;}this.receiptWindow.push(seen?0:1);if(this.receiptWindow.length>64)this.receiptWindow.shift();this.feedbackNew++;}
  if(delivery<=this.highestAck||!this.sentAt.has(delivery))return false;
  this.lastAckMs=Math.max(0,now-this.sentAt.get(delivery));this.lastAckAt=now;this.highestAck=delivery;this.acked++;
  if(this.rttEstimateMs){this.jitterMs=this.jitterMs*.75+Math.abs(this.lastAckMs-this.rttEstimateMs)*.25;this.rttEstimateMs=this.rttEstimateMs*.875+this.lastAckMs*.125;}else this.rttEstimateMs=this.lastAckMs;
  if(now-this.lastRttSample>=100){this.rttSamples.push({at:now,ms:this.lastAckMs});this.rttSamples=this.rttSamples.filter(s=>now-s.at<=10000).slice(-128);this.lastRttSample=now;}
  for(const id of this.sentAt.keys()){if(id>delivery)break;this.sentAt.delete(id);if(id!==delivery)this.supersededReceipts++;}
  this.observed('receiptRtt',this.lastAckMs);return true;
 }
 nextDelay(bufferedBytes,now=performance.now()){if(!this.pending)return null;return bufferedBytes>=MOTION_BUFFER_LIMIT?20:Math.max(1,this.nextSendAt-this.intervalMs-now);}
 oldestAgeMs(now=performance.now()){return this.sentAt.size?Math.max(0,now-this.sentAt.values().next().value):0;}
 ackProgressAgeMs(now=performance.now()){return this.sent>this.highestAck?Math.max(0,now-Math.max(this.firstSentAt??now,this.lastAckAt??-Infinity)):0;}
 snapshot(now=performance.now()){return {mode:'latest',inFlight:this.sentAt.size,pending:this.pending?1:0,pendingBytes:this.pending?.bytes.byteLength||0,coalesced:this.coalesced,ackRttMs:this.lastAckMs,sendIntervalMs:this.intervalMs,rateHz:this.rateHz,rttEstimateMs:this.rttEstimateMs,rttBaselineMs:this.baselineMs,jitterMs:this.jitterMs,oldestAckAgeMs:this.oldestAgeMs(now),ackProgressAgeMs:this.ackProgressAgeMs(now),gatedWindow:0,gatedBuffer:this.gatedBuffer,gatedPacer:this.gatedPacer,expiredReceipts:this.expiredReceipts,supersededReceipts:this.supersededReceipts,expiredPending:this.expiredPending,rateReductions:this.rateReductions,receiptGapFraction:this.receiptGapFraction,receiptWindow:this.receiptWindow.length,receiptFeedbackUnknown:this.receiptFeedbackUnknown};}
}
