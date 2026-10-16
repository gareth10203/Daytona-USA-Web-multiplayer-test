export const ROOM_DIAGNOSTICS_KEY='daytona-room-diagnostics-v1';
export function mountRoomDiagnostics({room,diagnostics,storage,toggle,status,overlayToggle,download}){
 try{room.hostDiagnosticsEnabled=storage.getItem(ROOM_DIAGNOSTICS_KEY)!=='off';}catch{room.hostDiagnosticsEnabled=true;}
 room.setPerformanceCapture(room.hostDiagnosticsEnabled);
 function sync(){
  const archive=!room.isHost&&room.lastHostReport,on=room.performanceCaptureEnabled;
  diagnostics.setCaptureEnabled(on);toggle.checked=archive?archive.captureMode!=='off':on;
  toggle.disabled=!room.isHost||!['lobby','playing'].includes(room.phase);overlayToggle.disabled=!on;overlayToggle.checked=diagnostics.enabled;download.disabled=!diagnostics.history.length;
  status.textContent=archive?'Saved report. Previous measurements are retained; recording controls apply to a live hosted room.':on?'Recording performance on every cabinet. Previous reports remain available when recording is turned off.':'Detailed recording is off for this room. Connection supervision and the game continue; previous samples remain available.';
 }
 toggle.addEventListener('change',()=>{if(room.setDiagnosticsEnabled(toggle.checked)){try{storage.setItem(ROOM_DIAGNOSTICS_KEY,toggle.checked?'full':'off');}catch{}}sync();});
 sync();return {sync};
}
