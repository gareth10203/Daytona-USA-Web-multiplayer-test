import {HostDistributor,STATE_BYTES,STATE_TAG} from './central-link.js';
import {BUILD_ID,validateSettings,invitation,parseInvitation} from './room-settings.js';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const cleanName=value=>String(value||'Driver').trim().slice(0,24)||'Driver';
export const CHAT_LIMIT=240,CHAT_HISTORY_LIMIT=60,CHAT_INTERVAL_MS=900;
const chatText=value=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():'';
const MAX_BUFFER=1024*1024;
function packetTiming(){return {count:0,last:null,intervals:[]};}
function recordPacket(timing){const now=performance.now();timing.count++;if(timing.last!==null){timing.intervals.push(now-timing.last);if(timing.intervals.length>256)timing.intervals.shift();}timing.last=now;}
function timingSummary(timing){const values=[...timing.intervals].sort((a,b)=>a-b);return {packets:timing.count,intervalP95Ms:values.length?values[Math.floor((values.length-1)*.95)]:null,intervalMaxMs:values.length?values.at(-1):null};}
export const PROGRESS_TIMEOUT_MS=5000;
export const CONNECTION_TIMEOUT_MS=12000;
export const RECONNECT_GRACE_MS=30000;
const retryDelay=attempt=>Math.min(1000*2**Math.min(attempt,4),10000);
const INACTIVE_REASON="The race was interrupted because a cabinet became inactive. Return to the room and start again.";
export class Multiplayer {
 constructor({onChange=()=>{},onPrepare=async()=>{},onStart=()=>{},onStop=()=>{},onBytes=()=>{},isVisible=()=>true}={}){
  Object.assign(this,{onChange,onPrepare,onStart,onStop,onBytes,isVisible});this.reset();
 }
 reset(){this.distributor=null;this.stateSequence=0;this.awaitingStop=false;this.endedEpoch='';this.progressFrames=0;this.progressAt=0;this.networkStats=new Map();this.payloadSent=0;this.payloadReceived=0;this.chat=[];this.chatSequence=0;this.chatRate=new Map();this.lastChatSent=-Infinity;this.sentTiming=packetTiming();this.receivedTiming=packetTiming();this.peer=null;this.server=null;this.connections=new Map();this.members=[];this.pending=new Map();this.phase='idle';this.isHost=false;this.id='';this.host='';this.secret='';this.epoch='';this.revision=0;this.settings={mode:0,difficulty:0,region:'Export'};this.error='';this.signaling=true;this.prepared=new Set();this.timer=null;this.generation=(this.generation||0)+1;this.initRecovery();}
 snapshot(){return {phase:this.phase,isHost:this.isHost,id:this.id,host:this.host,code:this.host&&this.secret?invitation(this.host,this.secret):'',members:this.members.map(x=>({...x})),pending:[...this.pending.values()].map(x=>({...x})),settings:{...this.settings},error:this.error,signaling:this.signaling,awaitingStop:this.awaitingStop,chat:this.chat.map(x=>({...x})),reconnectUntil:this.reconnectUntil,confirming:this.commands.size,readyPending:[...this.commands.values()].some(c=>c.data.type==='ready'),lastAck:this.lastAck};}
 changed(){this.onChange(this.snapshot());}
 initRecovery(){this.sessions=new Map();this.sessionKey='';this.reconnectUntil=0;this.retryAt=0;this.retryAttempt=0;this.signalRetryAt=0;this.signalAttempt=0;this.lobbySequence=0;this.lastLobbySequence=0;this.commands=new Map();this.commandSequence=0;this.lastAck=null;}
 get active(){return this.phase==='playing';}
 get occupied(){return !['idle','error'].includes(this.phase);}
 send(conn,data){if(!conn?.open)throw Error('A player is disconnected.');if((conn.dataChannel?.bufferedAmount||0)>MAX_BUFFER)throw Error('A player connection is too slow; the arcade link was stopped.');conn.send(data);if(['arcade-sample','arcade-state'].includes(data.type)){this.payloadSent+=data.bytes.byteLength;recordPacket(this.sentTiming);}}
 broadcast(data){for(const member of this.members){if(member.id===this.id)continue;const conn=this.connections.get(member.id);if(!conn)continue;try{this.send(conn,data);}catch{queueMicrotask(()=>{this.detach(conn,true);try{conn.close();}catch{}});}}}
 signalingLost(){this.signaling=false;if(!this.signalRetryAt)this.signalRetryAt=performance.now()+retryDelay(this.signalAttempt++);this.changed();}
 connectHost(){
  if(!this.peer||this.peer.destroyed||this.peer.disconnected||this.server)return;
  try{const conn=this.peer.connect(this.host,{reliable:true,serialization:'binary',metadata:{build:BUILD_ID,token:this.secret,name:this.name,session:this.sessionKey}});this.server=conn;this.attach(conn,false);}
  catch(e){if(this.phase==='connecting')throw e;this.retryAt=performance.now()+retryDelay(this.retryAttempt++);}
 }
 failRoom(reason){this.reconnectUntil=0;this.commands.clear();this.phase='error';this.error=reason;this.members=[];this.changed();}
 syncConnection(conn){
  const admitted=this.members.some(m=>m.id===conn.peer);
  this.send(conn,{type:'room-sync',sequence:++this.lobbySequence,revision:this.revision,admitted,members:admitted?this.members:[],settings:this.settings,chat:admitted?this.chat:[],reason:this.error});
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
   const expiry=setTimeout(()=>reject(Error('PeerJS signaling did not respond. Check your connection and try again.')),15000);
   peer.on('open',id=>{if(generation!==this.generation)return;clearTimeout(expiry);opened=true;this.id=id;this.signaling=true;this.signalRetryAt=0;this.signalAttempt=0;this.changed();resolve();});
   peer.on('error',err=>{
    if(generation!==this.generation)return;
    if(['network','socket-error','socket-closed','disconnected'].includes(err.type)&&!peer.destroyed){this.signalingLost();return;}
    if(opened&&err.type==='peer-unavailable'&&!this.isHost&&this.phase==='reconnecting'){if(this.server){const conn=this.server;this.detach(conn,false);try{conn.close();}catch{}}return;}
    const e=Error(err.type==='peer-unavailable'?'Room unavailable. Ask the host for a new invitation.':`Connection failed (${err.type||'network'}). Some networks need a TURN relay.`);
    if(!opened){clearTimeout(expiry);reject(e);return;}
    if(this.active||this.phase==='preparing')this.end(e.message);
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
  const generation=this.generation;let accepted=false;conn.lastSeen=performance.now();
  const expiry=setTimeout(()=>{if(generation!==this.generation||accepted)return;if(!incoming&&this.server===conn)this.detach(conn,false);try{conn.close();}catch{}},15000);
  conn.on('open',()=>{
   if(generation!==this.generation||(!incoming&&this.server!==conn)){conn.close();return;}
   const channel=conn.dataChannel;if(!channel?.ordered||channel.maxRetransmits!=null||channel.maxPacketLifeTime!=null){if(!incoming)this.failRoom('Incompatible data channel.');conn.close();return;}
   conn.lastSeen=performance.now();
   if(incoming){
    const meta=conn.metadata,session=this.sessions.get(conn.peer),returning=!!session;
    const valid=meta?.build===BUILD_ID&&meta?.token===this.secret&&/^[a-f0-9]{32}$/.test(meta?.session||'');
    if(!valid||this.phase!=='lobby'||(returning?(session.key!==meta.session||(session.until&&performance.now()>session.until)):this.members.length+this.pending.size>=8)){
     this.send(conn,{type:'reject',reason:this.phase!=='lobby'?'The arcade is already running. Join after it returns to the room.':'Invalid invitation, expired session, incompatible version or room full.'});setTimeout(()=>conn.close(),200);return;
    }
    const previous=this.connections.get(conn.peer);this.connections.set(conn.peer,conn);
    if(returning){session.until=0;const member=this.members.find(m=>m.id===conn.peer),pending=this.pending.get(conn.peer);if(member){member.connection='connected';member.ready=false;this.revision++;if(!this.members.some(m=>m.connection==='reconnecting'))this.error='';}if(pending)pending.connection='connected';}
    else{this.sessions.set(conn.peer,{key:meta.session,until:0,commands:new Map()});this.pending.set(conn.peer,{id:conn.peer,name:cleanName(meta.name),connection:'connected'});}
    accepted=true;clearTimeout(expiry);this.syncConnection(conn);this.publish();if(previous&&previous!==conn)previous.close();
   }else{accepted=true;clearTimeout(expiry);if(this.phase!=='reconnecting'){this.phase='pending';this.changed();}}
  });
  conn.on('data',data=>{if(generation!==this.generation||(incoming?this.connections.get(conn.peer)!==conn:this.server!==conn))return;conn.lastSeen=performance.now();if(['arcade-sample','arcade-state'].includes(data?.type)&&data.bytes instanceof ArrayBuffer){this.payloadReceived+=data.bytes.byteLength;recordPacket(this.receivedTiming);}try{this.handle(conn,data,incoming);}catch(e){if(this.isHost){this.detach(conn,true,e.message,false);conn.close();}else{if(this.active||this.phase==='preparing')this.end(e.message);this.detach(conn,false,e.message,false);conn.close();}}});
  conn.on('close',()=>{clearTimeout(expiry);if(generation===this.generation)this.detach(conn,incoming);});
  conn.on('error',()=>{clearTimeout(expiry);if(generation===this.generation)this.detach(conn,incoming);try{conn.close();}catch{}});
 }
 forget(id,reason){
  const member=this.members.find(m=>m.id===id);this.sessions.delete(id);this.pending.delete(id);this.chatRate.delete(id);this.members=this.members.filter(m=>m.id!==id);this.renumber();
  if(member){this.revision++;for(const m of this.members)m.ready=false;if(this.active||this.phase==='preparing')this.end(reason+' The arcade link must restart.',member);else this.error=`${member.name} left the room. ${reason}`;}
  this.publish();
 }
 detach(conn,incoming,reason='The cabinet disconnected.',recover=true){
  if(incoming){
   if(this.connections.get(conn.peer)!==conn)return;this.connections.delete(conn.peer);
   const member=this.members.find(m=>m.id===conn.peer),pending=this.pending.get(conn.peer),session=this.sessions.get(conn.peer);
   if(recover&&session&&(member||pending)){
    session.until=performance.now()+RECONNECT_GRACE_MS;
    if(member){if(this.active||this.phase==='preparing')this.end(reason+' Reconnect in the lobby to start again.',member);member.connection='reconnecting';this.revision++;for(const m of this.members)m.ready=false;this.error=`${member.name} is reconnecting. Their seat is reserved for 30 seconds.`;}
    if(pending)pending.connection='reconnecting';this.publish();
   }else this.forget(conn.peer,reason);
  }else{
   if(this.server!==conn)return;this.server=null;
   const host=this.members.find(m=>m.id===this.host),message=host?`Session interrupted by ${host.name} (cabinet ${host.cabinet}). ${reason}`:reason;
   if(!recover||this.phase==='error'){this.reconnectUntil=0;this.commands.clear();this.awaitingStop=false;this.failRoom(message);return;}
   if(this.active||this.phase==='preparing')this.stopLocal(message+' Reconnecting in the lobby.');
   this.awaitingStop=false;if(!this.reconnectUntil){this.reconnectUntil=performance.now()+RECONNECT_GRACE_MS;this.retryAttempt=0;}
   this.retryAt=performance.now()+retryDelay(this.retryAttempt++);this.phase='reconnecting';this.error='Connection interrupted. Reconnecting automatically…';for(const m of this.members){m.ready=false;if(m.id===this.id)m.connection='reconnecting';}this.changed();
  }
 }
 renumber(){this.members.forEach((x,i)=>x.cabinet=i+1);}
 publish(){if(this.isHost&&this.phase!=='idle'){this.broadcast({type:'roster',sequence:++this.lobbySequence,members:this.members,settings:this.settings,revision:this.revision,phase:this.phase});}this.changed();}
 approve(id){if(!this.isHost||this.phase!=='lobby'||!this.pending.has(id)||!this.connections.get(id)?.open||this.members.length>=8)return;const member=this.pending.get(id);this.pending.delete(id);this.members.push({...member,ready:false,cabinet:this.members.length+1,rtt:null});this.revision++;for(const m of this.members)m.ready=false;const conn=this.connections.get(id);this.syncConnection(conn);this.publish();}
 kick(id){
  if(!this.isHost||this.phase!=='lobby'||id===this.id||!this.members.some(m=>m.id===id))return false;
  const conn=this.connections.get(id);
  if(conn?.open)this.send(conn,{type:'removed',reason:'The host removed you from this room.'});
  this.connections.delete(id);this.sessions.delete(id);this.pending.delete(id);this.members=this.members.filter(m=>m.id!==id);
  this.renumber();this.revision++;for(const m of this.members)m.ready=false;this.publish();
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
 reject(id,reason='The host declined this request.'){const conn=this.connections.get(id);if(conn?.open){this.send(conn,{type:'reject',reason});setTimeout(()=>conn.close(),200);}this.connections.delete(id);this.sessions.delete(id);this.pending.delete(id);this.changed();}
 setSettings(value){if(!this.isHost||this.phase!=='lobby')return;this.settings=validateSettings(value);this.revision++;for(const x of this.members)x.ready=false;this.publish();}
 ready(value){if(this.phase!=='lobby'||this.awaitingStop||(value&&!this.isVisible())||this.snapshot().readyPending)return;if(this.isHost){this.members[0].ready=!!value;this.publish();}else this.command('ready',{value:!!value,revision:this.revision});}
 async start(){
  if(!this.isVisible()||!this.isHost||this.phase!=='lobby'||this.members.length<2||this.pending.size||this.members.some(x=>!x.ready||x.connection==='reconnecting'))return;
  this.phase='preparing';this.progressFrames=0;this.epoch=token();this.prepared.clear();this.prepareDeadline=performance.now()+60000;this.error='';
  const data={type:'prepare',epoch:this.epoch,members:this.members,settings:this.settings,revision:this.revision};this.broadcast(data);this.changed();await this.prepare(data);
 }
 async prepare(data){
  this.settings=validateSettings(data.settings);if(!/^[a-f0-9]{32}$/.test(data.epoch))throw Error('Invalid race session.');
  this.members=this.validateMembers(data.members);this.epoch=data.epoch;this.progressFrames=0;this.phase='preparing';this.changed();if(!this.isVisible()){this.end(INACTIVE_REASON);return;}const generation=this.generation,epoch=this.epoch;
  const me=this.members.find(x=>x.id===this.id);if(!me)throw Error('This cabinet is not in the race.');
  try{await this.onPrepare({...this.settings,master:this.id===this.host,cabinet:me.cabinet},()=>generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing');
   if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;
   if(this.isHost){this.prepared.add(this.id);this.tryGo();}else this.send(this.server,{type:'prepared',epoch:this.epoch,revision:this.revision});
  }catch(e){if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;if(this.isHost)this.end(e.message);else this.send(this.server,{type:'prepare-failed',epoch:this.epoch,reason:e.message});}
 }
 tryGo(){if(this.phase==='preparing'&&this.members.every(x=>this.prepared.has(x.id))){this.broadcast({type:'go',epoch:this.epoch});this.go();}}
 go(){
  if(!this.isVisible()){this.end(INACTIVE_REASON);return;}
  const now=performance.now();this.progressFrames=0;this.progressAt=now;
  for(const conn of this.isHost?this.connections.values():[this.server])if(conn)conn.emulation={epoch:this.epoch,frames:0,at:now};
  this.distributor=this.isHost?new HostDistributor(this.members):null;this.stateSequence=0;this.phase='playing';this.onStart();this.changed();
 }
 advance(){if(this.active){this.progressFrames++;this.progressAt=performance.now();}}
 visibilityChanged(){if(!this.isVisible()&&(this.active||this.phase==='preparing'))this.end(INACTIVE_REASON);}
 checkProgress(now=performance.now()){
  if(!this.active)return;
  const connections=this.isHost?[...this.connections.values()]:[this.server];
  if(now-this.progressAt>PROGRESS_TIMEOUT_MS){this.end(INACTIVE_REASON);return;}
  const stalled=connections.find(c=>c?.emulation?.epoch===this.epoch&&now-c.emulation.at>PROGRESS_TIMEOUT_MS);
  if(stalled){
   const member=this.members.find(m=>m.id===stalled.peer);
   const label=member?`${cleanName(member.name)} (cabinet ${member.cabinet})`:'the remote cabinet';
   this.end(`No emulation progress from ${label}. Return to the room and start again.`,stalled.peer);
  }
 }

 validateMembers(members){if(!Array.isArray(members)||members.length<1||members.length>8||new Set(members.map(x=>x.id)).size!==members.length||members[0].id!==this.host||members.some((x,i)=>typeof x.id!=='string'||x.cabinet!==i+1))throw Error('Invalid cabinet roster.');return members.map(x=>({id:x.id,name:cleanName(x.name),cabinet:x.cabinet,ready:!!x.ready,rtt:Number.isFinite(x.rtt)?x.rtt:null,connection:x.connection==='reconnecting'?'reconnecting':'connected'}));}
 handle(conn,data,incoming){
  if(!data||typeof data.type!=='string')throw Error('Invalid room message.');
  if(this.active&&data.epoch===this.epoch&&Number.isSafeInteger(data.frames)&&data.frames>=0){
   const previous=conn.emulation;
   if(!previous||previous.epoch!==this.epoch||data.frames>previous.frames)conn.emulation={epoch:this.epoch,frames:data.frames,at:performance.now()};
  }
  if(data.type==='ping'){this.send(conn,{type:'pong',time:data.time,epoch:this.epoch,frames:this.active?this.progressFrames:0});return;}
  if(data.type==='pong'){if(Number.isFinite(data.time)){const member=this.members.find(x=>x.id===conn.peer);conn.measuredRttMs=Math.max(0,performance.now()-data.time);if(member)member.rtt=Math.round(conn.measuredRttMs);}return;}
  if(incoming){
   if(this.connections.get(conn.peer)!==conn)return;
   if(data.type==='leave'){this.detach(conn,true,'The player left the room.',false);conn.close();return;}
   const member=this.members.find(x=>x.id===conn.peer);if(!member)return;
   if(['ready','chat-submit'].includes(data.type)){
    const session=this.sessions.get(conn.peer),saved=session?.commands.get(data.command);if(saved){this.send(conn,saved);return;}
    if(data.command!==undefined&&(!Number.isSafeInteger(data.command)||data.command<1))throw Error('Invalid lobby action.');
    if(data.command!==undefined&&data.command<=(session?.lastCommand||0)){this.acknowledge(conn,data,false,'This action has expired.');return;}
    if(data.type==='ready'){const valid=this.phase==='lobby'&&data.revision===this.revision; if(valid){member.ready=!!data.value;this.publish();}this.acknowledge(conn,data,valid,valid?'':'Room settings changed. Please confirm Ready again.');if(!valid&&this.phase==='lobby')this.syncConnection(conn);}
    else{const valid=this.acceptChat(conn.peer,data.text);this.acknowledge(conn,data,valid,valid?'':'Message could not be sent. Try again in the lobby.');}
   }
   else if(data.type==='prepared'&&this.phase==='preparing'&&data.epoch===this.epoch&&data.revision===this.revision){this.prepared.add(conn.peer);this.tryGo();}
   else if(data.type==='prepare-failed'&&this.phase==='preparing'&&data.epoch===this.epoch)this.end('The cabinet could not prepare: '+String(data.reason).slice(0,160),conn.peer);
   else if(data.type==='stop'&&(this.active||this.phase==='preparing')&&data.epoch===this.epoch){
    // The connection identifies the requester; clients cannot name another cabinet.
    this.end(String(data.reason||'The cabinet stopped.').slice(0,180),conn.peer);
   }
   else if(data.type==='arcade-sample'&&this.active&&data.epoch===this.epoch)this.distributor.accept(conn.peer,data.frames,data.bytes);
  }else{
   if(this.server!==conn)return;
   if(data.type==='command-ack'){
    if(this.commands.delete(data.command)){this.lastAck={...data};this.changed();}return;
   }
   if(data.type==='room-sync'){
    if(!Number.isSafeInteger(data.sequence)||data.sequence<=this.lastLobbySequence)return;
    const settings=validateSettings(data.settings),members=data.admitted?this.validateMembers(data.members):[];
    if(data.admitted&&!members.some(m=>m.id===this.id))throw Error('Missing session identity.');
    const chat=Array.isArray(data.chat)?data.chat.slice(-CHAT_HISTORY_LIMIT).map(m=>this.validateChatMessage(m)).filter(Boolean):[];
    this.lastLobbySequence=data.sequence;this.revision=data.revision;this.settings=settings;this.members=members;this.chat=data.admitted?chat:[];
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
   else if(data.type==='roster'){if(!Number.isSafeInteger(data.sequence)||data.sequence<=this.lastLobbySequence)return;this.lastLobbySequence=data.sequence;if(this.awaitingStop&&data.phase==='lobby')this.awaitingStop=false;this.members=this.validateMembers(data.members);this.settings=validateSettings(data.settings);this.revision=data.revision;this.changed();}
   else if(data.type==='prepare'&&this.phase==='lobby'){this.revision=data.revision;void this.prepare(data).catch(e=>this.end(e.message));}
   else if(data.type==='go'&&this.phase==='preparing'&&data.epoch===this.epoch)this.go();
   else if(data.type==='stop'&&(data.epoch===this.epoch||(this.awaitingStop&&data.epoch===this.endedEpoch)))this.stopLocal(String(data.reason||'The arcade link stopped.').slice(0,280));
   else if(data.type==='arcade-state'&&this.active&&data.epoch===this.epoch){
    if(!Number.isSafeInteger(data.sequence)||data.sequence<1||!(data.bytes instanceof ArrayBuffer)||data.bytes.byteLength!==STATE_BYTES||new Uint8Array(data.bytes)[0]!==STATE_TAG)throw Error('Invalid centralized state.');
    if(data.sequence>this.stateSequence){this.stateSequence=data.sequence;this.receiveBytes(data.bytes);}
   }
  }
 }
 receiveBytes(bytes){if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>4096)throw Error('Invalid arcade packet.');this.onBytes(new Uint8Array(bytes));}
 write(bytes){
  if(!this.active)return;
  const data={type:'arcade-sample',epoch:this.epoch,frames:this.progressFrames,bytes:bytes.slice().buffer};
  try{
   if(!this.isHost){this.send(this.server,data);return;}
   if(!this.distributor.accept(this.id,data.frames,data.bytes)||!this.distributor.ready)return;
   const sequence=++this.distributor.sequence;
   for(const member of this.members){
    const state=this.distributor.snapshot(member.id);
    if(member.id===this.id)this.receiveBytes(state);
    else this.send(this.connections.get(member.id),{type:'arcade-state',epoch:this.epoch,frames:this.progressFrames,sequence,bytes:state});
   }
  }catch(e){this.end(e.message);}
 }
 stopLocal(reason){const hadSession=this.active||this.phase==='preparing';if(this.epoch)this.endedEpoch=this.epoch;this.distributor=null;this.stateSequence=0;this.awaitingStop=false;this.epoch='';this.phase='lobby';this.error=reason;for(const x of this.members)x.ready=false;if(hadSession)this.onStop(reason);this.changed();}
 end(reason='The arcade session ended.',cabinet=this.id){
  const member=typeof cabinet==='string'?this.members.find(m=>m.id===cabinet):cabinet;
  const detail=String(reason).slice(0,180);
  const message=member?`Session interrupted by ${cleanName(member.name)} (cabinet ${member.cabinet}). ${detail}`:detail;
  if(this.isHost){try{this.broadcast({type:'stop',epoch:this.epoch,reason:message});}catch{}this.stopLocal(message);this.publish();}
  else{const hadSession=!!this.epoch;try{if(hadSession)this.send(this.server,{type:'stop',epoch:this.epoch,reason:detail});}catch{}this.stopLocal(message);this.awaitingStop=hadSession;this.changed();}
 }
 heartbeat(now=performance.now()){
  if(!this.signaling&&this.peer&&!this.peer.destroyed&&now>=this.signalRetryAt){this.signalRetryAt=now+retryDelay(this.signalAttempt++);if(this.peer.disconnected)try{this.peer.reconnect();}catch{}}
  if(this.phase==='reconnecting'){
   if(this.peer?.destroyed||now>this.reconnectUntil){const conn=this.server;this.server=null;this.failRoom('Could not reconnect. Return to room selection and try again.');try{conn?.close();}catch{}return;}
   if(!this.server&&now>=this.retryAt)this.connectHost();
  }
  if(this.isHost){for(const [id,session] of this.sessions)if(session.until&&now>session.until)this.forget(id,'The reconnection window expired.');}
  if(this.phase==='lobby'&&!this.isHost&&this.server?.open)for(const command of this.commands.values())if(now-command.at>=2000){command.at=now;try{this.send(this.server,command.data);}catch{this.detach(this.server,false);break;}}
  this.checkProgress(now);if(this.isHost&&this.phase==='preparing'&&now>this.prepareDeadline){this.end('Cabinet preparation timed out.');return;}
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  for(const conn of connections){
   if(!conn.open){if(this.phase==='reconnecting')continue;this.detach(conn,this.isHost,'The connection closed.');continue;}
   if(now-conn.lastSeen>CONNECTION_TIMEOUT_MS){this.detach(conn,this.isHost,'No response for 12 seconds.');try{conn.close();}catch{}continue;}
   try{this.send(conn,{type:'ping',time:now,epoch:this.epoch,frames:this.active?this.progressFrames:0});}catch{this.detach(conn,this.isHost);try{conn.close();}catch{}}
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
   relayConnections:connections.filter(c=>this.networkStats.get(c)?.relay).length};
 }
 async pollDiagnostics(){
  const generation=this.generation;
  const connections=(this.isHost?[...this.connections.values()]:[this.server]).filter(c=>c?.open);
  const next=new Map();
  await Promise.all(connections.map(async conn=>{
   try{if(!conn.peerConnection?.getStats)return;const stats=await conn.peerConnection.getStats();
    let pair;for(const value of stats.values())if(value.type==='transport'&&value.selectedCandidatePairId)pair=stats.get(value.selectedCandidatePairId);
    if(!pair)for(const value of stats.values())if(value.type==='candidate-pair'&&value.nominated&&value.state==='succeeded')pair=value;
    if(pair){const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
     next.set(conn,{rttMs:Number.isFinite(pair.currentRoundTripTime)?pair.currentRoundTripTime*1000:null,relay:local?.candidateType==='relay'||remote?.candidateType==='relay'});
    }
   }catch{} // Stats are optional; never interrupt the arcade link.
  }));
  if(generation===this.generation)this.networkStats=next;
 }
 leave(){
  const hadSession=this.active||this.phase==='preparing';
  // Best effort: peer closure or the presence timeout still cleans up if this message is lost.
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  for(const conn of connections)try{this.send(conn,{type:this.isHost?'room-closed':'leave'});}catch{}
  const peer=this.peer;this.generation++;clearInterval(this.timer);if(peer)setTimeout(()=>peer.destroy(),200);if(hadSession)this.onStop('You left the room.');this.reset();this.changed();
 }
}
