#version 300 es
// BSD-3-Clause. System-24 rules shared with system24.wgsl.
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uData;
layout(location=0) out vec4 outBack;
layout(location=1) out vec4 outFront;
uint data(uint i){return texelFetch(uData,ivec2(int(i&1023u),int(i>>10u)),0).r;}
uint tile_word(uint i){return (data(i>>1u)>>((i&1u)*16u))&65535u;}
uint tile_pixel(uint layer,int x,int y){
 uint ux=uint(x)&511u,uy=uint(y)&511u;
 uint val=tile_word(layer*4096u+(uy>>3u)*64u+(ux>>3u));
 uint addr=((val&16383u)*32u+(uy&7u)*4u+((ux&7u)>>1u))^1u;
 uint packed=data(0x4000u+(addr>>2u));
 uint byte_value=(packed>>((addr&3u)*8u))&255u;
 uint pixel=(ux&1u)!=0u?byte_value&15u:byte_value>>4u;
 return ((val>>15u)<<15u)|(((val>>7u)&255u)*16u+pixel);
}
uint tile_layer(uint layer,bool opaque,int x,int y){
 uint l=layer>>1u,category=layer&1u;
 uint hscr=tile_word(0x5000u+l),vscr=tile_word(0x5004u+l),ctrl=tile_word(0x5004u+(l&2u));
 if((vscr&0x8000u)!=0u)return 0u;
 if((ctrl&0x6000u)!=0u){
  if((l&1u)!=0u)return 0u;
  uint mode=(ctrl&0x6000u)>>13u;int sy=int(vscr&511u),v=int((0u-vscr)&511u);
  uint lv=((0u-vscr)&512u)!=0u?l:l^1u;uint src;int sx;
  if((hscr&0x8000u)!=0u){
   uint hl=tile_word(0x4000u+512u*l+uint(y));int h=int(hl&511u);sx=-h;
   if(mode==1u)src=y>=v?lv^1u:lv;
   else{uint l1=(hl&512u)!=0u?l:l^1u;src=x<h?l1:l1^1u;}
  }else{
   int h=int(hscr&511u);sx=-h;
   if(mode==1u)src=y<v?lv:lv^1u;
   else{uint lh=(hscr&512u)!=0u?l:l^1u;src=x<h?lh:lh^1u;}
  }
  uint pixel=tile_pixel(src,x+sx,y+sy);
  if((pixel>>15u)!=category||(!opaque&&(pixel&15u)==0u))return 0u;
  return (pixel&4095u)+1u;
 }
 uint base=(layer&4u)!=0u?0x6800u:0x6000u;
 uint mask=tile_word(base+uint(y)*4u+uint(x>>7));if((l&1u)!=0u)mask=~mask;
 if((mask&(0x8000u>>uint((x>>3)&15)))!=0u)return 0u;
 int hs=int((0u-hscr)&511u);
 if((hscr&0x8000u)!=0u)hs=int((0u-tile_word(0x4000u+512u*l+uint(y)))&511u);
 uint pixel=tile_pixel(l,x+hs,int(vscr&511u)+y);
 if(!opaque&&((pixel>>15u)!=category||(pixel&15u)==0u))return 0u;
 return (pixel&4095u)+1u;
}
vec4 color(uint pen){uint argb=data(0x24000u+pen);return vec4(float((argb>>16u)&255u),float((argb>>8u)&255u),float(argb&255u),255.0)/255.0;}
void main(){
 // Offscreen layers use native top-down row indices; presentation fetches them
 // with integer coordinates, independently of the canvas GL orientation.
 int x=int(gl_FragCoord.x),y=int(gl_FragCoord.y);uint back_pen=0u;
 for(uint n=0u;n<4u;n++){uint candidate=tile_layer((3u-n)*2u,n<2u,x,y);if(candidate!=0u)back_pen=candidate-1u;}
 vec4 front_color=vec4(0);
 for(uint n=0u;n<4u;n++){uint candidate=tile_layer((3u-n)*2u+1u,false,x,y);if(candidate!=0u)front_color=color(candidate-1u);}
 outBack=color(back_pen);outFront=front_color;
}
