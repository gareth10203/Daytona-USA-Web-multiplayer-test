export const SLOT_BYTES=0x1c0,SAMPLE_BYTES=SLOT_BYTES+5,STATE_BYTES=SLOT_BYTES*8+1+9*4;
export const STATE_TAG=0xfd;
// Preserve the IDs assigned by RC1's original discovery (slaves count backwards).
export function linkIdForSeat(seat,count){return seat===1?1:count-seat+2;}
export class HostDistributor {
 constructor(members){
  if(!Array.isArray(members)||members.length<2||members.length>8||new Set(members.map(m=>m.id)).size!==members.length||members.some((m,i)=>typeof m.id!=='string'||m.cabinet!==i+1))throw Error('Invalid centralized grid.');
  this.members=members.map(m=>({...m}));this.samples=new Map();this.sequence=0;this.discarded=0;
 }
 accept(id,frames,bytes){
  const member=this.members.find(m=>m.id===id);
  if(!member||!Number.isSafeInteger(frames)||frames<0||!(bytes instanceof ArrayBuffer)||bytes.byteLength!==SAMPLE_BYTES)throw Error('Invalid cabinet sample.');
  const sample=new Uint8Array(bytes);
  if(sample[0]!==linkIdForSeat(member.cabinet,this.members.length))throw Error('Cabinet sample identity mismatch.');
  const previous=this.samples.get(id);
  if(previous&&frames<=previous.frames){this.discarded++;return false;}
  this.samples.set(id,{frames,bytes:sample.slice(1,1+SLOT_BYTES),clock:new DataView(bytes).getUint32(1+SLOT_BYTES,true),at:performance.now()});return true;
 }
 get ready(){return this.samples.size===this.members.length;}
 snapshot(id){
  if(!this.ready)return null;
  const target=this.members.findIndex(m=>m.id===id);if(target<0)throw Error('Unknown state recipient.');
  const bytes=new Uint8Array(STATE_BYTES);bytes[0]=STATE_TAG;
  const clocks=new DataView(bytes.buffer),clockOffset=1+SLOT_BYTES*8;
  clocks.setUint32(clockOffset,this.samples.get(this.members[0].id).clock,true);
  // Incoming slot 0 belongs to the predecessor. Recreate the game's expected
  // circular RAM layout using independent samples, with no network circulation.
  for(let slot=0;slot<8;slot++){
   const index=(target-1-slot+this.members.length*8)%this.members.length;
   bytes.set(this.samples.get(this.members[index].id).bytes,1+slot*SLOT_BYTES);
   clocks.setUint32(clockOffset+4+slot*4,this.samples.get(this.members[index].id).clock,true);
  }
  return bytes.buffer;
 }
}
