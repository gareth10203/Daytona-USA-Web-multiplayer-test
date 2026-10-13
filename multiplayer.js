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
const INACTIVE_REASON="The race was interrupted because a cabinet became inactive. Return to the room and start again.";
export class Multiplayer {
 constructor({onChange=()=>{},onPrepare=async()=>{},onStart=()=>{},onStop=()=>{},onBytes=()=>{},isVisible=()=>true}={}){
  Object.assign(this,{onChange,onPrepare,onStart,onStop,onBytes,isVisible});this.reset();
 }
 reset(){this.awaitingStop=false;this.endedEpoch='';this.progressFrames=0;this.progressAt=0;this.networkStats=new Map();this.payloadSent=0;this.payloadReceived=0;this.chat=[];this.chatSequence=0;this.chatRate=new Map();this.lastChatSent=-Infinity;this.sentTiming=packetTiming();this.receivedTiming=packetTiming();this.peer=null;this.server=null;this.connections=new Map();this.members=[];this.pending=new Map();this.phase='idle';this.isHost=false;this.id='';this.host='';this.secret='';this.epoch='';this.revision=0;this.settings={mode:0,difficulty:0,region:'Export'};this.error='';this.signaling=true;this.prepared=new Set();this.timer=null;this.generation=(this.generation||0)+1;}
 snapshot(){return {phase:this.phase,isHost:this.isHost,id:this.id,host:this.host,code:this.host&&this.secret?invitation(this.host,this.secret):'',members:this.members.map(x=>({...x})),pending:[...this.pending.values()].map(x=>({...x})),settings:{...this.settings},error:this.error,signaling:this.signaling,awaitingStop:this.awaitingStop,chat:this.chat.map(x=>({...x}))};}
 changed(){this.onChange(this.snapshot());}
 get active(){return this.phase==='playing';}
 get occupied(){return !['idle','error'].includes(this.phase);}
 send(conn,data){if(!conn?.open)throw Error('A player is disconnected.');if((conn.dataChannel?.bufferedAmount||0)>MAX_BUFFER)throw Error('A player connection is too slow; the arcade link was stopped.');conn.send(data);if(data.type==='arcade'){this.payloadSent+=data.bytes.byteLength;recordPacket(this.sentTiming);}}
 broadcast(data){for(const member of this.members){if(member.id===this.id)continue;const conn=this.connections.get(member.id);try{this.send(conn,data);}catch{if(conn)queueMicrotask(()=>{this.detach(conn,true);try{conn.close();}catch{}});}}}
 async openPeer(){
  if(typeof globalThis.Peer!=='function')throw Error('PeerJS could not load. Reload the page.');
  const generation=this.generation;
  const peer=this.peer=new Peer(`dt-${token()}`,{debug:0,config:{iceServers:globalThis.DAYTONA_ICE_SERVERS||[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]}});
  peer.on('connection',conn=>{if(this.isHost&&generation===this.generation)this.attach(conn,true);else conn.close();});
  peer.on('disconnected',()=>{if(generation!==this.generation)return;this.signaling=false;this.changed();if(!peer.destroyed)setTimeout(()=>{if(generation===this.generation&&peer.disconnected)peer.reconnect();},1500);});
  peer.on('open',()=>{if(generation===this.generation){this.signaling=true;this.changed();}});
  await new Promise((resolve,reject)=>{
   const expiry=setTimeout(()=>reject(Error('PeerJS signaling did not respond. Check your connection and try again.')),15000);
   peer.once('open',id=>{clearTimeout(expiry);this.id=id;resolve();});
   peer.on('error',err=>{clearTimeout(expiry);const e=Error(err.type==='peer-unavailable'?'Room unavailable. Ask the host for a new invitation.':`Connection failed (${err.type||'network'}). Some networks need a TURN relay.`);reject(e);if(generation===this.generation){if(this.active||this.phase==='preparing')this.end(e.message);else{this.error=e.message;this.changed();}}});
  });
  this.timer=setInterval(()=>this.heartbeat(),1000);
 }
 async create(name){this.leave();this.isHost=true;this.name=cleanName(name);this.phase='connecting';this.changed();try{await this.openPeer();this.host=this.id;this.secret=token();this.members=[{id:this.id,name:this.name,ready:false,cabinet:1,rtt:null}];this.phase='lobby';this.changed();}catch(e){this.leave();this.phase='error';this.error=e.message;this.changed();}}
 async join(code,name){
  const invite=parseInvitation(code);this.leave();this.name=cleanName(name);this.host=invite.host;this.secret=invite.token;this.phase='connecting';this.changed();
  try{await this.openPeer();const conn=this.peer.connect(this.host,{reliable:true,serialization:'binary',metadata:{build:BUILD_ID,token:this.secret,name:this.name}});this.server=conn;this.attach(conn,false);}catch(e){this.leave();this.phase='error';this.error=e.message;this.changed();}
 }
 attach(conn,incoming){
  const generation=this.generation;let accepted=false;const connectedAt=performance.now();conn.lastSeen=connectedAt;
  const expiry=setTimeout(()=>{if(generation===this.generation&&!accepted){conn.close();if(!incoming){this.error='Connection timed out. The host may be offline, or this network may need TURN.';this.phase='error';this.changed();}}},15000);
  conn.on('open',()=>{
   if(generation!==this.generation){conn.close();return;}
   const channel=conn.dataChannel;if(!channel?.ordered||channel.maxRetransmits!=null||channel.maxPacketLifeTime!=null){conn.close();return;}
   conn.lastSeen=performance.now();
   if(incoming){
    const meta=conn.metadata;
    if(this.phase!=='lobby'||meta?.build!==BUILD_ID||meta?.token!==this.secret||this.connections.has(conn.peer)||this.members.length+this.pending.size>=8){this.send(conn,{type:'reject',reason:this.phase!=='lobby'?'The arcade is already running. Join after it returns to the room.':'Invalid invitation, incompatible version or room full.'});setTimeout(()=>conn.close(),200);return;}
    this.connections.set(conn.peer,conn);this.pending.set(conn.peer,{id:conn.peer,name:cleanName(meta.name)});this.send(conn,{type:'pending'});accepted=true;clearTimeout(expiry);this.changed();
   }else{accepted=true;clearTimeout(expiry);this.phase='pending';this.changed();}
  });
  conn.on('data',data=>{if(generation!==this.generation||(incoming?this.connections.get(conn.peer)!==conn:this.server!==conn))return;conn.lastSeen=performance.now();if(data?.type==='arcade'&&data.bytes instanceof ArrayBuffer){this.payloadReceived+=data.bytes.byteLength;recordPacket(this.receivedTiming);}try{this.handle(conn,data,incoming);}catch(e){if(this.isHost){this.reject(conn.peer,e.message);if(this.active||this.phase==='preparing')this.end(e.message);}else this.end(e.message);}});
  conn.on('close',()=>{
   clearTimeout(expiry);if(generation!==this.generation)return;
   this.detach(conn,incoming);
  });
  conn.on('error',()=>{if(generation===this.generation)this.detach(conn,incoming);try{conn.close();}catch{}});
 }
 detach(conn,incoming,reason='The cabinet disconnected.'){
  if(incoming){
   if(this.connections.get(conn.peer)!==conn)return;
   this.connections.delete(conn.peer);this.pending.delete(conn.peer);this.chatRate.delete(conn.peer);
   const member=this.members.find(m=>m.id===conn.peer);
   this.members=this.members.filter(m=>m.id!==conn.peer);this.renumber();
   if(member){this.revision++;for(const m of this.members)m.ready=false;}
   if(member&&(this.active||this.phase==='preparing'))this.end(reason+' The original arcade link must restart.',member);
   else{if(member)this.error=`${member.name} left the room. ${reason}`;this.publish();}
  }else{
   if(this.server!==conn)return;
   this.server=null;
   const host=this.members.find(m=>m.id===this.host);
   const message=host?`Session interrupted by ${host.name} (cabinet ${host.cabinet}). ${reason}`:reason;
   if(this.phase!=='error')this.stopLocal(message+' Create or join a new room.');
   this.awaitingStop=false;this.phase='error';this.members=[];this.changed();
  }
 }
 renumber(){this.members.forEach((x,i)=>x.cabinet=i+1);}
 publish(){if(this.isHost&&this.phase!=='idle'){this.broadcast({type:'roster',members:this.members,settings:this.settings,revision:this.revision,phase:this.phase});}this.changed();}
 approve(id){if(!this.isHost||this.phase!=='lobby'||!this.pending.has(id)||this.members.length>=8)return;const member=this.pending.get(id);this.pending.delete(id);this.members.push({...member,ready:false,cabinet:this.members.length+1,rtt:null});this.revision++;for(const m of this.members)m.ready=false;const conn=this.connections.get(id);this.send(conn,{type:'welcome',host:this.host});this.send(conn,{type:'chat-history',messages:this.chat.map(m=>({...m}))});this.publish();}
 kick(id){
  if(!this.isHost||this.phase!=='lobby'||id===this.id||!this.members.some(m=>m.id===id))return false;
  const conn=this.connections.get(id);
  if(conn?.open)this.send(conn,{type:'removed',reason:'The host removed you from this room.'});
  this.connections.delete(id);this.pending.delete(id);this.members=this.members.filter(m=>m.id!==id);
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
  if(this.isHost)this.acceptChat(this.id,text);else this.send(this.server,{type:'chat-submit',text});
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
 reject(id,reason='The host declined this request.'){const conn=this.connections.get(id);if(conn?.open){this.send(conn,{type:'reject',reason});setTimeout(()=>conn.close(),200);}this.pending.delete(id);this.changed();}
 setSettings(value){if(!this.isHost||this.phase!=='lobby')return;this.settings=validateSettings(value);this.revision++;for(const x of this.members)x.ready=false;this.publish();}
 ready(value){if(this.phase!=='lobby'||this.awaitingStop||(value&&!this.isVisible()))return;if(this.isHost){this.members[0].ready=!!value;this.publish();}else this.send(this.server,{type:'ready',value:!!value,revision:this.revision});}
 async start(){
  if(!this.isVisible()||!this.isHost||this.phase!=='lobby'||this.members.length<2||this.pending.size||this.members.some(x=>!x.ready))return;
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
  this.phase='playing';this.onStart();this.changed();
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

 validateMembers(members){if(!Array.isArray(members)||members.length<1||members.length>8||new Set(members.map(x=>x.id)).size!==members.length||members[0].id!==this.host||members.some((x,i)=>typeof x.id!=='string'||x.cabinet!==i+1))throw Error('Invalid cabinet roster.');return members.map(x=>({id:x.id,name:cleanName(x.name),cabinet:x.cabinet,ready:!!x.ready,rtt:Number.isFinite(x.rtt)?x.rtt:null}));}
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
   if(data.type==='leave'){this.detach(conn,true,'The player left the room.');conn.close();return;}
   const member=this.members.find(x=>x.id===conn.peer);if(!member)return;
   if(data.type==='ready'&&this.phase==='lobby'&&data.revision===this.revision){member.ready=!!data.value;this.publish();}
   else if(data.type==='chat-submit')this.acceptChat(conn.peer,data.text);
   else if(data.type==='prepared'&&this.phase==='preparing'&&data.epoch===this.epoch&&data.revision===this.revision){this.prepared.add(conn.peer);this.tryGo();}
   else if(data.type==='prepare-failed'&&this.phase==='preparing'&&data.epoch===this.epoch)this.end('The cabinet could not prepare: '+String(data.reason).slice(0,160),conn.peer);
   else if(data.type==='stop'&&(this.active||this.phase==='preparing')&&data.epoch===this.epoch){
    // The connection identifies the requester; clients cannot name another cabinet.
    this.end(String(data.reason||'The cabinet stopped.').slice(0,180),conn.peer);
   }
   else if(data.type==='arcade')this.route(conn.peer,data);
  }else{
   if(this.server!==conn)return;
   if(data.type==='pending'){this.phase='pending';this.changed();}
   else if(data.type==='room-closed'){this.detach(conn,false,'The host closed the room.');conn.close();}
   else if(data.type==='reject'){this.error=String(data.reason).slice(0,180);this.phase='error';this.changed();}
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
   else if(data.type==='roster'){if(this.awaitingStop&&data.phase==='lobby')this.awaitingStop=false;this.members=this.validateMembers(data.members);this.settings=validateSettings(data.settings);this.revision=data.revision;this.changed();}
   else if(data.type==='prepare'&&this.phase==='lobby'){this.revision=data.revision;void this.prepare(data).catch(e=>this.end(e.message));}
   else if(data.type==='go'&&this.phase==='preparing'&&data.epoch===this.epoch)this.go();
   else if(data.type==='stop'&&(data.epoch===this.epoch||(this.awaitingStop&&data.epoch===this.endedEpoch)))this.stopLocal(String(data.reason||'The arcade link stopped.').slice(0,280));
   else if(data.type==='arcade'&&this.active&&data.epoch===this.epoch)this.receiveBytes(data.bytes);
  }
 }
 receiveBytes(bytes){if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>4096)throw Error('Invalid arcade packet.');this.onBytes(new Uint8Array(bytes));}
 route(sender,data){
  if(!this.active||data.epoch!==this.epoch)return;const index=this.members.findIndex(x=>x.id===sender);if(index<0)return;
  if(!(data.bytes instanceof ArrayBuffer)||data.bytes.byteLength<1||data.bytes.byteLength>4096)throw Error('Invalid arcade packet.');
  const next=this.members[(index+1)%this.members.length];if(next.id===this.id)this.receiveBytes(data.bytes);else this.send(this.connections.get(next.id),{...data,frames:this.progressFrames});
 }
 write(bytes){if(!this.active)return;const data={type:'arcade',epoch:this.epoch,frames:this.progressFrames,bytes:bytes.slice().buffer};try{if(this.isHost)this.route(this.id,data);else this.send(this.server,data);}catch(e){this.end(e.message);}}
 stopLocal(reason){const hadSession=this.active||this.phase==='preparing';if(this.epoch)this.endedEpoch=this.epoch;this.awaitingStop=false;this.epoch='';this.phase='lobby';this.error=reason;for(const x of this.members)x.ready=false;if(hadSession)this.onStop(reason);this.changed();}
 end(reason='The arcade session ended.',cabinet=this.id){
  const member=typeof cabinet==='string'?this.members.find(m=>m.id===cabinet):cabinet;
  const detail=String(reason).slice(0,180);
  const message=member?`Session interrupted by ${cleanName(member.name)} (cabinet ${member.cabinet}). ${detail}`:detail;
  if(this.isHost){try{this.broadcast({type:'stop',epoch:this.epoch,reason:message});}catch{}this.stopLocal(message);this.publish();}
  else{const hadSession=!!this.epoch;try{if(hadSession)this.send(this.server,{type:'stop',epoch:this.epoch,reason:detail});}catch{}this.stopLocal(message);this.awaitingStop=hadSession;this.changed();}
 }
 heartbeat(now=performance.now()){
  this.checkProgress(now);if(this.isHost&&this.phase==='preparing'&&now>this.prepareDeadline){this.end('Cabinet preparation timed out.');return;}
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  for(const conn of connections){
   if(!conn.open||now-conn.lastSeen>CONNECTION_TIMEOUT_MS){this.detach(conn,this.isHost,conn.open?'No response for 12 seconds.':'The connection closed.');try{conn.close();}catch{}continue;}
   try{this.send(conn,{type:'ping',time:now,epoch:this.epoch,frames:this.active?this.progressFrames:0});}catch{this.detach(conn,this.isHost);try{conn.close();}catch{}}
  }
  if(this.isHost&&['lobby','playing'].includes(this.phase))this.publish();else this.changed();
 }
 diagnostics(){
  const connections=(this.isHost?[...this.connections.values()]:[this.server]).filter(c=>c?.open);
  const rtts=connections.map(c=>this.networkStats.get(c)?.rttMs??c.measuredRttMs).filter(Number.isFinite);
  return {connections:connections.length,rttMs:rtts.length?Math.max(...rtts):null,
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
  this.generation++;clearInterval(this.timer);this.peer?.destroy();if(hadSession)this.onStop('You left the room.');this.reset();this.changed();
 }
}
