// Bounded, room-local game measurements. Never accept IDs or device data from a sample.
export const PERFORMANCE_HISTORY_LIMIT=300,PERFORMANCE_BATCH_LIMIT=4,PERFORMANCE_PARTICIPANT_LIMIT=32;
const valid=(v,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const fields=(source,keys)=>Object.fromEntries(keys.filter(k=>valid(source?.[k])||source?.[k]===null).map(k=>[k,source[k]]));
const metrics=['simulationHz','drawHz','cpuMeanMs','cpuP95Ms','maxStepGapMs','discardedMs','audioResets','heapBytes','callbackSlots','receiveBytes','frames','progressFrames','backlogMs','drawDistance'];
const nativeMetrics=['listWritesHz','fgEdgesHz','dataBlocksHz','parseHz','fgReadsHz','frameCaps','vblankCaps','dataInFg','groupedFgReads','cancelledFgBatches','video30Frames','poseApplicationsHz','poseHeldPercent','poseBufferTicks'];
const networkMetrics=['connections','rttMs','bufferedBytes','payloadSentBytes','payloadReceivedBytes','sentBytesPerSecond','receivedBytesPerSecond','sentPacketsPerSecond','receivedPacketsPerSecond','relayConnections'];
const flowMetrics=['cabinet','inFlight','pending','pendingBytes','coalesced','ackRttMs','sendIntervalMs','oldestAckAgeMs','ackProgressAgeMs'];
export function normalizePerformanceSample(source){
 if(!source||!Number.isSafeInteger(source.sequence)||source.sequence<1||!valid(source.time)||!valid(source.capturedAt,8640000000000000)||!valid(source.seconds,3600)||source.seconds<.5||source.linked!==true||typeof source.running!=='boolean'||!['MASTER','SLAVE'].includes(source.role))return null;
 for(const key of ['simulationHz','drawHz','cpuMeanMs','cpuP95Ms','maxStepGapMs'])if(!valid(source[key]))return null;
 const result={sequence:source.sequence,time:source.time,capturedAt:source.capturedAt,seconds:source.seconds,running:source.running,linked:true,role:source.role,...fields(source,metrics)};
 if(typeof source.hidden==='boolean')result.hidden=source.hidden;
 result.nativeLink=source.nativeLink?fields(source.nativeLink,nativeMetrics):null;
 const net=source.network||{};result.network={...fields(net,networkMetrics),topology:'central'};
 for(const key of ['rttMs'])if(net[key]===null)result.network[key]=null;
 for(const key of ['sent','received']){result.network[key]=fields(net[key],['packets','intervalP95Ms','intervalMaxMs']);}
 result.network.snapshotFlow=Array.isArray(net.snapshotFlow)?net.snapshotFlow.slice(0,8).map(row=>fields(row,flowMetrics)):[];
 if(net.central){result.network.central={...fields(net.central,['samples','sequence','discarded']),agesMs:Array.isArray(net.central.agesMs)?net.central.agesMs.slice(0,8).map(row=>({...fields(row,['cabinet','ageMs']),...(row?.ageMs===null?{ageMs:null}:{})})):[]};}
 result.peers=Array.isArray(source.peers)?source.peers.slice(0,8).map(row=>({...fields(row,['cabinet','frames','ageMs']),...(Number.isFinite(row?.observedFrameDelta)&&Math.abs(row.observedFrameDelta)<=Number.MAX_SAFE_INTEGER?{observedFrameDelta:row.observedFrameDelta}:{})})):[];
 return result;
}
export function performanceBatch(history,epoch,after=0){
 if(!epoch)return null;
 const candidates=history.filter(s=>s.sessionId===epoch&&s.linked&&s.sequence>after),samples=candidates.slice(0,PERFORMANCE_BATCH_LIMIT).map(normalizePerformanceSample).filter(Boolean);
 if(!samples.length)return null;
 return {version:1,epoch,availableFromSequence:candidates[0].sequence,samples};
}
export class PerformanceHistory {
 constructor(){this.records=new Map();this.races=new Map();this.raceNumber=0;}
 beginRace(epoch,members=[]){if(!this.races.has(epoch)){this.races.set(epoch,{number:++this.raceNumber,roster:new Map(members.map(m=>[m.id,{name:m.name,cabinet:m.cabinet}]))});if(this.races.size>128)this.races.delete(this.races.keys().next().value);}return this.races.get(epoch);}
 accept(member,packet,acceptedEpochs,{local=false,receivedAt=Date.now(),activeIDs=[]}={}){
  if(!packet||packet.version!==1||typeof packet.epoch!=='string'||!acceptedEpochs.includes(packet.epoch)||!packet.epoch||!Array.isArray(packet.samples)||!packet.samples.length||packet.samples.length>PERFORMANCE_BATCH_LIMIT)return {accepted:0,ack:this.records.get(member.id)?.lastSequence||0};
  const samples=packet.samples.map(normalizePerformanceSample);
  if(samples.some(s=>!s)||samples.some((s,i)=>i&&s.sequence<=samples[i-1].sequence))return {accepted:0,ack:this.records.get(member.id)?.lastSequence||0};
  let record=this.records.get(member.id);if(!record){record={name:member.name,cabinet:member.cabinet,source:local?'local':'participant-reported',samples:[],lastSequence:0,discardedSamples:0,unreceivedSamples:0};this.records.set(member.id,record);}
  record.name=member.name;record.cabinet=member.cabinet;
  const race=this.beginRace(packet.epoch),identity=race.roster.get(member.id)||member;let accepted=0;
  for(const sample of samples){
   if(sample.sequence<=record.lastSequence)continue;
   // Sequence gaps within a race indicate missing measurements, not network packet loss.
   const previous=record.samples.at(-1);if(previous?.race===race.number)record.unreceivedSamples+=Math.max(0,sample.sequence-record.lastSequence-1);
   record.lastSequence=sample.sequence;record.samples.push({...sample,role:local?'MASTER':'SLAVE',race:race.number,name:identity.name,cabinet:identity.cabinet,receivedAt});accepted++;
   if(record.samples.length>PERFORMANCE_HISTORY_LIMIT){record.samples.shift();record.discardedSamples++;}
  }
  const keep=new Set(activeIDs);for(const id of this.records.keys())if(this.records.size>PERFORMANCE_PARTICIPANT_LIMIT&&!keep.has(id))this.records.delete(id);
  return {accepted,ack:record.lastSequence};
 }
 summary(id){const r=this.records.get(id);return r?{sampleCount:r.samples.length,firstCapturedAt:r.samples[0]?.capturedAt??null,lastCapturedAt:r.samples.at(-1)?.capturedAt??null,lastReceivedAt:r.samples.at(-1)?.receivedAt??null,discardedSamples:r.discardedSamples,unreceivedSamples:r.unreceivedSamples,source:r.source}:{sampleCount:0,firstCapturedAt:null,lastCapturedAt:null,lastReceivedAt:null,discardedSamples:0,unreceivedSamples:0,source:null};}
 report(identities=[]){return {schema:1,limitPerCabinet:PERFORMANCE_HISTORY_LIMIT,nominalIntervalMs:1000,notes:['Automatic collection during linked gameplay; performance overlay is optional.','Up to 300 game samples per cabinet, approximately five minutes of collected gameplay. Earlier samples may have been discarded.','Remote measurements are participant-reported, not independently verified by the host.','Device clocks are not synchronized. capturedAt is the device wall clock; receivedAt is the host wall clock. Do not subtract them to infer one-way latency.','unreceivedSamples counts gaps in diagnostic sample sequences within a race; it does not measure packet loss.','A disconnected device can only contribute measurements already received; reconnecting devices retry retained samples.','GPU time and underlying network packet loss are unavailable.'],cabinets:identities.map(({id,serial,name,cabinet,self})=>{const r=this.records.get(id);return {schema:4,serial,name,cabinet,source:self?'local':'participant-reported',coverage:this.summary(id),samples:structuredClone(r?.samples||[])};})};}
}
