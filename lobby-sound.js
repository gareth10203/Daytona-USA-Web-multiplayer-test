// Short arcade chime. Uses the game's existing volume and audio context.
export function createLobbySound({context,output,muted=()=>false,clock=()=>performance.now()}) {
  let last=-Infinity;
  return ()=>{
    const ctx=context(),target=output(),now=clock();
    if(muted()||!ctx||ctx.state!=='running'||!target||now-last<500)return false;
    last=now;
    try{for(const [frequency,offset] of [[659.25,0],[880,0.095]]){
      const tone=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+offset;
      tone.type='triangle';tone.frequency.setValueAtTime(frequency,at);
      gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(0.075,at+0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001,at+0.16);
      tone.connect(gain);gain.connect(target);tone.onended=()=>{tone.disconnect();gain.disconnect();};
      tone.start(at);tone.stop(at+0.17);
    }
    return true;}catch{return false;}
  };
}
