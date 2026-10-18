#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aPosition;
layout(location=1) in float aDepth;
layout(location=2) in vec3 aOz;
layout(location=3) in vec4 aColor;
layout(location=4) in uvec4 aInfo;
layout(location=5) in uvec2 aMore;
uniform vec2 uOutput;
uniform vec4 uView; // native width, height, left offset, scale
uniform float uTop;
out vec3 vOz;
flat out vec4 vColor;
flat out uvec4 vInfo;
flat out uvec2 vMore;
void main(){
 float y=1.0-aPosition.y/uView.y*2.0;
 float viewportHeight=uView.y*uView.w;
 gl_Position=vec4((aPosition.x-uView.z)/uView.x*2.0-1.0,
  y*(viewportHeight/uOutput.y)+(1.0-(2.0*uTop+viewportHeight)/uOutput.y),aDepth*2.0-1.0,1.0);
 vOz=aOz;vColor=aColor;vInfo=aInfo;vMore=aMore;
}
