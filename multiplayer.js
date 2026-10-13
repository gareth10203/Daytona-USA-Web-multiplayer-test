import {BUILD_ID,validateSettings,invitation,parseInvitation} from './room-settings.js';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const cleanName=value=>String(value||'Driver').trim().slice(0,24)||'Driver';
const MAX_BUFFER=1024*1024;
export class Multiplayer {
 constructor({onChange=()=>{},onPrepare=async()=>{},onStart=()=>{},onStop=()=>{},onBytes=()=>{}}={}){
  Object.assign(this,{onChange,onPrepare,onStart,onStop,onBytes});this.reset();
 }
 reset(){this.peer=null;this.server=null;this.connections=new Map();this.members=[];this.pending=new Map();this.phase='idle';this.isHost=false;this.id='';this.host='';this.secret='';this.epoch='';this.revision=0;this.settings={mode:0,difficulty:0,region:'Export'};this.error='';this.signaling=true;this.prepared=new Set();this.timer=null;this.generation=(this.generation||0)+1;}
 snapshot(){return {phase:this.phase,isHost:this.isHost,id:this.id,host:this.host,code:this.host&&this.secret?invitation(this.host,this.secret):'',members:this.members.map(x=>({...x})),pending:[...this.pending.values()].map(x=>({...x})),settings:{...this.settings},error:this.error,signaling:this.signaling};}
 changed(){this.onChange(this.snapshot());}
 get active(){return this.phase==='playing';}
 get occupied(){return !['idle','error'].includes(this.phase);}
 send(conn,data){if(!conn?.open)throw Error('A player is disconnected.');if((conn.dataChannel?.bufferedAmount||0)>MAX_BUFFER)throw Error('A player connection is too slow; the arcade link was stopped.');conn.send(data);}
 broadcast(data){for(const member of this.members){if(member.id!==this.id)this.send(this.connections.get(member.id),data);}}
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
  this.timer=setInterval(()=>this.heartbeat(),2000);
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
   if(incoming){
    const meta=conn.metadata;
    if(this.phase!=='lobby'||meta?.build!==BUILD_ID||meta?.token!==this.secret||this.connections.has(conn.peer)||this.members.length+this.pending.size>=8){this.send(conn,{type:'reject',reason:this.phase!=='lobby'?'The arcade is already running. Join after it returns to the room.':'Invalid invitation, incompatible version or room full.'});setTimeout(()=>conn.close(),200);return;}
    this.connections.set(conn.peer,conn);this.pending.set(conn.peer,{id:conn.peer,name:cleanName(meta.name)});this.send(conn,{type:'pending'});accepted=true;clearTimeout(expiry);this.changed();
   }else{accepted=true;clearTimeout(expiry);this.phase='pending';this.changed();}
  });
  conn.on('data',data=>{if(generation!==this.generation)return;conn.lastSeen=performance.now();try{this.handle(conn,data,incoming);}catch(e){if(this.isHost){this.reject(conn.peer,e.message);if(this.active||this.phase==='preparing')this.end(e.message);}else this.end(e.message);}});
  conn.on('close',()=>{
   clearTimeout(expiry);if(generation!==this.generation)return;
   if(incoming){if(this.connections.get(conn.peer)!==conn)return;this.connections.delete(conn.peer);this.pending.delete(conn.peer);const member=this.members.some(x=>x.id===conn.peer);this.members=this.members.filter(x=>x.id!==conn.peer);if(member&&(this.active||this.phase==='preparing'))this.end('A cabinet disconnected. The original arcade link must restart.');else{this.renumber();this.publish();}}
   else{if(this.phase!=='error')this.end('The host disconnected. Create or join a new room.');this.phase='error';this.changed();}
  });
  conn.on('error',()=>{conn.close();});
 }
 renumber(){this.members.forEach((x,i)=>x.cabinet=i+1);}
 publish(){if(this.isHost&&this.phase!=='idle'){this.broadcast({type:'roster',members:this.members,settings:this.settings,revision:this.revision,phase:this.phase});}this.changed();}
 approve(id){if(!this.isHost||this.phase!=='lobby'||!this.pending.has(id)||this.members.length>=8)return;const member=this.pending.get(id);this.pending.delete(id);this.members.push({...member,ready:false,cabinet:this.members.length+1,rtt:null});this.send(this.connections.get(id),{type:'welcome',host:this.host});this.publish();}
 reject(id,reason='The host declined this request.'){const conn=this.connections.get(id);if(conn?.open){this.send(conn,{type:'reject',reason});setTimeout(()=>conn.close(),200);}this.pending.delete(id);this.changed();}
 setSettings(value){if(!this.isHost||this.phase!=='lobby')return;this.settings=validateSettings(value);this.revision++;for(const x of this.members)x.ready=false;this.publish();}
 ready(value){if(this.phase!=='lobby')return;if(this.isHost){this.members[0].ready=!!value;this.publish();}else this.send(this.server,{type:'ready',value:!!value,revision:this.revision});}
 async start(){
  if(!this.isHost||this.phase!=='lobby'||this.members.length<2||this.pending.size||this.members.some(x=>!x.ready))return;
  this.phase='preparing';this.epoch=token();this.prepared.clear();this.prepareDeadline=performance.now()+60000;this.error='';
  const data={type:'prepare',epoch:this.epoch,members:this.members,settings:this.settings,revision:this.revision};this.broadcast(data);this.changed();await this.prepare(data);
 }
 async prepare(data){
  this.settings=validateSettings(data.settings);if(!/^[a-f0-9]{32}$/.test(data.epoch))throw Error('Invalid race session.');
  this.members=this.validateMembers(data.members);this.epoch=data.epoch;this.phase='preparing';this.changed();const generation=this.generation,epoch=this.epoch;
  const me=this.members.find(x=>x.id===this.id);if(!me)throw Error('This cabinet is not in the race.');
  try{await this.onPrepare({...this.settings,master:this.id===this.host,cabinet:me.cabinet},()=>generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing');
   if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;
   if(this.isHost){this.prepared.add(this.id);this.tryGo();}else this.send(this.server,{type:'prepared',epoch:this.epoch,revision:this.revision});
  }catch(e){if(generation!==this.generation||this.epoch!==epoch||this.phase!=='preparing')return;if(this.isHost)this.end(e.message);else this.send(this.server,{type:'prepare-failed',epoch:this.epoch,reason:e.message});}
 }
 tryGo(){if(this.phase==='preparing'&&this.members.every(x=>this.prepared.has(x.id))){this.broadcast({type:'go',epoch:this.epoch});this.go();}}
 go(){this.phase='playing';this.onStart();this.changed();}
 validateMembers(members){if(!Array.isArray(members)||members.length<1||members.length>8||new Set(members.map(x=>x.id)).size!==members.length||members[0].id!==this.host||members.some((x,i)=>typeof x.id!=='string'||x.cabinet!==i+1))throw Error('Invalid cabinet roster.');return members.map(x=>({id:x.id,name:cleanName(x.name),cabinet:x.cabinet,ready:!!x.ready,rtt:Number.isFinite(x.rtt)?x.rtt:null}));}
 handle(conn,data,incoming){
  if(!data||typeof data.type!=='string')throw Error('Invalid room message.');
  if(data.type==='ping'){this.send(conn,{type:'pong',time:data.time});return;}
  if(data.type==='pong'){if(Number.isFinite(data.time)){const member=this.members.find(x=>x.id===conn.peer);if(member)member.rtt=Math.round(Math.max(0,performance.now()-data.time));}return;}
  if(incoming){
   const member=this.members.find(x=>x.id===conn.peer);if(!member)return;
   if(data.type==='ready'&&this.phase==='lobby'&&data.revision===this.revision){member.ready=!!data.value;this.publish();}
   else if(data.type==='prepared'&&this.phase==='preparing'&&data.epoch===this.epoch&&data.revision===this.revision){this.prepared.add(conn.peer);this.tryGo();}
   else if(data.type==='prepare-failed'&&data.epoch===this.epoch)this.end('A cabinet could not prepare: '+String(data.reason).slice(0,160));
   else if(data.type==='stop'&&data.epoch===this.epoch)this.end(String(data.reason||'A cabinet stopped.').slice(0,180));
   else if(data.type==='arcade')this.route(conn.peer,data);
  }else{
   if(data.type==='pending'){this.phase='pending';this.changed();}
   else if(data.type==='reject'){this.error=String(data.reason).slice(0,180);this.phase='error';this.changed();}
   else if(data.type==='welcome'){this.phase='lobby';this.changed();}
   else if(data.type==='roster'){this.members=this.validateMembers(data.members);this.settings=validateSettings(data.settings);this.revision=data.revision;this.changed();}
   else if(data.type==='prepare'&&this.phase==='lobby'){this.revision=data.revision;void this.prepare(data).catch(e=>this.end(e.message));}
   else if(data.type==='go'&&this.phase==='preparing'&&data.epoch===this.epoch)this.go();
   else if(data.type==='stop'&&data.epoch===this.epoch)this.stopLocal(String(data.reason||'The arcade link stopped.').slice(0,180));
   else if(data.type==='arcade'&&this.active&&data.epoch===this.epoch)this.receiveBytes(data.bytes);
  }
 }
 receiveBytes(bytes){if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>4096)throw Error('Invalid arcade packet.');this.onBytes(new Uint8Array(bytes));}
 route(sender,data){
  if(!this.active||data.epoch!==this.epoch)return;const index=this.members.findIndex(x=>x.id===sender);if(index<0)return;
  if(!(data.bytes instanceof ArrayBuffer)||data.bytes.byteLength<1||data.bytes.byteLength>4096)throw Error('Invalid arcade packet.');
  const next=this.members[(index+1)%this.members.length];if(next.id===this.id)this.receiveBytes(data.bytes);else this.send(this.connections.get(next.id),data);
 }
 write(bytes){if(!this.active)return;const data={type:'arcade',epoch:this.epoch,bytes:bytes.slice().buffer};try{if(this.isHost)this.route(this.id,data);else this.send(this.server,data);}catch(e){this.end(e.message);}}
 stopLocal(reason){const hadSession=this.active||this.phase==='preparing';this.epoch='';this.phase='lobby';this.error=reason;for(const x of this.members)x.ready=false;if(hadSession)this.onStop(reason);this.changed();}
 end(reason='The arcade session ended.'){
  if(this.isHost){try{this.broadcast({type:'stop',epoch:this.epoch,reason});}catch{}this.stopLocal(reason);this.publish();}
  else{try{if(this.epoch)this.send(this.server,{type:'stop',epoch:this.epoch,reason});}catch{}this.stopLocal(reason);}
 }
 heartbeat(){
  const now=performance.now();if(this.isHost&&this.phase==='preparing'&&now>this.prepareDeadline){this.end('Cabinet preparation timed out.');return;}
  const connections=this.isHost?[...this.connections.values()]:[this.server].filter(Boolean);
  for(const conn of connections){if(!conn.open)continue;if(now-conn.lastSeen>12000){conn.close();continue;}try{this.send(conn,{type:'ping',time:now});}catch{conn.close();}}
  if(this.isHost&&['lobby','playing'].includes(this.phase))this.publish();else this.changed();
 }
 leave(){const hadSession=this.active||this.phase==='preparing';this.generation++;clearInterval(this.timer);this.peer?.destroy();if(hadSession)this.onStop('You left the room.');this.reset();this.changed();}
}
