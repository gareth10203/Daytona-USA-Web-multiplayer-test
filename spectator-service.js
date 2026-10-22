import {BUILD_ID} from './room-settings.js?v=53.5.2-actors';
import {SPECTATOR_VERSION,SPECTATOR_HZ} from './spectator-world.js?v=53.5.2-actors';
import {transformPacket} from './spectator-codec.js?v=53.5.2-actors';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const name=v=>String(v||'Spectator').replace(/\s+/gu,' ').trim().slice(0,24)||'Spectator';
const CAP=8,QUEUE=262144;
export class SpectatorService {
 constructor(room,{getWasm=()=>null,onChange=()=>{},onMessage=()=>{}}={}){Object.assign(this,{room,getWasm,onChange,onMessage});this.viewers=new Map();this.tickets=new Map();this.streams=new Map();this.config=null;this.phase='';this.epoch='';this.frames=[];this.orders=[];this.frame=null;this.serial=0;this.busy=false;this.sending=false;this.timer=null;this.generation=0;this.reaper=null;}
 snapshot(){return {viewers:[...this.viewers.values()].filter(v=>v.conn.open).map(v=>({id:v.conn.peer,name:v.name,approved:v.approved,relay:v.relay,connected:v.conn.open})),streams:this.streams.size};}
 changed(){this.onChange(this.snapshot());}
 send(c,d){if(!c?.open||c.dataChannel?.bufferedAmount>QUEUE)return false;try{c.send(d);return true;}catch{return false;}}
 connection(c){
  const meta=c.metadata;if(!['spectator-control','spectator-stream'].includes(meta?.role))return false;
  if(meta.build!==BUILD_ID||meta.version!==SPECTATOR_VERSION){c.close();return true;}
  if(meta.role==='spectator-control')this.control(c);else this.stream(c);return true;
 }
 control(c){
  const room=this.room;if(!room.isHost||c.metadata.token!==room.secret||!['lobby','preparing','playing'].includes(room.phase)||this.viewers.size>=CAP){c.close();return;}
  const v={conn:c,name:name(c.metadata.name),approved:room.visibility==='public',relay:null,last:performance.now()};this.viewers.set(c.peer,v);
  if(!this.reaper)this.reaper=setInterval(()=>this.expire(),2000);
  c.on('open',()=>{this.send(c,{type:'spectator-status',message:v.approved?'Connected. Waiting for a race.':'Waiting for host approval.'});this.changed();});
  c.on('data',d=>{if(d?.type==='spectator-ping'){const now=performance.now();v.last=now;if(!v.pongAt||now-v.pongAt>=500){v.pongAt=now;this.send(c,{type:'spectator-pong'});}}});
  const close=()=>{if(this.viewers.get(c.peer)!==v)return;this.viewers.delete(c.peer);this.revoke(v);this.changed();};c.on('close',close);c.on('error',()=>{close();c.close();});this.changed();
 }
 expire(now=performance.now()){for(const v of [...this.viewers.values()])if(now-v.last>30000){this.viewers.delete(v.conn.peer);this.revoke(v);if(!v.integrated)v.conn.close();this.changed();}if(!this.viewers.size){clearInterval(this.reaper);this.reaper=null;}}
 approve(id,allow){const v=this.viewers.get(id);if(!this.room.isHost||!v)return;v.approved=!!allow;if(!allow){this.send(v.conn,{type:'spectator-status',message:'The host declined this spectator request.'});v.conn.close();this.viewers.delete(id);}else this.send(v.conn,{type:'spectator-status',message:'Approved. Waiting for a race.'});this.changed();}
 revoke(v){if(v.relay){const c=this.room.connections.get(v.relay);this.send(c,{type:'spectator-revoke',viewer:v.conn.peer});}v.relay=null;}
 sync(state){
  if(this.room.isHost&&this.room.waiters){
   const desired=new Map([...this.room.waiters.values()].filter(w=>w.spectator&&!w.needsApproval).map(w=>[w.id,w]));
   for(const [id,v] of this.viewers)if(v.integrated&&(!desired.has(id)||(id!==this.room.id&&this.room.connections.get(id)!==v.conn))){this.revoke(v);this.viewers.delete(id);}
   for(const [id,w] of desired){
    if(this.viewers.has(id))continue;
    const conn=id===this.room.id?{peer:id,open:true,send:d=>this.onMessage(d),close:()=>{}}:this.room.connections.get(id);
    if(conn?.open)this.viewers.set(id,{conn,name:w.name,approved:true,relay:null,integrated:true,last:performance.now()});
   }
  }
  if(this.room.isHost&&this.epoch!==this.room.epoch)for(const v of this.viewers.values())this.revoke(v);
  if(this.room.isHost&&['preparing','playing'].includes(state.phase))this.assignViewers();
  if(state.phase===this.phase&&this.room.epoch===this.epoch){this.changed();return;}
  const old=this.phase;this.phase=state.phase;this.epoch=this.room.epoch;
  if(old==='playing'&&state.phase!=='playing'&&state.phase!=='preparing')this.stopStreams('The arcade session ended. Waiting for the next session.');
  if(['idle','error'].includes(state.phase)&&this.viewers.size){for(const v of this.viewers.values())if(!v.integrated)v.conn.close();this.viewers.clear();this.changed();}
  this.changed();
 }
 assignViewers(){
  if(!this.room.isHost)return;
  const relays=this.room.members.filter(m=>m.id!==this.room.host&&m.id!==this.room.id&&m.connection!=='reconnecting'&&this.room.connections.get(m.id)?.open),loads=new Map();
  for(const v of this.viewers.values())if(v.relay)loads.set(v.relay,(loads.get(v.relay)||0)+1);
  for(const v of this.viewers.values()){
   if(v.relay||!v.approved||!v.conn.open)continue;
   const relay=relays.filter(m=>(loads.get(m.id)||0)<2).sort((a,b)=>(loads.get(a.id)||0)-(loads.get(b.id)||0))[0];
   if(!relay){this.send(v.conn,{type:'spectator-status',message:'All spectator relays are busy. Waiting for a free relay.'});continue;}
   const ticket=token();loads.set(relay.id,(loads.get(relay.id)||0)+1);v.relay=relay.id;
   this.send(this.room.connections.get(relay.id),{type:'spectator-grant',epoch:this.room.epoch,viewer:v.conn.peer,ticket});
   this.send(v.conn,{type:'spectator-assignment',epoch:this.room.epoch,relay:relay.id,ticket,name:relay.name});
  }
 }
 handle(c,d){
  if(!d||!['spectator-grant','spectator-revoke','spectator-assignment','spectator-status'].includes(d.type))return false;
  if(this.room.isHost||c!==this.room.server)return true;
  if(['spectator-assignment','spectator-status'].includes(d.type)){if(this.room.waiters.get(this.room.id)?.spectator)this.onMessage(d);return true;}
  if(d.type==='spectator-revoke'){this.tickets.delete(d.viewer);const stream=this.streams.get(d.viewer);if(stream){this.streams.delete(d.viewer);stream.conn.close();}return true;}
  if(typeof d.viewer!=='string'||d.viewer.length>100||!/^[a-f0-9]{32}$/.test(d.ticket||'')||!/^[a-f0-9]{32}$/.test(d.epoch||'')||this.tickets.size>=CAP)return true;
  this.tickets.set(d.viewer,{ticket:d.ticket,epoch:d.epoch,until:performance.now()+60000});return true;
 }
 stream(c){
  const t=this.tickets.get(c.peer),m=c.metadata;
  if(this.room.isHost||!t||t.ticket!==m.ticket||t.epoch!==m.epoch||performance.now()>t.until||this.streams.size>=2){c.close();return;}
  const s={conn:c,begun:false,epoch:m.epoch};this.streams.set(c.peer,s);
  c.on('open',()=>{this.begin(s);this.ensureTimer();this.changed();});
  c.on('data',()=>c.close());const close=()=>{if(this.streams.get(c.peer)===s){this.streams.delete(c.peer);if(!this.streams.size){clearInterval(this.timer);this.timer=null;}this.changed();}};c.on('close',close);c.on('error',()=>{close();c.close();});
 }
 prepared(config){
  this.config=config;this.frames=[];this.orders=[];this.serial=0;
  for(const s of this.streams.values())this.begin(s);
 }
 begin(s){if(s.begun||!s.conn.open||!this.config||s.epoch!==this.config.epoch)return;s.begun=this.send(s.conn,{type:'spectator-begin',version:SPECTATOR_VERSION,config:this.config});}
 ensureTimer(){if(!this.timer)this.timer=setInterval(()=>{void this.flush();},1000/SPECTATOR_HZ);}
 start(){this.generation++;for(const s of this.streams.values())this.begin(s);if(this.streams.size)this.ensureTimer();}
 get capturing(){return false;}
 beginStep(){} // Racers no longer journal or copy their per-step inbox/inputs.
 order(){}
 endStep(){}
 async flush(){
  if(this.room.isHost||this.busy||!this.room.active||!this.config||![...this.streams.values()].some(s=>s.begun&&s.conn.open))return;
  this.busy=true;const generation=this.generation;
  try{
   const wasm=this.getWasm(),ptr=wasm?._daytona_spectator_world_export();if(!ptr)return;
   const raw=wasm.HEAPU8.slice(ptr,ptr+wasm._daytona_spectator_world_size()).buffer,format=typeof CompressionStream==='function'?'deflate':'raw',bytes=await transformPacket(raw,format);
   if(generation!==this.generation)return;
   for(const [id,s] of this.streams){if(!s.begun||!s.conn.open)continue;if(!this.send(s.conn,{type:'spectator-world',epoch:this.config.epoch,format,bytes})){this.streams.delete(id);s.conn.close();this.changed();}}
  }catch{this.stopStreams('The spectator relay stopped. Drivers are unaffected.');}finally{this.busy=false;}
 }
 stopStreams(message){this.generation++;clearInterval(this.timer);this.timer=null;this.sending=false;this.config=null;this.frames=[];this.orders=[];this.frame=null;this.getWasm()?._daytona_spectator_replay?.(0,0);for(const s of this.streams.values()){this.send(s.conn,{type:'spectator-wait',message});s.conn.close();}this.streams.clear();this.tickets.clear();this.changed();}
 close(){clearInterval(this.reaper);this.reaper=null;this.stopStreams('The relay left the room. The race continues.');for(const v of this.viewers.values()){this.revoke(v);if(!v.integrated)v.conn.close();}this.viewers.clear();this.phase='';this.epoch='';this.changed();}
}
export function spectatorConfig(wasm,room,config){return {epoch:room.epoch,settings:config,members:room.members.map(m=>({id:m.id,name:m.name,cabinet:m.cabinet,skin:m.skin??0})),donor:room.id,host:room.host,eeprom:wasm.HEAPU8.slice(wasm._daytona_eeprom_ptr(),wasm._daytona_eeprom_ptr()+wasm._daytona_eeprom_size()).buffer,drawDistance:wasm._daytona_draw_distance()};}
