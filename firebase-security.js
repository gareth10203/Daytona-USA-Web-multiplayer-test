// Public site key, never a reCAPTCHA secret or service-account credential.
// Populate only after registering this provider in Firebase App Check.
export const APP_CHECK_CONFIG=Object.freeze({
 provider:'recaptcha-enterprise',
 siteKey:'6Lf9G_ctAAAAAO0MsXgxCTQf2BqiDnWSdGwww4mE'
});

// A shared initializer is awaited before Authentication or Database is used.
// The SDK owns token caching/refresh; no per-frame token requests are made.
export function createAppCheckGate({config=APP_CHECK_CONFIG,hostname=()=>globalThis.location?.hostname||'',debugToken=()=>globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN,load=()=>import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js')}={}){
 let pending,refresh,active=true;
 const start=instance=>{
  if(!config.siteKey)return Promise.resolve(null);
  // Production reCAPTCHA deliberately excludes localhost. After enforcement,
  // local development needs an explicitly registered private debug token.
  // Without one, the server rejects protected access; this is no server bypass.
  if(['localhost','127.0.0.1','[::1]'].includes(hostname())&&!debugToken())return Promise.resolve(null);
  if(config.provider!=='recaptcha-enterprise')return Promise.reject(Error('Unsupported App Check provider'));
  return pending??=(async()=>{
   const sdk=await load();
   const appCheck=sdk.initializeAppCheck(instance,{provider:new sdk.ReCaptchaEnterpriseProvider(config.siteKey),isTokenAutoRefreshEnabled:active});
   refresh=value=>sdk.setTokenAutoRefreshEnabled(appCheck,value);
   return appCheck;
  })().catch(error=>{pending=null;throw error;});
 };
 start.setActive=value=>{active=!!value;refresh?.(active);};
 return start;
}
