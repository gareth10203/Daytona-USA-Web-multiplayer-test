import {classifyConnection,describeEvent} from './connection-health.js?v=43-reverse-checkpoints';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const ms=v=>Number.isFinite(v)?v<1000?`${Math.round(v)} ms`:`${(v/1000).toFixed(1)} s`:'—';
const bytes=v=>Number.isFinite(v)?v<1024?`${Math.round(v)} B`:`${(v/1024).toFixed(1)} KiB`:'—';
const hz=v=>Number.isFinite(v)?`${v.toFixed(1)} Hz`:'—';
const time=v=>new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
export function mountHostConsole(room){
 const panel=$('hostConsole'),dialog=$('menuDialog'),tabs=[$('connectionPlayersTab'),$('connectionEventsTab')],rows=new Map(),events=new Map();
 let open=false,origin=null,previous=null,roomGeneration=null,timer=null,polling=false,nextStats=0,lastReport=null;
 function downloadReport(report,name){const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=node('a');link.href=url;link.download=`${name}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function select(tab,focus=false){for(const t of tabs){const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;$(t.getAttribute('aria-controls')).hidden=!selected;}if(focus)tab.focus();}
 for(const tab of tabs){tab.onclick=()=>select(tab);tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();select(e.key==='Home'?tabs[0]:e.key==='End'?tabs[1]:tabs[1-tabs.indexOf(tab)],true);}});}
 function rowElement(row){
  const tr=node('tr'),detail=node('tr',undefined,'connection-detail'),cell=node('td');cell.colSpan=6;detail.append(cell);detail.hidden=true;
  const button=node('button',undefined,'connection-driver');button.type='button';button.setAttribute('aria-expanded','false');button.onclick=()=>{detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));};
  const name=node('strong'),seat=node('small');button.append(name,seat);tr.append(node('td'));tr.firstChild.append(button);
  const values=['Connection','RTT','SIM','Game update age','Outgoing queue'].map(label=>{const td=node('td');td.dataset.label=label;tr.append(td);return td;});
  const status=node('span',undefined,'connection-badge');values[0].append(status);
  const list=node('dl',undefined,'connection-detail-list'),download=node('button','Download performance','connection-performance-download');download.type='button';cell.append(list,download);const details=new Map();
  download.onclick=()=>{const report=room.consoleSnapshot({includePerformance:true}),cabinet=report?.performance?.cabinets.find(c=>c.serial===row.serial);if(cabinet?.samples.length)downloadReport({...cabinet,build:report.build,createdAt:report.generatedAt,notes:report.performance.notes},'daytona-cabinet-'+(cabinet.cabinet??'unknown')+'-performance');};
  const value=(label,text)=>{let dd=details.get(label);if(!dd){const pair=node('div');dd=node('dd');pair.append(node('dt',label),dd);list.append(pair);details.set(label,dd);}dd.textContent=text;};
  return {tr,detail,button,name,seat,values,status,value,download};
 }
 function renderRows(report){
  const ids=new Set();
  for(const row of report.rows){const id=row.serial;ids.add(id);let view=rows.get(id);if(!view){view=rowElement(row);rows.set(id,view);$('connectionRows').append(view.tr,view.detail);}
   const state=classifyConnection(row,report.phase==='playing'),fresh=!row.archived&&row.reportAgeMs!=null&&row.reportAgeMs<=Math.max(3000,(row.rttMs||0)*3+1000);
   view.name.textContent=row.name;view.seat.textContent=row.self?`${String(row.cabinet??1).padStart(2,'0')} · You / host`:`${row.cabinet==null?'Pending request':String(row.cabinet).padStart(2,'0')+' · Cabinet'}${row.archived?' · Previous participant':''}`;
   view.button.setAttribute('aria-label',`Connection details for ${row.name}`);view.tr.dataset.level=state.level;view.status.dataset.level=state.level;view.status.textContent=state.label;view.status.title=state.detail;
   view.values[1].textContent=row.self?'Local':ms(row.rttMs);view.values[1].title=row.rttSource==='browser'?'Browser candidate-pair RTT':'Round-trip room ping measured by the host';
   const sim=row.health?.phase==='playing'?row.health.simulationHz:null;
   view.values[2].textContent=hz(sim)+(sim!==null&&!fresh?' · old':'');view.values[2].title=row.self?'Measured on this device':'Latest measurement reported by the participant';
   view.values[3].textContent=ms(row.lastStateAgeMs);view.values[4].textContent=bytes(row.bufferedBytes);
   view.value('Observation',row.archived?'Retained at disconnect; measurements are frozen':state.detail);
   view.value('Transport / ICE',row.self?'Local cabinet':`${row.channelState||'Unavailable'} / ${row.connectionState||'Unavailable'} / ${row.iceState||'Unavailable'}`);
   view.value('Route',row.self?'Local':row.path?`${row.path==='relay'?'TURN relay':'Direct'} · browser stats ${ms(row.statsAgeMs)} old`:'Awaiting browser stats');
   view.value('Browser RTT',ms(row.transportRttMs));view.value('Last message / progress',`${ms(row.lastMessageAgeMs)} / ${ms(row.progressAgeMs)}`);
   view.value('Status report age',ms(row.reportAgeMs));view.value('Reported tab / signaling',row.health?`${row.health.visible?'Visible':'Hidden'} / ${row.health.signaling?'Connected':'Reconnecting'}`:'Unavailable');
   view.value('SIM sample duration',ms(row.health?.sampleMs));view.value('States in flight / pending',row.inFlight==null?'—':`${row.inFlight} / ${row.pendingStates}`);
   view.value('Oldest state receipt wait',ms(row.ackAgeMs));view.value('No receipt progress for',ms(row.ackProgressAgeMs));view.value('Game payload sent / received',`${bytes(row.sentBytes)} / ${bytes(row.receivedBytes)}`);
   view.value('Game payload TX / RX',`${bytes(row.txBytesPerSecond)}/s / ${bytes(row.rxBytesPerSecond)}/s`);
   view.value('Reported receive queue / backlog',`${bytes(row.health?.receiveBytes)} / ${ms(row.health?.backlogMs)}`);
   const captureOff=row.health?.captureMode==='off',perf=row.performance;view.value('Diagnostics',row.health?.captureMode?captureOff?'Off · supervised connection':'On · detailed recording':'Awaiting status');
   view.value('Recorded game performance',perf?.sampleCount?`${perf.sampleCount} samples · ${time(perf.firstCapturedAt)} – ${time(perf.lastCapturedAt)} (device time)${captureOff?' · earlier recording':''}`:captureOff?'Detailed recording is off':'Awaiting game measurements');
   view.value('Performance coverage',perf?.sampleCount?`${perf.source==='local'?'Local':'Player reported'} · ${perf.discardedSamples} earlier samples discarded · ${perf.unreceivedSamples} sequence gaps`:captureOff?'Connection status is still supervised':'Recording starts during linked gameplay when enabled by the host');
   view.download.disabled=!perf?.sampleCount;view.download.setAttribute('aria-label',`Download performance for ${row.name}`);
  }
  for(const [id,v] of rows)if(!ids.has(id)){v.tr.remove();v.detail.remove();rows.delete(id);}
  $('connectionRowsEmpty').hidden=!!ids.size;$('connectionPlayerCount').textContent=String(report.rows.filter(r=>!r.archived).length);
 }
 function renderEvents(report){
  const ids=new Set();for(const event of [...report.events].reverse()){ids.add(event.id);if(events.has(event.id))continue;
   const li=node('li'),description=describeEvent(event),heading=node('div',undefined,'connection-event-heading');
   heading.append(node('time',time(event.at)),node('strong',description.title),node('span',event.source==='reported'?'Reported':event.source==='action'?'Action':'Observed','connection-source'));
   li.append(heading,node('p',`${event.name}${event.cabinet!=null?' · Cabinet '+event.cabinet:''} — ${description.detail}`));
   if(event.reason)li.append(node('p',event.reason,'connection-event-reason'));events.set(event.id,li);
  }
  for(const [id,el] of events)if(!ids.has(id)){el.remove();events.delete(id);}
  // Preserve the pane and its scroll position, including while the reader inspects older entries.
  const list=$('connectionEvents');for(const event of [...report.events].reverse()){const el=events.get(event.id),index=[...list.children].indexOf(el),target=report.events.length-1-report.events.indexOf(event);if(index!==target)list.insertBefore(el,list.children[target]||null);}
  $('connectionEventsEmpty').hidden=!!ids.size;$('connectionEventCount').textContent=String(ids.size);
  const incident=[...report.events].reverse().find(e=>e.kind==='session-stop'),banner=$('hostConsoleIncident');banner.hidden=!incident;
  if(incident)banner.textContent=`Last interruption · ${time(incident.at)} · ${incident.name}${incident.cabinet!=null?' / cabinet '+incident.cabinet:''}: ${describeEvent(incident).title} (${incident.source==='reported'?'reported':incident.source==='action'?'action':'observed'}).`;
 }
 function render(){
  if(!open)return;const report=room.consoleSnapshot();if(!report){close();return;}
  if(roomGeneration!==room.generation){roomGeneration=room.generation;rows.clear();events.clear();$('connectionRows').replaceChildren();$('connectionEvents').replaceChildren();}
  lastReport=report;$('hostConsoleState').textContent=report.live?report.phase==='playing'?'ON TRACK':'LIVE ROOM':'SAVED SESSION';
  $('hostConsoleSummary').textContent=report.live?report.signaling?'Updates every second · host observations and player reports':'Invitation service reconnecting · existing channels may still work':'Last room hosted on this device · retained until the page reloads';
  $('hostConsoleUpdated').textContent=`${report.live?'Updated':'Captured'} ${time(report.generatedAt)}`;
  renderRows(report);renderEvents(report);
  const now=performance.now();if(report.live&&!polling&&now>=nextStats){nextStats=now+2000;polling=true;Promise.resolve(room.pollDiagnostics()).catch(()=>{}).finally(()=>{polling=false;});}
 }
 function show(button){
  if(!room.isHost&&!room.lastHostReport)return;
  origin=button;previous={main:$('mainMenu').hidden,settings:$('settingsModal').hidden,title:dialog.getAttribute('aria-labelledby')};
  $('mainMenu').hidden=$('settingsModal').hidden=true;panel.hidden=false;dialog.classList.add('host-console-view');dialog.setAttribute('aria-labelledby','hostConsoleTitle');$('overlay').scrollTop=0;open=true;nextStats=0;select(tabs[0]);render();timer=setInterval(render,500);$('hostConsoleBack').focus();
 }
 function close(){if(!open)return;open=false;clearInterval(timer);timer=null;panel.hidden=true;dialog.classList.remove('host-console-view');$('mainMenu').hidden=previous.main;$('settingsModal').hidden=previous.settings;dialog.setAttribute('aria-labelledby',previous.title||'gameTitle');if(origin&&!origin.hidden)origin.focus();}
 function sync(){
  $('hostConsoleBtn').hidden=!room.isHost||!room.members.length;$('lastHostConsoleBtn').hidden=room.isHost||!room.lastHostReport;
  $('lastHostConsoleBtn').textContent='Last connection report';
  if(open)render();
 }
 $('hostConsoleBtn').onclick=()=>show($('hostConsoleBtn'));$('lastHostConsoleBtn').onclick=()=>show($('lastHostConsoleBtn'));$('hostConsoleBack').onclick=close;
 $('hostConsoleExport').onclick=()=>{render();const report=room.consoleSnapshot({includePerformance:true});if(!report)return;downloadReport({...report,reportVersion:2,notes:['RTT is host-to-player round trip, not player-to-player latency.','SIM is measured emulation steps per second, not display FPS.','Remote status and game performance are participant-reported. Archived connection measurements are frozen.','Game payload counters exclude protocol overhead and room messages.','Packet loss percentage and underlying network failure causes are unavailable.']},'daytona-host-connections');};
 sync();return {sync,close,isOpen:()=>open};
}
