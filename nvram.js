// First-run settings saved by the original arcade menu: Single link / DELUXE cabinet / Export.
// Credits are not part of this EEPROM preset; backup RAM starts blank.
export const DEFAULT_EEPROM = Uint8Array.from([83, 69, 71, 65, 64, 130, 2, 0, 110, 161, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 20, 28, 0, 1, 0, 1, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0]);
export const STORAGE_ID = 'daytona-web-rev-a-nvram-v1';
export const RECOVERY_STORAGE_ID = 'daytona-web-rev-a-nvram-recovery-v1';
const bytes=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=255);
// SEGA header and the original DELUXE / TWIN / UPRIGHT cabinet enum.
// The arcade still validates its own checksums when it boots.
export function usableCabinetEEPROM(value,size=DEFAULT_EEPROM.length){
  return bytes(value,size)&&[83,69,71,65].every((n,i)=>value[i]===n)&&value[26]<=2;
}
export function restoreNVRAM(wasm, storage = localStorage, onRecovery=()=>{}) {
  if (wasm._daytona_eeprom_size() !== DEFAULT_EEPROM.length) throw Error('The engine uses an unsupported settings format.');
  let saved,raw=null;
  try {raw=storage.getItem(STORAGE_ID);saved=JSON.parse(raw||'null');}catch{}
  const eepromOK=usableCabinetEEPROM(saved?.eeprom,wasm._daytona_eeprom_size());
  const backupOK=bytes(saved?.backup,wasm._daytona_backup_size());
  const recovered=raw!==null&&(!eepromOK||!backupOK);
  if(recovered){
    // Keep the first original save before the normal persistence path repairs
    // it. Storage can be unavailable/full without preventing the ROM loading.
    try{if(storage.getItem(RECOVERY_STORAGE_ID)===null)storage.setItem(RECOVERY_STORAGE_ID,raw);}catch{}
  }
  wasm.HEAPU8.set(eepromOK?saved.eeprom:DEFAULT_EEPROM,wasm._daytona_eeprom_ptr());
  const backup=wasm._daytona_backup_ptr();
  if(backupOK)wasm.HEAPU8.set(saved.backup,backup);
  else wasm.HEAPU8.fill(255,backup,backup+wasm._daytona_backup_size());
  if(recovered)onRecovery({eepromRecovered:!eepromOK,backupRecovered:!backupOK,backupPreserved:backupOK});
  return eepromOK&&backupOK;
}
