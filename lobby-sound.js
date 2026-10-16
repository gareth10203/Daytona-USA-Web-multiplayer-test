// Short arcade chime. Uses the game's existing volume and audio context.
export function createLobbySound({context,output,muted=()=>false,clock=()=>performance.now()}) {
  let last=-Infinity;
  const patterns={request:{notes:[[659.25,0],[880,.095]],level:.075},chat:{notes:[[523.25,0],[659.25,.07]],level:.045},ready:{notes:[[440,0],[554.37,.10]],level:.035}};
  return (kind='request')=>{
    const ctx=context(),target=output(),now=clock();
    if(muted()||!ctx||ctx.state!=='running'||!target||now-last<500)return false;
    const pattern=patterns[kind];if(!pattern)return false;
    last=now;
    try{for(const [frequency,offset] of pattern.notes){
      const tone=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+offset;
      tone.type='triangle';tone.frequency.setValueAtTime(frequency,at);
      gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(pattern.level,at+0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001,at+0.16);
      tone.connect(gain);gain.connect(target);tone.onended=()=>{tone.disconnect();gain.disconnect();};
      tone.start(at);tone.stop(at+0.17);
    }
    return true;}catch{return false;}
  };
}
