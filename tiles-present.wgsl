// GPU scaling and per-item HUD composition preserve the native layer order.
struct Screen{size:vec2f,pad:vec2f,origin:vec2f,unused:vec2f}
@group(0) @binding(0) var back:texture_2d<f32>;
@group(0) @binding(1) var front:texture_2d<f32>;
@group(0) @binding(2) var<storage,read> data:array<u32>;
@group(0) @binding(3) var<uniform> screen:Screen;
@group(0) @binding(4) var<uniform> control:vec4u; // margin, fill, relocated HUD, ABI
@vertex fn vs(@builtin(vertex_index) id:u32)->@builtin(position) vec4f {
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[id],0,1);
}
fn native_at(p:vec2f)->vec2i {
 let size=vec2i(496+2*i32(control.x),384);
 let at=vec2i((p-screen.origin)/screen.pad.y+vec2f(screen.pad.x,0));
 return clamp(at,vec2i(0),size-vec2i(1));
}
@fragment fn fs_back(@builtin(position) p:vec4f)->@location(0) vec4f {
 let at=native_at(p.xy);let margin=i32(control.x);let width=496+2*margin;let x=at.x-margin;
 if(margin>0&&control.y==2u){
  let u=clamp((f32(at.x)+0.5)*496.0/f32(width)-0.5,0.0,495.0);
  let a=i32(u);let b=min(a+1,495);let f=u-f32(a);
  let ca=round(textureLoad(back,vec2i(a,at.y),0).rgb*255.0);
  let cb=round(textureLoad(back,vec2i(b,at.y),0).rgb*255.0);
  let c=ca*(1.0-f)+cb*f;
  return vec4f(vec3f(vec3u(c+vec3f(0.5)))/255.0,1);
 }
 var source=vec2i(x,at.y);
 if(x<0||x>=496){
  if(control.y==1u){source=vec2i(0);}
  else{source.x=select(495,0,x<0);}
 }
 return textureLoad(back,source,0);
}
fn direction(x:i32,y:i32)->u32 {
 let index=u32(y)*496u+u32(x);
 return (data[0x25000u+(index>>2u)]>>((index&3u)*8u))&255u;
}
@fragment fn fs_front(@builtin(position) p:vec4f)->@location(0) vec4f {
 let at=native_at(p.xy);let margin=i32(control.x);
 if(control.z==0u){
  let x=at.x-margin;if(x<0||x>=496){discard;}
  let c=textureLoad(front,vec2i(x,at.y),0);if(c.a==0.0){discard;}return c;
 }
 // Native copies in ascending source x. Test descending x to preserve wins
 // when shifted HUD groups and an unshifted banner share a destination.
 let candidates=array<i32,3>(at.x,at.x-margin,at.x-2*margin);
 let directions=array<u32,3>(1u,0u,2u);
 for(var n=0u;n<3u;n++){
  let x=candidates[n];if(x<0||x>=496){continue;}
  if(direction(x,at.y)!=directions[n]){continue;}
  let c=textureLoad(front,vec2i(x,at.y),0);if(c.a!=0.0){return c;}
 }
 discard;
 return vec4f(0);
}
