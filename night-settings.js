// Shared GPU parameters for the race environment. No simulation state is changed.
export const nightDefaults=Object.freeze({distance:15,width:75,softness:350,brightness:130,temperature:-50,saturation:100,sky:10,skyTemperature:-100,beam:1,ambient:20,edge:75,pitch:-12,vertical:60});
export const nightRanges=Object.freeze({distance:[1,300,1],width:[.5,200,.5],softness:[10,1000,5],brightness:[20,150,5],temperature:[-100,100,5],saturation:[0,150,5],sky:[0,40,.5],skyTemperature:[-100,100,5],beam:[0,1,1],ambient:[0,50,1],edge:[10,100,5],pitch:[-20,10,.5],vertical:[4,60,1]});
export function normalizeNight(values={}){
 return Object.fromEntries(Object.entries(nightDefaults).map(([key,fallback])=>{
  const value=Number(values?.[key]??fallback),[min,max]=nightRanges[key];
  return [key,Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback];
 }));
}
// Preserve the original 10–100% range; higher values extend the fade tail.
export const nightFadeStart=softness=>1-Math.min(100,Math.max(10,softness))*.0095;
function tint(temperature,neutral,cool,warm){
 const amount=Math.abs(temperature)/100,target=temperature<0?cool:warm;
 return neutral.map((v,i)=>v+(target[i]-v)*amount);
}
// Nine aligned vec4 values, identical for WebGPU and WebGL2.
export function packNight(on,near=16,far=128,sky=.12,options={}){
 const s=normalizeNight(options),world=tint(s.temperature,[.78,.78,.80],[.60,.68,.90],[.95,.72,.53]);
 const skyTint=tint(s.skyTemperature,[.85,.85,.85],[.55,.65,1],[1,.72,.48]);
 const end=Number.isFinite(far)?Math.max(1,far):128;
 const start=Number.isFinite(near)?Math.max(0,Math.min(end-.001,near)):16;
 return new Float32Array([typeof on==='number'?Math.min(1,Math.max(0,Number.isFinite(on)?on:0)):Number(!!on),start,end,Number.isFinite(sky)?Math.max(0,Math.min(1,sky)):.12,
  128*s.width/100,nightFadeStart(s.softness),s.saturation/100,Math.max(0,s.softness/100-1),
  ...world.map(v=>v*s.brightness/100),0,...skyTint,0,
  0,0,0,0, 0,0,1,Math.sin(s.pitch*Math.PI/180), 1,0,0,Math.cos(s.pitch*Math.PI/180), 0,1,0,Math.tan(s.vertical*Math.PI/360),
  s.beam>=.5?1:0,s.ambient/100,1-s.edge*.0095,Math.max(.01,s.width/50)]);
}

// Pose is already in the exact geometry view space. No arbitrary RAM reads.
export function updateNightPose(wasm,values){
 if(values[0]<=0||values[32]<.5)return false;
 const ptr=wasm._daytona_night_pose_ptr?.();
 const pose=ptr?new Float32Array(wasm.HEAPU8.buffer,ptr,20):null;
 const valid=!!pose&&pose[0]>0&&[4,5,6,8,9,10,12,13,14,16,17,18].every(i=>Number.isFinite(pose[i]));
 let changed=false;
 const copy=(to,from)=>{for(let i=0;i<3;i++){const value=valid?pose[from+i]:0;if(values[to+i]!==value){values[to+i]=value;changed=true;}}};
 copy(16,4);copy(20,8);copy(24,12);copy(28,16);
 if(values[19]!==Number(valid)){values[19]=Number(valid);changed=true;}
 return changed;
}
