// A short grace period and spaced reminders; no stored chat history is replayed.
export function createLobbyNotifications({notifyChat=()=>{},notifyReady=()=>{},visible=()=>!document.hidden,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),initialDelay=5000,repeatDelay=12000}={}){
 let key='',baseline=false,lastChat=0,state=null,timer=null;
 const eligible=()=>{
  if(!state||state.phase!=='lobby'||state.awaitingStop||state.readyPending||state.pending?.length||state.members.length<2)return false;
  const me=state.members.find(m=>m.id===state.id);
  return !!me&&!me.ready&&state.members.every(m=>m.connection!=='reconnecting'&&(m.id===state.id||m.ready));
 };
 const stop=()=>{if(timer!==null)cancel(timer);timer=null;};
 function remind(){timer=null;if(!eligible())return;if(visible())notifyReady();timer=schedule(remind,repeatDelay);}
 return {
  update(next){
   state=next;const nextKey=(next.host||'')+':'+next.id;
   if(nextKey!==key){key=nextKey;baseline=false;lastChat=0;stop();}
   const admitted=next.members.some(m=>m.id===next.id),inLobby=next.phase==='lobby'&&admitted;
   const newest=Math.max(0,...(next.chat||[]).map(m=>m.seq));
   if(inLobby&&baseline&&(next.chat||[]).some(m=>m.seq>lastChat&&m.sender!==next.id))notifyChat();
   lastChat=Math.max(lastChat,newest);baseline=inLobby;
   if(!eligible())stop();else if(timer===null)timer=schedule(remind,initialDelay);
  },
  dispose(){stop();state=null;baseline=false;}
 };
}
