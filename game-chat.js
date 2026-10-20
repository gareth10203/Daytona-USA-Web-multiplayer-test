// One bounded room history, also used by the lobby. No polling/network timer.
export function mountGameChat(root,{room,storage,gameShown=()=>false,notify=()=>{},onTyping=()=>{},onRead=()=>{},returnFocus=()=>{}}){
 const find=id=>root.querySelector('#'+id),panel=find('gameChatPanel'),toggle=find('gameChatToggle'),badge=find('gameChatUnread'),log=find('gameChatLog'),input=find('gameChatInput'),send=find('gameChatSend'),feedback=find('gameChatFeedback'),newer=find('gameChatNew'),empty=find('gameChatEmpty');
 let collapsed=false;try{collapsed=storage?.getItem('daytona-game-chat-collapsed-v1')==='1';}catch{}
 let key='',baseline=false,lastSeq=0,unread=0,shown=false,lastAck=0,lastRead=0,lastUpdate=-Infinity,displayKey='';const nodes=new Map();
 const bottom=()=>log.scrollTop+log.clientHeight>=log.scrollHeight-24;
 const typing=()=>root.contains(document.activeElement)&&document.activeElement===input;
 function read(){if(unread){unread=0;paintUnread();}if(lastSeq>lastRead){lastRead=lastSeq;onRead();}}
 function paintUnread(){badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);toggle.setAttribute('aria-label',`Show room chat${unread?`, ${unread} unread messages`:''}`);newer.hidden=!unread||collapsed;newer.textContent=unread?`${unread} new message${unread===1?'':'s'} ↓`:'New messages ↓';}
 function latest(){log.scrollTop=log.scrollHeight;read();}
 function collapse(value,focus=true){collapsed=value;try{storage?.setItem('daytona-game-chat-collapsed-v1',value?'1':'0');}catch{}update(true);if(focus){if(value)returnFocus();else input.focus({preventScroll:true});}if(!value)latest();}
 toggle.onclick=()=>collapse(false);find('gameChatHide').onclick=()=>collapse(true);newer.onclick=latest;
 log.addEventListener('scroll',()=>{if(shown&&!collapsed&&bottom())read();});
 root.addEventListener('focusin',()=>{if(typing())onTyping();});
 root.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();collapse(true);}});
 input.addEventListener('input',()=>{send.disabled=!room.chatAllowed(room.id)||!input.value.trim();});
 find('gameChatForm').addEventListener('submit',event=>{event.preventDefault();try{if(room.submitChat(input.value)){input.value='';send.disabled=true;feedback.textContent=room.isHost?'Message sent.':'Sending…';latest();input.focus({preventScroll:true});}}catch(e){feedback.textContent=e.message;}});
 function update(force=false){
  const now=performance.now();if(!force&&now-lastUpdate<100)return;lastUpdate=now;
  const available=room.active&&room.chatAllowed(room.id),next=available&&gameShown();
  if(shown!==next){shown=next;root.hidden=!next;if(!next&&root.contains(document.activeElement)){document.activeElement.blur();if(gameShown())returnFocus();}}
  const stamp=`${next}:${collapsed}:${available}`;if(stamp!==displayKey){displayKey=stamp;panel.hidden=!next||collapsed;toggle.hidden=!next||!collapsed;toggle.setAttribute('aria-expanded',String(!collapsed));input.disabled=!available;send.disabled=!available||!input.value.trim();}
  if(next&&!collapsed&&!document.hidden&&bottom())read();
  // Reading in the lobby also clears the in-game badge.
  const lobby=document.getElementById('chatLog');if(unread&&!document.hidden&&lobby?.getClientRects().length&&lobby.scrollTop+lobby.clientHeight>=lobby.scrollHeight-24)read();
 }
 function sync(state){
  const nextKey=(state.host||'')+':'+state.id;if(key!==nextKey){key=nextKey;displayKey='';baseline=false;lastSeq=0;lastAck=0;lastRead=0;unread=0;nodes.clear();log.replaceChildren();input.value='';feedback.textContent='Chat pauses during the race.';paintUnread();}
  const chat=state.chat||[],nearBottom=bottom(),wanted=new Set(chat.map(m=>m.seq));let added=0,own=false;
  for(const [seq,node] of nodes)if(!wanted.has(seq)){node.remove();nodes.delete(seq);}
  for(const m of chat){if(nodes.has(m.seq))continue;const li=document.createElement('li'),head=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');li.className='chat-message'+(m.sender===state.id?' own-message':'');name.textContent=m.sender===state.id?'You':m.name;time.dateTime=new Date(m.time).toISOString();time.textContent=new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});head.append(name,time);text.textContent=m.text;li.append(head,text);log.append(li);nodes.set(m.seq,li);if(baseline&&m.seq>lastSeq){if(m.sender!==state.id)added++;else own=true;}}
  lastSeq=Math.max(lastSeq,...chat.map(m=>m.seq),0);baseline=state.members.some(m=>m.id===state.id);unread+=added;empty.hidden=chat.length>0;
  if(added&&room.active&&room.chatAllowed(room.id)&&!document.hidden)notify();
  if(state.lastAck?.action==='chat-submit'&&state.lastAck.command>lastAck){lastAck=state.lastAck.command;feedback.textContent=state.lastAck.accepted?'Confirmed by host.':state.lastAck.reason;}
  paintUnread();update(true);if(shown&&!collapsed&&(nearBottom||own))latest();
 }
 return {sync,update,typing,hide:()=>collapse(true),get unread(){return unread;}};
}
