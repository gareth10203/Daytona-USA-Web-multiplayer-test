import {BUILD_ID,validateSettings} from './room-settings.js?v=53.5.2-actors';
import {DEFAULT_EEPROM} from './nvram.js?v=53.5.2-actors';
import {linkIdForSeat} from './central-link.js?v=53.5.2-actors';
import {createRenderer} from './renderer.js?v=53.5.2-actors';
import {transformPacket} from './spectator-codec.js?v=53.5.2-actors';
import {SPECTATOR_VERSION,SpectatorWorldBuffer,worldState} from './spectator-world.js?v=53.5.2-actors';
import {ARCADE_STEP_MS} from './simulation-clock.js?v=53.5.2-actors';
import {mountSpectatorHUD} from './spectator-hud.js?v=53.5.2-actors';

export function createSpectatorPlayback({room,getROM,root,onStatus=()=>{}}){
 const $=id=>root.querySelector('#'+id),hud=mountSpectatorHUD(root);
 const status=s=>{if($('spectatorStatus').textContent!==s)$('spectatorStatus').textContent=s;onStatus(s);};
 let wasm,renderer,ready,stream,epoch='',generation=0,disposed=false,visible=true,prepared=false,booting=false,initializedCourse=-1,
  members=[],donor=null,selected=null,latest=null,buffer=new SpectatorWorldBuffer(),raf,lastTick=0,debt=0,currentCamera=-1,
  lastWire=0,metricsAt=performance.now(),packets=0,receivedBytes=0,boots=0,failure='';
 const loading=(on,value=0)=>{$('spectatorLoading').hidden=!on;$('spectatorLoadProgress').value=value;};
 for(const o of $('spectatorCamera').options)o.disabled=Number(o.value)<0;$('spectatorCamera').value='2';
 $('spectatorSound').disabled=true;$('spectatorSound').textContent='Sound unavailable';$('spectatorSound').title='This prototype transmits current race states, without an audio stream.';
 $('spectatorViewHint').hidden=false;$('spectatorViewHint').textContent='Live race states · Short interpolation buffer · Audio not streamed.';
 async function ensureReady(){
  if(!ready)ready=(async()=>{
   const file=getROM();if(!file)throw Error('Choose a ROM before watching.');
   const next=await createDaytonaModule();if(disposed)return;wasm=next;
   const draw=await createRenderer($('spectatorCanvas'),e=>stop(e),{});if(disposed){draw.dispose();return;}renderer=draw;
   try{wasm.FS.mkdir('/roms');}catch{}wasm.FS.writeFile('/roms/spectator.zip',new Uint8Array(await file.arrayBuffer()));
  })().catch(e=>{ready=null;throw e;});return ready;
 }
 function stop(message){failure=message;prepared=false;generation++;loading(false);$('spectatorStage').hidden=true;status(message);}
 function reset(message='Waiting for a race.'){generation++;stream?.close();stream=null;prepared=false;latest=null;buffer=new SpectatorWorldBuffer();hud.reset();loading(false);$('spectatorStage').hidden=true;status(message);}
 function configure(config){
  validateSettings(config.settings);const grid=config.members;
  if(config.epoch!==epoch||!Array.isArray(grid)||grid.length<2||grid.length>8||grid.some(m=>typeof m.id!=='string'||m.id.length>100||typeof m.name!=='string'||m.name.length>24||!Number.isInteger(m.cabinet)||m.cabinet<1||m.cabinet>8||!Number.isInteger(m.skin)||m.skin<0||m.skin>39)||new Set(grid.map(m=>m.id)).size!==grid.length||new Set(grid.map(m=>m.cabinet)).size!==grid.length)throw Error('Invalid spectator grid.');
  const relay=grid.find(m=>m.id===config.donor);if(!relay||relay.id===config.host)throw Error('Invalid spectator relay.');
  members=grid;donor=relay;selected=members.find(m=>m.id===selected?.id)||donor;hud.reset(members);hud.select(selected.id);
  $('spectatorDriver').replaceChildren(...members.map(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name+' · Car '+m.cabinet;return o;}));$('spectatorDriver').value=selected.id;
  status('Connected · Waiting for a live race state.');
 }
 const race=s=>s&&s.count>0&&s.scene>=22&&s.scene<=29;
 function accept(s){
  const bytes=new Uint8Array(s.bytes);wasm.HEAPU8.set(bytes,wasm._daytona_spectator_world_input());
  if(!wasm._daytona_spectator_world_accept(bytes.length))throw Error('Could not apply the current race state.');
 }
 async function loadCourse(first){
  if(booting||disposed||!race(first))return;
  booting=true;prepared=false;initializedCourse=-1;loading(true,0);$('spectatorStage').hidden=true;const ticket=generation,course=first.course;
  const valid=()=>!disposed&&ticket===generation&&race(latest)&&latest.course===course;
  const step=async(n,buttons=0,gas=0)=>{
   let slice=performance.now();for(let i=0;i<n;i++){
    if(!valid())return false;
    if(!wasm._daytona_step(0,gas,0,4,buttons))throw Error(wasm.ccall('daytona_error','string',[],[])||'The local spectator arcade could not initialize.');
    if(performance.now()-slice>=6){await new Promise(r=>setTimeout(r,0));slice=performance.now();}
   }return true;
  };
  try{
   status('Loading the circuit from your ROM…');await ensureReady();if(!valid())return;
   wasm._daytona_central_config(0,0);wasm._daytona_delivery_mode(0);
   if(!wasm.ccall('daytona_load','number',['string','number'],['/roms/spectator.zip',0]))throw Error('Could not load the spectator arcade.');
   wasm.HEAPU8.set(DEFAULT_EEPROM,wasm._daytona_eeprom_ptr());
   if(!wasm._daytona_spectator_world_boot(course))throw Error('Could not start the spectator circuit loader.');
   // Fixed local initialization, not a replay of past race inputs or packets.
   if(!await step(850))return;loading(true,25);
   for(const [n,b,g] of [[20,1,0],[20,0,0],[20,2,0],[140,0,0],[20,0,100],[90,0,0],[20,0,100]])if(!await step(n,b,g))return;
   loading(true,55);
   let attempts=0;while((wasm._daytona_spectator_world_phase()&255)!==22&&attempts++<80)if(!await step(20,0,100))return;
   if((wasm._daytona_spectator_world_phase()&255)!==22)throw Error('The circuit loader did not reach a race.');
   // Complete original texture upload and rolling-camera setup while hidden.
   if(!await step(700,64))return;loading(true,90);
   if((wasm._daytona_spectator_world_phase()>>>8)!==40)throw Error('The spectator actor grid was not initialized.');
   initializedCourse=course;renderer.reset();renderer.setDrawDistance(1);accept(buffer.sample()||latest);
   boots++;prepared=true;currentCamera=-1;debt=0;lastTick=performance.now();loading(false);$('spectatorStage').hidden=false;status('Watching live · Current race state');
  }catch(e){if(ticket===generation)stop(e.message);}
  finally{booting=false;if(!disposed&&ticket===generation&&!prepared&&race(latest))setTimeout(()=>{void loadCourse(latest);},0);}
 }
 function receive(s,at){
  if(!buffer.accept(s,at))return;latest=s;lastWire=performance.now();
  if(!race(s)){prepared=false;loading(false);$('spectatorStage').hidden=true;status('Waiting for the next race · No history is recorded.');return;}
  if(booting)return;
  if(initializedCourse!==s.course){void loadCourse(s);return;}
  if(!prepared){accept(s);prepared=true;lastTick=performance.now();debt=0;$('spectatorStage').hidden=false;status('Watching live · Current race state');}
 }
 function connect(assignment){
  if(typeof assignment.relay!=='string'||assignment.relay.length>100||!/^[a-f0-9]{32}$/.test(assignment.ticket||'')||!/^[a-f0-9]{32}$/.test(assignment.epoch||''))throw Error('Invalid spectator assignment.');
  reset('Connecting to a live race relay…');failure='';epoch=assignment.epoch;const ticket=generation;
  const c=stream=room.peer.connect(assignment.relay,{reliable:true,serialization:'binary',metadata:{role:'spectator-stream',build:BUILD_ID,version:SPECTATOR_VERSION,epoch,ticket:assignment.ticket}});
  let decoding=false,pending=null,configured=false;
  async function decode(){
   if(decoding)return;decoding=true;
   try{while(pending&&c===stream&&ticket===generation){const {d,at}=pending;pending=null;const bytes=await transformPacket(d.bytes,d.format,true);if(c!==stream||ticket!==generation)return;receive(worldState(bytes,members.length),at);packets++;receivedBytes+=d.bytes.byteLength;}}
   catch(e){if(c===stream){stop(e.message);c.close();}}finally{decoding=false;}
  }
  c.on('data',d=>{
   if(c!==stream||ticket!==generation)return;
   if(d?.type==='spectator-begin'&&d.version===SPECTATOR_VERSION){try{configure(d.config);configured=true;}catch(e){stop(e.message);c.close();}return;}
   if(d?.type==='spectator-wait'){stop(String(d.message||'Waiting for a race.').slice(0,160));return;}
   if(d?.type==='spectator-world'&&configured&&d.epoch===epoch){pending={d,at:performance.now()};void decode();}
  });
  c.on('close',()=>{if(c===stream&&!failure)stop('The spectator relay disconnected. Drivers are unaffected.');});c.on('error',()=>{if(c===stream&&!failure)stop('Could not reach the spectator relay.');});
 }
 function frame(now){
  raf=requestAnimationFrame(frame);if(disposed)return;
  if(prepared&&race(latest))try{
   debt=Math.min(70,debt+Math.max(0,now-lastTick));lastTick=now;let n=0;
   while(debt>=ARCADE_STEP_MS&&n++<4){
    const index=members.findIndex(m=>m.id===selected?.id);wasm._daytona_spectator_target(linkIdForSeat(Math.max(0,index)+1,members.length));
    const camera=Number($('spectatorCamera').value);if(!wasm._daytona_spectator_world_view(camera,selected.cabinet))throw Error('Could not select the spectator camera.');currentCamera=camera;
    accept(buffer.sample(now)||latest);renderer.prepare(wasm);
    if(!wasm._daytona_step(0,0,0,4,0))throw Error(wasm.ccall('daytona_error','string',[],[])||'The spectator renderer stopped.');debt-=ARCADE_STEP_MS;
   }
   if(visible){renderer.setHUDVisible(false);hud.update(wasm,now);renderer.draw(wasm);}
   $('spectatorFollowing').textContent=latest.scene>=23?`Race ended · ${selected.name}`:`Following ${selected.name} · Car ${selected.cabinet}`;
   if(now-lastWire>10000)stop('The spectator relay stopped sending. Drivers are unaffected.');
  }catch(e){stop(e.message);stream?.close();}
  else lastTick=now;
  if(now-metricsAt>=1000){$('spectatorMetrics').textContent=`${Math.round(packets*1000/(now-metricsAt))} states/s · ${Math.round(receivedBytes*1000/(now-metricsAt)/1024)} KiB/s · ${buffer.frames.length}/8 recent states · No history`;packets=receivedBytes=0;metricsAt=now;}
 }
 $('spectatorDriver').onchange=()=>{selected=members.find(m=>m.id===$('spectatorDriver').value)||donor;if(selected)hud.select(selected.id);};
 $('spectatorFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():root.requestFullscreen?.();
 raf=requestAnimationFrame(frame);
 return {message(d){if(disposed)return;if(d.type==='spectator-assignment'){try{connect(d);}catch(e){stop(e.message);}}else if(d.type==='spectator-status')status(String(d.message||'').slice(0,160));},
  reset,warm(){void ensureReady().catch(e=>status(e.message));},visible(on){visible=!!on;},
  state:()=>({prepared,booting,boots,course:initializedCourse,frame:wasm?._daytona_total_frames(),scene:latest?.scene,sourceFrame:latest?.frame,queued:buffer.frames.length,received:buffer.received,epoch,relay:donor?.id,target:selected?.id,camera:currentCamera,focus:wasm?._daytona_spectator_focus(),hud:hud.snapshot(),history:false,failure,localPhase:wasm?._daytona_spectator_world_phase()}),
  dispose(){disposed=true;cancelAnimationFrame(raf);reset('');renderer?.dispose();renderer=null;wasm=null;}
 };
}
