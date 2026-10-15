import {HostDistributor,STATE_BYTES,STATE_TAG,compactState,expandState} from './central-link.js';
import {SnapshotFlow} from './snapshot-flow.js';
import {HealthSampler,normalizeHealth,STOP_CAUSES,cleanReason} from './connection-health.js';
import {PerformanceHistory,PERFORMANCE_BATCH_LIMIT,normalizePerformanceSample} from './performance-history.js';
import {BUILD_ID,validateSettings,invitation,parseInvitation} from './room-settings.js';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const cleanName=value=>String(value||'Driver').trim().slice(0,24)||'Driver';
export const CHAT_LIMIT=240,CHAT_HISTORY_LIMIT=60,CHAT_INTERVAL_MS=900;
const chatText=value=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():'';
const MAX_BUFFER=1024*1024;
const linkError=(message,cause,conn)=>Object.assign(Error(message),{linkCause:cause,linkPeer:conn?.peer});
function packetTiming(){return {count:0,last:null,intervals:[]};}
function recordPacket(timing,enabled){timing.count++;if(!enabled)return;const now=performance.now();if(timing.last!==null){timing.intervals.push(now-timing.last);if(timing.intervals.length>256)timing.intervals.shift();}timing.last=now;}
function timingSummary(timing){const values=[...timing.intervals].sort((a,b)=>a-b);return {packets:timing.count,intervalP95Ms:values.length?values[Math.floor((values.length-1)*.95)]:null,intervalMaxMs:values.length?values.at(-1):null};}
export const PROGRESS_TIMEOUT_MS=10000;
export const CONNECTION_TIMEOUT_MS=20000;
export const OPEN_TIMEOUT_MS=30000;
export const RECONNECT_GRACE_MS=30000;
const retryDelay=attempt=>Math.min(1000*2**Math.min(attempt,4),10000);
const INACTIVE_REASON="The race was interrupted because a cabinet became inactive. Return to the room and start again.";
export class Multiplayer {
 constructor({onChange=()=>{},onPrepare=async()=>{},onStart=()=>{},onStop=()=>{},onBytes=()=>{},isVisible=()=>true,readHealth=()=>({}),readPerformance=()=>null}={}){
  Object.assign(this,{onChange,onPrepare,onStart,onStop,onBytes,isVisible,readHealth,readPerformance});this.performanceCaptureEnabled=true;this.hostDiagnosticsEnabled=true;this.reset();
 }
 reset(){this.diagnosticsRevision=0;this.receivedDiagnosticsRevision=-1;this.setPerformanceCapture(this.hostDiagnosticsEnabled);this.distributor=null;this.stateSequence=0;this.awaitingStop=false;this.endedEpoch='';this.progressFrames=0;this.progressAt=0;this.networkStats=new Map();this.payloadSent=0;this.payloadReceived=0;this.chat=[];this.chatSequence=0;this.chatRate=new Map();this.lastChatSent=-Infinity;this.sentTiming=packetTiming();this.receivedTiming=packetTiming();this.peer=null;this.server=null;this.connections=new Map();this.members=[];this.pending=new Map();this.phase='idle';this.isHost=false;this.id='';this.host='';this.secret='';this.epoch='';this.revision=0;this.settings={mode:0,difficulty:0,region:'Export'};this.error='';this.signaling=true;this.prepared=new Set();this.timer=null;this.generation=(this.generation||0)+1;this.initRecovery();}
 snapshot(){return {diagnosticsEnabled:this.performanceCaptureEnabled,phase:this.phase,isHost:this.isHost,id:this.id,host:this.host,code:this.host&&this.secret?invitation(this.host,this.secret):'',members:this.members.map(x=>({...x})),pending:[...this.pending.values()].map(x=>({...x})),settings:{...this.settings},error:this.error,signaling:this.signaling,awaitingStop:this.awaitingStop,chat:this.chat.map(x=>({...x})),reconnectUntil:this.reconnectUntil,confirming:this.commands.size,readyPending:[...this.commands.values()].some(c=>c.data.type==='ready'),lastAck:this.lastAck};}
 changed(){this.onChange(this.snapshot());}
 recordConnectionEvent(kind,conn=null,detail={}){
  const now=performance.now(),pc=conn?.peerConnection;
  const member=detail.member||this.members.find(m=>m.id===(conn?.peer||this.id))||this.pending.get(conn?.peer);
  this.connectionEvents.push({id:++this.consoleEventSequence,at:Date.now(),time:now,kind,phase:this.phase,role:this.isHost?'MASTER':'SLAVE',name:cleanName(member?.name||(!conn?this.name:'Driver')),cabinet:member?.cabinet??null,source:detail.source||'observed',cause:detail.cause||null,reason:cleanReason(detail.reason),
   channelState:conn?.dataChannel?.readyState??(conn?.open?'open':null),connectionState:pc?.connectionState??null,iceState:pc?.iceConnectionState??null,
   bufferedBytes:conn?.dataChannel?.bufferedAmount||0,rttMs:this.networkStats.get(conn)?.rttMs??conn?.measuredRttMs??null,lastMessageAgeMs:conn?.lastSeen==null?null:Math.max(0,now-conn.lastSeen),progressAgeMs:conn?.emulation?.at==null?null:Math.max(0,now-conn.emulation.at)});
  if(this.connectionEvents.length>128)this.connectionEvents.shift();
 }
 initRecovery(){this.performanceHistory=new PerformanceHistory();this.performanceAck=0;this.performanceOffered=0;this.connectionEvents=[];this.consoleEventSequence=0;this.consoleRecords=new Map();this.consoleSerial=0;this.healthSampler=new HealthSampler();this.lastHealth=null;this.sessions=new Map();this.sessionKey='';this.reconnectUntil=0;this.retryAt=0;this.retryAttempt=0;this.signalRetryAt=0;this.signalAttempt=0;this.lobbySequence=0;this.lastLobbySequence=0;this.commands=new Map();this.commandSequence=0;this.lastAck=null;}
 diagnosticsPolicy(){return {enabled:this.performanceCaptureEnabled,revision:this.diagnosticsRevision};}
 setDiagnosticsEnabled(on){
  if(!this.isHost||!['lobby','playing'].includes(this.phase)||typeof on!=='boolean')return false;
  this.hostDiagnosticsEnabled=on;if(on===this.performanceCaptureEnabled)return true;
  this.diagnosticsRevision++;this.setPerformanceCapture(on);this.recordConnectionEvent('diagnostics-changed',null,{source:'action',reason:on?'Detailed room diagnostics enabled.':'Detailed room diagnostics disabled.'});
  this.broadcast({type:'diagnostics-policy',diagnostics:this.diagnosticsPolicy()});this.changed();return true;
 }
 applyDiagnosticsPolicy(policy){
  if(!policy||typeof policy.enabled!=='boolean'||!Number.isSafeInteger(policy.revision)||policy.revision<0||policy.revision<=this.receivedDiagnosticsRevision)return false;
  this.receivedDiagnosticsRevision=policy.revision;this.diagnosticsRevision=policy.revision;this.setPerformanceCapture(policy.enabled);return true;
 }
 setPerformanceCapture(on){on=!!on;if(on===this.performanceCaptureEnabled)return;this.performanceCaptureEnabled=on;this.sentTiming=packetTiming();this.receivedTiming=packetTiming();this.networkStats.clear();}
 makePerformance(){
  if(!this.performanceCaptureEnabled)return null;
  const epoch=this.epoch||this.endedEpoch;if(!epoch)return null;
  let packet;try{packet=this.readPerformance(epoch,this.isHost?(this.performanceHistory.records.get(this.id)?.lastSequence||0):this.performanceAck);}catch{return null;}
  if(!packet||packet.version!==1||packet.epoch!==epoch||!Array.isArray(packet.samples)||!packet.samples.length||packet.samples.length>PERFORMANCE_BATCH_LIMIT)return null;
  const samples=packet.samples.map(normalizePerformanceSample);if(samples.some(s=>!s))return null;packet={version:1,epoch,samples};
  if(this.isHost){const member=this.members.find(m=>m.id===this.id);if(member)this.performanceHistory.accept(member,packet,[epoch],{local:true,activeIDs:this.members.map(m=>m.id)});return null;}
  return packet;
 }
 receivePerformance(conn,data){
  if(!this.performanceCaptureEnabled||!this.isHost||this.connections.get(conn.peer)!==conn)return 0;
  const member=this.members.find(m=>m.id===conn.peer);if(!member)return 0;
  try{return this.performanceHistory.accept(member,data.performance,[this.epoch||this.endedEpoch],{activeIDs:this.members.map(m=>m.id)}).ack;}catch{return this.performanceHistory.records.get(conn.peer)?.lastSequence||0;}
 }
 performanceIdentities(){
  const identities=[{id:this.id,serial:0,name:this.name,cabinet:1,self:true}];
  for(const member of this.members){if(member.id===this.id)continue;if(!this.consoleRecords.has(member.id))this.connectionRow(member,this.connections.get(member.id),performance.now());}
  for(const [id,record] of this.consoleRecords)if(record.row)identities.push({id,serial:record.serial,name:record.row.name,cabinet:record.row.cabinet,self:false});
  return identities;
 }
 makeHealth(now=performance.now()){let extra={};try{extra=this.readHealth()||{};}catch{}return this.lastHealth=this.healthSampler.sample(this,now,extra);}
 receiveHealth(conn,data){
  if(!this.isHost||this.connections.get(conn.peer)!==conn||!this.members.some(m=>m.id===conn.peer)||data.health===undefined)return;
  const health=normalizeHealth(data.health);
  if(!health){if(!conn.invalidHealthAt||performance.now()-conn.invalidHealthAt>5000){conn.invalidHealthAt=performance.now();this.recordConnectionEvent('invalid-status-report',conn);}return;}
  if(health.sequence<=(conn.healthSequence||0))return;
  if(this.active&&data.epoch!==this.epoch)return;
  conn.healthSequence=health.sequence;conn.healthReport={...health,receivedAt:performance.now()};
 }
 connectionRow(member,conn,now){
  const stats=this.networkStats.get(conn),flow=conn?.snapshotFlow?.snapshot();
  let record=this.consoleRecords.get(member.id);
  if(!record){record={serial:++this.consoleSerial};this.consoleRecords.set(member.id,record);}
  if(conn){const counters=conn.consoleCounters||{tx:0,rx:0};const prev=conn.consoleRate;
   if(!prev||now-prev.at>=500){conn.consoleRate={at:now,tx:counters.tx,rx:counters.rx,txRate:prev?Math.max(0,counters.tx-prev.tx)*1000/(now-prev.at):null,rxRate:prev?Math.max(0,counters.rx-prev.rx)*1000/(now-prev.at):null};}
  }
  const age=at=>at==null?null:Math.max(0,now-at),report=conn?.healthReport;
  const health=report?Object.fromEntries(Object.entries(report).filter(([key])=>key!=='receivedAt')):null;
  const row={serial:record.serial,name:cleanName(member.name),cabinet:member.cabinet??null,self:false,pending:this.pending.has(member.id),archived:false,connection:member.connection||'connected',
   rttMs:conn?.measuredRttMs??stats?.rttMs??null,rttSource:Number.isFinite(conn?.measuredRttMs)?'room-ping':stats?.rttMs!=null?'browser':null,transportRttMs:stats?.rttMs??null,statsAgeMs:stats?.at==null?null:Math.max(0,now-stats.at),path:stats?stats.relay?'relay':'direct':null,channelState:conn?.dataChannel?.readyState??(conn?.open?'open':null),connectionState:conn?.peerConnection?.connectionState??null,iceState:conn?.peerConnection?.iceConnectionState??null,
   bufferedBytes:conn?.dataChannel?.bufferedAmount??null,inFlight:flow?.inFlight??null,pendingStates:flow?.pending??null,ackAgeMs:conn?.snapshotFlow?.oldestAgeMs(now)??null,ackProgressAgeMs:conn?.snapshotFlow?.ackProgressAgeMs(now)??null,
   lastMessageAgeMs:age(conn?.lastSeen),progressAgeMs:age(conn?.emulation?.epoch===this.epoch?conn.emulation.at:null),lastStateAgeMs:age(conn?.lastStateAt),reportAgeMs:age(report?.receivedAt),health,
   sentBytes:conn?.consoleCounters?.tx??0,receivedBytes:conn?.consoleCounters?.rx??0,txBytesPerSecond:conn?.consoleRate?.txRate??null,rxBytesPerSecond:conn?.consoleRate?.rxRate??null,performance:this.performanceHistory.summary(member.id)};
  record.row=row;return row;
 }
 retainConnection(conn){
  if(!this.isHost)return;const member=this.members.find(m=>m.id===conn.peer)||this.pending.get(conn.peer);if(!member)return;
  const row=this.connectionRow(member,conn,performance.now());this.consoleRecords.get(member.id).row={...row,archived:true,connection:'disconnected'};
  this.trimConsoleRecords();
 }
 trimConsoleRecords(){
  const current=new Set([...this.members.map(m=>m.id),...this.pending.keys()]);
  for(const [id,r] of this.consoleRecords)if(this.consoleRecords.size>32&&!current.has(id)&&r.row?.archived)this.consoleRecords.delete(id);
 }
 consoleSnapshot({includePerformance=false}={}){
  if(!this.isHost){if(!this.lastHostReport)return null;return {...structuredClone(this.lastHostReport),...(includePerformance?{performance:structuredClone(this.lastHostPerformance)}:{})};}
  this.makePerformance();
  const now=performance.now(),health=this.makeHealth(now),activeIDs=new Set([this.id]),rows=[{serial:0,self:true,name:cleanName(this.name),cabinet:1,visible:health.visible,health,reportAgeMs:0,connection:'connected',archived:false,rttMs:null,lastMessageAgeMs:0,lastStateAgeMs:null,progressAgeMs:this.active?Math.max(0,now-this.progressAt):null,bufferedBytes:this.diagnostics().bufferedBytes,performance:this.performanceHistory.summary(this.id)}];
  for(const member of [...this.members,...this.pending.values()]){
   if(member.id===this.id)continue;activeIDs.add(member.id);const conn=this.connections.get(member.id),previous=this.consoleRecords.get(member.id)?.row;
   rows.push(conn?this.connectionRow(member,conn,now):previous?{...previous,archived:false,connection:member.connection||'reconnecting'}:this.connectionRow(member,null,now));
  }
  for(const [id,record] of this.consoleRecords)if(!activeIDs.has(id)&&record.row)rows.push({...record.row,archived:true,connection:'disconnected',performance:this.performanceHistory.summary(id)});
  this.trimConsoleRecords();
  return {build:BUILD_ID,captureMode:this.performanceCaptureEnabled?'full':'off',generatedAt:new Date().toISOString(),live:true,phase:this.phase,signaling:this.signaling,rows,events:this.connectionEvents.map(e=>({...e})),packetLossPercent:null,...(includePerformance?{performance:this.performanceHistory.report(this.performanceIdentities())}:{})};
 }
 get active(){return this.phase==='playing';}
 get occupied(){return !['idle','error'].includes(this.phase);}
 send(conn,data){if(!conn?.open)throw linkError('A player is disconnected.','transport-interruption',conn);if((conn.dataChannel?.bufferedAmount||0)>MAX_BUFFER){this.recordConnectionEvent('send-queue-limit',conn);throw linkError('A player connection is too slow; the arcade link was stopped.','send-queue-limit',conn);}try{conn.send(data);}catch(e){this.recordConnectionEvent('send-error',conn);throw linkError(e.message||'Send failed.','send-error',conn);}if(['arcade-sample','arcade-state'].includes(data.type)){this.payloadSent+=data.bytes.byteLength;recordPacket(this.sentTiming,this.performanceCaptureEnabled);if(conn.consoleCounters)conn.consoleCounters.tx+=data.bytes.byteLength;}}
 sendSnapshot(conn,data){
  if(!conn?.open)throw linkError('A player is disconnected.','transport-interruption',conn);
  if(!conn.snapshotFlow||conn.snapshotFlow.epoch!==this.epoch)conn.snapshotFlow=new SnapshotFlow(this.epoch,conn.measuredRttMs);
  conn.snapshotFlow.offer(data);this.flushSnapshot(conn);
 }
 flushSnapshot(conn){if(this.active&&conn?.open&&conn.snapshotFlow?.epoch===this.epoch)conn.snapshotFlow.flush(conn.dataChannel?.bufferedAmount||0,data=>this.send(conn,data));}
 acknowledgeSnapshot(conn,data){
  if(data.delivery===undefined)return; // Bare local messages have no receipt envelope; sendSnapshot always adds one.
  if(!Number.isSafeInteger(data.delivery)||data.delivery<1)throw Error('Invalid snapshot delivery.');
  this.send(conn,{type:'arcade-ack',epoch:this.epoch,kind:data.type,delivery:data.delivery,frames:this.progressFrames});
 }
 clearSnapshots(){for(const conn of this.isHost?this.connections.values():[this.server])if(conn)conn.snapshotFlow=null;}
 broadcast(data){for(const member of this.members){if(member.id===this.id)continue;const conn=this.connections.get(member.id);if(!conn)continue;try{this.send(conn,data);}catch(e){queueMicrotask(()=>{this.detach(conn,true,e.message);try{conn.close();}catch{}});}}}
 signalingLost(){this.recordConnectionEvent('signaling-disconnected');this.signaling=false;if(!this.signalRetryAt)this.signalRetryAt=performance.now()+retryDelay(this.signalAttempt++);this.changed();}
 connectHost(){
  if(!this.peer||this.peer.destroyed||this.peer.disconnected||this.server)return;
  try{const conn=this.peer.connect(this.host,{reliable:true,serialization:'binary',metadata:{build:BUILD_ID,token:this.secret,name:this.name,session:this.sessionKey}});this.server=conn;this.attach(conn,false);}
  catch(e){if(this.phase==='connecting')throw e;this.retryAt=performance.now()+retryDelay(this.retryAttempt++);}
 }
 failRoom(reason){this.reconnectUntil=0;this.commands.clear();this.phase='error';this.error=reason;this.members=[];this.changed();}
 syncConnection(conn){
  const admitted=this.members.some(m=>m.id===conn.peer);
  this.send(conn,{type:'room-sync',diagnostics:this.diagnosticsPolicy(),sequence:++this.lobbySequence,revision:this.revision,admitted,members:admitted?this.members:[],settings:this.settings,chat:admitted?this.chat:[],reason:this.error});
 }
 command(type,fields){if(this.commands.size>=32)throw Error('Waiting for the host to confirm pending actions.');const data={type,...fields,command:++this.commandSequence};this.commands.set(data.command,{data,at:performance.now()});try{this.send(this.server,data);}catch{if(this.server)this.detach(this.server,false);}this.changed();}
 acknowledge(conn,data,accepted,reason=''){
  if(!Number.isSafeInteger(data.command)||data.command<1)return;
  const session=this.sessions.get(conn.peer),ack={type:'command-ack',command:data.command,action:data.type,accepted,reason};
  if(session){session.lastCommand=Math.max(session.lastCommand||0,data.command);session.commands.set(data.command,ack);if(session.commands.size>64)session.commands.delete(session.commands.keys().next().value);}
  this.send(conn,ack);
 }
 async openPeer(){
  if(typeof globalThis.Peer!=='function')throw Error('PeerJS could not load. Reload the page.');
  const generation=this.generation;
  const peer=this.peer=new Peer(`dt-${token()}`,{debug:0,config:{iceServers:globalThis.DAYTONA_ICE_SERVERS||[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]}});
  peer.on('connection',conn=>{if(this.isHost&&generation===this.generation)this.attach(conn,true);else conn.close();});
  peer.on('disconnected',()=>{if(generation===this.generation)this.signalingLost();});
  let opened=false;
  await new Promise((resolve,reject)=>{
   const expiry=setTimeout(()=>reject(Error('PeerJS signaling did not respond. Check your connection and try again.')),OPEN_TIMEOUT_MS);
   peer.on('open',id=>{if(generation!==this.generation)return;clearTimeout(expiry);opened=true;this.id=id;this.signaling=true;this.signalRetryAt=0;this.signalAttempt=0;this.changed();resolve();});
   peer.on('error',err=>{
    if(generation!==this.generation)return;
    const errorType=/^[a-z0-9-]{1,40}$/i.test(err?.type||'')?err.type:'unknown';this.recordConnectionEvent('peer-error:'+errorType);
    if(['network','socket-error','socket-closed','disconnected'].includes(err.type)&&!peer.destroyed){this.signalingLost();return;}
    if(opened&&err.type==='peer-unavailable'&&!this.isHost&&this.phase==='reconnecting'){if(this.server){const conn=this.server;this.detach(conn,false);try{conn.close();}catch{}}return;}
    const e=Error(err.type==='peer-unavailable'?'Room unavailable. Ask the host for a new invitation.':`Connection failed (${err.type||'network'}). Some networks need a TURN relay.`);
    if(!opened){clearTimeout(expiry);reject(e);return;}
    if(this.active||this.phase==='preparing')this.end(e.message,this.id,'local-runtime-error');
    if(peer.destroyed){this.signaling=false;this.pending.clear();this.sessions.clear();this.failRoom(e.message);}else{this.error=e.message;this.changed();}
   });
  });
  this.timer=setInterval(()=>this.heartbeat(),1000);
 }
 async create(name){this.leave();this.isHost=true;this.name=cleanName(name);this.phase='connecting';this.changed();try{await this.openPeer();this.host=this.id;this.secret=token();this.members=[{id:this.id,name:this.name,ready:false,cabinet:1,rtt:null}];this.phase='lobby';this.changed();}catch(e){this.leave();this.phase='error';this.error=e.message;this.changed();}}
 async join(code,name){
  const invite=parseInvitation(code);this.leave();this.name=cleanName(name);this.sessionKey=token();this.host=invite.host;this.secret=invite.token;this.phase='connecting';this.changed();
  try{await this.openPeer();this.connectHost();}catch(e){this.leave();this.phase='error';this.error=e.message;this.changed();}
 }
 attach(conn,incoming){
  const generation=this.generation;let accepted=false;conn.consoleCounters={tx:0,rx:0};conn.lastSeen=performance.now();conn.openingUntil=conn.lastSeen+OPEN_TIMEOUT_MS;conn.wasOpened=false;
  const expiry=setTimeout(()=>{if(generation!==this.generation||accepted)return;this.recordConnectionEvent('opening-timeout',conn);if(!incoming&&this.server===conn)this.detach(conn,false,'The data channel did not open within 30 seconds.');try{conn.close();}catch{}},OPEN_TIMEOUT_MS);
  conn.on('open',()=>{
   if(generation!==this.generation||(!incoming&&this.server!==conn)){conn.close();return;}
   const channel=conn.dataChannel;if(!channel?.ordered||channel.maxRetransmits!=null||channel.maxPacketLifeTime!=null){if(!incoming)this.failRoom('Incompatible data channel.');conn.close();return;}
   conn.lastSeen=performance.now();conn.wasOpened=true;conn.openingUntil=0;this.recordConnectionEvent('channel-open',conn);
   if(incoming){
    const meta=conn.metadata,session=this.sessions.get(conn.peer),returning=!!session;
    const valid=meta?.build===BUILD_ID&&meta?.token===this.secret&&/^[a-f0-9]{32}$/.test(meta?.session||'');
    if(!valid||this.phase!=='lobby'||(returning?(session.key!==meta.session||(session.until&&performance.now()>session.until)):this.members.length+this.pending.size>=8)){
     this.send(conn,{type:'reject',reason:this.phase!=='lobby'?'The arcade is already running. Join after it returns to the room.':'Invalid invitation, expired session, incompatible version or room full.'});setTimeout(()=>conn.close(),200);return;
    }
    const previous=this.connections.get(conn.peer);this.connections.set(conn.peer,conn);
    if(returning){session.until=0;const member=this.members.find(m=>m.id===conn.peer),pending=this.pending.get(conn.peer);if(member){member.connection='connected';member.ready=false;this.revision++;if(!this.members.some(m=>m.connection==='reconnecting'))this.error='';}if(pending)pending.connection='connected';}
    else{this.sessions.set(conn.peer,{key:meta.session,until:0,commands:new Map()});this.pending.set(conn.peer,{id:conn.peer,name:cleanName(meta.name),connection:'connected'});}
    accepted=true;clearTimeout(expiry);if(returning)this.recordConnectionEvent('player-reconnected',conn);this.observeTransport(conn,incoming,generation);this.syncConnection(conn);this.publish();if(previous&&previous!==conn)previous.close();
   }else{accepted=true;clearTimeout(expiry);this.observeTransport(conn,incoming,generation);if(this.phase!=='reconnecting'){this.phase='pending';this.changed();}}
  });
  conn.on('data',data=>{if(generation!==this.generation||(incoming?this.connections.get(conn.peer)!==conn:this.server!==conn))return;conn.lastSeen=performance.now();if(['arcade-sample','arcade-state'].includes(data?.type)&&data.bytes instanceof ArrayBuffer){this.payloadReceived+=data.bytes.byteLength;recordPacket(this.receivedTiming,this.performanceCaptureEnabled);conn.consoleCounters.rx+=data.bytes.byteLength;}try{this.handle(conn,data,incoming);}catch(e){this.recordConnectionEvent('data-handler-error',conn);if(this.isHost){this.detach(conn,true,e.message,false);conn.close();}else{if(this.active||this.phase==='preparing')this.end(e.message,this.id,'data-handler-error');this.detach(conn,false,e.message,false);conn.close();}}});
  conn.on('close',()=>{clearTimeout(expiry);if(generation===this.generation&&(incoming?this.connections.get(conn.peer)===conn:this.server===conn)){this.recordConnectionEvent('channel-close',conn);this.detach(conn,incoming,'The data channel closed.');}});
  conn.on('error',err=>{clearTimeout(expiry);if(generation===this.generation&&(incoming?this.connections.get(conn.peer)===conn:this.server===conn)){const type=/^[a-z0-9-]{1,40}$/i.test(err?.type||'')?err.type:'transport';this.recordConnectionEvent('channel-error:'+type,conn);this.detach(conn,incoming,`Data channel error (${type}).`);}try{conn.close();}catch{}});
 }
 observeTransport(conn,incoming,generation){
  const pc=conn.peerConnection;if(!pc?.addEventListener)return;
  const observe=()=>{if(generation!==this.generation||(incoming?this.connections.get(conn.peer)!==conn:this.server!==conn))return;
   const state=pc.connectionState;if(state===conn.consoleTransportState)return;conn.consoleTransportState=state;
   if(['connected','disconnected','failed'].includes(state))this.recordConnectionEvent('rtc-'+state,conn);
  };pc.addEventListener('connectionstatechange',observe);observe();
  conn.on('close',()=>pc.removeEventListener?.('connectionstatechange',observe));
 }
 forget(id,reason,cause='transport-interruption',source='observed'){
  const member=this.members.find(m=>m.id===id);this.sessions.delete(id);this.pending.delete(id);this.chatRate.delete(id);this.members=this.members.filter(m=>m.id!==id);this.renumber();this.trimConsoleRecords();
  if(member){this.revision++;for(const m of this.members)m.ready=false;if(this.active||this.phase==='preparing')this.end(reason+' The arcade link must restart.',member,cause,source);else this.error=`${member.name} left the room. ${reason}`;}
  this.publish();
 }
 detach(conn,incoming,reason='The cabinet disconnected.',recover=true,cause='transport-interruption',source='observed'){
  if(incoming){
   if(this.connections.get(conn.peer)!==conn)return;this.retainConnection(conn);this.connections.delete(conn.peer);
   const member=this.members.find(m=>m.id===conn.peer),pending=this.pending.get(conn.peer),session=this.sessions.get(conn.peer);
   if(recover&&session&&(member||pending)){
    session.until=performance.now()+RECONNECT_GRACE_MS;
    if(member){if(this.active||this.phase==='preparing')this.end(reason+' Reconnect in the lobby to start again.',member,cause,source);member.connection='reconnecting';this.revision++;for(const m of this.members)m.ready=false;this.error=`${member.name} is reconnecting. ${reason} Their seat is reserved for 30 seconds.`;}
    if(pending)pending.connection='reconnecting';this.publish();
   }else this.forget(conn.peer,reason,cause,source);
  }else{
   if(this.server!==conn)return;this.server=null;
   const host=this.members.find(m=>m.id===this.host),message=host?`Session interrupted by ${host.name} (cabinet ${host.cabinet}). ${reason}`:reason;
   if(!recover||this.phase==='error'){this.reconnectUntil=0;this.commands.clear();this.awaitingStop=false;this.failRoom(message);return;}
   if(this.active||this.phase==='preparing')this.stopLocal(message+' Reconnecting in the lobby.');
   this.awaitingStop=false;if(!this.reconnectUntil){this.reconnectUntil=performance.now()+RECONNECT_GRACE_MS;this.retryAttempt=0;}
   this.retryAt=performance.now()+retryDelay(this.retryAttempt++);this.phase='reconnecting';this.error=`Connection interrupted. ${reason} Reconnecting automatically…`;for(const m of this.members){m.ready=false;if(m.id===this.id)m.connection='reconnecting';}this.changed();
  }
 }
 renumber(){this.members.forEach((x,i)=>x.cabinet=i+1);}
 publish(){if(this.isHost&&this.phase!=='idle'){this.broadcast({type:'roster',diagnostics:this.diagnosticsPolicy(),sequence:++this.lobbySequence,members:this.members,settings:this.settings,revision:this.revision,phase:this.phase});}this.changed();}
 approve(id){if(!this.isHost||this.phase!=='lobby'||!this.pending.has(id)||!this.connections.get(id)?.open||this.members.length>=8)return;const member=this.pending.get(id);this.pending.delete(id);this.members.push({...member,ready:false,cabinet:this.members.length+1,rtt:null});this.recordConnectionEvent('player-admitted',this.connections.get(id),{source:'action'});this.revision++;for(const m of this.members)m.ready=false;const conn=this.connections.get(id);this.syncConnection(conn);this.publish();}
 kick(id){
  if(!this.isHost||this.phase!=='lobby'||id===this.id||!this.members.some(m=>m.id===id))return false;
  const conn=this.connections.get(id);this.recordConnectionEvent('host-removed-player',conn,{source:'action'});if(conn)this.retainConnection(conn);
  if(conn?.open)this.send(conn,{type:'removed',reason:'The host removed you from this room.'});
  this.connections.delete(id);this.sessions.delete(id);this.pending.delete(id);this.members=this.members.filter(m=>m.id!==id);
  this.renumber();this.trimConsoleRecords();this.revision++;for(const m of this.members)m.ready=false;this.publish();
  if(conn)setTimeout(()=>conn.close(),200);
  return true;
 }
 submitChat(value){
  if(this.phase!=='lobby'||!this.members.some(m=>m.id===this.id))throw Error('Chat is available to admitted players in the lobby.');
  const text=chatText(value);if(!text)return false;
  if(text.length>CHAT_LIMIT)throw Error(`Keep your message under ${CHAT_LIMIT} characters.`);
  const now=performance.now();if(now-this.lastChatSent<CHAT_INTERVAL_MS)throw Error('Wait a moment before sending another message.');
  this.lastChatSent=now;
  if(this.isHost)this.acceptChat(this.id,text);else this.command('chat-submit',{text});
  return true;
 }
 acceptChat(id,value){
  const member=this.members.find(m=>m.id===id),text=chatText(value),now=performance.now();
  if(!this.isHost||this.phase!=='lobby'||!member||!text||text.length>CHAT_LIMIT||now-(this.chatRate.get(id)??-Infinity)<CHAT_INTERVAL_MS)return false;
  this.chatRate.set(id,now);
  const message={seq:++this.chatSequence,sender:id,name:member.name,text,time:Date.now()};
  this.chat.push(message);if(this.chat.length>CHAT_HISTORY_LIMIT)this.chat.shift();
  this.broadcast({type:'chat-message',message});this.changed();return true;
 }
 validateChatMessage(m){
  if(!m||!Number.isSafeInteger(m.seq)||m.seq<1||typeof m.sender!=='string'||m.sender.length>100||typeof m.name!=='string'||m.name.length>24||typeof m.text!=='string'||!m.text.length||m.text.length>CHAT_LIMIT||!Number.isFinite(m.time)||m.time<0||m.time>8640000000000000)return null;
  return {seq:m.seq,sender:m.sender,name:cleanName(m.name),text:m.text,time:m.time};
 }
 reject(id,reason='The host declined this request.'){const conn=this.connections.get(id);if(conn){this.recordConnectionEvent('request-declined',conn,{source:'action'});this.retainConnection(conn);}if(conn?.open){this.send(conn,{type:'reject',reason});setTimeout(()=>conn.close(),200);}this.connections.delete(id);this.sessions.delete(id);this.pending.delete(id);this.trimConsoleRecords();this.changed();}
 setSettings(value){if(!this.isHost||this.phase!=='lobby')return;this.settings=validateSettings(value);this.revision++;for(const x of this.members)x.ready=false;this.publish();}
 ready(value){if(this.phase!=='lobby'||this.awaitingStop||(value&&!this.isVisible())||this.snapshot().readyPending)return;if(this.isHost){this.members[0].ready=!!value;this.publish();}else this.command('ready',{value:!!value,revision:this.revision});}
 async start(){
  if(!this.isVisible()||!this.isHost||this.phase!=='lobby'||this.members.length<2||this.pending.size||this.members.some(x=>!x.ready||x.connection==='reconnecting'))return;
  this.phase='preparing';this.progressFrames=0;this.epoch=token();this.prepared.clear();this.prepareDeadline=performance.now()+60000;this.error='';
  const data={type:'prepare',diagnostics:this.diagnosticsPolicy(),epoch:this.epoch,members:this.members,settings:this.settings,revision:this.revision};this.broadcast(data);this.changed();await this.prepare(data);
 }
 async prepare(data){
  this.settings=validateSettings(data.settings);if(!this.isHost)this.applyDiagnosticsPolicy(data.diagnostics);if(!/^[a-f0-9]{32}$/.test(data.epoch))throw Error('Invalid race session.');
  this.members=this.validateMembers(data.members);this.epoch=data.epoch;this.progressFrames=0;this.phase='preparing';this.changed();if(!this.isVisible()){this.end(INACTIVE_REASON,this.id,'visibility-interruption');return;}const generation=this.generation,epoch=this.epoch;
  const me=this.members.find(x=>x.id===this.id);if(!me)throw Error('This cabinet is not in the race.');
  try{await this.onPrepare({...this.settings,master:this.id===this.host,cabinet:me.cabinet},()=>generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing');
   if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;
   if(this.isHost){this.prepared.add(this.id);this.tryGo();}else this.send(this.server,{type:'prepared',epoch:this.epoch,revision:this.revision});
  }catch(e){if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;if(this.isHost)this.end(e.message,this.id,'prepare-failed');else this.send(this.server,{type:'prepare-failed',epoch:this.epoch,reason:e.message});}
 }
 tryGo(){if(this.phase==='preparing'&&this.members.every(x=>this.prepared.has(x.id))){this.broadcast({type:'go',epoch:this.epoch});this.go();}}
 go(){
  if(!this.isVisible()){this.end(INACTIVE_REASON,this.id,'visibility-interruption');return;}
  const now=performance.now();this.progressFrames=0;this.progressAt=now;
  for(const conn of this.isHost?this.connections.values():[this.server])if(conn){conn.lastStateAt=null;conn.emulation={epoch:this.epoch,frames:0,at:now};conn.snapshotFlow=new SnapshotFlow(this.epoch,conn.measuredRttMs);}
  if(this.isHost)this.performanceHistory.beginRace(this.epoch,this.members);
  this.distributor=this.isHost?new HostDistributor(this.members):null;this.stateSequence=0;this.phase='playing';this.onStart();this.changed();
 }
 advance(){if(this.active){this.progressFrames++;this.progressAt=performance.now();}}
 visibilityChanged(){if(!this.isVisible()&&(this.active||this.phase==='preparing')){this.recordConnectionEvent('visibility-interruption');this.end(INACTIVE_REASON,this.id,'visibility-interruption');}}
 checkProgress(now=performance.now()){
  if(!this.active)return;
  const connections=this.isHost?[...this.connections.values()]:[this.server];
  if(now-this.progressAt>PROGRESS_TIMEOUT_MS){this.recordConnectionEvent('local-progress-timeout');this.end(INACTIVE_REASON,this.id,'local-progress-timeout');return;}
  const stalled=connections.find(c=>c?.emulation?.epoch===this.epoch&&now-c.emulation.at>PROGRESS_TIMEOUT_MS);
  if(stalled){
   const member=this.members.find(m=>m.id===stalled.peer);
   const label=member?`${cleanName(member.name)} (cabinet ${member.cabinet})`:'the remote cabinet';
   this.recordConnectionEvent('remote-progress-timeout',stalled);this.end(`No emulation progress from ${label}. Return to the room and start again.`,stalled.peer,'remote-progress-timeout');
  }
 }

 validateMembers(members){if(!Array.isArray(members)||members.length<1||members.length>8||new Set(members.map(x=>x.id)).size!==members.length||members[0].id!==this.host||members.some((x,i)=>typeof x.id!=='string'||x.cabinet!==i+1))throw Error('Invalid cabinet roster.');return members.map(x=>({id:x.id,name:cleanName(x.name),cabinet:x.cabinet,ready:!!x.ready,rtt:!this.isHost&&x.id===this.host&&this.server?.open&&Number.isFinite(this.server.measuredRttMs)?Math.round(this.server.measuredRttMs):Number.isFinite(x.rtt)?x.rtt:null,connection:x.connection==='reconnecting'?'reconnecting':'connected'}));}
 handle(conn,data,incoming){
  if(!data||typeof data.type!=='string')throw Error('Invalid room message.');
  if(this.active&&data.epoch===this.epoch&&Number.isSafeInteger(data.frames)&&data.frames>=0){
   const previous=conn.emulation;
   if(!previous||previous.epoch!==this.epoch||data.frames>previous.frames)conn.emulation={epoch:this.epoch,frames:data.frames,at:performance.now()};
  }
  if(data.type==='ping'){this.receiveHealth(conn,data);const performanceAck=this.receivePerformance(conn,data);this.send(conn,{type:'pong',time:data.time,epoch:this.epoch,frames:this.active?this.progressFrames:0,...(this.isHost?{performanceAck}:{})});return;}
  if(data.type==='pong'){if(!this.isHost&&this.server===conn&&Number.isSafeInteger(data.performanceAck)&&data.performanceAck>this.performanceAck&&data.performanceAck<=this.performanceOffered)this.performanceAck=data.performanceAck;if(Number.isFinite(data.time)){const member=this.members.find(x=>x.id===conn.peer);conn.measuredRttMs=Math.max(0,performance.now()-data.time);if(member)member.rtt=Math.round(conn.measuredRttMs);}return;}
  if(data.type==='arcade-ack'){
   if(!this.active||data.epoch!==this.epoch||!conn.snapshotFlow||conn.snapshotFlow.epoch!==this.epoch)return;
   if(incoming?this.connections.get(conn.peer)!==conn:this.server!==conn)return;
   if(data.kind!==(this.isHost?'arcade-state':'arcade-sample'))throw Error('Invalid snapshot acknowledgment kind.');
   if(conn.snapshotFlow.acknowledge(data.delivery))this.flushSnapshot(conn);return;
  }
  if(incoming){
   if(this.connections.get(conn.peer)!==conn)return;
   if(data.type==='leave'){this.receivePerformance(conn,data);this.recordConnectionEvent('player-left',conn,{source:'action'});this.detach(conn,true,'The player left the room.',false,'player-left','action');conn.close();return;}
   const member=this.members.find(x=>x.id===conn.peer);if(!member)return;
   if(['ready','chat-submit'].includes(data.type)){
    const session=this.sessions.get(conn.peer),saved=session?.commands.get(data.command);if(saved){this.send(conn,saved);return;}
    if(data.command!==undefined&&(!Number.isSafeInteger(data.command)||data.command<1))throw Error('Invalid lobby action.');
    if(data.command!==undefined&&data.command<=(session?.lastCommand||0)){this.acknowledge(conn,data,false,'This action has expired.');return;}
    if(data.type==='ready'){const valid=this.phase==='lobby'&&data.revision===this.revision; if(valid){member.ready=!!data.value;this.publish();}this.acknowledge(conn,data,valid,valid?'':'Room settings changed. Please confirm Ready again.');if(!valid&&this.phase==='lobby')this.syncConnection(conn);}
    else{const valid=this.acceptChat(conn.peer,data.text);this.acknowledge(conn,data,valid,valid?'':'Message could not be sent. Try again in the lobby.');}
   }
   else if(data.type==='prepared'&&this.phase==='preparing'&&data.epoch===this.epoch&&data.revision===this.revision){this.prepared.add(conn.peer);this.tryGo();}
   else if(data.type==='prepare-failed'&&this.phase==='preparing'&&data.epoch===this.epoch)this.end('The cabinet could not prepare: '+String(data.reason).slice(0,160),conn.peer,'prepare-failed','reported');
   else if(data.type==='stop'&&(this.active||this.phase==='preparing')&&data.epoch===this.epoch){
    // The connection identifies the requester; clients cannot name another cabinet.
    this.receiveHealth(conn,data);this.receivePerformance(conn,data);this.end(String(data.reason||'The cabinet stopped.').slice(0,180),conn.peer,STOP_CAUSES.includes(data.cause)?data.cause:'requested-stop','reported');
   }
   else if(data.type==='arcade-sample'&&this.active&&data.epoch===this.epoch){if(this.distributor.accept(conn.peer,data.frames,data.bytes))conn.lastStateAt=performance.now();this.acknowledgeSnapshot(conn,data);}
  }else{
   if(this.server!==conn)return;
   if(data.type==='diagnostics-policy'){if(this.applyDiagnosticsPolicy(data.diagnostics))this.changed();return;}
   if(data.type==='command-ack'){
    if(this.commands.delete(data.command)){this.lastAck={...data};this.changed();}return;
   }
   if(data.type==='room-sync'){
    if(!Number.isSafeInteger(data.sequence)||data.sequence<=this.lastLobbySequence)return;
    const settings=validateSettings(data.settings),members=data.admitted?this.validateMembers(data.members):[];
    if(data.admitted&&!members.some(m=>m.id===this.id))throw Error('Missing session identity.');
    const chat=Array.isArray(data.chat)?data.chat.slice(-CHAT_HISTORY_LIMIT).map(m=>this.validateChatMessage(m)).filter(Boolean):[];
    this.applyDiagnosticsPolicy(data.diagnostics);this.lastLobbySequence=data.sequence;this.revision=data.revision;this.settings=settings;this.members=members;this.chat=data.admitted?chat:[];
    this.reconnectUntil=0;this.retryAt=0;this.retryAttempt=0;this.awaitingStop=false;this.phase=data.admitted?'lobby':'pending';this.error=String(data.reason||'').slice(0,280);
    for(const [id,command] of this.commands){if(command.data.type==='ready')this.commands.delete(id);else command.at=-Infinity;}this.changed();return;
   }
   if(data.type==='pending'){this.phase='pending';this.changed();}
   else if(data.type==='room-closed'){this.detach(conn,false,'The host closed the room.',false);conn.close();}
   else if(data.type==='reject'){this.detach(conn,false,String(data.reason).slice(0,180),false);conn.close();}
   else if(data.type==='welcome'){this.phase='lobby';this.error='';this.changed();}
   else if(data.type==='removed'){this.leave();this.phase='error';this.error='The host removed you from this room.';this.changed();}
   else if(data.type==='chat-history'&&this.phase==='lobby'&&Array.isArray(data.messages)){
    const messages=data.messages.slice(-CHAT_HISTORY_LIMIT).map(m=>this.validateChatMessage(m)).filter(Boolean);
    this.chat=messages.filter((m,i)=>i===0||m.seq>messages[i-1].seq);this.changed();
   }
   else if(data.type==='chat-message'&&['lobby','playing','preparing'].includes(this.phase)){
    const message=this.validateChatMessage(data.message);
    if(message&&message.seq>(this.chat.at(-1)?.seq??0)){this.chat.push(message);if(this.chat.length>CHAT_HISTORY_LIMIT)this.chat.shift();this.changed();}
   }
   else if(data.type==='roster'){if(!Number.isSafeInteger(data.sequence)||data.sequence<=this.lastLobbySequence)return;this.applyDiagnosticsPolicy(data.diagnostics);this.lastLobbySequence=data.sequence;if(this.awaitingStop&&data.phase==='lobby')this.awaitingStop=false;this.members=this.validateMembers(data.members);this.settings=validateSettings(data.settings);this.revision=data.revision;this.changed();}
   else if(data.type==='prepare'&&this.phase==='lobby'){this.revision=data.revision;void this.prepare(data).catch(e=>this.end(e.message,this.id,'prepare-failed'));}
   else if(data.type==='go'&&this.phase==='preparing'&&data.epoch===this.epoch)this.go();
   else if(data.type==='stop'&&(data.epoch===this.epoch||(this.awaitingStop&&data.epoch===this.endedEpoch)))this.stopLocal(String(data.reason||'The arcade link stopped.').slice(0,280));
   else if(data.type==='arcade-state'&&this.active&&data.epoch===this.epoch){
    if(data.encoding!==undefined&&data.encoding!=='cabinet-slots')throw Error('Invalid state encoding.');
    const bytes=data.encoding==='cabinet-slots'?expandState(data.bytes,this.members.length):data.bytes;
    if(!Number.isSafeInteger(data.sequence)||data.sequence<1||!(bytes instanceof ArrayBuffer)||bytes.byteLength!==STATE_BYTES||new Uint8Array(bytes)[0]!==STATE_TAG)throw Error('Invalid centralized state.');
    if(data.sequence>this.stateSequence){this.stateSequence=data.sequence;this.receiveBytes(bytes);}this.acknowledgeSnapshot(conn,data);
   }
  }
 }
 receiveBytes(bytes){if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>4096)throw Error('Invalid arcade packet.');this.onBytes(new Uint8Array(bytes));}
 write(bytes){
  if(!this.active)return;
  const data={type:'arcade-sample',epoch:this.epoch,frames:this.progressFrames,bytes:bytes.slice().buffer};
  try{
   if(!this.isHost){this.sendSnapshot(this.server,data);return;}
   if(!this.distributor.accept(this.id,data.frames,data.bytes)||!this.distributor.ready)return;
   const sequence=++this.distributor.sequence;
   for(const member of this.members){
    const state=this.distributor.snapshot(member.id);
    if(member.id===this.id)this.receiveBytes(state);
    else this.sendSnapshot(this.connections.get(member.id),{type:'arcade-state',epoch:this.epoch,frames:this.progressFrames,sequence,encoding:'cabinet-slots',bytes:compactState(state,this.members.length)});
   }
  }catch(e){this.end(e.message,e.linkPeer||this.id,e.linkCause||'receive-error');}
 }
 stopLocal(reason){const hadSession=this.active||this.phase==='preparing';this.clearSnapshots();if(this.epoch)this.endedEpoch=this.epoch;this.distributor=null;this.stateSequence=0;this.awaitingStop=false;this.epoch='';this.phase='lobby';this.error=reason;for(const x of this.members)x.ready=false;if(hadSession)this.onStop(reason);this.changed();}
 end(reason='The arcade session ended.',cabinet=this.id,cause='requested-stop',source='observed'){
  cause=STOP_CAUSES.includes(cause)?cause:'requested-stop';
  const member=typeof cabinet==='string'?this.members.find(m=>m.id===cabinet):cabinet;
  const detail=String(reason).slice(0,180);this.recordConnectionEvent('session-stop',typeof cabinet==='string'?this.connections.get(cabinet):null,{member,source,cause,reason:detail});
  const message=member?`Session interrupted by ${cleanName(member.name)} (cabinet ${member.cabinet}). ${detail}`:detail;
  if(this.isHost){try{this.broadcast({type:'stop',epoch:this.epoch,reason:message});}catch{}this.stopLocal(message);this.publish();}
  else{const hadSession=!!this.epoch;try{if(hadSession)this.send(this.server,{type:'stop',epoch:this.epoch,reason:detail,cause,health:this.makeHealth(),performance:this.makePerformance()});}catch{}this.stopLocal(message);this.awaitingStop=hadSession;this.changed();}
 }
 heartbeat(now=performance.now()){
  const health=this.makeHealth(now),performanceData=this.makePerformance();
  if(!this.signaling&&this.peer&&!this.peer.destroyed&&now>=this.signalRetryAt){this.signalRetryAt=now+retryDelay(this.signalAttempt++);if(this.peer.disconnected)try{this.peer.reconnect();}catch{}}
  if(this.phase==='reconnecting'){
   if(this.peer?.destroyed||now>this.reconnectUntil){const conn=this.server;this.server=null;this.failRoom('Could not reconnect. Return to room selection and try again.');try{conn?.close();}catch{}return;}
   if(!this.server&&now>=this.retryAt)this.connectHost();
  }
  if(this.isHost){for(const [id,session] of this.sessions)if(session.until&&now>session.until){const m=this.members.find(m=>m.id===id)||this.pending.get(id);this.recordConnectionEvent('recovery-expired',null,{member:m});this.forget(id,'The reconnection window expired.');}}
  if(this.phase==='lobby'&&!this.isHost&&this.server?.open)for(const command of this.commands.values())if(now-command.at>=2000){command.at=now;try{this.send(this.server,command.data);}catch{this.detach(this.server,false);break;}}
  this.checkProgress(now);if(this.isHost&&this.phase==='preparing'&&now>this.prepareDeadline){this.recordConnectionEvent('preparation-timeout');this.end('Cabinet preparation timed out.',this.id,'preparation-timeout');return;}
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  if(this.active){const stalled=connections.find(conn=>conn?.snapshotFlow?.ackProgressAgeMs(now)>PROGRESS_TIMEOUT_MS);if(stalled){this.recordConnectionEvent('snapshot-ack-timeout',stalled);this.end('No arcade snapshot acknowledgment progress for 10 seconds. Return to the room and start again.',stalled.peer,'snapshot-ack-timeout');return;}}
  for(const conn of connections){
   if(!conn.open){if(!conn.wasOpened&&conn.openingUntil>now)continue;const opening=!!conn.openingUntil&&!conn.wasOpened;this.recordConnectionEvent(opening?'opening-timeout':'channel-not-open',conn);this.detach(conn,this.isHost,opening?'The data channel did not open within 30 seconds.':'The connection closed.');try{conn.close();}catch{}continue;}
   if(now-conn.lastSeen>CONNECTION_TIMEOUT_MS){this.recordConnectionEvent('silence-timeout',conn);this.detach(conn,this.isHost,'No response for 20 seconds.');try{conn.close();}catch{}continue;}
   try{this.flushSnapshot(conn);const share=!this.isHost&&performanceData&&(conn.dataChannel?.bufferedAmount||0)<16*1024?performanceData:null;this.send(conn,{type:'ping',time:now,epoch:this.epoch,frames:this.active?this.progressFrames:0,...(!this.isHost?{health,...(share?{performance:share}:{})}:{})});if(share)this.performanceOffered=Math.max(this.performanceOffered,share.samples.at(-1).sequence);}catch(e){this.detach(conn,this.isHost,e.message);try{conn.close();}catch{}}
  }
  if(this.isHost&&['lobby','playing'].includes(this.phase))this.publish();else this.changed();
 }
 diagnostics(){
  const connections=(this.isHost?[...this.connections.values()]:[this.server]).filter(c=>c?.open);
  const rtts=connections.map(c=>this.networkStats.get(c)?.rttMs??c.measuredRttMs).filter(Number.isFinite);
  return {topology:'central',central:this.distributor?{samples:this.distributor.samples.size,sequence:this.distributor.sequence,discarded:this.distributor.discarded,agesMs:this.members.map(m=>({cabinet:m.cabinet,ageMs:this.distributor.samples.has(m.id)?performance.now()-this.distributor.samples.get(m.id).at:null}))}:null,connections:connections.length,rttMs:rtts.length?Math.max(...rtts):null,
   bufferedBytes:connections.reduce((sum,c)=>sum+(c.dataChannel?.bufferedAmount||0),0),
   payloadSentBytes:this.payloadSent,payloadReceivedBytes:this.payloadReceived,
   sent:timingSummary(this.sentTiming),received:timingSummary(this.receivedTiming),
   snapshotFlow:connections.map(c=>({cabinet:this.members.find(m=>m.id===c.peer)?.cabinet??null,...(c.snapshotFlow?.snapshot()||{inFlight:0,pending:0,pendingBytes:0,coalesced:0,ackRttMs:null})})),
   relayConnections:connections.filter(c=>this.networkStats.get(c)?.relay).length,connectionEvents:this.connectionEvents.map(e=>({...e}))};
 }
 async pollDiagnostics(){
  if(!this.performanceCaptureEnabled)return;
  const generation=this.generation;
  const connections=(this.isHost?[...this.connections.values()]:[this.server]).filter(c=>c?.open);
  const next=new Map();
  await Promise.all(connections.map(async conn=>{
   try{if(!conn.peerConnection?.getStats)return;const stats=await conn.peerConnection.getStats();
    let pair;for(const value of stats.values())if(value.type==='transport'&&value.selectedCandidatePairId)pair=stats.get(value.selectedCandidatePairId);
    if(!pair)for(const value of stats.values())if(value.type==='candidate-pair'&&value.nominated&&value.state==='succeeded')pair=value;
    if(pair){const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
     next.set(conn,{at:performance.now(),rttMs:Number.isFinite(pair.currentRoundTripTime)?pair.currentRoundTripTime*1000:null,relay:local?.candidateType==='relay'||remote?.candidateType==='relay'});
    }
   }catch{} // Stats are optional; never interrupt the arcade link.
  }));
  if(this.performanceCaptureEnabled&&generation===this.generation)this.networkStats=new Map([...next].filter(([c])=>c.open&&(this.isHost?this.connections.get(c.peer)===c:this.server===c)));
 }
 leave(){
  const hadSession=this.active||this.phase==='preparing';
  if(this.isHost&&this.members.length){this.recordConnectionEvent('room-closed',null,{source:'action'});this.lastHostReport={...this.consoleSnapshot(),live:false,phase:'closed'};this.lastHostReport.rows=this.lastHostReport.rows.map(r=>({...r,archived:true}));this.lastHostPerformance=this.performanceHistory.report(this.performanceIdentities());}
  // Best effort: peer closure or the presence timeout still cleans up if this message is lost.
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  for(const conn of connections)try{this.send(conn,{type:this.isHost?'room-closed':'leave',...(!this.isHost?{performance:this.makePerformance()}:{})});}catch{}
  const peer=this.peer;this.generation++;clearInterval(this.timer);if(peer)setTimeout(()=>peer.destroy(),200);if(hadSession)this.onStop('You left the room.');this.reset();this.changed();
 }
}
