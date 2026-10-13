const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:780}});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8082');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.setInputFiles('#romInput',process.env.TEST_ROM);
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='ROM ready');
  await page.evaluate(async()=>{
   const m=window.configModule=await createDaytonaModule();
   m.FS.mkdir('/roms');m.FS.writeFile('/roms/game.zip',new Uint8Array(await document.querySelector('#romInput').files[0].arrayBuffer()));
   if(!m.ccall('daytona_load','number',['string','number'],['/roms/game.zip',0]))throw Error('ROM rejected');
   const {DEFAULT_EEPROM}=await import('./nvram.js');m.HEAPU8.set(DEFAULT_EEPROM,m._daytona_eeprom_ptr());
   window.stepConfig=(n,buttons=0)=>{for(let i=0;i<n;i++)if(!m._daytona_step(0,0,0,1,buttons))throw Error('Step failed');};
   window.pressConfig=buttons=>{stepConfig(20,buttons);stepConfig(20);};
   const {createRenderer}=await import('./renderer.js');window.configRenderer=await createRenderer(document.querySelector('#screen'),console.error);
   stepConfig(600);pressConfig(4);pressConfig(8);pressConfig(8);pressConfig(2);
   configRenderer.setEnhanced(false);configRenderer.draw(m);document.querySelector('#overlay').hidden=true;document.documentElement.classList.add('playing');
  });
  await page.screenshot({path:'build/game-system.png'});
  const plan=JSON.parse(process.env.CONFIG_PLAN||'[]');
  for(const item of plan){
   await page.evaluate(button=>{pressConfig(button);configRenderer.draw(configModule);},item.button);
   if(item.shot)await page.screenshot({path:`build/${item.shot}.png`});
  }
  const data=await page.evaluate(()=>{const m=configModule;return Array.from(m.HEAPU8.subarray(m._daytona_eeprom_ptr(),m._daytona_eeprom_ptr()+128));});
  fs.writeFileSync(`build/${process.env.CONFIG_NAME||'derived'}-eeprom.json`,JSON.stringify(data));
  console.log(data);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
