export const GRAPHICS_API_KEY='daytona-graphics-api-v1';
export function requestedGraphicsAPI(storage,search=''){
 const override=new URLSearchParams(search).get('renderer');
 if(override!==null)return override;
 try{const saved=storage.getItem(GRAPHICS_API_KEY);if(['auto','webgpu','webgl2'].includes(saved))return saved;}catch{}
 return 'auto';
}

export function mountGraphicsAPISettings({select,apply,status,storage,search,occupied,beforeReload,reload,onChoice=()=>{}}){
 const initial=requestedGraphicsAPI(storage,search);
 let choice=['auto','webgpu','webgl2'].includes(initial)?initial:'auto';
 select.value=choice;
 function sync(){
  const pending=choice!==initial,blocked=occupied();
  apply.hidden=!pending;apply.disabled=blocked;
  status.textContent=pending?(blocked?'Saved for next launch. Leave the multiplayer room before reloading.':'Saved for next launch. Reload to apply; you will need to choose your ROM again.'):'Automatic prefers WebGPU and falls back to WebGL2 when unavailable. Changing the API requires a page reload.';
 }
 select.addEventListener('change',()=>{
  choice=select.value;
  try{storage.setItem(GRAPHICS_API_KEY,choice);}catch{}
  onChoice(choice);
  sync();
 });
 apply.addEventListener('click',()=>{
  if(occupied()||choice===initial)return;
  beforeReload();reload(choice);
 });
 sync();return {sync};
}
