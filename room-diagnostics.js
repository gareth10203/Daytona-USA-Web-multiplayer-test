export const ROOM_DIAGNOSTICS_KEY='daytona-room-diagnostics-v1';
export function mountRoomDiagnostics({room,diagnostics,storage,toggle,status,overlayToggle,download}){
 // Recording is opt-in on each page load, including browsers with an older saved preference.
 room.hostDiagnosticsEnabled=false;
 room.setPerformanceCapture(room.hostDiagnosticsEnabled);
 function sync(){
  const archive=!room.isHost&&room.lastHostReport,on=room.performanceCaptureEnabled;
  const capture=on||!room.occupied;diagnostics.setCaptureEnabled(capture);toggle.checked=archive?archive.captureMode!=='off':on;
  toggle.disabled=!room.isHost||!['lobby','playing'].includes(room.phase);overlayToggle.disabled=!capture;overlayToggle.checked=diagnostics.enabled;download.disabled=!diagnostics.history.length;
  status.textContent=archive?'Saved report. Previous measurements are retained; recording controls apply to a live hosted room.':on?'Recording performance on every cabinet. Previous reports remain available when recording is turned off.':'Detailed recording is off for this room. Connection supervision and the game continue; previous samples remain available.';
 }
 toggle.addEventListener('change',()=>{room.setDiagnosticsEnabled(toggle.checked);sync();});
 sync();return {sync};
}
