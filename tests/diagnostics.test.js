import test from 'node:test';
import assert from 'node:assert/strict';
import {Diagnostics} from '../web/diagnostics.js';
import {Multiplayer} from '../web/multiplayer.js';

test('diagnostics distinguish simulation from repeated draws, and retain bounded local history',()=>{
  let now=0;const d=new Diagnostics({clock:()=>now,read:()=>({heapBytes:256}),network:()=>({bufferedBytes:0})});
  d.step(20);assert.equal(d.steps,0);d.enable(true);
  for(let i=0;i<60;i++){now=i*16;d.draw();if(i<30)d.step(4);}
  d.discard(17);now=1000;d.update(true);
  assert.equal(d.latest.simulationHz,30);assert.equal(d.latest.drawHz,60);assert.equal(d.latest.cpuMeanMs,4);assert.equal(d.latest.discardedMs,17);
  for(let i=0;i<310;i++){now+=1000;d.update(false);}
  assert.equal(d.history.length,300);assert.equal(d.latest.simulationHz,0);
  assert.ok(!JSON.stringify(d.report()).includes('roomToken'));
  d.enable(false);now+=1000;d.update(true);assert.equal(d.history.length,300);
});

test('network statistics use the selected RTC pair, expose no addresses and discard stale results',async()=>{
  const room=new Multiplayer();
  const stats=new Map([
    ['t',{type:'transport',selectedCandidatePairId:'p'}],
    ['p',{type:'candidate-pair',currentRoundTripTime:.025,localCandidateId:'l',remoteCandidateId:'r'}],
    ['l',{candidateType:'relay',address:'private-address'}],['r',{candidateType:'host'}]
  ]);
  const conn={open:true,dataChannel:{bufferedAmount:500},peerConnection:{getStats:async()=>stats}};
  room.server=conn;await room.pollDiagnostics();assert.equal(room.diagnostics().rttMs,25);assert.equal(room.diagnostics().bufferedBytes,500);assert.equal(room.diagnostics().relayConnections,1);
  assert.ok(!JSON.stringify(room.diagnostics()).includes('private-address'));
  let finish;conn.peerConnection.getStats=()=>new Promise(resolve=>{finish=resolve;});
  const pending=room.pollDiagnostics();room.reset();finish(stats);await pending;assert.equal(room.diagnostics().connections,0);assert.equal(room.networkStats.size,0);
});
