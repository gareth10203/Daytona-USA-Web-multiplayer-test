// Catalog IDs are appearance rows, never RAM addresses or native player IDs.
export const PLAYER_SKINS=Object.freeze(Array.from({length:40},(_,id)=>Object.freeze({id,name:id?`CPU style ${String(id).padStart(2,'0')}`:'Original seat livery'})));
export const validPlayerSkin=value=>Number.isInteger(value)&&value>=0&&value<PLAYER_SKINS.length;
export function skinOwner(members,skin,except=''){return skin?members.find(m=>m.id!==except&&m.skin===skin):undefined;}
export function validateSkinRoster(members){
 const used=new Set();for(const m of members){const skin=m.skin??0;if(!validPlayerSkin(skin)||(skin&&used.has(skin)))throw Error('Invalid or duplicate player skin.');if(skin)used.add(skin);}
 return members;
}
