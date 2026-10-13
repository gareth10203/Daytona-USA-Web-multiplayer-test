import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Multiplayer} from '../web/multiplayer.js';
import {parseInvitation,configurationInputs,validateSettings} from '../web/room-settings.js';
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
