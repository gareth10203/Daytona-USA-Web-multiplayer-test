// Bounded, non-interactive announcement. It never changes menu/focus/game state.
export function mountWaitingToast(root,{schedule=setTimeout,cancel=clearTimeout}={}){
 let key='',seen=new Set(),timer=null;
 function hide(){if(timer!==null)cancel(timer);timer=null;root.hidden=true;}
 return {sync(state){
  const next=(state.host||'')+':'+state.id;
  if(next!==key){key=next;seen=new Set();hide();}
  const waiting=state.waiting||[],added=waiting.filter(w=>!seen.has(w.id));
  // Retain IDs for this room, including reconnections; at most eight seats.
  seen=new Set(waiting.map(w=>w.id));
  if(!state.isHost||!['playing','preparing'].includes(state.phase)){hide();return;}
  if(!added.length)return;
  hide();const title=document.createElement('strong'),detail=document.createElement('span');
  title.textContent=added.length===1?`${added[0].name} ${added[0].needsApproval?'requested to join':'joined the room'}`:`${added.length} drivers joined the waiting seats`;
  detail.textContent=added.some(w=>w.needsApproval)?'Review the request when you return to the lobby.':'Waiting for the next race · seat reserved';
  root.replaceChildren(title,detail);root.hidden=false;timer=schedule(()=>{root.hidden=true;timer=null;},5500);
 },dispose(){hide();seen.clear();}};
}
