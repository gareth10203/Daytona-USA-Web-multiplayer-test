import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Multiplayer} from '../web/multiplayer.js';
import {parseInvitation,configurationInputs,singleConfigurationInputs,prepareSingleCabinet,validateSettings} from '../web/room-settings.js';
import {DEFAULT_EEPROM} from '../web/nvram.js';
const peers=new Map();
class Connection extends EventEmitter{
 constructor(peer,metadata){super();this.peer=peer;this.metadata=metadata;this.open=false;this.dataChannel={ordered:true,maxRetransmits:null,maxPacketLifeTime:null,bufferedAmount:0};}
 send(data){const copy=structuredClone(data);queueMicrotask(()=>{if(this.other.open)this.other.emit('data',copy);});}
 close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close');}}
}
class FakePeer extends EventEmitter{
 constructor(id){super();this.id=id;this.links=[];peers.set(id,this);queueMicrotask(()=>this.emit('open',id));}
 connect(id,options){const target=peers.get(id);if(!target)throw Error('Unknown peer');const a=new Connection(id),b=new Connection(this.id,options.metadata);a.other=b;b.other=a;this.links.push(a);target.links.push(b);queueMicrotask(()=>{target.emit('connection',b);a.open=b.open=true;b.emit('open');a.emit('open');});return a;}
 destroy(){this.destroyed=true;peers.delete(this.id);for(const x of this.links)x.close();}
}
globalThis.Peer=FakePeer;
const flush=()=>new Promise(resolve=>setTimeout(resolve,5));
test('invitations keep the room key in the fragment; invalid codes and settings are rejected',()=>{
 const code='dt-1234567890.'+'a'.repeat(32);assert.equal(parseInvitation('https://example.com/game/#room='+code).host,'dt-1234567890');assert.throws(()=>parseInvitation('DAYTONA-1234'));assert.throws(()=>validateSettings({mode:9,difficulty:0,region:'Export'}));assert.throws(()=>configurationInputs({master:true,cabinet:9,mode:0,difficulty:0,region:'Export'}));
});
test('single-player preparation selects a standalone deluxe cabinet and preserves backup RAM',async()=>{
 const memory=new Uint8Array(256);memory.fill(77,128);let reloads=0,linkSetting=null;
 const engine={
  HEAPU8:memory,
  _daytona_eeprom_ptr:()=>0,_daytona_eeprom_size:()=>128,
  _daytona_backup_ptr:()=>128,_daytona_backup_size:()=>128,
  _daytona_step:()=>1,_daytona_link_enable:value=>(linkSetting=value,1)
 };
 assert.deepEqual(singleConfigurationInputs(),[4,8,8,2,...Array(8).fill(128),8,8,8,8,8,8,8,8,2,128,128,2]);
 await prepareSingleCabinet(engine,()=>{reloads++;memory.fill(255);});
 assert.equal(reloads,2);assert.equal(linkSetting,0);
 assert.deepEqual(memory.slice(0,128),DEFAULT_EEPROM);
 assert.ok(memory.slice(128).every(value=>value===77));
 assert.equal(memory[11],0);assert.equal(memory[26],0);
});
test('host approval, shared readiness, original ring routing and disconnect restart',async()=>{
 const received=[[],[],[]],started=[0,0,0],stopped=[0,0,0],configs=[];
 const rooms=Array.from({length:3},(_,i)=>new Multiplayer({onBytes:b=>received[i].push([...b]),onStart:()=>started[i]++,onStop:()=>stopped[i]++,onPrepare:async c=>configs.push({i,...c})}));
 const [host,a,b]=rooms;
 try{
  await host.create('Host');await a.join(host.snapshot().code,'A');await b.join(host.snapshot().code,'B');await flush();
  assert.equal(host.members.length,1);assert.equal(host.pending.size,2);assert.equal(a.phase,'pending');
  host.approve(a.id);host.approve(b.id);await flush();assert.equal(a.members.length,3);assert.equal(b.members.length,3);
  for(const r of rooms)r.ready(true);await flush();assert.ok(host.members.every(x=>x.ready));
  host.setSettings({mode:2,difficulty:3,region:'Export'});await flush();assert.ok(host.members.every(x=>!x.ready));assert.equal(a.settings.mode,2);
  for(const r of rooms)r.ready(true);await flush();await host.start();await flush();assert.deepEqual(started,[1,1,1]);assert.ok(configs.every(c=>c.mode===2&&c.difficulty===3));assert.equal(configs.filter(c=>c.master).length,1);
  host.write(new Uint8Array([1]));a.write(new Uint8Array([2]));b.write(new Uint8Array([3]));await flush();assert.deepEqual(received,[[[3]],[[1]],[[2]]]);
  b.leave();await flush();assert.equal(host.phase,'lobby');assert.equal(a.phase,'lobby');assert.equal(host.members.length,2);assert.ok(stopped[0]&&stopped[1]);assert.ok(host.members.every(x=>!x.ready));
 }finally{for(const r of rooms)r.leave();}
});
test('capacity is eight, stale readiness cannot start and late admission is rejected',async()=>{
 const host=new Multiplayer(),guests=Array.from({length:8},()=>new Multiplayer());
 try{
  await host.create('H');
  for(let i=0;i<7;i++){await guests[i].join(host.snapshot().code,'G'+i);await flush();host.approve(guests[i].id);await flush();}
  assert.equal(host.members.length,8);await guests[7].join(host.snapshot().code,'overflow');await flush();assert.equal(guests[7].phase,'error');
  host.handle(host.connections.get(guests[0].id),{type:'ready',value:true,revision:99},true);assert.equal(host.members[1].ready,false);
  await host.start();assert.equal(host.phase,'lobby');
 }finally{host.leave();for(const r of guests)r.leave();}
});

async function linkedRooms(count=3){
 const visibility=Array(count).fill(true),stopped=Array(count).fill(0);
 const rooms=Array.from({length:count},(_,i)=>new Multiplayer({isVisible:()=>visibility[i],onStop:()=>stopped[i]++}));
 await rooms[0].create('Host');
 for(let i=1;i<count;i++){await rooms[i].join(rooms[0].snapshot().code,'Guest '+i);await flush();rooms[0].approve(rooms[i].id);await flush();}
 for(const r of rooms)r.ready(true);await flush();await rooms[0].start();await flush();
 return {rooms,visibility,stopped};
}
test('host and guest visibility interruption stop every cabinet, retain the room and allow a clean restart',async()=>{
 const {rooms,visibility,stopped}=await linkedRooms();const host=rooms[0],code=host.snapshot().code;
 try{
  for(const index of [0,1]){
   const epoch=host.epoch;visibility[index]=false;rooms[index].visibilityChanged();await flush();
   assert.ok(rooms.every(r=>r.phase==='lobby'&&!r.active&&!r.awaitingStop));assert.ok(rooms.every(r=>r.members.length===3&&r.members.every(m=>!m.ready)));assert.equal(host.snapshot().code,code);
   visibility[index]=true;rooms[index].visibilityChanged();assert.ok(rooms.every(r=>!r.active));
   for(const r of rooms)r.ready(true);await flush();await host.start();await flush();assert.ok(rooms.every(r=>r.active));assert.notEqual(host.epoch,epoch);
   host.handle(host.connections.get(rooms[1].id),{type:'stop',epoch,reason:'stale'},true);assert.ok(host.active);
  }
  assert.deepEqual(stopped,[2,2,2]);
 }finally{for(const r of rooms)r.leave();}
});
test('keepalive traffic cannot conceal a stalled host and guests wait for stop acknowledgment',async()=>{
 const {rooms}=await linkedRooms();const [host,a,b]=rooms;
 try{
  const epoch=host.epoch;const now=performance.now();
  for(const guest of [a,b]){
   guest.advance();guest.server.emulation.at=now-6000;
   guest.handle(guest.server,{type:'ping',time:now,epoch,frames:0},false);assert.equal(guest.server.emulation.at,now-6000);
   guest.checkProgress(now);assert.equal(guest.phase,'lobby');assert.ok(guest.awaitingStop);guest.ready(true);assert.ok(guest.members.every(m=>!m.ready));
  }
  await flush();assert.ok(rooms.every(r=>r.phase==='lobby'&&!r.awaitingStop));assert.equal(host.members.length,3);
 }finally{for(const r of rooms)r.leave();}
});
test('host watches each slave progress, while progressing cabinets stay active',async()=>{
 const {rooms}=await linkedRooms();const [host,a,b]=rooms;
 try{
  const now=performance.now();for(const r of rooms)r.advance();
  for(const guest of [a,b])host.handle(host.connections.get(guest.id),{type:'ping',time:now,epoch:host.epoch,frames:1},true);
  host.checkProgress(now);assert.ok(host.active);
  host.connections.get(b.id).emulation.at=now-6000;host.checkProgress(now);await flush();assert.ok(rooms.every(r=>r.phase==='lobby'));
 }finally{for(const r of rooms)r.leave();}
});

test('relayed slave packets cannot pretend that the master is advancing',async()=>{
 const {rooms}=await linkedRooms();const [host,a,b]=rooms;
 try{
  host.advance();const now=performance.now();b.server.emulation={epoch:host.epoch,frames:host.progressFrames,at:now-6000};
  a.advance();a.write(new Uint8Array([9]));await flush();assert.equal(b.server.emulation.at,now-6000);
  b.checkProgress(performance.now());await flush();assert.ok(rooms.every(r=>r.phase==='lobby'));
 }finally{for(const r of rooms)r.leave();}
});

test('preparation never advertises counters retained from the previous race',async()=>{
 const {rooms}=await linkedRooms(2);const [host,guest]=rooms;
 try{
  for(const r of rooms)for(let i=0;i<100;i++)r.advance();host.end('Restart');await flush();
  for(const r of rooms){r.onPrepare=async()=>{assert.equal(r.progressFrames,0);r.heartbeat();};r.ready(true);}
  await flush();await host.start();await flush();assert.ok(rooms.every(r=>r.active&&r.progressFrames===0));
  assert.equal(guest.server.emulation.frames,0);assert.equal(host.connections.get(guest.id).emulation.frames,0);
 }finally{for(const r of rooms)r.leave();}
});
