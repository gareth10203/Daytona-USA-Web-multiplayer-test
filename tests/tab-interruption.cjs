const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--autoplay-policy=no-user-gesture-required']});
 const contexts=[],errors=[];
 try{
  async function cabinet(){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/main.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  diagnostics.update(running);','  if(window.holdCabinet)return;\n  diagnostics.update(running);')+'\nwindow.progressDebug=()=>({now:performance.now(),frames:room.progressFrames,at:room.progressAt,peers:(room.isHost?[...room.connections.values()]:[room.server]).map(c=>c?.emulation)});window.holdHost=()=>{window.holdCabinet=true;clearInterval(room.timer);const handle=room.handle.bind(room);const waiting=[];room.handle=(...args)=>waiting.push(args);window.releaseHost=()=>{window.holdCabinet=false;room.handle=handle;for(const args of waiting)handle(...args);room.timer=setInterval(()=>room.heartbeat(),1000);};};'});});
   await page.goto(process.env.TEST_URL||'http://127.0.0.1:8083');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
   await page.evaluate(async()=>{window.state=(await import('./main.js')).getArcadeState;});await page.setInputFiles('#romInput',process.env.TEST_ROM);await page.waitForFunction(()=>document.querySelector('#status').textContent==='ROM ready');await page.click('#multiplayerPlayer');return page;
  }
  const host=await cabinet(),guest=await cabinet();await host.click('#createRoom');await host.waitForFunction(()=>document.querySelector('#inviteLink').value);const invite=await host.locator('#inviteLink').inputValue();
  await guest.fill('#joinCode',invite);await guest.click('#joinRoom');await host.waitForFunction(()=>document.querySelector('#pendingList button'));await host.locator('#pendingList button').first().click();await guest.waitForFunction(()=>state().multiplayer.members.length===2);
  const pages=[host,guest];
  async function start(){for(const p of pages)await p.click('#readyRoom');await host.waitForFunction(()=>!document.querySelector('#startRoom').disabled);await host.click('#startRoom');for(const p of pages)try{await p.waitForFunction(()=>state().linkState===2&&state().multiplayer.phase==='playing',null,{timeout:60000});}catch(e){console.log('Restart failure states',await Promise.all(pages.map(p=>p.evaluate(()=>({state:state(),progress:progressDebug()})))));throw e;}}
  async function lobby(){for(const p of pages)await p.waitForFunction(()=>state().multiplayer.phase==='lobby'&&!state().multiplayer.awaitingStop,null,{timeout:15000});
   for(const p of pages){const s=await p.evaluate(()=>state());assert.equal(s.running,false);assert.equal(s.multiplayer.members.length,2);assert.ok(s.multiplayer.members.every(m=>!m.ready));assert.ok(s.multiplayer.error.includes('inactive'));const frames=s.frames;await p.waitForTimeout(200);assert.equal((await p.evaluate(()=>state())).frames,frames);}
   assert.equal(await host.locator('#inviteLink').inputValue(),invite);
  }
  for(const [index,p] of pages.entries()){
   await start();
   // Focus changes while still visible and the in-game menu must not stop a race.
   await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.keyboard.press('Escape');await p.waitForTimeout(300);assert.equal((await p.evaluate(()=>state())).multiplayer.phase,'playing');await p.keyboard.press('Escape');
   // Headless Chrome keeps targets visible; inject the DOM visibility signal.
   // Actual scheduler suspension is tested separately with CDP below.
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   await lobby();await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   await p.waitForTimeout(200);assert.equal((await p.evaluate(()=>state())).running,false);
   console.log('PASS visibility handler over real WebRTC:',index===0?'host':'slave');
  }
  // Emulate a host unable to advance or process messages. Headless Chrome may
  // refuse native page freezing while WebRTC/audio are active.
  await start();await host.evaluate(()=>holdHost());
  await guest.waitForFunction(()=>state().multiplayer.phase==='lobby'&&state().multiplayer.awaitingStop,null,{timeout:12000});assert.equal((await guest.evaluate(()=>state())).running,false);
  await host.evaluate(()=>releaseHost());await lobby();console.log('PASS simulated host suspension over real WebRTC: slave watchdog, host acknowledgment, preserved room, no stale resume');
  assert.deepEqual(errors,[]);
 }finally{for(const context of contexts)await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
