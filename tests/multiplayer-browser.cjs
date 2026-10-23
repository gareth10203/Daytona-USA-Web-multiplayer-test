const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required']});
 const contexts=[];const errors=[];
 try{
  async function pageFor(name){
   const context=await browser.newContext({viewport:{width:1100,height:850}});contexts.push(context);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));
   await page.route('**/daytona_engine.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst realFactory=createDaytonaModule;createDaytonaModule=async o=>{const m=await realFactory(o);window.testEngine=m;return m;};'});});
   await page.goto(base);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
   await page.evaluate(async()=>{window.arcadeState=(await import('./main.js')).getArcadeState;});
   assert.equal(await page.locator('#playerModes').isVisible(),false);
   await page.setInputFiles('#romInput',process.env.TEST_ROM);await page.waitForFunction(()=>document.querySelector('#status').textContent==='ROM ready');
   assert.ok(await page.locator('#singlePlayer').isVisible());assert.ok(await page.locator('#multiplayerPlayer').isVisible());
   await page.screenshot({path:`build/${name}-modes.png`});return page;
  }
  const host=await pageFor('host'),guest=await pageFor('guest');
  await host.click('#singlePlayer');await host.waitForFunction(()=>localStorage.getItem('daytona-web-rev-a-nvram-v1'),null,{timeout:30000});await host.keyboard.press('Escape');
  const saved=await host.evaluate(()=>localStorage.getItem('daytona-web-rev-a-nvram-v1'));assert.ok(saved);
  await host.click('#multiplayerPlayer');await host.fill('#driverName','Host');await host.click('#createRoom');
  await host.waitForFunction(()=>document.querySelector('#inviteLink').value||document.querySelector('#roomMessage').textContent.includes('failed'),null,{timeout:20000});
  const invite=await host.locator('#inviteLink').inputValue();if(!invite)throw Error('PeerJS Cloud unavailable: '+await host.locator('#roomMessage').innerText());
  await guest.click('#multiplayerPlayer');await guest.fill('#driverName','Guest');await guest.fill('#joinCode',invite);await guest.click('#joinRoom');
  await host.waitForFunction(()=>document.querySelector('#pendingList button'),null,{timeout:25000});await host.locator('#pendingList button').first().click();
  await guest.waitForFunction(()=>document.querySelector('#roomCount').textContent==='2 / 8 players');
  assert.equal(await guest.locator('#roomMode').isDisabled(),true);
  await host.selectOption('#roomMode','1');await host.selectOption('#roomDifficulty','2');
  await guest.waitForFunction(()=>document.querySelector('#roomMode').value==='1'&&document.querySelector('#roomDifficulty').value==='2');
  await host.click('#readyRoom');await guest.click('#readyRoom');await host.waitForFunction(()=>!document.querySelector('#startRoom').disabled);
  await host.screenshot({path:'build/room-desktop.png',fullPage:true});
  await host.click('#startRoom');
  const state=page=>page.evaluate(async()=> (await import('./main.js')).getArcadeState());
  await host.waitForFunction(()=>{const s=arcadeState();return s.linkState===2||s.multiplayer.error;},null,{timeout:60000});
  await guest.waitForFunction(()=>{const s=arcadeState();return s.linkState===2||s.multiplayer.error;},null,{timeout:60000});
  const initial=await Promise.all([state(host),state(guest)]);console.log('Linked states:',initial.map(s=>({phase:s.multiplayer.phase,error:s.multiplayer.error,id:s.linkId,count:s.linkCount,state:s.linkState,frames:s.frames})));
  assert.ok(initial.every(s=>s.linkState===2&&s.linkCount===2));assert.deepEqual(initial.map(s=>s.linkId).sort(),[1,2]);
  for(const p of [host,guest]){await p.keyboard.press('Escape');await p.click('#settingsBtn');await p.click('#experimentalTab');await p.check('#diagnosticsEnabled');await p.keyboard.press('Escape');await p.keyboard.press('Escape');}
  assert.equal(await host.evaluate(()=>localStorage.getItem('daytona-web-rev-a-nvram-v1')),saved);
  const eeprom=await Promise.all([host,guest].map(p=>p.evaluate(()=>{const m=testEngine;return Array.from(m.HEAPU8.slice(m._daytona_eeprom_ptr(),m._daytona_eeprom_ptr()+128));})));
  fs.writeFileSync('build/room-eeprom.json',JSON.stringify(eeprom));
  assert.deepEqual(eeprom.map(e=>e[11]),[1,2]);assert.deepEqual(eeprom.map(e=>e[12]),[0,1]);
  assert.ok(eeprom.every(e=>e[28]===1&&e[32]===3)); // Menu-derived Grand Prix / Hardest values.
  for(let i=0;i<128;i++)if(![8,9,11,12].includes(i))assert.equal(eeprom[0][i],eeprom[1][i]);
  await host.keyboard.press('Escape');const before=(await state(host)).frames;await host.waitForTimeout(700);assert.ok((await state(host)).frames>before);assert.ok((await state(host)).running);
  await host.click('#settingsBtn');await host.click('#soundTab');const settingsBefore=(await state(host)).frames;await host.waitForTimeout(400);assert.ok((await state(host)).frames>settingsBefore);await host.keyboard.press('Escape');await host.keyboard.press('Escape');
  await Promise.all([host,guest].map(async p=>{await p.keyboard.down('Digit5');await p.waitForTimeout(250);await p.keyboard.up('Digit5');await p.keyboard.down('Enter');await p.waitForTimeout(250);await p.keyboard.up('Enter');}));
  await host.waitForTimeout(1500);await host.screenshot({path:'build/linked-selection.png'});
  await Promise.all([host,guest].map(async p=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(250);await p.keyboard.up('ArrowUp');}));
  await host.waitForTimeout(1000);
  await Promise.all([host,guest].map(async p=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(250);await p.keyboard.up('ArrowUp');}));
  await host.waitForTimeout(35000);
  await Promise.all([host,guest].map(async p=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(2000);await p.keyboard.up('ArrowUp');}));
  const race=await Promise.all([state(host),state(guest)]);assert.ok(race.every(s=>s.linkState===2));await host.screenshot({path:'build/linked-race-host.png'});await guest.screenshot({path:'build/linked-race-guest.png'});
  await host.screenshot({path:'build/diagnostics-race.png'});assert.ok(await host.locator('#diagnosticsHud').isVisible());
  await host.keyboard.press('Escape');await host.click('#settingsBtn');await host.click('#experimentalTab');
  const reportEvent=host.waitForEvent('download');await host.click('#downloadDiagnostics');const download=await reportEvent;
  const report=JSON.parse(fs.readFileSync(await download.path(),'utf8'));fs.writeFileSync('build/live-diagnostics.json',JSON.stringify(report,null,2));
  assert.ok(report.samples.some(s=>s.linked&&s.simulationHz>30&&s.callbackSlots>0&&s.callbackSlots<=256));
  assert.ok(report.samples.some(s=>s.network.rttMs!=null));assert.ok(report.samples.every(s=>s.cpuMeanMs>=0));assert.ok(!JSON.stringify(report).includes(invite));
  await host.keyboard.press('Escape');await host.keyboard.press('Escape');
  await guest.keyboard.press('Escape');await guest.click('#leaveRoom');await host.waitForFunction(()=>arcadeState().multiplayer.phase==='lobby');
  assert.equal((await state(host)).running,false);assert.equal((await state(host)).multiplayer.members.length,1);
  await host.click('#leaveRoom');await host.click('#modeBack');await host.click('#singlePlayer');
  await host.waitForFunction(()=>{const m=testEngine,p=m._daytona_eeprom_ptr();return document.querySelector('#overlay').hidden&&m.HEAPU8[p+11]===0&&m.HEAPU8[p+26]===0;},null,{timeout:30000});
  assert.equal((await state(host)).linkState,0);assert.equal((await state(host)).multiplayer.phase,'idle');
  await host.keyboard.press('Escape');const paused=(await state(host)).frames;await host.waitForTimeout(300);assert.equal((await state(host)).frames,paused);
  await guest.setViewportSize({width:390,height:844});await guest.click('#modeBack');await guest.screenshot({path:'build/multiplayer-mobile.png',fullPage:true});assert.equal(await guest.evaluate(()=>document.querySelector('.launcher-content').scrollWidth>document.querySelector('.launcher-content').clientWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS: real ROM, PeerJS Cloud/WebRTC, MASTER+SLAVE link, shared settings, menus without pause, disconnect and single-player recovery.');
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
