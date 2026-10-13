const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling']});
 try{
  const pages=await Promise.all([0,1].map(async()=>{const page=await browser.newPage();await page.route('**/network-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><script src="vendor/peerjs.min.js"></script>'}));await page.goto('http://127.0.0.1:8082/network-test');await page.evaluate(async()=>{const {Multiplayer}=await import('./multiplayer.js');window.received=[];window.room=new Multiplayer({onBytes:b=>received.push([...b])});});return page;}));
  const [host,guest]=pages;
  await host.evaluate(()=>room.create('Host'));const code=await host.evaluate(()=>room.snapshot().code);if(!code)throw Error(await host.evaluate(()=>room.error));
  await guest.evaluate(code=>room.join(code,'Guest'),code);await host.waitForFunction(()=>room.pending.size===1,null,{timeout:25000});
  await host.evaluate(()=>room.approve([...room.pending.keys()][0]));await guest.waitForFunction(()=>room.members.length===2);
  await Promise.all(pages.map(p=>p.evaluate(()=>room.ready(true))));await host.waitForFunction(()=>room.members.every(x=>x.ready));await host.evaluate(()=>room.start());await guest.waitForFunction(()=>room.active);
  await host.evaluate(()=>room.write(new Uint8Array([10,20,30])));await guest.waitForFunction(()=>received.length===1);await guest.evaluate(()=>room.write(new Uint8Array([40,50])));await host.waitForFunction(()=>received.length===1);
  console.log('Real PeerJS Cloud/WebRTC packets:',await host.evaluate(()=>received),await guest.evaluate(()=>received));
  console.log('PASS: cloud signaling, private approval, binary reliable data channel, logical ring.');
  await Promise.all(pages.map(p=>p.evaluate(()=>room.leave())));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
