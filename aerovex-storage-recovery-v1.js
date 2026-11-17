/* Aerovex storage safety: move redundant rollback snapshots into IndexedDB,
 * keeping the active ERP database and all business records untouched.
 * No automatic deletions, no cache reset and no cloud overwrite.
 */
(function(){
'use strict';
const CORE='aerovex-erp-data-v1';
const ARCHIVE_DB='aerovex-storage-archive-v1';
const isArchive=k=>k==='aerovex-sync-prechange-v3'||/^aerovex-previous-cloud-/.test(k);
const fmt=n=>(n/1024/1024).toFixed(2)+' MB';
const size=s=>String(s||'').length*2;
function keys(){
 const arr=[];
 try{for(let i=0;i<localStorage.length;i++)arr.push(localStorage.key(i))}catch(e){}
 return arr.filter(Boolean);
}
function usage(){
 let total=0;
 for(const k of keys()){try{total+=size(k)+size(localStorage.getItem(k))}catch(e){}}
 return {total,core:size(localStorage.getItem(CORE)||''),archives:keys().filter(isArchive)};
}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('IndexedDB unavailable on this phone'));
  const r=indexedDB.open(ARCHIVE_DB,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('snapshots'))r.result.createObjectStore('snapshots',{keyPath:'key'})};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('Archive database open failed'));
 });
}
async function storeSnapshot(key,raw){
 const d=await openDb();
 try{
  await new Promise((resolve,reject)=>{
   const tx=d.transaction('snapshots','readwrite');
   tx.objectStore('snapshots').put({key,raw,archivedAt:new Date().toISOString()});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Archive save failed'));tx.onabort=()=>reject(tx.error||Error('Archive aborted'));
  });
  const saved=await new Promise((resolve,reject)=>{
   const tx=d.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get(key);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('Archive check failed'));
  });
  if(!saved||saved.raw!==raw)throw Error('Archive verification failed for '+key);
 }finally{d.close()}
}
async function getArchiveAll(){
 const d=await openDb();
 try{return await new Promise((resolve,reject)=>{
  const tx=d.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').getAll();
  r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error||Error('Archive read failed'));
 })}finally{d.close()}
}
async function getEmergencyOrders(){
 return new Promise(resolve=>{
  if(!window.indexedDB)return resolve([]);
  const r=indexedDB.open('aerovex-sales-emergency-v1',1);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('orders'))d.createObjectStore('orders',{keyPath:'documentNo'})};
  r.onerror=()=>resolve([]);
  r.onsuccess=()=>{
   const d=r.result;
   if(!d.objectStoreNames.contains('orders')){d.close();return resolve([])}
   const tx=d.transaction('orders','readonly'),q=tx.objectStore('orders').getAll();
   q.onsuccess=()=>{const list=q.result||[];d.close();resolve(list)};
   q.onerror=()=>{d.close();resolve([])};
  };
 });
}
function setStatus(msg){
 const el=document.getElementById('axStorageRepairStatus');
 if(el)el.textContent=msg;
}
function refresh(){
 const x=usage(),el=document.getElementById('axStorageRepairSummary');
 if(el)el.textContent='ERP data: '+fmt(x.core)+' | Browser storage used (estimated): '+fmt(x.total)+' | Extra archived snapshots: '+x.archives.length+'. Phone storage quota is different from total phone capacity.';
}
function download(payload,name){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function backup(){
 const btn=document.getElementById('axStorageBackup');
 if(btn)btn.disabled=true;
 setStatus('Preparing complete ERP phone backup…');
 try{
  const data={};
  for(const k of keys()){
   if(k===CORE||isArchive(k)||/^aerovex-/.test(k)&&!/session|token|auth/i.test(k)){
    data[k]=localStorage.getItem(k);
   }
  }
  if(!data[CORE])throw Error('ERP main database not found in phone storage; do not clear anything.');
  const archived=await getArchiveAll().catch(()=>[]);
  const emergency=await getEmergencyOrders().catch(()=>[]);
  download({application:'Aerovex ERP',kind:'Complete phone safety export',createdAt:new Date().toISOString(),localStorage:data,archivedSnapshots:archived,emergencySalesOrders:emergency},'Aerovex-Complete-Phone-Backup-'+new Date().toISOString().slice(0,10)+'.json');
  setStatus('Backup download requested. Confirm the JSON file is in Downloads. No phone or Cloud data was removed.');
 }catch(e){setStatus('Backup could not finish: '+e.message+'. No data was removed.')}
 finally{if(btn)btn.disabled=false}
}
async function optimize(){
 const btn=document.getElementById('axStorageRepair');
 if(btn)btn.disabled=true;
 const candidates=usage().archives;
 if(!candidates.length){setStatus('No redundant localStorage snapshots to migrate. Active ERP data remains unchanged.');if(btn)btn.disabled=false;return}
 if(!confirm('Move '+candidates.length+' old rollback snapshot(s) to verified IndexedDB archive? Active Sales Orders, invoices, stock and Cloud data will NOT be deleted or overwritten.')){if(btn)btn.disabled=false;return}
 let moved=0,freed=0;
 try{
  for(const k of candidates){
   const raw=localStorage.getItem(k);
   if(raw===null)continue;
   await storeSnapshot(k,raw);
   if(localStorage.getItem(k)!==raw)throw Error('Snapshot changed during repair; stopped safely');
   localStorage.removeItem(k);
   moved++;freed+=size(raw);
  }
  setStatus('✓ '+moved+' old rollback snapshots moved and verified in phone IndexedDB. Approximately '+fmt(freed)+' freed from localStorage. Active ERP records untouched. Download a backup next.');
 }catch(e){setStatus('Repair stopped safely after '+moved+' snapshot(s): '+e.message+'. Unmoved records remain intact.')}
 finally{refresh();if(btn)btn.disabled=false}
}
function open(){
 if(typeof show!=='function')return alert('ERP is still loading; reopen Storage Repair.');
 show('Storage Repair & Safety Backup','<div id="axStoragePanel" style="padding:9px;line-height:1.6"><p id="axStorageRepairSummary"></p><p>For Sales Orders, Cloud Save fallback handles a full phone quota. This tool safely archives only old duplicate rollback snapshots, never your live ERP database.</p><button type="button" id="axStorageBackup">Download Complete Phone Backup</button> <button type="button" id="axStorageRepair">Move Old Snapshots to Safe Archive</button><p id="axStorageRepairStatus" role="status">Your active data will not be deleted.</p></div>');
 const backupBtn=document.getElementById('axStorageBackup'),repairBtn=document.getElementById('axStorageRepair');
 if(backupBtn)backupBtn.onclick=backup;
 if(repairBtn)repairBtn.onclick=optimize;
 refresh();
}
function init(){
 if(document.getElementById('axStorageRepairOpen'))return;
 const root=document.querySelector('.hero');
 if(!root)return;
 const btn=document.createElement('button');
 btn.id='axStorageRepairOpen';btn.type='button';btn.textContent='🛡 Storage Repair / Backup';btn.style.margin='8px';btn.onclick=open;
 root.appendChild(btn);
}
window.axERPStorageRepair=open;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();