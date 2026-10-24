#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform highp sampler2D uLayer;
uniform usampler2D uData;
uniform uvec4 uControl;
uniform vec4 uView; // native width, height, left offset, scale
uniform float uTop;
uniform float uOutputHeight;
uniform int uFront;
uniform vec4 uNight;
uniform vec4 uNightSky;
vec4 night_sky(vec4 c){if(uNight.x<=0.0)return c;return mix(c,vec4(c.rgb*uNightSky.rgb*uNight.w,c.a),uNight.x);}
layout(location=0) out vec4 outColor;
uint direction(int x,int y){uint i=uint(y)*496u+uint(x);return (texelFetch(uData,ivec2(int((0x25000u+(i>>2u))&1023u),int((0x25000u+(i>>2u))>>10u)),0).r>>((i&3u)*8u))&255u;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uOutputHeight-gl_FragCoord.y);
 // Match the integer raster bounds of the native viewport, including the
 // last row of a letterboxed portrait image.
 if(p.y<floor(uTop)||p.y>=floor(uTop+uView.y*uView.w))discard;
 int margin=int(uControl.x),width=496+2*margin;
 ivec2 at=clamp(ivec2((p-vec2(0,uTop))/uView.w+vec2(uView.z,0)),ivec2(0),ivec2(width-1,383));
 if(uFront==0){
  int x=at.x-margin;
  if(margin>0&&uControl.y==2u){
   float u=clamp((float(at.x)+0.5)*496.0/float(width)-0.5,0.0,495.0);int a=int(u),b=min(a+1,495);float f=u-float(a);
   vec3 ca=round(texelFetch(uLayer,ivec2(a,at.y),0).rgb*255.0),cb=round(texelFetch(uLayer,ivec2(b,at.y),0).rgb*255.0);
   vec3 c=ca*(1.0-f)+cb*f;outColor=night_sky(vec4(vec3(uvec3(c+vec3(0.5)))/255.0,1));return;
  }
  ivec2 source=ivec2(x,at.y);
  if(x<0||x>=496){if(uControl.y==1u)source=ivec2(0);else source.x=x<0?0:495;}
  outColor=night_sky(texelFetch(uLayer,source,0));return;
 }
 if(uControl.z==0u){int x=at.x-margin;if(x<0||x>=496)discard;vec4 c=texelFetch(uLayer,ivec2(x,at.y),0);if(c.a==0.0)discard;outColor=c;return;}
 int candidates[3]=int[3](at.x,at.x-margin,at.x-2*margin);uint directions[3]=uint[3](1u,0u,2u);
 for(int n=0;n<3;n++){int x=candidates[n];if(x<0||x>=496)continue;if(direction(x,at.y)!=directions[n])continue;vec4 c=texelFetch(uLayer,ivec2(x,at.y),0);if(c.a!=0.0){outColor=c;return;}}
 discard;
}
