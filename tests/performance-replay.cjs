// Deterministic comparison with the previous compiled release, using local ROM.
// Sources/ROM bytes and captured game images are never packaged by this test.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const results=[];
 try{
  for(const optimized of [false,true]){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const engineRoot=optimized?'dist':'../multiplayer-version/dist';
   await page.route('**/replay-page',r=>r.fulfill({contentType:'text/html',body:'<script src="daytona_engine.js"></script>'}));
   for(const file of ['daytona_engine.js','daytona_engine.wasm'])await page.route('**/'+file,r=>r.fulfill({path:path.resolve(engineRoot,file),contentType:file.endsWith('.wasm')?'application/wasm':'text/javascript'}));
   await page.goto(base+'/replay-page');
   const result=await page.evaluate(async({rom,optimized})=>{
    const {DEFAULT_EEPROM}=await import('./nvram.js');const {prepareCabinet}=await import('./room-settings.js');
    const modules=[];for(let i=0;i<2;i++){const m=await createDaytonaModule({locateFile:x=>x});m.FS.mkdir('/roms');m.FS.writeFile('/roms/game.zip',new Uint8Array(rom));modules.push(m);}
    const reload=m=>{if(!m.ccall('daytona_load','number',['string','number'],['/roms/game.zip',1]))throw Error('ROM load failed');m._daytona_set_display(0,496,384);m._daytona_set_draw_distance(0);};
    const hash=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return h>>>0;};
    const checkpoints=[];
    const capture=m=>{
     const slice=(ptr,size)=>hash(m.HEAPU8.subarray(ptr,ptr+size));
     return {frames:m._daytona_total_frames(),vertices:slice(m._daytona_vertices_ptr(),m._daytona_vertices_count()*64),batches:slice(m._daytona_batches_ptr(),m._daytona_batches_count()*24),background:slice(m._daytona_background_ptr(),m._daytona_width()*m._daytona_height()*4),foreground:slice(m._daytona_foreground_ptr(),m._daytona_width()*m._daytona_height()*4),audio:slice(m._daytona_audio_ptr(),m._daytona_audio_frames()*8),eeprom:slice(m._daytona_eeprom_ptr(),m._daytona_eeprom_size())};
    };
    const step=(m,steer,gas,buttons)=>{if(!m._daytona_step(steer,gas,0,1,buttons))throw Error('Step failed');};
    const yieldBrowser=()=>new Promise(r=>setTimeout(r,0));
    // Individual boot/attract parity, then both cabinet configurations.
    for(const m of modules){reload(m);m.HEAPU8.set(DEFAULT_EEPROM,m._daytona_eeprom_ptr());}
    for(let f=0;f<720;f++){modules.forEach(m=>step(m,0,0,0));if(f%120===119)checkpoints.push({kind:'single',state:modules.map(capture)});if(f%20===19)await yieldBrowser();}
    for(let i=0;i<2;i++)await prepareCabinet(modules[i],()=>reload(modules[i]),{master:i===0,cabinet:i+1,mode:0,difficulty:0,region:'Export'});
    let wire=[],frame=0,packetHash=2166136261,packets=0,maxSlots=0;const cpu=[[],[]];
    const tick=(buttons=0,gas=0,steer=0,measure=false)=>{
     frame++;const ready=wire.filter(x=>x.due<=frame);wire=wire.filter(x=>x.due>frame);
     for(const msg of ready){const m=modules[msg.target];m.HEAPU8.set(msg.bytes,m._daytona_link_receive_ptr());if(!m._daytona_link_receive(msg.bytes.length))throw Error('RX overflow');}
     for(let i=0;i<2;i++){
      const m=modules[i],begin=performance.now();step(m,steer,gas,buttons);if(measure)cpu[i].push(performance.now()-begin);
      if(optimized)maxSlots=Math.max(maxSlots,m._daytona_callback_slots());
      while(m._daytona_link_tx_size()){
       const size=m._daytona_link_tx_size(),bytes=m.HEAPU8.slice(m._daytona_link_tx_ptr(),m._daytona_link_tx_ptr()+size);m._daytona_link_tx_pop();
       for(const b of bytes)packetHash=Math.imul(packetHash^b,16777619);packets++;wire.push({target:1-i,bytes,due:frame+3});
      }
     }
     if(frame%120===0)checkpoints.push({kind:'linked',state:modules.map(capture),packetHash:packetHash>>>0,packets});
    };
    const advance=async(n,buttons=0,gas=0)=>{for(let i=0;i<n;i++){tick(buttons,gas);if(i%12===11)await yieldBrowser();}};
    await advance(900);await advance(20,1);await advance(20);await advance(20,2);await advance(150);await advance(20,0,100);await advance(100);await advance(20,0,100);await advance(2100);
    for(let i=0;i<1200;i++){tick(0,75,Math.round(Math.sin(i/90)*35),true);if(i%12===11)await yieldBrowser();}
    const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
    return {checkpoints,cpuMeanMs:cpu.map(mean),maxSlots,link:modules.map(m=>m._daytona_link_state()),frames:modules.map(m=>m._daytona_total_frames()),heapBytes:modules.map(m=>m.HEAPU8.buffer.byteLength)};
   },{rom:[...fs.readFileSync(process.env.TEST_ROM)],optimized});
   assert.deepEqual(errors,[]);assert.deepEqual(result.link,[2,2]);if(optimized)assert.ok(result.maxSlots<=256,'Callbacks must remain bounded');
   results.push(result);console.log(optimized?'optimized':'previous',JSON.stringify({cpuMeanMs:result.cpuMeanMs,maxSlots:result.maxSlots,frames:result.frames,heapBytes:result.heapBytes}));await page.close();
  }
  fs.writeFileSync('build/performance-replay.json',JSON.stringify(results,null,2));
  assert.deepEqual(results[1].checkpoints,results[0].checkpoints,'Video, geometry, audio, EEPROM and ordered link packets must match previous release');
  console.log('PASS: deterministic individual/linked replay, race inputs, bounded callbacks and unchanged arcade packets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
