const icon=path=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
export const spectatorIcons={
 eye:icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
 chat:icon('<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/>'),
 full:icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),
 close:icon('<path d="m6 6 12 12M18 6 6 18"/>'),
 back:icon('<path d="m10 5-7 7 7 7M3 12h18"/>'),
 send:icon('<path d="m3 3 18 9-18 9 4-9-4-9ZM7 12h14"/>'),
 flag:icon('<path d="M5 21V3m0 1c5-4 9 4 14 0v11c-5 4-9-4-14 0"/><path d="M10 4v11m4-9v11M5 9c5-4 9 4 14 0"/>')
};
export function spectatorMarkup(){const i=spectatorIcons;return `
 <div id="spectatorShell" class="spectator-shell">
  <header class="spectator-room-heading"><div class="spectator-brand">${i.eye}<div><span class="room-eyebrow">SPECTATOR MODE</span><h2 id="spectatorTitle">Trackside</h2></div></div>
   <span id="spectatorBadge" class="spectator-badge" data-tone="offline"><span aria-hidden="true"></span><b>OFF AIR</b></span>
   <div class="spectator-header-actions"><button id="spectatorChatToggle" type="button" class="ui-button" aria-expanded="true" aria-controls="spectatorChat">${i.chat}<span>Chat</span><span id="spectatorChatUnread" class="spectator-unread" hidden></span></button><button id="spectatorFullscreen" type="button" class="ui-button" aria-pressed="false">${i.full}<span>Fullscreen</span></button><button id="closeSpectator" aria-label="Back to room" type="button" class="ui-button spectator-back">${i.back}<span>Back to room</span></button></div>
  </header>
  <div class="spectator-session-line"><p id="spectatorStatus" role="status" aria-live="polite">Drivers are in the lobby.</p><span id="spectatorRoomName"></span></div>
  <div class="spectator-workspace" data-chat-open="true">
   <section id="spectatorStage" class="spectator-monitor" aria-label="Race viewer">
    <div class="spectator-screen">
     <div id="spectatorEmpty" class="spectator-empty"><div class="spectator-empty-mark">${i.flag}</div><span id="spectatorEmptyTag" class="room-eyebrow">OFF AIR</span><h3 id="spectatorEmptyTitle">The grid is in the lobby.</h3><p id="spectatorEmptyDetail">Stay here and chat. The viewer connects when the arcade session starts.</p>
      <div id="spectatorLoading" class="spectator-loading" hidden><label for="spectatorLoadProgress">Preparing the circuit from your ROM</label><progress id="spectatorLoadProgress" max="100" value="0"></progress></div>
      <span class="spectator-wait-note">${i.eye}<span>You are watching. No driver seat is occupied.</span></span>
     </div>
     <div class="spectator-picture" hidden><canvas id="spectatorCanvas" aria-label="Live arcade view"></canvas><aside id="spectatorHUD" aria-label="Observed player and race order" hidden><strong id="spectatorHUDName"></strong><div class="spectator-hud-facts"><span>POSITION <b id="spectatorHUDPosition">—</b></span><span>LAP <b id="spectatorHUDLap">—</b></span></div><small id="spectatorOrderHeading">RACE ORDER</small><ol id="spectatorOrder"></ol></aside></div>
    </div>
    <div class="spectator-toolbar"><div class="spectator-following"><span class="room-eyebrow">ON CAMERA</span><strong id="spectatorFollowing">Waiting for drivers</strong></div><label>Follow<select id="spectatorDriver" aria-label="Follow player" disabled><option>Waiting for drivers</option></select></label><label>Camera<select id="spectatorCamera"><option value="0">Bumper</option><option value="1">Driver</option><option value="2" selected>Behind</option><option value="3">Far behind</option></select></label><button id="spectatorSound" type="button" aria-pressed="false" class="ui-button">Enable sound</button></div>
   </section>
   <aside id="spectatorChat" class="spectator-chat" aria-labelledby="spectatorChatTitle"><header><div>${i.chat}<h3 id="spectatorChatTitle">ROOM CHAT</h3></div><button id="spectatorChatHide" type="button" class="spectator-icon-button" aria-label="Hide chat">${i.close}</button></header>
    <div class="spectator-chat-scroll"><ol id="spectatorChatLog" role="log" aria-live="polite" aria-relevant="additions" aria-label="Room messages" tabindex="0"></ol><p id="spectatorChatEmpty" class="spectator-chat-empty">Meet your grid.<span>Chat before, during and between races.</span></p><div class="spectator-chat-new-anchor"><button id="spectatorChatNew" type="button" hidden>New messages ↓</button></div></div>
    <form id="spectatorChatForm"><label for="spectatorChatInput" class="sr-only">Message to your room</label><input id="spectatorChatInput" maxlength="240" autocomplete="off" enterkeyhint="send" placeholder="Message your room…" aria-describedby="spectatorChatFeedback"><button id="spectatorChatSend" type="submit" aria-label="Send message" disabled>${i.send}</button></form><div class="spectator-chat-meta"><p id="spectatorChatFeedback" role="status">Only people in this room can read this chat.</p><span id="spectatorChatCount">0/240</span></div>
   </aside>
  </div>
  <footer class="spectator-footer"><span id="spectatorViewHint">Live race view · Original sound effects · Music off</span><span id="spectatorMetrics" hidden></span><span id="spectatorNotice" role="status" aria-live="polite"></span></footer>
 </div>`;}

// HTMLDialogElement itself cannot enter fullscreen. Its ordinary child can,
// keeping the chat, controls and canvas together in the fullscreen top layer.
export function mountSpectatorFullscreen(root){
 const shell=root.querySelector('#spectatorShell'),button=root.querySelector('#spectatorFullscreen'),notice=root.querySelector('#spectatorNotice');
 let expanded=false;
 const owned=()=>document.fullscreenElement===shell||document.webkitFullscreenElement===shell;
 function render(){const on=owned()||expanded,label=on?'Exit fullscreen':document.fullscreenEnabled||shell.webkitRequestFullscreen?'Fullscreen':'Expand view';button.setAttribute('aria-pressed',String(on));button.querySelector('span').textContent=label;button.setAttribute('aria-label',label);button.title=label;}
 function fallback(){expanded=true;root.classList.add('spectator-expanded');notice.textContent='Expanded view';render();}
 function exit(){expanded=false;root.classList.remove('spectator-expanded');notice.textContent='';if(owned())try{const p=document.exitFullscreen?.()||document.webkitExitFullscreen?.();p?.catch(()=>{});}catch{}render();}
 button.onclick=()=>{
  if(owned()||expanded){exit();return;}
  notice.textContent='';try{const request=shell.requestFullscreen||shell.webkitRequestFullscreen;if(!request){fallback();return;}Promise.resolve(request.call(shell)).then(render,fallback);}catch{fallback();}
 };
 document.addEventListener('fullscreenchange',render);document.addEventListener('webkitfullscreenchange',render);render();
 return {exit,get active(){return owned()||expanded;},dispose(){exit();document.removeEventListener('fullscreenchange',render);document.removeEventListener('webkitfullscreenchange',render);}};
}

const viewerStates={
 offline:['OFF AIR','The grid is in the lobby.','Stay here and chat. The viewer connects when the arcade session starts.','Drivers are in the lobby.'],
 connecting:['CONNECTING','Getting you trackside.','Connecting to a player’s race feed. Your driver seat stays free.','Connecting to the race feed…'],
 waiting:['STANDBY','Waiting for the race.','Drivers are in attract mode or choosing a circuit. The race view opens automatically.','Waiting for drivers to enter a race.'],
 loading:['LOADING','Your race view is on its way.','Preparing the circuit and textures. You can keep chatting while it loads.','Preparing your race view…'],
 live:['LIVE','Watching live.','','Live race view'],
 finished:['RESULTS','Race finished.','','Race finished · Watching the grid'],
 interrupted:['OFF AIR','The race feed was interrupted.','Return to the room to reconnect. The drivers’ race is unaffected.','Race feed unavailable.']
};
export function mountSpectatorStatus(root){
 const $=id=>root.querySelector('#'+id);let stamp='';
 return (kind,detail='')=>{
  const next=viewerStates[kind]||viewerStates.waiting,key=kind+'\n'+detail;if(key===stamp)return;stamp=key;
  root.dataset.viewerState=kind;$('spectatorBadge').dataset.tone=kind;$('spectatorBadge').querySelector('b').textContent=next[0];
  $('spectatorStatus').textContent=detail||next[3];$('spectatorEmptyTag').textContent=next[0];$('spectatorEmptyTitle').textContent=next[1];$('spectatorEmptyDetail').textContent=kind==='interrupted'&&detail?detail:next[2];
  const picture=kind==='live'||kind==='finished';root.querySelector('.spectator-picture').hidden=!picture;$('spectatorEmpty').hidden=picture;
 };
}
