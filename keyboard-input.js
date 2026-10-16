export const KEYBOARD_ID='daytona-keyboard-bindings-v1';
export const KEYBOARD_ACTIONS=Object.freeze({left:'Steer left',right:'Steer right',accel:'Accelerate',brake:'Brake',gear1:'Gear 1',gear2:'Gear 2',gear3:'Gear 3',gear4:'Gear 4',shiftDown:'Shift down',shiftUp:'Shift up',camera1:'Camera 1',camera2:'Camera 2',camera3:'Camera 3',camera4:'Camera 4',coin:'Insert coin',start:'Start'});
export const DEFAULT_KEYS=Object.freeze({left:'ArrowLeft',right:'ArrowRight',accel:'ArrowUp',brake:'ArrowDown',gear1:'Digit1',gear2:'Digit2',gear3:'Digit3',gear4:'Digit4',shiftDown:'KeyQ',shiftUp:'KeyW',camera1:'KeyA',camera2:'KeyS',camera3:'KeyD',camera4:'KeyF',coin:'Digit5',start:'Enter'});
export const validKey=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Comma|Period|Slash|Semicolon|Quote|Bracket(Left|Right)|Backslash|Minus|Equal|Backquote)$/.test(code);
export function keyName(code){return {ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift'}[code]||code.replace(/^Key|^Digit/,'').replace(/^Numpad/,'Num ');}
export function assignKey(bindings,action,code){
 if(!Object.hasOwn(DEFAULT_KEYS,action)||!validKey(code))return false;
 const other=Object.keys(bindings).find(a=>a!==action&&bindings[a]===code),old=bindings[action];
 if(other)bindings[other]=old;bindings[action]=code;return other||null;
}
export function loadKeys(storage){
 const keys={...DEFAULT_KEYS};let saved;try{saved=JSON.parse(storage.getItem(KEYBOARD_ID));}catch{}
 if(saved&&Object.keys(DEFAULT_KEYS).every(a=>validKey(saved[a]))&&new Set(Object.keys(DEFAULT_KEYS).map(a=>saved[a])).size===Object.keys(DEFAULT_KEYS).length)
  for(const a of Object.keys(DEFAULT_KEYS))keys[a]=saved[a];
 return keys;
}
export function smoothKeyboardSteering(value,target,seconds,sensitivity=1){
 const dt=Math.max(0,Math.min(.05,Number.isFinite(seconds)?seconds:0));
 const speed=Math.max(.25,Math.min(1.75,Number.isFinite(sensitivity)?sensitivity:1));
 const step=100/(target===0?.20:.32)*speed*dt;
 return value+Math.max(-step,Math.min(step,target-value));
}
export class KeyboardInput{
 constructor(held,bindings){this.held=held;this.bindings=bindings;this.steer=0;}
 reset(){this.steer=0;}
 read(seconds,sensitivity=1){
  const down=a=>this.held.has(this.bindings[a]);
  this.steer=smoothKeyboardSteering(this.steer,(Number(down('right'))-Number(down('left')))*100,seconds,sensitivity);
  let buttons=0;for(const [action,mask] of [['coin',1],['start',2],['camera1',16],['camera2',32],['camera3',64],['camera4',128]])if(down(action))buttons|=mask;
  if(this.held.has('F2'))buttons|=4;if(this.held.has('F3'))buttons|=8;
  return {steer:Math.round(this.steer),active:down('left')||down('right')||Math.abs(this.steer)>.01,accel:down('accel')?100:0,brake:down('brake')?100:0,buttons};
 }
}
