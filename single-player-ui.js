import {loadSingleSettings,sameSingleSettings,SINGLE_SETTINGS_ID} from './single-player-settings.js?v=43-reverse-checkpoints';

export function createSinglePlayerUI({storage,onOpen,onBack,onStart,getSession,unlockAudio}){
 const $=id=>document.getElementById(id),panel=$('singlePlayerPanel'),form=$('singleRaceForm');
 let settings=loadSingleSettings(storage),busy=false;
 function read(){return {mode:Number($('singleMode').value),difficulty:Number($('singleDifficulty').value),cpuCars:$('singleCpuCars').value==='true',reverse:$('singleDirection').value==='reverse',region:'Export'};}
 function render(){
  const session=getSession(),resume=session.canResume&&sameSingleSettings(settings,session.settings);
  $('singleCpuHelp').textContent=settings.cpuCars?'Race against the original arcade grid.':'Uses the original solo Time Attack mode.';
  $('singleStartLabel').textContent=busy?'PREPARING CABINET…':resume?'RESUME ARCADE':session.canResume?'APPLY & RESTART':'ENTER ARCADE';
  $('singleSessionHint').textContent=session.canResume&&!resume?'New settings restart this cabinet. Saved scores stay.':resume?'Your current session is paused and ready to resume.':'Choose your circuit and transmission in the arcade.';
  $('singleDirectionHelp').textContent=settings.reverse?'All three circuits, driven in the opposite direction.':'The original direction on all three circuits.';
 }
 function change(){settings=read();try{storage.setItem(SINGLE_SETTINGS_ID,JSON.stringify(settings));}catch{}$('singleStatus').textContent='';render();}
 function setBusy(value){busy=value;panel.setAttribute('aria-busy',String(value));for(const input of form.elements)input.disabled=value;$('singleBack').disabled=value;$('settingsBtn').disabled=value;render();}
 function back(){if(busy)return;onBack();}
 for(const id of ['singleMode','singleDifficulty','singleCpuCars','singleDirection'])$(id).addEventListener('change',change);
 $('singleBack').onclick=back;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;void unlockAudio();change();setBusy(true);$('singleStatus').textContent='Applying your arcade settings…';
  try{await onStart({...settings});$('singleStatus').textContent='';}catch(error){$('singleStatus').textContent=error.message||'Could not prepare this cabinet. Please try again.';}finally{setBusy(false);if(!panel.hidden)$('singleStart').focus();}
 });
 return {
  open(){onOpen();$('singleMode').value=String(settings.mode);$('singleDifficulty').value=String(settings.difficulty);$('singleCpuCars').value=String(settings.cpuCars);$('singleDirection').value=settings.reverse?'reverse':'normal';$('singleStatus').textContent='';render();$('singleMode').focus();},
  escape(){if(panel.hidden)return false;back();return true;},
  isOpen:()=>!panel.hidden
 };
}
