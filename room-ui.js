import {parseInvitation} from './room-settings.js';
const $=id=>document.getElementById(id);
export function createRoomUI(room,{single,unlockAudio}){
 const panel=$('roomPanel'),choices=$('playerModes'),entry=$('multiplayerEntry');let verified=false,pendingStamp='',lastPhase='';
 const invite=new URLSearchParams(location.hash.slice(1)).get('room');if(invite)$('joinCode').value=invite;
 const utilities=document.querySelector('.menu-quick-controls'),utilitiesHome=utilities.parentElement;
 function layout(active){$('menuDialog').classList.toggle('mp-view',active);$('mpUtilities').hidden=!active;const target=active?$('mpUtilities'):utilitiesHome;if(utilities.parentElement!==target)target.append(utilities);}
 function showEntry(){layout(true);choices.hidden=true;entry.hidden=false;panel.hidden=true;$('message').textContent='Create a private room or join your friends.';$('menuDialog').setAttribute('aria-labelledby','entryTitle');$('driverName').focus();}
 function showModes(){layout(false);entry.hidden=true;panel.hidden=true;choices.hidden=!verified;$('menuDialog').setAttribute('aria-labelledby','gameTitle');if(verified)$('message').textContent='ROM verified. Choose Single Player or Multiplayer.';}
 function action(fn){return async()=>{try{await fn();}catch(e){$('roomMessage').textContent=e.message;document.querySelector('#message').textContent=e.message;}};}
 $('singlePlayer').onclick=action(async()=>{room.leave();showModes();await single();});
 $('multiplayerPlayer').onclick=showEntry;
 $('modeBack').onclick=showModes;
 $('createRoom').onclick=action(async()=>{panel.hidden=false;entry.hidden=true;await room.create($('driverName').value);});
 $('joinRoom').onclick=action(async()=>{parseInvitation($('joinCode').value);panel.hidden=false;entry.hidden=true;await room.join($('joinCode').value,$('driverName').value);});
 $('leaveRoom').onclick=()=>{room.leave();showEntry();};
 $('readyRoom').onclick=()=>{void unlockAudio();const me=room.members.find(x=>x.id===room.id);room.ready(!me?.ready);};
 $('startRoom').onclick=action(async()=>{void unlockAudio();await room.start();});
 $('stopRoom').onclick=()=>room.end('The host returned everyone to the room.');
 $('copyRoom').onclick=action(async()=>{await navigator.clipboard.writeText($('inviteLink').value);$('roomMessage').textContent='Invitation copied. Share it privately with your friends.';});
 $('copyCode').onclick=action(async()=>{await navigator.clipboard.writeText($('roomCode').textContent);$('roomMessage').textContent='Room code copied.';});
 $('inviteLink').onclick=event=>event.target.select();
 $('returnRoomGame').onclick=()=>$('startBtn').click();
 const change=()=>room.setSettings({mode:Number($('roomMode').value),difficulty:Number($('roomDifficulty').value),region:'Export'});
 $('roomMode').onchange=change;$('roomDifficulty').onchange=change;
 return {
  verified(){verified=true;$('startBtn').hidden=true;$('dropzone').hidden=true;showModes();$('singlePlayer').focus();if(invite)showEntry();},
  loading(){layout(false);verified=false;choices.hidden=true;entry.hidden=true;panel.hidden=true;$('dropzone').hidden=false;$('startBtn').hidden=true;},
  running(){choices.hidden=true;entry.hidden=true;$('startBtn').hidden=false;},
  link(state,id,count){const text=state===2?`Arcade link · Cabinet ${id} / ${count}`:'Linking original arcade cabinets…';for(const name of ['networkStatus','arcadeLinkStatus'])if($(name).textContent!==text)$(name).textContent=text;},
  render(state){
   $('networkStatus').hidden=state.phase!=='playing';$('arcadeLinkStatus').hidden=state.phase!=='playing';
   if(state.phase==='idle')return;
   layout(true);panel.classList.toggle('guest-room',!state.isHost);
   if($('settingsModal').hidden)$('menuDialog').setAttribute('aria-labelledby','roomTitle');
   $('startBtn').hidden=state.phase!=='playing';
   $('startBtn').disabled=state.phase!=='playing';$('closeBtn').hidden=state.phase!=='playing';
   panel.hidden=false;entry.hidden=true;choices.hidden=true;
   $('roomTitle').textContent=state.isHost?'Your room':'Race room';
   $('roomCount').textContent=`${state.members.length} / 8 players`;
   const url=new URL(location.href);url.hash=new URLSearchParams({room:state.code}).toString();
   $('inviteLink').value=state.code?url.href:'';$('roomCode').textContent=state.code||'Connecting…';
   $('inviteBlock').hidden=!state.isHost||!state.code;
   $('roomMode').value=state.settings.mode;$('roomDifficulty').value=state.settings.difficulty;
   for(const id of ['roomMode','roomDifficulty'])$(id).disabled=!state.isHost||state.phase!=='lobby';
   $('roomSettingsHint').textContent=state.isHost?'Applied to everyone. Changes reset Ready.':'Chosen by the host for everyone.';
   $('readyCount').textContent=`${state.members.filter(x=>x.ready).length} ready`;
   $('playersList').replaceChildren(...state.members.map(member=>{
    const li=document.createElement('li'),number=document.createElement('span'),info=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('small'),status=document.createElement('span');
    li.className='driver-card';li.classList.toggle('driver-ready',member.ready);number.className='cabinet-number';number.textContent=String(member.cabinet).padStart(2,'0');info.className='driver-info';
    name.textContent=`${member.name}${member.id===state.id?' · You':''}`;name.title=name.textContent;
    role.textContent=`${member.cabinet===1?'Host':'Driver'}${member.rtt===null?'':' · '+member.rtt+' ms'}`;
    status.className='driver-status';status.textContent=member.ready?'Ready':'Waiting';info.append(name,role);li.append(number,info,status);return li;
   }));
   if(!state.pending.length&&state.phase==='lobby')for(let slot=state.members.length+1;slot<=8;slot++){
    const li=document.createElement('li'),number=document.createElement('span'),label=document.createElement('span');li.className='driver-card empty-slot';number.className='cabinet-number';number.textContent=String(slot).padStart(2,'0');label.textContent='Open seat';li.append(number,label);$('playersList').append(li);
   }
   const stamp=JSON.stringify(state.pending);if(stamp!==pendingStamp){pendingStamp=stamp;$('pendingList').replaceChildren(...state.pending.map(member=>{
    const li=document.createElement('li'),name=document.createElement('span'),accept=document.createElement('button'),decline=document.createElement('button');
    name.textContent=member.name;name.title=member.name;accept.textContent='Accept';decline.textContent='×';decline.setAttribute('aria-label',`Decline ${member.name}`);accept.type=decline.type='button';accept.onclick=()=>room.approve(member.id);decline.onclick=()=>room.reject(member.id);li.append(name,accept,decline);return li;
   }));}
   $('pendingBlock').hidden=!state.isHost||!state.pending.length;
   $('pendingCount').textContent=`${state.pending.length} pending`;
   const me=state.members.find(x=>x.id===state.id);
   $('readyRoom').disabled=!!state.awaitingStop;$('readyRoom').hidden=state.phase!=='lobby'||!me;$('readyRoom').textContent=me?.ready?'READY ✓':'I’M READY';$('readyRoom').title=me?.ready?'Undo Ready':'Mark yourself ready';$('readyRoom').setAttribute('aria-pressed',String(!!me?.ready));
   $('startRoom').hidden=!state.isHost||state.phase!=='lobby';$('startRoom').disabled=state.members.length<2||state.pending.length>0||state.members.some(x=>!x.ready);
   $('stopRoom').hidden=!state.isHost||state.phase!=='playing';
   $('leaveRoom').textContent=state.phase==='playing'?'Leave game':'← Leave room';
   const waiting=state.members.filter(x=>!x.ready).length;
   const lobby=state.pending.length?'Review the join requests to continue.':state.members.length<2?'Invite a friend to fill the grid.':waiting?`Waiting for ${waiting} ${waiting===1?'driver':'drivers'} to get ready.`:state.isHost?'Everyone is ready. Start the game.':'Everyone is ready. Waiting for the host.';
   const messages={connecting:'Connecting…',pending:'Waiting for the host to accept you.',lobby,preparing:'Preparing every cabinet…',playing:'Race in progress. This menu does not pause it.',error:'Connection could not be established.'};
   $('roomMessage').textContent=(state.error||messages[state.phase]||'')+(state.awaitingStop?' Waiting for the host to return to the room.':'');
   $('roomConnection').textContent=state.phase==='connecting'?'Connecting…':state.phase==='error'?'Connection unavailable':state.signaling?'● Room connected':'Room service unavailable';
   $('roomConnection').title=state.signaling?'Room service available.':'Existing player connections can continue.';
   $('returnRoomGame').hidden=state.phase!=='playing';
   $('startBtn').hidden=true;
   if(state.phase!==lastPhase&&!$('overlay').hidden){lastPhase=state.phase;$('leaveRoom').focus();}
  }
 };
}
