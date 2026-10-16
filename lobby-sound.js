// Original FM plucks: a bright attack, warm body and a short musical tail.
// All voices use the game's existing volume and audio context.
export function createLobbySound({context,output,muted=()=>false,clock=()=>performance.now()}) {
  let last=-Infinity,lastKind='';
  const patterns={
    request:{notes:[[523.25,0,.14],[783.99,.08,.14],[1046.50,.20,.28]],level:.070,colour:1.25},
    chat:{notes:[[987.77,0,.10],[1318.51,.065,.19]],level:.048,colour:.85},
    ready:{notes:[[659.25,0,.12],[659.25,.14,.12],[987.77,.30,.25]],level:.072,colour:.65},
    confirmed:{notes:[[783.99,0,.10],[1046.50,.085,.16],[1567.98,.16,.22]],level:.057,colour:1.1}
  };
  return (kind='request')=>{
    const ctx=context(),target=output(),now=clock();
    if(muted()||!ctx||ctx.state!=='running'||!target)return false;
    const pattern=patterns[kind];if(!pattern)return false;
    // The first Ready prompt must not be swallowed by a simultaneous chat/admission.
    if(now-last<500&&kind!=='confirmed'&&(kind!=='ready'||lastKind==='ready'))return false;
    last=now;lastKind=kind;
    try{for(const [frequency,offset,duration] of pattern.notes){
      const tone=ctx.createOscillator(),mod=ctx.createOscillator(),body=ctx.createOscillator();
      const gain=ctx.createGain(),depth=ctx.createGain(),bodyGain=ctx.createGain(),at=ctx.currentTime+offset;
      tone.type=mod.type='sine';body.type='triangle';
      tone.frequency.setValueAtTime(frequency*1.015,at);
      tone.frequency.exponentialRampToValueAtTime(frequency,at+.018);
      mod.frequency.setValueAtTime(frequency*2,at);body.frequency.setValueAtTime(frequency/2,at);
      depth.gain.setValueAtTime(frequency*pattern.colour,at);
      depth.gain.exponentialRampToValueAtTime(frequency*.015,at+.055);
      bodyGain.gain.setValueAtTime(.23,at);
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(pattern.level,at+.006);
      gain.gain.exponentialRampToValueAtTime(pattern.level*.28,at+duration*.35);
      gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
      mod.connect(depth);depth.connect(tone.frequency);tone.connect(gain);
      body.connect(bodyGain);bodyGain.connect(gain);gain.connect(target);
      tone.onended=()=>{for(const node of [tone,mod,body,gain,depth,bodyGain])node.disconnect();};
      for(const voice of [tone,mod,body]){voice.start(at);voice.stop(at+duration+.01);}
    }
    return true;}catch{return false;}
  };
}
