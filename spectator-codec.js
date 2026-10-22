export const SPECTATOR_VERSION=1,SPECTATOR_HZ=15,SPECTATOR_MAX_PACKET=131072;
const MAGIC=0x31504353;
function validFrame(f){
 if(!Number.isSafeInteger(f.n)||f.n<1||f.n>0xffffffff||!Array.isArray(f.i)||f.i.length!==5||f.i.some(x=>!Number.isInteger(x))||Math.abs(f.i[0])>100||f.i[1]<0||f.i[1]>100||f.i[2]<0||f.i[2]>100||f.i[3]<1||f.i[3]>4||f.i[4]<0||f.i[4]>255||![f.at,f.post,f.consumed].every(Number.isFinite)||f.at<0||f.post<f.at||f.post-f.at>1000||f.consumed<0||f.consumed>1000||!(f.bytes instanceof Uint8Array)||f.bytes.length>4096)throw Error('Invalid spectator frame.');
 for(const orders of [f.pre,f.after])if(!Array.isArray(orders)||orders.length>16||orders.some(o=>!Array.isArray(o)||o.length!==6||o.some(x=>!Number.isInteger(x)||x<0||x>0xffffffff)))throw Error('Invalid spectator result.');
}
export function encodeSpectatorFrames(frames){
 if(!Array.isArray(frames)||frames.length<1||frames.length>16)throw Error('Invalid spectator batch.');
 frames.forEach(validFrame);const size=12+frames.reduce((n,f)=>n+40+f.bytes.length+(f.pre.length+f.after.length)*24,0);
 if(size>SPECTATOR_MAX_PACKET)throw Error('Spectator batch too large.');
 const b=new ArrayBuffer(size),v=new DataView(b),u=new Uint8Array(b);v.setUint32(0,MAGIC,true);v.setUint16(4,frames.length,true);let p=12;
 for(const f of frames){v.setUint32(p,f.n,true);v.setInt16(p+4,f.i[0],true);u[p+6]=f.i[1];u[p+7]=f.i[2];u[p+8]=f.i[3];v.setUint16(p+10,f.i[4],true);v.setFloat64(p+12,f.at,true);v.setFloat64(p+20,f.post,true);v.setFloat64(p+28,f.consumed,true);v.setUint16(p+36,f.bytes.length,true);u[p+38]=f.pre.length;u[p+39]=f.after.length;p+=40;u.set(f.bytes,p);p+=f.bytes.length;for(const order of [...f.pre,...f.after])for(const x of order){v.setUint32(p,x,true);p+=4;}}
 return b;
}
export function decodeSpectatorFrames(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<12||buffer.byteLength>SPECTATOR_MAX_PACKET)throw Error('Invalid spectator packet.');
 const v=new DataView(buffer),u=new Uint8Array(buffer),count=v.getUint16(4,true);if(v.getUint32(0,true)!==MAGIC||count<1||count>16)throw Error('Invalid spectator protocol.');const frames=[];let p=12;
 for(let j=0;j<count;j++){
  if(p+40>u.length)throw Error('Truncated spectator frame.');
  const f={n:v.getUint32(p,true),i:[v.getInt16(p+4,true),u[p+6],u[p+7],u[p+8],v.getUint16(p+10,true)],at:v.getFloat64(p+12,true),post:v.getFloat64(p+20,true),consumed:v.getFloat64(p+28,true),pre:[],after:[]},size=v.getUint16(p+36,true),a=u[p+38],b=u[p+39];p+=40;
  if(size>4096||a>16||b>16||p+size+(a+b)*24>u.length)throw Error('Invalid spectator lengths.');f.bytes=u.slice(p,p+size);p+=size;
  for(let k=0;k<a+b;k++){const order=[];for(let t=0;t<6;t++){order.push(v.getUint32(p,true));p+=4;}(k<a?f.pre:f.after).push(order);}
  validFrame(f);frames.push(f);
 }
 if(p!==u.length)throw Error('Unexpected spectator bytes.');return frames;
}
// Decompression has a hard OUTPUT bound as well as a bound on received bytes.
export async function transformPacket(buffer,format,decompress=false){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>SPECTATOR_MAX_PACKET||!['raw','deflate'].includes(format))throw Error('Invalid spectator encoding.');
 if(format==='raw')return buffer;
 const stream=new Blob([buffer]).stream().pipeThrough(decompress?new DecompressionStream('deflate'):new CompressionStream('deflate')),reader=stream.getReader(),parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>SPECTATOR_MAX_PACKET)throw Error('Spectator decompression limit.');parts.push(value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}
 const result=new Uint8Array(size);let p=0;for(const part of parts){result.set(part,p);p+=part.length;}return result.buffer;
}
export class SpectatorQueue {
 constructor({reserve=8,limit=120}={}){this.reserve=reserve;this.limit=limit;this.frames=[];this.expected=1;this.started=false;this.received=0;}
 accept(frames){for(const f of frames){if(f.n!==this.expected++)throw Error('Spectator stream lost continuity.');}if(this.frames.length+frames.length>this.limit)throw Error('This spectator is too far behind. Rejoin for the next session.');this.frames.push(...frames);this.received+=frames.length;}
 take(){if(!this.started){if(this.frames.length<this.reserve)return null;this.started=true;}const frame=this.frames.shift();if(!frame)this.started=false;return frame||null;}
}
