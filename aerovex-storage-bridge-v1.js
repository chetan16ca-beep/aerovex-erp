/* Aerovex durable IndexedDB storage bridge v1.
 * Existing synchronous ERP modules retain localStorage getItem/setItem API,
 * but their large Aerovex data is stored in IndexedDB.
 * The startup loader MUST await axERPStorageBridge.ready before app.js.
 * Never deletes existing localStorage or cloud records automatically.
 */
(function(){
'use strict';
const DATA_KEY='aerovex-erp-data-v1';
const DB_NAME='aerovex-durable-data-v1',STORE='records';
const PERSISTED=new Map(),REV=new Map();
let db=null,ready=false,fallback=false,lastError='',pending=0;
let chain=Promise.resolve(),migration=null,original=Object.create(null);
const managed=k=>k===DATA_KEY||k==='aerovex-logo-data'||
  k==='aerovex-erp-prechange-v30'||k==='aerovex-gst-itc-prechange-v2'||
  k==='aerovex-sync-prechange-v3'||k==='aerovex-sync-baseline-v1'||/^aerovex-previous-cloud-/.test(k);
const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
const ident=(k)=>String(k);
const nativeGet=k=>get.call(localStorage,k);
function report(status,message){
  let node=document.getElementById('axERPStorageState');
  if(!node&&document.body){
    node=document.createElement('div');node.id='axERPStorageState';
    node.style.cssText='position:fixed;z-index:2147481000;left:8px;bottom:8px;'+
      'font:12px Arial,sans-serif;border-radius:7px;padding:7px 10px;'+
      'max-width:calc(100vw - 16px);box-shadow:0 2px 8px #0003';
    document.body.appendChild(node);
  }
  if(node){
    node.style.background=status==='error'?'#fff1ed':status==='saving'?'#fff9e5':'#eaf9f0';
    node.style.color=status==='error'?'#8a2215':'#14553f';
    node.textContent=message;
  }
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('IndexedDB is unavailable'));
  const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'key'})};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('IndexedDB could not open'));
  r.onblocked=()=>reject(Error('Close other Aerovex tabs to complete storage upgrade'));
 });
}
function readAll(){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();
  r.onsuccess=()=>resolve(r.result||[]);
  r.onerror=()=>reject(r.error||Error('IndexedDB could not read'));
 });
}
function readOne(key){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);
  r.onsuccess=()=>resolve(r.result||null);
  r.onerror=()=>reject(r.error||Error('IndexedDB verification failed'));
 });
}
function writeOne(key,value,base){
 return new Promise((resolve,reject)=>{
  let tx;
  try{
   tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put({key,value,base,updatedAt:new Date().toISOString()});
   tx.oncomplete=()=>resolve(true);
   tx.onerror=()=>reject(tx.error||Error('IndexedDB save failed'));
   tx.onabort=()=>reject(tx.error||Error('IndexedDB save aborted'));
  }catch(e){reject(e)}
 });
}
function deleteOne(key){
 return new Promise((resolve,reject)=>{
  try{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).delete(key);
   tx.oncomplete=()=>resolve(true);
   tx.onerror=()=>reject(tx.error||Error('IndexedDB delete failed'));
  }catch(e){reject(e)}
 });
}
async function initialize(){
 try{
  db=await openDB();
  const rows=await readAll();
  for(const row of rows){
   if(!row||!managed(row.key))continue;
   // Detect legacy ERP written by an out-of-date PWA after migration.
   const legacy=nativeGet(row.key);
   if(legacy!==null&&row.base!==undefined&&legacy!==row.base&&legacy!==row.value){
    throw Error('Another older ERP version changed '+row.key+
      '. No records overwritten. Export both versions and reconcile.');
   }
   PERSISTED.set(row.key,row.value);
   original[row.key]=row.base;
  }
  const legacyKeys=[];
  for(let i=0;i<localStorage.length;i++){
   const k=localStorage.key(i);if(k&&managed(k)&&!PERSISTED.has(k))legacyKeys.push(k);
  }
  for(const key of legacyKeys){
   const value=nativeGet(key);if(value===null)continue;
   // Complete an initial migration transaction AND verify read-back.
   await writeOne(key,value,value);
   const checked=await readOne(key);
   if(!checked||checked.value!==value)throw Error('Storage migration verification failed for '+key);
   PERSISTED.set(key,value);original[key]=value;
  }
  ready=true;
  report('ok','✓ Aerovex device storage: IndexedDB ready (no old data removed)');
  return true;
 }catch(error){
  fallback=true;lastError=String(error?.message||error);
  report('error','⚠ Aerovex storage not migrated: '+lastError+' — existing local data retained');
  return false;
 }
}
function queuedWrite(key,value){
 const revision=(REV.get(key)||0)+1;REV.set(key,revision);
 const before=PERSISTED.get(key),base=original[key]===undefined?nativeGet(key):original[key];
 PERSISTED.set(key,value);pending++;
 report('saving','Aerovex: Saving device data…');
 const work=chain.catch(()=>{}).then(async()=>{
  if(!db)throw Error('IndexedDB unavailable');
  await writeOne(key,value,base);
  const checked=await readOne(key);
  if(!checked||checked.value!==value)throw Error('IndexedDB read-back mismatch: '+key);
 });
 chain=work.then(()=>{
  pending--;
  if(pending===0&&!lastError)report('ok','✓ Device saved — Cloud Sync checks independently');
 },e=>{
  pending--;
  lastError=String(e?.message||e);
  if(REV.get(key)===revision){
   if(before===undefined)PERSISTED.delete(key);
   else PERSISTED.set(key,before);
  }
  report('error','⚠ DEVICE SAVE FAILED: '+lastError+'. Do not close this tab. Export backup.');
  // Do not silently report "saved" for a failed async write.
 });
 return chain;
}
Storage.prototype.getItem=function(k){
 const key=ident(k);
 if(this===localStorage&&ready&&!fallback&&managed(key)&&PERSISTED.has(key))
  return PERSISTED.get(key);
 return get.call(this,key);
};
Storage.prototype.setItem=function(k,value){
 const key=ident(k),v=String(value);
 if(this===localStorage&&ready&&!fallback&&managed(key)){
  queuedWrite(key,v);
  return;
 }
 return set.call(this,key,v);
};
Storage.prototype.removeItem=function(k){
 const key=ident(k);
 if(this===localStorage&&ready&&!fallback&&managed(key)){
  PERSISTED.delete(key);
  pending++;
  chain=chain.catch(()=>{}).then(()=>deleteOne(key)).then(()=>{pending--;},e=>{
   pending--;lastError=String(e);report('error','⚠ Data removal could not be persisted: '+lastError);
  });
  return;
 }
 return remove.call(this,key);
};
const flush=async()=>{
 await chain;
 if(lastError)throw Error(lastError);
 if(fallback)throw Error('IndexedDB is not ready. Do not claim a durable save.');
 return true;
};
async function exportBackup(){
 await flush();
 const data={};
 for(const [key,value] of PERSISTED)if(managed(key))data[key]=value;
 const raw=JSON.stringify({application:'Aerovex ERP',type:'IndexedDB durable device backup',
   exportedAt:new Date().toISOString(),records:data});
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;
 a.download='Aerovex-IndexedDB-Full-Backup-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
 return Object.keys(data);
}
async function freeLegacySpace(){
 await flush();
 const raw=nativeGet(DATA_KEY),current=PERSISTED.get(DATA_KEY);
 if(raw===null)return {freed:0};
 if(!current)throw Error('IndexedDB core data not found; nothing removed.');
 const row=await readOne(DATA_KEY);
 if(!row||row.value!==current||row.base!==raw)
  throw Error('Old and current data were not verified. Keep the original localStorage copy.');
 // Only the OLD duplicate localStorage version is removed after a separate
 // verified IDB copy AND an explicit backup download action by the user.
 remove.call(localStorage,DATA_KEY);
 const freed=raw.length*2;
 original[DATA_KEY]=null;
 const newRow=await writeOne(DATA_KEY,current,null);
 const check=await readOne(DATA_KEY);
 if(!check||check.value!==current)throw Error('IndexedDB remained accessible but verification failed.');
 return {freed};
}
const readyPromise=initialize();
window.axERPStorageBridge={
 ready:()=>readyPromise,flush,
 status:()=>({ready, fallback,pending,error:lastError,
   mainBytes:2*String(PERSISTED.get(DATA_KEY)||'').length}),
 exportBackup,freeLegacySpace,
 getMain:()=>PERSISTED.get(DATA_KEY)||nativeGet(DATA_KEY)
};
})();
