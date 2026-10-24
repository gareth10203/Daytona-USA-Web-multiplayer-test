// Visual clock only. Durations are seconds; it never changes the arcade timer.
export const cycleDefaults=Object.freeze({enabled:true,duration:60,transition:30});
export function normalizeCycle(value={}){
 const seconds=(v,fallback)=>Number.isFinite(Number(v))?Math.max(1,Math.min(3599,Math.round(Number(v)))):fallback;
 return {enabled:typeof value?.enabled==='boolean'?value.enabled:cycleDefaults.enabled,duration:seconds(value?.duration??cycleDefaults.duration,cycleDefaults.duration),transition:seconds(value?.transition??cycleDefaults.transition,cycleDefaults.transition)};
}
export function formatDuration(seconds){const s=Math.max(0,Math.ceil(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
export function parseDuration(text){
 const match=/^(\d{1,2}):([0-5]\d)$/.exec(String(text).trim());
 if(!match)return null;
 const seconds=Number(match[1])*60+Number(match[2]);return seconds>=1&&seconds<=3599?seconds:null;
}
export function cycleAt(elapsed,options=cycleDefaults){
 const {duration:d,transition:t}=normalizeCycle(options),total=2*(d+t),time=((elapsed%total)+total)%total;
 let phase,mix,remaining;
 if(time<d){phase='Day';mix=0;remaining=d-time;}
 else if(time<d+t){phase='Sunset';const p=(time-d)/t;mix=p*p*(3-2*p);remaining=d+t-time;}
 else if(time<2*d+t){phase='Night';mix=1;remaining=2*d+t-time;}
 else{phase='Sunrise';const p=(time-2*d-t)/t;mix=1-p*p*(3-2*p);remaining=total-time;}
 return {phase,mix,remaining};
}
