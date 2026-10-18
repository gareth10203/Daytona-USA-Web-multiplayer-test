import {carColor} from './car-colors.js?v=43-reverse-checkpoints';
import {parseInvitation,invitation} from './room-settings.js?v=43-reverse-checkpoints';
import {createLobbyNotifications} from './lobby-notifications.js?v=43-reverse-checkpoints';
const $=id=>document.getElementById(id);
export function invitationFromURL(href){return new URLSearchParams(new URL(href).hash.slice(1)).get('room')||'';}
export function createRoomUI(room,{single,unlockAudio,canResume=()=>false,notifyRequest=()=>{},notifyChat=()=>{},notifyReady=()=>{},notifyConfirmed=()=>{}}){
 const panel=$('roomPanel'),choices=$('playerModes'),entry=$('multiplayerEntry'),singlePanel=$('singlePlayerPanel');
 let verified=false,view='loading',pendingStamp='',lastPhase='',lastURL='',roomKey='',pendingIDs=new Set(),unread=0,lastChatSeq=0,lastAckCommand=0,lastSeatAck=0,previousSeat=null,focusSeatReady=false,swapStamp='';
 const cards=new Map(),emptySeats=new Map(),messages=new Map();
 const notifications=createLobbyNotifications({notifyChat,notifyReady,notifyConfirmed});
 const utilities=document.querySelector('.menu-quick-controls'),utilitiesHome=utilities.parentElement;
 try{const name=localStorage.getItem('daytona-driver-name-v1');if(name)$('driverName').value=name.slice(0,24);}catch{}
 function layout(active,showGuide=false){$('menuDialog').classList.remove('single-view');singlePanel.hidden=true;$('menuDialog').classList.toggle('mp-view',active);$('menuDialog').classList.toggle('mp-entry',active&&showGuide);$('mpUtilities').hidden=!active;const target=active?$('mpUtilities'):utilitiesHome;if(utilities.parentElement!==target)target.append(utilities);}
 function navigation(next=view){
  view=next;
  choices.hidden=view!=='modes'||!verified;
  const resume=view==='modes'&&verified&&canResume();
  $('startBtn').hidden=!resume;$('closeBtn').hidden=!resume;
  if(resume){$('startBtn').disabled=false;$('startLabel').textContent='Resume arcade';}
 }
 function hint(){const code=$('joinCode').value.trim();let valid=false;try{parseInvitation(code);valid=true;}catch{}
  $('joinCard').classList.toggle('has-invitation',valid);$('invitationHint').textContent=valid?(code===invitationFromURL(location.href)?'Invitation loaded. Enter your name and join.':'Invitation ready. Your host approves the request.'):code?'Paste a complete invitation link or room code.':'Your host will approve your request.';
 }
 function setURL(code){const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));if(code)hash.set('room',code);else hash.delete('room');url.hash=hash.toString();history.replaceState(history.state,'',url.href);lastURL=code;}
 function syncInvitation(navigate=false){
  const code=invitationFromURL(location.href),changed=code!==lastURL;lastURL=code;$('joinCode').value=code;hint();
  if(!navigate||!verified||!code)return;
  let valid=false;try{parseInvitation(code);valid=true;}catch{}
  if(changed&&valid&&room.occupied&&!room.active&&room.phase!=='preparing'&&room.snapshot().code!==code)room.leave();
  if(['idle','error'].includes(room.phase))showEntry(false);
 }
 function showEntry(sync=true){if(sync)syncInvitation();layout(true,true);navigation('entry');entry.hidden=false;panel.hidden=true;$('entryStatus').textContent='';$('message').textContent='Create a private room or join your friends.';$('menuDialog').setAttribute('aria-labelledby','entryTitle');$('driverName').focus();}
 function showModes(){layout(false);entry.hidden=true;panel.hidden=true;navigation('modes');$('menuDialog').setAttribute('aria-labelledby','gameTitle');if(verified)$('message').textContent='ROM verified. Choose Single Player or Multiplayer.';}
 function action(fn){return async()=>{try{$('entryStatus').textContent='';await fn();}catch(e){$('entryStatus').textContent=e.message;$('roomMessage').textContent=e.message;$('message').textContent=e.message;}};}
 function rememberName(){try{localStorage.setItem('daytona-driver-name-v1',$('driverName').value.trim().slice(0,24));}catch{}}
 $('driverName').addEventListener('input',rememberName);
 $('driverName').addEventListener('change',rememberName);
 $('joinCode').addEventListener('input',hint);
 window.addEventListener('hashchange',()=>syncInvitation(true));
 window.addEventListener('popstate',()=>syncInvitation(true));
 window.addEventListener('pageshow',()=>{syncInvitation(true);requestAnimationFrame(()=>syncInvitation(true));});
 syncInvitation();
 $('singlePlayer').onclick=action(async()=>{setURL('');room.leave();showModes();await single();});
 $('multiplayerPlayer').onclick=()=>showEntry();
 $('modeBack').onclick=()=>{setURL('');showModes();};
 $('createRoom').onclick=action(async()=>{void unlockAudio();rememberName();setURL('');panel.hidden=false;entry.hidden=true;await room.create($('driverName').value);if(room.phase==='lobby')setURL(room.snapshot().code);});
 $('joinRoom').onclick=action(async()=>{void unlockAudio();const parsed=parseInvitation($('joinCode').value);rememberName();setURL(invitation(parsed.host,parsed.token));panel.hidden=false;entry.hidden=true;await room.join($('joinCode').value,$('driverName').value);});
 $('leaveRoom').onclick=()=>{room.leave();showEntry();};
 $('seatSwapAccept').onclick=()=>{const o=room.swapFor(room.id);if(o)room.answerSwap(o.id,true);};
 $('seatSwapDecline').onclick=()=>{const o=room.swapFor(room.id);if(o)room.answerSwap(o.id,false);};
 $('seatSwapCancel').onclick=()=>{const o=room.swapFor(room.id);if(o)room.cancelSwap(o.id);};
 $('readyRoom').onclick=()=>{void unlockAudio();const me=room.members.find(x=>x.id===room.id);room.ready(!me?.ready);};
 $('startRoom').onclick=action(async()=>{void unlockAudio();await room.start();});
 $('stopRoom').onclick=()=>room.end('The host returned everyone to the room.',room.id,'requested-stop','action');
 $('copyRoom').onclick=action(async()=>{await navigator.clipboard.writeText($('inviteLink').value);$('roomMessage').textContent='Link copied. Share it with your friends.';});
 $('copyCode').onclick=action(async()=>{await navigator.clipboard.writeText($('roomCode').textContent);$('roomMessage').textContent='Room code copied.';});
 $('inviteLink').onclick=event=>event.target.select();
 $('returnRoomGame').onclick=()=>$('startBtn').click();
 const change=()=>room.setSettings({mode:Number($('roomMode').value),difficulty:Number($('roomDifficulty').value),cpuCars:$('roomCpuCars').value==='true',reverse:$('roomDirection').value==='reverse',region:'Export'});
 $('roomMode').onchange=change;$('roomDifficulty').onchange=change;$('roomCpuCars').onchange=change;$('roomDirection').onchange=change;
 function markRead(){unread=0;for(const id of ['chatUnread','mobileChatUnread'])$(id).hidden=true;$('newChatMessages').hidden=true;}
 function scrollChat(){const log=$('chatLog');log.scrollTop=log.scrollHeight;markRead();}
  function mobileTab(tab){panel.dataset.mobileTab=tab;for(const [id,name] of [['roomGridTab','grid'],['roomChatTab','chat']]){$(id).setAttribute('aria-selected',String(tab===name));$(id).tabIndex=tab===name?0:-1;}if(tab==='chat')scrollChat();}
 $('roomGridTab').onclick=()=>mobileTab('grid');$('roomChatTab').onclick=()=>mobileTab('chat');
 for(const id of ['roomGridTab','roomChatTab'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const chat=e.key==='End'||(e.key!=='Home'&&id==='roomGridTab');mobileTab(chat?'chat':'grid');$(chat?'roomChatTab':'roomGridTab').focus();}});
 $('newChatMessages').onclick=scrollChat;
 $('chatLog').addEventListener('scroll',()=>{const log=$('chatLog');if(log.scrollTop+log.clientHeight>=log.scrollHeight-20)markRead();});
 $('chatInput').addEventListener('input',()=>{$('chatLength').textContent=`${$('chatInput').value.length}/240`;$('chatSend').disabled=room.phase!=='lobby'||!$('chatInput').value.trim();});
 $('chatInput').addEventListener('pointerdown',()=>{void unlockAudio();});
 $('chatForm').addEventListener('submit',e=>{e.preventDefault();void unlockAudio();try{if(room.submitChat($('chatInput').value)){$('chatInput').value='';$('chatLength').textContent='0/240';$('chatSend').disabled=true;$('chatFeedback').textContent=room.isHost?'Message sent.':'Sending…';scrollChat();$('chatInput').focus();}}catch(err){$('chatFeedback').textContent=err.message;}});
 function renderChat(state){
  const log=$('chatLog'),visible=log.getClientRects().length>0,nearBottom=log.scrollTop+log.clientHeight>=log.scrollHeight-24,chat=state.chat||[];
  const wanted=new Set(chat.map(m=>m.seq));for(const [seq,node] of messages)if(!wanted.has(seq)){node.remove();messages.delete(seq);}
  let added=0,own=false;
  for(const m of chat){if(messages.has(m.seq))continue;const li=document.createElement('li'),header=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');
   li.className=`chat-message${m.sender===state.id?' own-message':''}`;name.textContent=m.sender===state.id?'You':m.name;time.dateTime=new Date(m.time).toISOString();time.textContent=new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});header.append(name,time);text.textContent=m.text;li.append(header,text);log.append(li);messages.set(m.seq,li);if(m.seq>lastChatSeq){added++;own||=m.sender===state.id;}lastChatSeq=Math.max(lastChatSeq,m.seq);
  }
  $('chatEmpty').hidden=chat.length>0;
  if(added){if(visible&&(nearBottom||own))scrollChat();else {unread+=added;for(const id of ['chatUnread','mobileChatUnread']){$(id).hidden=false;$(id).textContent=String(unread);}$('newChatMessages').hidden=!visible;}}
  const admitted=state.members.some(m=>m.id===state.id),enabled=state.phase==='lobby'&&admitted;
  $('chatInput').disabled=!enabled;$('chatSend').disabled=!enabled||!$('chatInput').value.trim();
  if(!enabled)$('chatFeedback').textContent=state.phase==='reconnecting'?'Reconnecting. Your chat will be restored.':admitted?'Chat resumes when everyone returns to the lobby.':'Chat opens after the host admits you.';
  else if(state.lastAck&&state.lastAck.command>lastAckCommand){lastAckCommand=state.lastAck.command;if(state.lastAck.action==='chat-submit')$('chatFeedback').textContent=state.lastAck.accepted?'Confirmed by host.':state.lastAck.reason;}
  else if(!['Message sent.','Sending…','Confirmed by host.','Wait a moment before sending another message.'].includes($('chatFeedback').textContent))$('chatFeedback').textContent='Only players in this room can read this chat.';
 }
 function renderRoster(state){
  const list=$('playersList'),me=state.members.find(m=>m.id===state.id),wanted=new Set(state.members.map(m=>m.id));
  for(const [id,card] of cards)if(!wanted.has(id)){card.li.remove();cards.delete(id);}
  const showSeats=['lobby','reconnecting'].includes(state.phase)&&!!me,occupied=new Set(state.members.map(m=>m.cabinet));
  for(const [seat,node] of emptySeats)if(!showSeats||occupied.has(seat)){node.remove();emptySeats.delete(seat);}
  const nodes=new Map();
  for(const m of state.members){let c=cards.get(m.id);if(!c){const li=document.createElement('li'),number=document.createElement('span'),info=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('small'),status=document.createElement('span'),remove=document.createElement('button'),swap=document.createElement('button');
    li.className='driver-card';number.className='cabinet-number';info.className='driver-info';status.className='driver-status';remove.type='button';remove.className='remove-driver';remove.textContent='×';remove.onclick=()=>{if(room.kick(m.id))$('readyRoom').focus();};swap.type='button';swap.className='seat-swap';const action=document.createElement('span');action.className='seat-card-action';action.textContent='⇄ Request swap';swap.append(action);swap.onclick=()=>room.requestSwap(m.id);info.append(name,role);li.append(number,info,status,swap,remove);c={li,number,name,role,status,remove,swap};cards.set(m.id,c);}
   const reconnecting=m.connection==='reconnecting',color=carColor(m.cabinet),reserved=(state.swaps||[]).some(o=>o.from===m.id||o.to===m.id);c.li.style.setProperty('--car-color',color.color);c.number.title=`Car ${m.cabinet} · ${color.name}`;c.swap.hidden=m.id===state.id||state.phase!=='lobby';c.swap.disabled=reconnecting||reserved||!!state.seatActionPending||(state.swaps||[]).some(o=>o.from===state.id||o.to===state.id);c.swap.setAttribute('aria-label',`Request a swap with ${m.name}, car ${m.cabinet}`);c.swap.title=c.swap.disabled?'Seat reserved until the current request or reconnection ends.':`Request car ${m.cabinet} in exchange for yours`;c.li.dataset.seat=m.cabinet;c.li.classList.toggle('own-seat',m.id===state.id);c.li.classList.toggle('driver-ready',m.ready&&!reconnecting);c.li.classList.toggle('driver-reconnecting',reconnecting);c.number.textContent=String(m.cabinet).padStart(2,'0');c.name.textContent=m.name;c.name.title=m.name;c.role.textContent=`${m.id===state.id?'You · ':''}${m.id===state.host?'Host':'Driver'}${reconnecting?' · Seat reserved':m.rtt==null?'':' · '+m.rtt+' ms'}`;c.role.title=m.rtt==null?'':`Connection round-trip estimate: ${m.rtt} ms`;c.status.textContent=reconnecting?'RETRY':m.ready?'READY':'WAIT';c.status.title=reconnecting?'Reconnecting. Seat reserved for up to 30 seconds.':'';c.remove.hidden=!state.isHost||state.phase!=='lobby'||m.id===state.id;c.remove.title=`Remove ${m.name}`;c.remove.setAttribute('aria-label',`Remove ${m.name} from the room`);
   nodes.set(m.cabinet,c.li);
  }
  if(showSeats)for(let seat=1;seat<=8;seat++)if(!occupied.has(seat)){
   let node=emptySeats.get(seat);if(!node){node=document.createElement('li');node.className='driver-card empty-slot';node.dataset.seat=seat;
    const button=document.createElement('button'),number=document.createElement('span'),label=document.createElement('span'),action=document.createElement('span');button.type='button';button.className='seat-move';button.dataset.seat=seat;button.setAttribute('aria-label',`Move to seat ${seat}, car ${seat}`);number.className='cabinet-number';number.textContent=String(seat).padStart(2,'0');label.className='seat-label';label.textContent='Open seat';action.className='seat-action';action.textContent='Move here';button.append(number,label,action);button.onclick=()=>{if(room.moveSeat(seat))$('seatStatus').textContent=state.isHost?`Your car is ${seat}. Confirm Ready again.`:`Moving to car ${seat}…`;};node.append(button);emptySeats.set(seat,node);}
   const button=node.firstElementChild;button.disabled=state.phase!=='lobby'||!!state.seatActionPending||!!state.awaitingStop||(state.swaps||[]).some(o=>o.from===state.id||o.to===state.id);button.querySelector('.seat-action').textContent=state.seatPending===seat?'Moving…':'Move here';nodes.set(seat,node);
  }
  [...nodes].sort((a,b)=>a[0]-b[0]).forEach(([,node],i)=>{if(list.children[i]!==node)list.insertBefore(node,list.children[i]||null);});
  $('openSeatCount').hidden=showSeats;
  $('openSeatCount').textContent=state.members.length?`${8-state.members.length} ${state.members.length===7?'seat':'seats'} open · up to 8 drivers`:state.phase==='pending'?'Your host is reviewing the request.':state.phase==='error'?'Return to room selection to try another invitation.':'Preparing your private room…';
  const status=$('seatStatus');status.hidden=!showSeats||!!(state.swaps||[]).find(o=>o.from===state.id||o.to===state.id);
  if((state.lastAck?.action==='move-seat'||state.lastAck?.action.startsWith('swap-'))&&state.lastAck.command>lastSeatAck){lastSeatAck=state.lastAck.command;status.textContent=state.lastAck.accepted?(state.lastAck.action==='move-seat'?`Your car is ${me?.cabinet}. Confirm Ready again.`:state.swapNotice||'Seat request confirmed.'):state.lastAck.reason;}
  else if(state.seatPending)status.textContent=`Moving to car ${state.seatPending}…`;
  else if(me&&previousSeat!==me.cabinet)status.textContent=`Your car: ${me.cabinet}. Choose a seat to move, or a driver to request a swap.`;
  if(me&&previousSeat!==null&&previousSeat!==me.cabinet&&state.phase==='lobby')focusSeatReady=true;
  if(state.swapNotice&&!state.seatActionPending)status.textContent=state.swapNotice;
  else if(me?.ready&&!state.seatPending)status.textContent=`Your car: ${me.cabinet}. Choose a seat to move, or a driver to request a swap.`;
  previousSeat=me?.cabinet??null;
 }
 function renderSwap(state){
  const offer=(state.swaps||[]).find(o=>o.from===state.id||o.to===state.id),box=$('seatSwap'),incoming=offer?.to===state.id;
  const show=state.phase==='lobby'&&!!offer,stamp=show?offer.id:'';
  if(!show&&box.contains(document.activeElement))focusSeatReady=true;
  panel.classList.toggle('has-seat-swap',show);box.hidden=!show;if(!show){swapStamp='';return;}
  const other=state.members.find(m=>m.id===(incoming?offer.from:offer.to));
  $('seatSwapTitle').textContent=incoming?'Swap request':'Waiting for a reply · 30 s';
  $('seatSwapMessage').textContent=incoming?`${other?.name||'A driver'} offers car ${offer.fromCabinet} for your car ${offer.toCabinet}. `:`You offered car ${offer.fromCabinet} for ${other?.name||'the driver'}’s car ${offer.toCabinet}. `;
  $('seatSwapAccept').hidden=$('seatSwapDecline').hidden=!incoming;$('seatSwapCancel').hidden=incoming;
  for(const id of ['seatSwapAccept','seatSwapDecline','seatSwapCancel'])$(id).disabled=!!state.seatActionPending;
  if(stamp!==swapStamp){swapStamp=stamp;if(incoming)notifyRequest();if(!$('overlay').hidden&&$('settingsModal').hidden&&$('hostConsole')?.hidden!==false&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))$(incoming?'seatSwapAccept':'seatSwapCancel').focus({preventScroll:true});}
 }

 return {
  single(){layout(true,true);navigation('single');$('menuDialog').classList.add('single-view');singlePanel.hidden=false;entry.hidden=true;panel.hidden=true;$('menuDialog').setAttribute('aria-labelledby','singleTitle');},
  modes(){showModes();$('singlePlayer').focus();},
  opened(){navigation();},
  backLabel(){const o=room.swapFor(room.id);return o&&!$('seatSwap').hidden&&$('seatSwap').contains(document.activeElement)?o.to===room.id?'Decline swap':'Cancel request':null;},
  escape(){const o=room.swapFor(room.id);if(o&&!$('seatSwap').hidden&&$('seatSwap').contains(document.activeElement)){o.to===room.id?room.answerSwap(o.id,false):room.cancelSwap(o.id);return true;}if(entry.hidden)return false;showModes();$('multiplayerPlayer').focus();return true;},
  verified(){verified=true;$('startBtn').hidden=true;$('dropzone').hidden=true;syncInvitation();if(invitationFromURL(location.href))showEntry(false);else{showModes();$('singlePlayer').focus();}},
  loading(){layout(false);verified=false;navigation('loading');entry.hidden=true;panel.hidden=true;$('dropzone').hidden=false;},
  running(){if(!room.occupied)layout(false);navigation(room.occupied?'room':'modes');singlePanel.hidden=true;entry.hidden=true;},
  link(state,_id,count){
   // Discovery numbers the guests backwards. The lobby seat is the driver's
   // public cabinet/car number; the native link ID is transport identity only.
   const cabinet=room.members.find(member=>member.id===room.id)?.cabinet;
   const text=state===2?(cabinet?`Cabinet ${cabinet}`:`${count} cabinets`):'Linking arcade cabinets…';
   for(const name of ['networkStatus','arcadeLinkStatus'])if($(name).textContent!==text)$(name).textContent=text;
  },
  render(state){
   notifications.update(state);
   $('networkStatus').hidden=state.phase!=='playing';$('arcadeLinkStatus').hidden=state.phase!=='playing';
   const key=state.host||state.id||'idle';if(key!==roomKey){roomKey=key;pendingIDs=new Set();pendingStamp='';lastChatSeq=0;lastAckCommand=0;lastSeatAck=0;previousSeat=null;focusSeatReady=false;swapStamp='';$('seatStatus').textContent='';messages.clear();$('chatLog').replaceChildren();cards.clear();emptySeats.clear();$('playersList').replaceChildren();$('chatInput').value='';$('chatLength').textContent='0/240';markRead();mobileTab('grid');}
   if(state.phase==='idle')return;
   layout(true);panel.classList.toggle('guest-room',!state.isHost);panel.classList.toggle('has-requests',state.isHost&&state.pending.length>0);panel.dataset.phase=state.phase;
   if($('settingsModal').hidden&&$('hostConsole')?.hidden!==false)$('menuDialog').setAttribute('aria-labelledby','roomTitle');
   $('startBtn').disabled=state.phase!=='playing';navigation('room');panel.hidden=false;entry.hidden=true;
   $('roomTitle').textContent=state.phase==='pending'?'Request sent':state.phase==='error'?'Room unavailable':state.isHost?'Your starting grid':'Your race room';
   $('roomPhase').textContent={lobby:'LOBBY',preparing:'PREPARING',playing:'ON TRACK',pending:'WAITING',error:'OFFLINE',connecting:'CONNECTING',reconnecting:'RECONNECTING'}[state.phase]||'LOBBY';
   $('roomCount').textContent=state.phase==='pending'?'Awaiting host':`${state.members.length} / 8 drivers`;
   const url=new URL(location.href);url.hash=new URLSearchParams({room:state.code}).toString();$('inviteLink').value=state.code?url.href:'';$('roomCode').textContent=state.code||'Connecting…';$('inviteBlock').hidden=!state.isHost||!state.code;
   $('roomMode').value=state.settings.mode;$('roomDifficulty').value=state.settings.difficulty;$('roomCpuCars').value=String(state.settings.cpuCars??true);$('roomDirection').value=state.settings.reverse?'reverse':'normal';for(const id of ['roomMode','roomDifficulty','roomCpuCars','roomDirection'])$(id).disabled=!state.isHost||state.phase!=='lobby';
   $('roomSettingsHint').textContent=state.settings.reverse?'Choose any circuit. CPU cars follow this setting on all tracks.':state.isHost?'Shared by the grid. Changes reset Ready.':'Your host chooses these for everyone.';
   $('readyCount').textContent=`${state.members.filter(x=>x.ready).length} ready`;
   renderRoster(state);renderSwap(state);renderChat(state);
   const nextIDs=new Set(state.pending.map(m=>m.id));if(state.isHost&&state.phase==='lobby'&&state.pending.some(m=>!pendingIDs.has(m.id)))notifyRequest();pendingIDs=nextIDs;
   const stamp=JSON.stringify(state.pending);if(stamp!==pendingStamp){pendingStamp=stamp;$('pendingList').replaceChildren(...state.pending.map(m=>{const li=document.createElement('li'),name=document.createElement('span'),accept=document.createElement('button'),decline=document.createElement('button');name.textContent=m.name+(m.connection==='reconnecting'?' · Reconnecting…':'');name.title=m.name;accept.textContent='Admit';accept.disabled=m.connection==='reconnecting';accept.type=decline.type='button';decline.textContent='×';accept.setAttribute('aria-label',`Admit ${m.name}`);decline.setAttribute('aria-label',`Decline ${m.name}`);accept.onclick=()=>room.approve(m.id);decline.onclick=()=>room.reject(m.id);li.append(name,accept,decline);return li;}));}
   $('pendingBlock').hidden=!state.isHost||!state.pending.length;$('pendingCount').textContent=String(state.pending.length);
   const me=state.members.find(x=>x.id===state.id);$('readyRoom').disabled=!!state.awaitingStop||!!state.readyPending||!!state.seatActionPending||!!(state.swaps||[]).find(o=>o.from===state.id||o.to===state.id);$('readyRoom').hidden=state.phase!=='lobby'||!me;$('readyRoom').textContent=state.readyPending?'CONFIRMING…':me?.ready?'READY ✓':'I’M READY';$('readyRoom').setAttribute('aria-pressed',String(!!me?.ready));
   if(focusSeatReady&&!$('readyRoom').disabled){focusSeatReady=false;if(state.phase==='lobby'&&!$('overlay').hidden&&$('settingsModal').hidden&&$('hostConsole')?.hidden!==false){$('readyRoom').focus({preventScroll:true});if(document.documentElement.classList.contains('gamepad-navigation'))$('readyRoom').scrollIntoView({block:'nearest'});}}
   $('startRoom').hidden=!state.isHost||state.phase!=='lobby';$('startRoom').disabled=state.members.length<2||state.pending.length>0||(state.swaps||[]).length>0||state.members.some(x=>!x.ready||x.connection==='reconnecting');$('stopRoom').hidden=!state.isHost||state.phase!=='playing';
   $('leaveRoom').textContent=state.phase==='playing'?'Leave game':state.phase==='error'?'← Back to rooms':'← Leave room';
   const waiting=state.members.filter(x=>!x.ready).length,lobby=(state.swaps||[]).length?'A seat swap is awaiting a reply.':state.pending.length?'Review the requests to complete your grid.':state.members.length<2?'Copy your invitation and bring a friend.':waiting?`${waiting} ${waiting===1?'driver is':'drivers are'} not ready yet.`:state.isHost?'Your grid is ready. Start when you are.':'Your grid is ready. Waiting for the host.';
   const labels={connecting:'Connecting to the room…',pending:'Your host will admit you shortly.',lobby,preparing:'Setting up every cabinet. Please wait…',playing:'The race keeps running while this menu is open.',error:'Try another invitation.'};
   $('roomMessage').textContent=(state.error||labels[state.phase]||'')+(state.awaitingStop?' Waiting for the host to return to the room.':'');$('roomConnection').textContent=state.phase==='connecting'?'Connecting…':state.phase==='reconnecting'?'Reconnecting automatically · seat reserved':state.phase==='error'?'Disconnected':state.signaling?'● Room connected':'Room connected · invitation service reconnecting';$('roomConnection').dataset.state=state.phase==='error'?'offline':state.phase==='reconnecting'||!state.signaling?'recovering':'connected';
   $('returnRoomGame').hidden=state.phase!=='playing';$('startBtn').hidden=true;
   if(state.phase!==lastPhase&&!$('overlay').hidden){lastPhase=state.phase;if($('hostConsole')?.hidden!==false){if(state.phase==='lobby'&&me)$('readyRoom').focus();else if(state.phase==='error')$('leaveRoom').focus();}}
  }
 };
}
