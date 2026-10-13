const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8082');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.setInputFiles('#romInput',process.env.TEST_ROM);await page.waitForFunction(()=>document.querySelector('#status').textContent==='ROM ready');
  await page.evaluate(async()=>{
   const {createRoomUI}=await import('./room-ui.js');
   const stub={id:'host',members:[],leave(){},end(){},approve(id){previewState.pending=previewState.pending.filter(x=>x.id!==id);previewState.members.push({id,name:'Accepted driver',cabinet:previewState.members.length+1,ready:false,rtt:18});renderPreview();},reject(id){previewState.pending=previewState.pending.filter(x=>x.id!==id);renderPreview();},setSettings(value){previewState.settings=value;previewState.members.forEach(x=>x.ready=false);renderPreview();},ready(value){previewState.members[0].ready=value;renderPreview();}};
   window.previewUI=createRoomUI(stub,{single(){},unlockAudio(){}});
   window.renderPreview=()=>{stub.members=previewState.members;previewUI.render(previewState);};
   window.setPreview=(members,pending=0)=>{
    window.previewState={phase:'lobby',isHost:true,id:'host',host:'dt-1234567890',code:'dt-1234567890.'+'a'.repeat(32),settings:{mode:1,difficulty:0,region:'Export'},members:Array.from({length:members},(_,i)=>({id:i?'guest-'+i:'host',name:i===1?'A very long driver nickname':'Driver '+(i+1),cabinet:i+1,ready:i%2===0,rtt:i?20+i*5:null})),pending:Array.from({length:pending},(_,i)=>({id:'pending-'+i,name:'Incoming driver '+(i+1)})),signaling:true,error:''};renderPreview();
   };
  });
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,640]]){
   await page.setViewportSize({width,height});
   for(const [members,pending] of [[8,0],[1,7],[3,5],[2,0]]){
    await page.evaluate(([m,p])=>setPreview(m,p),[members,pending]);
    const measure=await page.evaluate(()=>{const overlay=document.querySelector('#overlay'),modal=document.querySelector('#mainMenu>.rom-modal'),footer=document.querySelector('.room-footer');return {scroll:overlay.scrollHeight-overlay.clientHeight,bottom:modal.getBoundingClientRect().bottom,footer:footer.getBoundingClientRect().bottom,width:document.querySelector('#menuDialog').scrollWidth-document.querySelector('#menuDialog').clientWidth};});
    console.log(`${width}x${height} · ${members} drivers / ${pending} requests`,measure);
    assert.ok(measure.scroll<=1,'Desktop room scrolls vertically');assert.ok(measure.bottom<=height-5);assert.ok(measure.footer<=height-5);assert.ok(measure.width<=1,'Room overflows horizontally');
    if(width===1366&&members===8)await page.screenshot({path:'build/room-eight-desktop.png'});
    if(width===1280&&pending===7)await page.screenshot({path:'build/room-requests-desktop.png'});
   }
  }
  await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>setPreview(2));
  await page.click('#settingsBtn');assert.ok(await page.locator('#settingsModal').isVisible());await page.click('#settingsBack');assert.ok(await page.locator('#settingsBtn').isVisible());
  await page.click('#readyRoom');assert.equal(await page.locator('#readyRoom').getAttribute('aria-pressed'),'false');
  await page.click('#leaveRoom');assert.ok(await page.locator('#multiplayerEntry').isVisible());
  const entryFit=await page.evaluate(()=>document.querySelector('#overlay').scrollHeight<=document.querySelector('#overlay').clientHeight+1);assert.ok(entryFit);
  await page.screenshot({path:'build/room-entry-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setPreview(8));await page.screenshot({path:'build/room-eight-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.querySelector('#menuDialog').scrollWidth<=document.querySelector('#menuDialog').clientWidth+1));
  assert.deepEqual(errors,[]);console.log('PASS: desktop room without scroll, eight drivers, pending requests, entry, settings access and mobile width. Roster fixtures; actual production UI and engine boot.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
