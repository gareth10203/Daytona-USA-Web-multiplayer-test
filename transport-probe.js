// Measurements only. Never schedules delivery, changes payloads or controls a race.
export const TRANSPORT_WINDOW=256;
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export class MetricWindow {
 constructor(){this.values=new Float64Array(TRANSPORT_WINDOW);this.count=0;this.cursor=0;}
 add(n){if(!valid(n))return;this.values[this.cursor]=n;this.cursor=(this.cursor+1)%TRANSPORT_WINDOW;this.count=Math.min(TRANSPORT_WINDOW,this.count+1);}
 summary(){if(!this.count)return {samples:0,median:null,p95:null,max:null};const a=Array.from(this.values.subarray(0,this.count)).sort((a,b)=>a-b);return {samples:this.count,median:a[Math.floor((a.length-1)*.5)],p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)};}
}
const windows=['sendCall','peerjsPrepare','rtcSubmit','receiveEvent','pendingWait','creditWait','receiveGap','sourceAge','sourceUncertainty','receiptRtt','nativeWait','nativeAge','nativeUncertainty','buffered'];
export function dataSize(data){if(typeof data==='string')return new TextEncoder().encode(data).byteLength;if(data instanceof ArrayBuffer||ArrayBuffer.isView(data))return data.byteLength;if(typeof Blob!=='undefined'&&data instanceof Blob)return data.size;return null;}
export class TransportProbe {
 constructor({clock=()=>performance.now(),enabled=true}={}){this.clock=clock;this.enabled=enabled;this.hooked=false;this.reset();}
 reset(){this.windows=Object.fromEntries(windows.map(k=>[k,new MetricWindow()]));this.txBytes=0;this.rxBytes=0;this.txMessages=0;this.rxMessages=0;this.sendCalls=0;this.asyncSendCalls=0;this.submitTotalMs=0;this.decoded=0;this.browser=null;this.lastRawAt=null;this.lastStateAt=null;this.startedAt=this.clock();this.rateAt=this.startedAt;this.previous={tx:0,rx:0,txMessages:0,rxMessages:0};this.rates={};this.cached=null;this.cachedAt=-Infinity;}
 setEnabled(on){on=!!on;if(on===this.enabled)return;this.enabled=on;this.reset();}
 add(key,n){if(this.enabled)this.windows[key]?.add(n);}
 sent(data,start,end){if(!this.enabled)return;const bytes=dataSize(data);if(bytes!==null)this.txBytes+=bytes;this.txMessages++;this.submitTotalMs+=Math.max(0,end-start);this.add('rtcSubmit',end-start);}
 rawReceived(data,now=this.clock(),eventTime=null){if(!this.enabled)return;const bytes=dataSize(data);if(bytes!==null)this.rxBytes+=bytes;this.rxMessages++;this.lastRawAt=now;if(valid(eventTime)&&eventTime<=now)this.add('receiveEvent',now-eventTime);}
 dispatched(){if(this.enabled)this.decoded++;}
 sendCall(ms,previousSubmitMs=null,async=false){if(this.enabled){this.sendCalls++;this.add('sendCall',ms);if(async)this.asyncSendCalls++;else if(this.hooked&&valid(previousSubmitMs))this.add('peerjsPrepare',Math.max(0,ms-(this.submitTotalMs-previousSubmitMs)));}}
 browserStats(stats,now=this.clock()){if(this.enabled)this.browser={at:now,...stats};}
 stateReceived(timing,now=this.clock()){
  if(!this.enabled)return;if(this.lastStateAt!==null)this.add('receiveGap',now-this.lastStateAt);this.lastStateAt=now;
  const entries=Array.isArray(timing)?timing:[timing],known=entries.filter(t=>t&&valid(t.ageMs)&&valid(t.uncertaintyMs));
  if(known.length){this.add('sourceAge',Math.max(...known.map(t=>t.ageMs)));this.add('sourceUncertainty',Math.max(...known.map(t=>t.uncertaintyMs)));}
 }
 nativeApplied(pending,now=this.clock()){
  if(!this.enabled||!pending)return;const wait=Math.max(0,now-pending.at);this.add('nativeWait',wait);
  const known=(pending.timing||[]).filter(t=>t&&valid(t.ageMs)&&valid(t.uncertaintyMs));
  if(known.length){this.add('nativeAge',Math.max(...known.map(t=>t.ageMs+wait)));this.add('nativeUncertainty',Math.max(...known.map(t=>t.uncertaintyMs)));}
 }
 snapshot(now=this.clock()){
  if(!this.enabled)return null;if(this.cached&&now-this.cachedAt<500)return this.cached;
  const seconds=(now-this.rateAt)/1000;
  if(seconds>=.5){this.rates={rtcTxBytesPerSecond:(this.txBytes-this.previous.tx)/seconds,rtcRxBytesPerSecond:(this.rxBytes-this.previous.rx)/seconds,rtcTxMessagesPerSecond:(this.txMessages-this.previous.txMessages)/seconds,rtcRxMessagesPerSecond:(this.rxMessages-this.previous.rxMessages)/seconds};this.rateAt=now;this.previous={tx:this.txBytes,rx:this.rxBytes,txMessages:this.txMessages,rxMessages:this.rxMessages};}
  const result={schema:1,window:TRANSPORT_WINDOW,seconds:Math.max(0,(now-this.startedAt)/1000),hooked:this.hooked,rtcTxBytes:this.txBytes,rtcRxBytes:this.rxBytes,rtcTxMessages:this.txMessages,rtcRxMessages:this.rxMessages,sendCalls:this.sendCalls,asyncSendCalls:this.asyncSendCalls,decodedMessages:this.decoded,...this.rates};
  for(const [name,window] of Object.entries(this.windows)){const s=window.summary();if(!s.samples)continue;result[name+'Samples']=s.samples;result[name+'Median']=s.median;result[name+'P95']=s.p95;result[name+'Max']=s.max;}
  if(this.browser){const {at,...stats}=this.browser;Object.assign(result,stats,{browserStatsAgeMs:Math.max(0,now-at)});}this.cachedAt=now;return this.cached=result;
 }
}

// Pass through exactly the same arguments, return value and send errors.
// RTC bytes are serialized message payloads; NOT UDP/IP, encryption or retransmissions.
export function attachDataChannelProbe(channel,probe){
 if(!channel?.send||!channel.addEventListener)return ()=>{};
 const original=channel.send,receive=event=>probe.rawReceived(event.data,probe.clock(),event.timeStamp);
 const wrapped=function(...args){const start=probe.enabled?probe.clock():0;const result=Reflect.apply(original,this,args);if(probe.enabled)probe.sent(args[0],start,probe.clock());return result;};
 try{channel.send=wrapped;if(channel.send!==wrapped)return ()=>{};channel.addEventListener('message',receive);probe.hooked=true;}catch{if(channel.send===wrapped)channel.send=original;return ()=>{};}
 return ()=>{channel.removeEventListener('message',receive);if(channel.send===wrapped)channel.send=original;};
}

const numeric=['seconds','rtcTxBytes','rtcRxBytes','rtcTxMessages','rtcRxMessages','sendCalls','asyncSendCalls','decodedMessages','rtcTxBytesPerSecond','rtcRxBytesPerSecond','rtcTxMessagesPerSecond','rtcRxMessagesPerSecond','browserStatsAgeMs','browserDataTxBytes','browserDataRxBytes','browserDataTxMessages','browserDataRxMessages','browserIceTxBytes','browserIceRxBytes','browserIceTxPackets','browserIceRxPackets','browserRttMs'];
export function normalizeTransportProbe(source){
 if(!source||source.schema!==1)return null;const result={schema:1,window:TRANSPORT_WINDOW,hooked:source.hooked===true};
 for(const key of numeric)if(valid(source[key])&&source[key]<=Number.MAX_SAFE_INTEGER)result[key]=source[key];
 for(const name of windows)for(const suffix of ['Samples','Median','P95','Max']){const key=name+suffix,n=source[key],limit=suffix==='Samples'?TRANSPORT_WINDOW:name==='buffered'?2**30:600000;if(valid(n)&&n<=limit)result[key]=n;}
 return result;
}

export function transportSignals({probe,browserRttMs,simulationHz}={}){
 const signals=[];if(!probe||probe.seconds<3)return signals;
 if(valid(simulationHz)&&simulationHz<52)signals.push('slow-simulation');
 if((probe.pendingWaitP95||0)>50||(probe.bufferedP95||0)>=16384)signals.push('sender-wait');
 if(valid(browserRttMs)&&valid(probe.receiptRttMedian)&&probe.receiptRttMedian-browserRttMs>Math.max(40,browserRttMs*.3))signals.push('application-rtt-excess');
 if((probe.receiveGapP95||0)>Math.max(80,(probe.receiveGapMedian||0)*2))signals.push('irregular-arrivals');
 if((probe.sourceAgeP95||0)>250)signals.push('old-source-state');
 return signals;
}
