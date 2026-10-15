// BSD-3-Clause. System-24 pixel rules from runtime/video.cpp and m2.hlsl.
// Raw tile/character RAM is decoded and composed on GPU at arcade dimensions.
@group(0) @binding(0) var<storage,read> data:array<u32>;
@group(0) @binding(1) var back:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var front:texture_storage_2d<rgba8unorm,write>;
fn tile_word(i:u32)->u32 {return (data[i>>1u]>>((i&1u)*16u))&65535u;}
fn tile_pixel(layer:u32,x:i32,y:i32)->u32 {
 let ux=u32(x)&511u;let uy=u32(y)&511u;
 let val=tile_word(layer*4096u+(uy>>3u)*64u+(ux>>3u));
 let byte=((val&16383u)*32u+(uy&7u)*4u+((ux&7u)>>1u))^1u;
 let packed=data[0x4000u+(byte>>2u)];
 let byte_value=(packed>>((byte&3u)*8u))&255u;
 let pixel=select(byte_value>>4u,byte_value&15u,(ux&1u)!=0u);
 return ((val>>15u)<<15u)|(((val>>7u)&255u)*16u+pixel);
}
// Return pen+1; zero means the layer writes no pixel.
fn tile_layer(layer:u32,opaque:bool,x:i32,y:i32)->u32 {
 let l=layer>>1u;let category=layer&1u;
 let hscr=tile_word(0x5000u+l);let vscr=tile_word(0x5004u+l);
 let ctrl=tile_word(0x5004u+(l&2u));
 if((vscr&0x8000u)!=0u){return 0u;}
 if((ctrl&0x6000u)!=0u){
  if((l&1u)!=0u){return 0u;}
  let mode=(ctrl&0x6000u)>>13u;let sy=i32(vscr&511u);
  let v=i32((0u-vscr)&511u);let lv=select(l^1u,l,((0u-vscr)&512u)!=0u);
  var src:u32;var sx:i32;
  if((hscr&0x8000u)!=0u){
   let hl=tile_word(0x4000u+512u*l+u32(y));let h=i32(hl&511u);sx=-h;
   if(mode==1u){src=select(lv,lv^1u,y>=v);}
   else{let l1=select(l^1u,l,(hl&512u)!=0u);src=select(l1^1u,l1,x<h);}
  }else{
   let h=i32(hscr&511u);sx=-h;
   if(mode==1u){src=select(lv^1u,lv,y<v);}
   else{let lh=select(l^1u,l,(hscr&512u)!=0u);src=select(lh^1u,lh,x<h);}
  }
  let pixel=tile_pixel(src,x+sx,y+sy);
  if((pixel>>15u)!=category||(!opaque&&(pixel&15u)==0u)){return 0u;}
  return (pixel&4095u)+1u;
 }
 let base=select(0x6000u,0x6800u,(layer&4u)!=0u);
 var mask=tile_word(base+u32(y)*4u+u32(x>>7));
 if((l&1u)!=0u){mask=~mask;}
 if((mask&(0x8000u>>u32((x>>3)&15)))!=0u){return 0u;}
 var hs=i32((0u-hscr)&511u);
 if((hscr&0x8000u)!=0u){hs=i32((0u-tile_word(0x4000u+512u*l+u32(y)))&511u);}
 let pixel=tile_pixel(l,x+hs,i32(vscr&511u)+y);
 if(!opaque&&((pixel>>15u)!=category||(pixel&15u)==0u)){return 0u;}
 return (pixel&4095u)+1u;
}
fn color(pen:u32)->vec4f {
 let argb=data[0x24000u+pen];
 return vec4f(f32((argb>>16u)&255u),f32((argb>>8u)&255u),f32(argb&255u),255.0)/255.0;
}
@compute @workgroup_size(8,8) fn compose(@builtin(global_invocation_id) p:vec3u){
 if(p.x>=496u||p.y>=384u){return;}
 let x=i32(p.x);let y=i32(p.y);var back_pen=0u;
 // The last native draw wins: layers 3,2 opaque, then 1,0 category zero.
 for(var n=0u;n<4u;n++){
  let layer=(3u-n)*2u;let candidate=tile_layer(layer,n<2u,x,y);
  if(candidate!=0u){back_pen=candidate-1u;}
 }
 var front_color=vec4f(0);
 for(var n=0u;n<4u;n++){
  let candidate=tile_layer((3u-n)*2u+1u,false,x,y);
  if(candidate!=0u){front_color=color(candidate-1u);}
 }
 textureStore(back,vec2i(p.xy),color(back_pen));
 textureStore(front,vec2i(p.xy),front_color);
}
