export const arrivalRoomKey=s=>s?.host&&s?.id&&s?.code?`${s.host}:${s.id}:${s.code}`:'';
const label=(value,max)=>String(value||'').replace(/[\u0000-\u001f\u007f]/gu,'').slice(0,max);
// Observe validated room snapshots, never raw PeerJS packets. Membership stages
// are retained across reconnections and waiting-seat promotion in the same room.
export function createRoomArrivals({notify=()=>{}}={}){
 let key='',baseline=false;const seen=new Map();
 return {update(state){
  const next=arrivalRoomKey(state);
  if(next!==key||state.phase==='idle'){key=next;baseline=false;seen.clear();}
  if(!key||!['lobby','waiting','preparing','playing'].includes(state.phase))return;
  const people=new Map();
  if(state.visibility==='private')for(const p of state.pending||[])people.set(p.id,{person:p,stage:'request'});
  for(const p of state.waiting||[])people.set(p.id,{person:p,stage:p.needsApproval?'request':'joined'});
  for(const p of state.members||[])people.set(p.id,{person:p,stage:'joined'});
  for(const [id,{person,stage}] of people){
   if(!id||id===state.id)continue;
   let record=seen.get(id);if(!record){record={request:false,joined:false};seen.set(id,record);}
   if(record[stage])continue;record[stage]=true;
   const system=!!state.isHost&&(stage==='request'?state.visibility==='private':state.visibility==='public');
   const sound=stage==='request'?!!state.isHost:!!state.isHost||['lobby','waiting'].includes(state.phase);
   if(baseline&&(system||sound))notify({kind:stage,id,name:label(person.name,24)||'Driver',roomName:label(state.roomName,48),roomKey:key,system,sound});
  }
  baseline=true;
  while(seen.size>256)seen.delete(seen.keys().next().value);
 },dispose(){seen.clear();baseline=false;key='';}};
}
