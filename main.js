import {protectTouchSurface} from './touch-guard.js?v=21-cpu-cars';
import {createKeyboardControls} from './keyboard-controls.js?v=21-cpu-cars';
import {SimulationClock} from './simulation-clock.js?v=21-cpu-cars';
import {nativeTimedState} from './link-timing.js?v=21-cpu-cars';
import {linkIdForSeat} from './central-link.js?v=21-cpu-cars';
import {createLobbySound} from './lobby-sound.js?v=21-cpu-cars';
import { mountDiagnostics } from './diagnostics.js?v=21-cpu-cars';
import { mountRoomDiagnostics } from './room-diagnostics.js?v=21-cpu-cars';
import {createControllerControls} from './controller-controls.js?v=21-cpu-cars';
import { createRenderer } from './renderer.js?v=21-cpu-cars';
import { restoreNVRAM, STORAGE_ID } from './nvram.js?v=21-cpu-cars';
import { createTouchControls } from './touch.js?v=21-cpu-cars';
import { createGamepadRumble } from './haptics.js?v=21-cpu-cars';
import { loadSettings, saveSettings } from './preferences.js?v=21-cpu-cars';
import { createWheelControls } from './wheel-controls.js?v=21-cpu-cars';
import { Multiplayer } from './multiplayer.js?v=21-cpu-cars';
import { createRoomUI } from './room-ui.js?v=21-cpu-cars';
import { mountHostConsole } from './host-console.js?v=21-cpu-cars';
import { prepareCabinet,ensureDeluxeCabinet } from './room-settings.js?v=21-cpu-cars';
// Daytona USA browser host. The wasm module is the original recomp game's
// native game loop, not a JavaScript reconstruction of Daytona.
const $ = (id) => document.getElementById(id);
const ui = {
  input: $('romInput'), dropzone: $('dropzone'), metadata: $('romMeta'),
  start: $('startBtn'), sound: $('soundBtn'),
  fullscreen: $('fullscreenBtn'), canvas: $('screen'), overlay: $('overlay'),
  message: $('message'), status: $('status'), fps: $('fps'),
  menu: $('menuBtn'), close: $('closeBtn'), fileLabel: $('fileLabel'), startLabel: $('startLabel')
};
let wasm = null, renderer = null, started = false, running = false;
let engineReady = null, engineStartupError = '';
let simulationClock=null;
let ctxAudio = null, audioGain = null, uiAudioGain = null, audioNext = 0;
const audioSources=new Set();
let soundMuted = false;
let lastTime = 0, lagMs = 0, statTime = performance.now(), rendered = 0, simulated = 0;
const FIXED_MS = 1000 / (16000000 / (656 * 424));
const held = new Set();
let currentGear = 1;

let audioLoaded = false;
const settingsStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const mobileDevice=!!navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const settings=loadSettings(settingsStorage,{mobile:mobileDevice});
let enhanced = settings.drawDistance>0;
let settingsOpen=false;
let multiplayerProfile=false,linkStartedAt=0;
let roomUI,hostConsole,diagnostics,roomDiagnostics;
const room=new Multiplayer({
 isVisible:()=>!document.hidden,
 readHealth:()=>({receiveBytes:wasm?._daytona_link_pending_bytes()||0,backlogMs:Math.max(0,lagMs)}),
 readPerformance:(epoch,after)=>diagnostics?.share(epoch,after),
 onChange:state=>{diagnostics?.setAutomatic(state.phase==='playing');roomDiagnostics?.sync();roomUI?.render(state);hostConsole?.sync();},
 onPrepare:async(config,cancelled)=>{
  simulationClock?.stop();running=false;started=false;held.clear();keyboardControls.reset();touch.clear();rumble.stop();multiplayerProfile=true;
  ui.start.disabled=true;ui.close.hidden=true;
  setStatus('Preparing linked cabinet…',true);
  await prepareCabinet(wasm,reloadEngine,config,cancelled);
  if(!wasm._daytona_central_config(linkIdForSeat(config.cabinet,room.members.length),room.members.length))throw Error('Invalid centralized cabinet configuration.');
  if(!wasm._daytona_set_cpu_cars(Number(config.cpuCars)))throw Error('Could not apply the room CPU car setting.');
  renderer.reset();applyGraphics();
 },
 onStart:()=>{wasm._daytona_delivery_mode(1);ui.start.disabled=false;linkStartedAt=performance.now();roomUI.running();void resumeGame();},
 onStop:reason=>{
  wasm?._daytona_delivery_mode(0);wasm?._daytona_central_config(0,0);
  for(const source of audioSources){try{source.stop();}catch{}}audioSources.clear();audioNext=0;
  simulationClock?.stop();running=false;started=false;held.clear();keyboardControls.reset();touch.clear();rumble.stop();wasm?._daytona_link_enable(0);
  ui.start.disabled=true;ui.start.hidden=true;openMenu();setStatus('Room ready',true);ui.message.textContent=reason;
 },
 onBytes:(bytes,timing)=>{
  bytes=nativeTimedState(bytes,timing);
  wasm.HEAPU8.set(bytes,wasm._daytona_link_receive_ptr());
  if(!wasm._daytona_link_receive(bytes.length))throw Error('The arcade receive queue overflowed.');
 }
});
diagnostics=mountDiagnostics({element:$('diagnosticsHud'),toggle:$('diagnosticsEnabled'),download:$('downloadDiagnostics'),room,
 read:()=>({heapBytes:wasm?.HEAPU8.buffer.byteLength||0,callbackSlots:wasm?._daytona_callback_slots()||0,receiveBytes:wasm?._daytona_link_pending_bytes()||0,frames:wasm?._daytona_total_frames()||0,linked:room.active,hidden:document.hidden,drawDistance:settings.drawDistance,
 role:room.active?(room.isHost?'MASTER':'SLAVE'):null,sessionId:room.active?room.epoch:null,progressFrames:room.progressFrames,backlogMs:Math.max(0,lagMs),
 peers:(room.isHost?[...room.connections.values()]:[room.server]).filter(c=>c?.emulation?.epoch===room.epoch&&room.active).map(c=>({cabinet:room.members.find(m=>m.id===c.peer)?.cabinet??null,frames:c.emulation.frames,ageMs:performance.now()-c.emulation.at,observedFrameDelta:room.progressFrames-c.emulation.frames}))})});
roomDiagnostics=mountRoomDiagnostics({toggle:$('roomDiagnosticsEnabled'),status:$('roomDiagnosticsStatus'),overlayToggle:$('diagnosticsEnabled'),download:$('downloadDiagnostics'),diagnostics,room,storage:settingsStorage});
function reloadEngine(){
 wasm._daytona_central_config(0,0);
 wasm._daytona_delivery_mode(0);
 if(!wasm.ccall('daytona_load','number',['string','number'],['/roms/user_daytona.zip',Number(audioLoaded)]))throw Error(cString(wasm._daytona_error()));
 renderer.reset();
}
const rumble=createGamepadRumble(status=>{$('rumbleStatus').textContent=status;});
function connectedDevices(){try{return [...(navigator.getGamepads?.() ?? [])].filter(pad=>pad?.connected);}catch{return [];}}
const wheelControls=createWheelControls($('wheelControls'),{storage:settingsStorage,getPads:connectedDevices,onChange:()=>rumble.stop()});
const controllerControls=createControllerControls($('controllerControls'),{storage:settingsStorage,reservedIds:()=>wheelControls.reservedIds(),wheelPad:()=>wheelControls.feedbackPad(),onChange:()=>rumble.stop()});
const keyboardControls=createKeyboardControls($('keyboardControls'),{held,storage:settingsStorage,settings,mobile:mobileDevice,onSetting:changeSetting});
if(mobileDevice){$('inputTabLabel').textContent='Touch controls';$('inputTab').querySelector('svg').innerHTML='<path d="M8 12V5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-3 7-7 7h-1c-2 0-3-1-4-2l-4-5a2 2 0 0 1 3-3l1 1Z"/>'; }
function applyGraphics(){
  enhanced=settings.drawDistance>0;
  renderer?.setDrawDistance(settings.drawDistance);
  wasm?._daytona_set_draw_distance(settings.drawDistance);
  $('graphicsSummary').textContent=enhanced?`Enhanced · Draw distance ${settings.drawDistance}x`:'Classic · Original draw distance';
}
function syncSettings(){
  rumble.setIntensity(settings.vibrationEnabled?settings.rumble:0);
  rumble.setCentringIntensity(settings.centring);
  for(const id of ['vibrationEnabled','settingsVibrationEnabled'])$(id).checked=settings.vibrationEnabled;
  for(const [key,input,output] of [['rumble','rumbleIntensity','rumbleValue'],['centring','centringIntensity','centringValue'],['volume','volumeIntensity','volumeValue'],['uiVolume','uiVolumeIntensity','uiVolumeValue'],['joystickSensitivity','joystickSensitivity','joystickSensitivityValue'],['joystickDeadzone','joystickDeadzone','joystickDeadzoneValue']]){
    $(input).value=Math.round(settings[key]*100);
    $(output).textContent=settings[key]===0&&key!=='joystickDeadzone'?(['volume','uiVolume'].includes(key)?'Silent':'Off'):`${Math.round(settings[key]*100)}%`;
    $(input).disabled=(key==='rumble' || key==='centring') && !settings.vibrationEnabled;
  }
  for(const radio of document.querySelectorAll('[name="drawDistance"]'))radio.checked=Number(radio.value)===settings.drawDistance;
  $('distance1Default').hidden=!mobileDevice;$('distance2Default').hidden=mobileDevice;
  if(audioGain)audioGain.gain.setTargetAtTime(settings.volume,ctxAudio.currentTime,0.025);
  if(uiAudioGain)uiAudioGain.gain.setTargetAtTime(settings.uiVolume,ctxAudio.currentTime,.025);
  keyboardControls.sync();
  $('touchControls').style.setProperty('--touch-button-scale',settings.touchButtonScale);$('touchControls').style.setProperty('--touch-steering-width',settings.touchSteeringWidth);
  applyGraphics();
}
function changeSetting(key,value){settings[key]=value;syncSettings();saveSettings(settingsStorage,settings);}
for(const id of ['vibrationEnabled','settingsVibrationEnabled'])$(id).addEventListener('change',event=>changeSetting('vibrationEnabled',event.target.checked));
for(const [id,key] of [['rumbleIntensity','rumble'],['centringIntensity','centring'],['volumeIntensity','volume'],['uiVolumeIntensity','uiVolume'],['joystickSensitivity','joystickSensitivity'],['joystickDeadzone','joystickDeadzone']])
  $(id).addEventListener('input',event=>changeSetting(key,Number(event.target.value)/100));
for(const radio of document.querySelectorAll('[name="drawDistance"]'))radio.addEventListener('change',event=>{if(event.target.checked)changeSetting('drawDistance',Number(event.target.value));});
syncSettings();
const settingsTabs=[...document.querySelectorAll('#settingsModal > .settings-tabs [role="tab"]')];
function selectSettingsTab(tab,focus=false){
  wheelControls.cancel();controllerControls.cancel();keyboardControls.cancel();
  for(const item of settingsTabs){
    const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;
    $(item.getAttribute('aria-controls')).hidden=!selected;
  }
  if(focus)tab.focus();
}
for(const tab of settingsTabs){
  tab.addEventListener('click',()=>selectSettingsTab(tab));
  tab.addEventListener('keydown',event=>{
    const index=settingsTabs.indexOf(tab);
    const next=event.key==='ArrowRight'?(index+1)%settingsTabs.length:event.key==='ArrowLeft'?(index+settingsTabs.length-1)%settingsTabs.length:event.key==='Home'?0:event.key==='End'?settingsTabs.length-1:null;
    if(next!==null){event.preventDefault();selectSettingsTab(settingsTabs[next],true);}
  });
}
function showMainMenu(focus=true){
  if(hostConsole?.isOpen())return;
  wheelControls.cancel();controllerControls.cancel();keyboardControls.cancel();
  settingsOpen=false;$('mainMenu').hidden=false;$('settingsModal').hidden=true;
  $('menuDialog').setAttribute('aria-labelledby','gameTitle');ui.overlay.scrollTop=0;
  if($('menuDialog').classList.contains('mp-view'))$('menuDialog').setAttribute('aria-labelledby',!$('roomPanel').hidden?'roomTitle':'entryTitle');
  if(focus)$('settingsBtn').focus();
}
$('settingsBtn').addEventListener('click',()=>{
  settingsOpen=true;$('mainMenu').hidden=true;$('settingsModal').hidden=false;
  $('menuDialog').setAttribute('aria-labelledby','settingsTitle');ui.overlay.scrollTop=0;
  settingsTabs.find(tab=>tab.getAttribute('aria-selected')==='true').focus();
});
$('settingsBack').addEventListener('click',()=>showMainMenu());
function connectedGamepad(){return controllerControls.getPad();}
function feedbackGamepad(){return controllerControls.hasExplicitSelection()?connectedGamepad():wheelControls.feedbackPad() || connectedGamepad();}
const touch=createTouchControls($('touchControls'),{
  isRunning:()=>running,
  shift:amount=>{currentGear=Math.max(1,Math.min(4,currentGear+amount));$('touchGear').textContent=currentGear;},
  menu:()=>openMenu(),
  sound:()=>toggleSound(),
  settings:()=>{const panel=$('touchControls').querySelector('.touch-service');panel.hidden=!panel.hidden;}
});
const joinChime=createLobbySound({context:()=>ctxAudio,output:()=>uiAudioGain,muted:()=>soundMuted||settings.uiVolume===0});
function lobbySound(kind='request'){
 if(soundMuted||settings.uiVolume===0||!ctxAudio||ctxAudio.state==='closed')return false;
 if(ctxAudio.state==='running')return joinChime(kind);
 // Resume only the context already unlocked by Create/Join/Ready. Browsers
 // may suspend it when a window loses focus; never create autoplay audio here.
 void ctxAudio.resume().then(()=>joinChime(kind)).catch(()=>{});return false;
}
roomUI=createRoomUI(room,{notifyRequest:lobbySound,notifyChat:()=>lobbySound('chat'),notifyReady:()=>lobbySound('ready'),notifyConfirmed:()=>lobbySound('confirmed'),single:async()=>{if(multiplayerProfile){reloadEngine();restoreNVRAM(wasm);multiplayerProfile=false;await applyDeluxeDefault();}ui.start.disabled=false;roomUI.running();await resumeGame();},unlockAudio:activateAudio});
hostConsole=mountHostConsole(room);
$('previewUISound').onclick=async()=>{await activateAudio();joinChime('confirmed');};
document.documentElement.classList.toggle('touch-device',navigator.maxTouchPoints>0 || matchMedia('(any-pointer:coarse)').matches);
function saveNVRAM() {
  if(multiplayerProfile)return;
  if(!wasm?._daytona_ready())return;
  try {
    const read=(fnPtr,fnLen)=>Array.from(wasm.HEAPU8.subarray(wasm[fnPtr](),wasm[fnPtr]()+wasm[fnLen]()));
    const eeprom=read('_daytona_eeprom_ptr','_daytona_eeprom_size');
    const backup=read('_daytona_backup_ptr','_daytona_backup_size');
    localStorage.setItem(STORAGE_ID,JSON.stringify({eeprom,backup}));
  }catch(e){console.warn('Could not save arcade settings',e);}
}
function setStatus(text, ok = false) {
  ui.status.textContent = text;
  document.documentElement.classList.toggle('ready', ok);
}
function cString(pointer) {
  const mem = wasm.HEAPU8;
  let end = pointer;
  while (end < mem.length && mem[end]) end++;
  return new TextDecoder().decode(mem.subarray(pointer, end));
}
function failure(message) {
  if(room.active||room.phase==='preparing')room.end(message,room.id,'local-runtime-error');
  running = false;simulationClock?.stop();
  setStatus('Error');
  openMenu();
  ui.start.disabled=true;
  ui.message.textContent = message;
  console.error(message);
}
function pollGamepad() {
  const value=controllerControls.read(settings.joystickSensitivity,settings.joystickDeadzone);
  currentGear=value.gear ?? Math.max(1,Math.min(4,currentGear+value.shift));
  return value;
}
function inputs() {
  if(room.active&&!ui.overlay.hidden)return {steer:0,accel:0,brake:0,gear:currentGear,buttons:0};
  const wheel=controllerControls.hasExplicitSelection()?{active:false}:wheelControls.read();
  const pad=wheel.active?wheel:pollGamepad();
  if(wheel.active){
    currentGear=wheel.gear ?? Math.max(1,Math.min(4,currentGear+wheel.shift));
    controllerControls.resetEdges();
  }
  const phone=touch.read();
  const keyboard=keyboardControls.read(FIXED_MS/1000);
  const buttons=pad.buttons|phone.buttons|keyboard.buttons;
  $('touchGear').textContent=currentGear;
  return {steer:keyboard.active?keyboard.steer:(phone.steer || pad.steer),
    accel:Math.max(keyboard.accel,pad.accel,phone.accel),
    brake:Math.max(keyboard.brake,pad.brake,phone.brake),
    gear:currentGear,buttons:room.active?buttons&~12:buttons};
}
window.addEventListener('keydown',(event)=>{
  if(event.code==='Escape'){
    if(hostConsole?.isOpen()){event.preventDefault();hostConsole.close();return;}
    if(settingsOpen){event.preventDefault();if(controllerControls.cancel()||keyboardControls.cancel())return;showMainMenu();return;}
    if(started){event.preventDefault();ui.overlay.hidden?openMenu():resumeGame();return;}
  }
  if(!running || !ui.overlay.hidden || !keyboardControls.uses(event.code)||event.ctrlKey||event.metaKey||event.altKey||['INPUT','SELECT','BUTTON'].includes(event.target?.tagName))return;
  if(room.active&&(event.code==='F2'||event.code==='F3'))return;
  if(started)event.preventDefault();
  const action=keyboardControls.action(event.code);
  if(!held.has(event.code)){if(action==='shiftDown'||action==='shiftUp')currentGear=Math.max(1,Math.min(4,currentGear+(action==='shiftUp'?1:-1)));if(/^gear[1-4]$/.test(action||''))currentGear=Number(action.at(-1));}
  held.add(event.code);
});
window.addEventListener('keyup',(event)=>held.delete(event.code));
window.addEventListener('blur',()=>{held.clear();keyboardControls.reset();rumble.stop();controllerControls.cancel();controllerControls.resetEdges();});
window.addEventListener('gamepaddisconnected',()=>rumble.disconnect());

function pushAudio() {
  if(soundMuted || !ctxAudio || ctxAudio.state!=='running' || !audioLoaded)return;
  const frames=wasm._daytona_audio_frames();
  const ptr=wasm._daytona_audio_ptr();
  if(!ptr||frames<=0)return;
  const samples=wasm.HEAPF32.subarray(ptr/4,ptr/4+frames*2);
  const buffer=ctxAudio.createBuffer(2,frames,48000);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  for(let i=0;i<frames;i++){left[i]=samples[i*2];right[i]=samples[i*2+1];}
  const source=ctxAudio.createBufferSource();source.buffer=buffer;source.connect(audioGain);
  const now=ctxAudio.currentTime;
  if(audioNext<now){diagnostics.audioReset();audioNext=now+0.05;}
  if(audioNext>now+0.25){diagnostics.audioReset();audioNext=now+0.05;}
  audioSources.add(source);source.onended=()=>audioSources.delete(source);
  source.start(audioNext);
  audioNext+=frames/48000;
}
function updateDevices(now){
  keyboardControls.update(now,settingsOpen&&!$('inputPanel').hidden);
  const devices=connectedDevices();
  wheelControls.update(devices,now,settingsOpen && !$('experimentalPanel').hidden);
  controllerControls.update(devices,now,settingsOpen && !$('controllerPanel').hidden,settings.joystickSensitivity,settings.joystickDeadzone);
}
function simulateStep(now){
  renderer.prepare(wasm);
  const i=inputs();
  if(diagnostics.collecting)wasm._daytona_probe_reset();
  const stepBegin=diagnostics.collecting?performance.now():0;
  if(!wasm._daytona_step(i.steer,i.accel,i.brake,i.gear,i.buttons)) {
    failure(cString(wasm._daytona_error()));return false;
  }
  room.advance();
  simulated++;
  if(diagnostics.collecting)diagnostics.step(performance.now()-stepBegin,new Float64Array(wasm.HEAPU8.buffer,wasm._daytona_probe_ptr(),24));
  if(room.active){
    for(let packet=0;packet<64;packet++){
      const size=wasm._daytona_link_tx_size();if(!size)break;
      room.write(wasm.HEAPU8.slice(wasm._daytona_link_tx_ptr(),wasm._daytona_link_tx_ptr()+size));wasm._daytona_link_tx_pop();
      if(!room.active)return false;
    }
    const state=wasm._daytona_link_state();
    roomUI.link(state,wasm._daytona_link_id(),wasm._daytona_link_count());
    if(state===3){room.end('The original arcade reported a lost link. Return to the room and restart.',room.id,'arcade-link-error');return false;}
    if(now-linkStartedAt>45000&&state!==2){room.end('The cabinets could not establish their original arcade link.',room.id,'arcade-start-timeout');return false;}
  }
  if(document.hasFocus() && !document.hidden)
    rumble.update(feedbackGamepad(),wasm._daytona_rumble_strong(),wasm._daytona_rumble_weak(),now,wasm._daytona_rumble_centring());
  else rumble.stop();
  pushAudio();
  if(wasm._daytona_eeprom_dirty() || (wasm._daytona_total_frames()%600===0))saveNVRAM();
  return running;
}
simulationClock=new SimulationClock({
 stepMs:FIXED_MS,
 before(now){
  if(!running||!wasm)return false;
  diagnostics.update(true);updateDevices(now);
  if(room.active){room.checkProgress(now);if(!room.active)return false;}
  return running;
 },
 step:simulateStep,
 onState(state){
  lagMs=state.lagMs;lastTime=state.lastTime;
  if(running&&lastTime-statTime>1000){ui.fps.textContent=String(Math.round(simulated*1000/(lastTime-statTime)));rendered=0;simulated=0;statTime=lastTime;}
 },
 onError:error=>failure(error.message||String(error))
});
function frame(now) {
  requestAnimationFrame(frame);
  if(!running||!wasm){updateDevices(now);diagnostics.update(false);rumble.update(feedbackGamepad(),0,0,now);return;}
  // Consume due steps immediately before presenting. The same clock has a
  // timer fallback for missing refreshes, without a second simulation loop.
  simulationClock.present(now);
  if(!running)return;
  if(wasm._daytona_total_frames()>0){
    try{if(renderer.draw(wasm)){rendered++;diagnostics.draw();}}
    catch(err){failure(err.message);}
  }
}

async function activateAudio() {
  if(soundMuted)return;
  try {
    // Safari's ambient audio session obeys the iPhone silent switch.
    try {if(navigator.audioSession)navigator.audioSession.type='playback';}catch(err){console.warn(err);}
    // Use the device's output rate; the original 48 kHz buffers are resampled.
    if(!ctxAudio || ctxAudio.state==='closed'){
      ctxAudio=new (window.AudioContext||window.webkitAudioContext)();
      audioGain=ctxAudio.createGain();audioGain.gain.value=settings.volume;audioGain.connect(ctxAudio.destination);
      uiAudioGain=ctxAudio.createGain();uiAudioGain.gain.value=settings.uiVolume;uiAudioGain.connect(ctxAudio.destination);
    }
    // Both calls must occur inside the trusted tap, before awaiting anything.
    const resumed=ctxAudio.resume();
    const unlock=ctxAudio.createBufferSource();
    unlock.buffer=ctxAudio.createBuffer(1,1,ctxAudio.sampleRate);
    unlock.connect(audioGain);unlock.onended=()=>unlock.disconnect();unlock.start();
    await resumed;audioNext=ctxAudio.currentTime+0.05;
    updateSoundControls();
  }catch(err){updateSoundControls('Tap to retry sound');console.warn(err);}
}
function updateSoundControls(label=soundMuted?'Unmute sound':'Mute sound') {
  for(const button of [ui.sound,document.querySelector('[data-sound]')]){
    button.setAttribute('aria-label',label);button.title=label;
    button.setAttribute('aria-pressed',String(soundMuted));
    button.textContent=soundMuted?'♪̸':'♫';
  }
}
async function toggleSound() {
  soundMuted=!soundMuted;updateSoundControls();
  if(soundMuted)await ctxAudio?.suspend();
  else await activateAudio();
}
const gameSurface=document.querySelector('.arcade');
protectTouchSurface(gameSurface,{mobile:mobileDevice});
gameSurface.addEventListener('pointerdown',()=>{
  if(running && audioLoaded && !soundMuted && ctxAudio?.state!=='running')void activateAudio();
},{capture:true});
async function loadROM(file) {
  // WASM can finish before the asynchronous GPU/shader initialization. Keep
  // the selected file waiting for both, and retain a failed startup's cause.
  if(!renderer){
    if(!engineStartupError)ui.metadata.textContent='Waiting for the graphics engine…';
    await engineReady;
  }
  if(engineStartupError||!wasm||!renderer){
    const message=engineStartupError||'The arcade engine could not finish starting. Reload the page to try again.';
    failure(message);ui.metadata.textContent=message;return;
  }
  if(!/\.zip$/i.test(file.name)){failure('Choose a Daytona USA Revision A (1994) ROM ZIP.');return;}
  room.leave();roomUI.loading();multiplayerProfile=false;
  rumble.stop();
  simulationClock?.stop();running=false;started=false;held.clear();keyboardControls.reset();touch.clear();ui.close.hidden=true;ui.start.disabled=true;ui.startLabel.textContent='Enter arcade';
  wheelControls.resetEdges();controllerControls.resetEdges();controllerControls.cancel();
  await ctxAudio?.suspend();
  ui.metadata.textContent=`Reading ${file.name} (${(file.size/1048576).toFixed(1)} MB)…`;
  setStatus('Checking ROM…');
  try {
    const binary=new Uint8Array(await file.arrayBuffer());
    try{wasm.FS.mkdir('/roms');}catch{}
    const path='/roms/user_daytona.zip';
    try{wasm.FS.unlink(path);}catch{}
    wasm.FS.writeFile(path,binary);
    audioLoaded=true;
    const loaded=wasm.ccall('daytona_load','number',['string','number'],[path,Number(audioLoaded)]);
    if(!loaded)throw Error(cString(wasm._daytona_error()));
    renderer.reset();
    restoreNVRAM(wasm);
    await applyDeluxeDefault();
    ui.metadata.textContent=`✓ ${file.name} · ROM verified · Ready to play`;
    ui.start.disabled=false;ui.sound.disabled=!audioLoaded;
    openMenu();roomUI.verified();ui.message.textContent='ROM verified. Choose Single Player or Multiplayer.';
    setStatus('ROM ready',true);
    ui.fileLabel.textContent=file.name;
  }catch(err){failure(err.message||String(err));ui.metadata.textContent=err.message||String(err);}
}
async function applyDeluxeDefault(){
  let applied=false;try{applied=settingsStorage.getItem('daytona-deluxe-default-v1')==='1';}catch{}
  if(applied)return;
  await ensureDeluxeCabinet(wasm,reloadEngine);
  saveNVRAM();
  try{settingsStorage.setItem('daytona-deluxe-default-v1','1');}catch{}
}
ui.input.addEventListener('change',(event)=>{const f=event.target.files?.[0];if(f)loadROM(f);});
for(const name of ['dragenter','dragover'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.add('drag');});
for(const name of ['dragleave','drop'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.remove('drag');});
ui.dropzone.addEventListener('drop',(event)=>{const f=event.dataTransfer?.files?.[0];if(f)loadROM(f);});
function openMenu() {
  rumble.stop();
  wheelControls.resetEdges();controllerControls.resetEdges();controllerControls.cancel();
  running=room.active&&started;if(!running)simulationClock?.stop();held.clear();keyboardControls.reset();touch.clear();ui.overlay.hidden=false;
  showMainMenu(false);gameSurface.inert=true;
  if(started&&!room.occupied)$('playerModes').hidden=false;
  document.documentElement.classList.add('launcher-open');
  ui.close.hidden=!started;
  ui.startLabel.textContent=started?'Resume arcade':'Enter arcade';
  if(started && ui.status.textContent!=='Error')setStatus(room.active?'Linked arcade running':'Arcade paused',true);
  if(!room.active&&!room.occupied)ctxAudio?.suspend().catch(console.warn);
  (hostConsole?.isOpen()?$('hostConsoleBack'):started?(room.active?$('returnRoomGame'):ui.start):(!$('playerModes').hidden?$('singlePlayer'):(!$('roomPanel').hidden?$('leaveRoom'):ui.dropzone))).focus();
}
async function resumeGame() {
  if(!wasm?._daytona_ready() || ui.start.disabled)return;
  wheelControls.resetEdges();controllerControls.resetEdges();controllerControls.cancel();
  const keepLinkedClock=room.active&&running;
  started=true;running=true;held.clear();keyboardControls.reset();touch.clear();
  if(!keepLinkedClock){statTime=performance.now();rendered=0;simulated=0;diagnostics.reset();}
  simulationClock.start({reset:!keepLinkedClock});
  ui.overlay.hidden=true;document.documentElement.classList.remove('launcher-open');
  gameSurface.inert=false;
  document.documentElement.classList.add('playing');ui.canvas.focus();
  setStatus(room.active?'Linked arcade running':'Arcade running',true);
  if(audioLoaded&&(!keepLinkedClock||ctxAudio?.state!=='running'))await activateAudio();
}
ui.start.addEventListener('click',resumeGame);
ui.menu.addEventListener('click',openMenu);
ui.close.addEventListener('click',resumeGame);
ui.sound.addEventListener('click',toggleSound);
ui.fullscreen.addEventListener('click',async()=>{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen?.();
});
ui.dropzone.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();ui.input.click();}
});
ui.overlay.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const targets=[...ui.overlay.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"],input:not([disabled]):not([type="file"]),select:not([disabled]),textarea:not([disabled]),summary')].filter(el=>{
    if(!el.getClientRects().length || el.tabIndex<0)return false;
    if(el.type==='radio' && el.name){
      const group=[...ui.overlay.querySelectorAll('input[type="radio"]')].filter(input=>input.name===el.name && input.getClientRects().length);
      return el===(group.find(input=>input.checked)||group[0]);
    }
    return true;
  });
  const first=targets[0],last=targets.at(-1);
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
});
let hudTimer;
function showHUD(){
  document.documentElement.classList.add('hud-visible');clearTimeout(hudTimer);
  hudTimer=setTimeout(()=>document.documentElement.classList.remove('hud-visible'),2200);
}
window.addEventListener('pointermove',showHUD);
window.addEventListener('pointerdown',showHUD);
window.addEventListener('pagehide',()=>{simulationClock?.stop();rumble.stop();saveNVRAM();room.leave();});
document.addEventListener('visibilitychange',()=>{
  room.visibilityChanged();
  if(document.hidden){saveNVRAM();held.clear();keyboardControls.reset();rumble.stop();if(started&&!room.active)openMenu();}
});
export function getArcadeState(){return {running,enhanced,multiplayer:room.snapshot(),linkState:wasm?._daytona_link_state(),linkId:wasm?._daytona_link_id(),linkCount:wasm?._daytona_link_count(),drawDistance:wasm?._daytona_draw_distance(),volume:settings.volume,uiVolume:settings.uiVolume,uiAudioGain:uiAudioGain?.gain.value,keyboard:{...keyboardControls.bindings},wheel:wheelControls.preview(),audioGain:audioGain?.gain.value,audioState:ctxAudio?.state||'uninitialized',soundMuted,touch:touch.read(),gear:currentGear,ready:!!wasm?._daytona_ready(),frames:wasm?._daytona_total_frames()||0,width:wasm?._daytona_width(),height:wasm?._daytona_height()};}
document.documentElement.classList.add('launcher-open');
gameSurface.inert=true;
ui.dropzone.focus();

requestAnimationFrame(frame);
async function main() {
  setStatus('Loading engine…');
  const factory = typeof createDaytonaModule === 'function' ? createDaytonaModule : window.createDaytonaModule;
  if(typeof factory!=='function'){
    engineStartupError='The arcade engine files could not be loaded. Reload the page and check that all files were uploaded.';
    setStatus('Engine files missing');
    ui.message.textContent=engineStartupError;
    return;
  }
  try{
    wasm=await factory({locateFile:(path)=>path+'?v=21-cpu-cars'});
    for(const name of ['_daytona_prepare_visual','_daytona_visual_updates','_daytona_tiles_ptr','_daytona_tiles_versions_ptr','_daytona_tiles_metadata_ptr','_daytona_set_display','_daytona_vertices_ptr','_daytona_vertices_count','_daytona_batches_ptr','_daytona_batches_count','_daytona_background_ptr','_daytona_foreground_ptr','_daytona_tex0_ptr','_daytona_tex1_ptr','_daytona_texture_generation','_daytona_luma_ptr','_daytona_xlat_ptr','_daytona_rumble_strong','_daytona_rumble_weak','_daytona_rumble_centring','_daytona_set_draw_distance','_daytona_draw_distance','_daytona_set_cpu_cars','_daytona_link_enable','_daytona_link_receive_ptr','_daytona_link_receive','_daytona_link_tx_ptr','_daytona_link_tx_size','_daytona_link_tx_pop','_daytona_link_state','_daytona_link_id','_daytona_link_count','_daytona_callback_slots','_daytona_link_pending_bytes']) {
      if(typeof wasm[name]!=='function')throw Error('Incomplete engine build: missing '+name+'. Run scripts/build_web.ps1 again.');
    }
    renderer=await createRenderer(ui.canvas,failure);
    applyGraphics();
    setStatus('Engine ready');
    ui.message.textContent='Choose your ROM to bring the arcade to life.';
  }catch(err){engineStartupError='Could not start the arcade engine: '+(err.message||String(err));failure(engineStartupError);}
}
engineReady=main();
