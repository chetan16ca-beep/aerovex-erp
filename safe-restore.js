/* Aerovex non-destructive restore patch */
(function(){
'use strict';
const KEY='aerovex-erp-data-v1';
const modules=['parties','suppliers','products','quotations','salesOrders','workOrders','store','cutting','departmentWork','packing','challans','invoices','receipts','payments','purchases','expenses','ledger','vouchers','purchaseOrders','purchaseOrderReceipts','dispatchTracking','dispatchEvents','quotationFollowups','auditLog','cfmLinks'];
const identity={quotations:['quotationNo'],salesOrders:['documentNo'],workOrders:['workNo'],challans:['documentNo'],invoices:['documentNo','invoiceNo'],purchaseOrders:['id'],purchaseOrderReceipts:['id'],dispatchTracking:['id'],dispatchEvents:['id'],quotationFollowups:['id'],auditLog:['date','module','action'],cfmLinks:['erpWorkNo'],vouchers:['type','no']};
function download(name,data){
 const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);
}
function normalize(s){return String(s??'').trim().toLowerCase();}
function id(row,module){
 const fields=identity[module];if(!fields)return null;
 if(module==='invoices')return normalize(row.documentNo||row.invoiceNo)||null;
 const vals=fields.map(k=>normalize(row[k]));return vals.every(Boolean)?vals.join('|'):null;
}
function init(){
 const button=document.getElementById('axImportBtn');if(!button||button.dataset.safeRestore)return;
 button.dataset.safeRestore='1';button.title='Safe merge backup without replacing existing records';
 const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.hidden=true;document.body.appendChild(picker);
 button.addEventListener('click',e=>{e.stopImmediatePropagation();picker.click()},true);
 picker.addEventListener('change',async()=>{
 const file=picker.files&&picker.files[0];if(!file)return;
 try{
 const raw=JSON.parse(await file.text());
 const incoming=raw&&raw.application==='Aerovex ERP'&&raw.storageKey===KEY&&raw.data?raw.data:raw;
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)||!modules.some(k=>Array.isArray(incoming[k]))||modules.some(k=>incoming[k]!==undefined&&!Array.isArray(incoming[k])))throw Error('Invalid ERP data format');
 const original=localStorage.getItem(KEY)||'{}';
 const current=JSON.parse(original);
 if(!current||typeof current!=='object'||Array.isArray(current))throw Error('Current ERP data is invalid; nothing changed');
 const next=JSON.parse(JSON.stringify(current));let added=0,skipped=0;const conflicts=[];
 for(const module of modules){
 if(!Array.isArray(incoming[module]))continue;
 if(!Array.isArray(next[module]))next[module]=[];
 for(const row of incoming[module]){
 if(!row||typeof row!=='object'||Array.isArray(row)){skipped++;continue}
 const identifier=id(row,module);
 let match=identifier?next[module].find(v=>id(v,module)===identifier):null;
 if(!match){match=next[module].find(v=>JSON.stringify(v)===JSON.stringify(row))}
 if(match){
 if(JSON.stringify(match)!==JSON.stringify(row))conflicts.push({module,document:identifier,existing:match,incoming:row});
 else skipped++;
 }else if(identifier||!identity[module]){next[module].push(row);added++}
 else conflicts.push({module,reason:'Missing document number',incoming:row});
 }
 }
 if(!confirm('SAFE MERGE: '+added+' new records, '+conflicts.length+' conflicts (will NOT overwrite), '+skipped+' duplicates. Download current safety backup and merge?'))return;
 download('Aerovex-BEFORE-SAFE-MERGE-'+new Date().toISOString().slice(0,10)+'.json',{application:'Aerovex ERP',formatVersion:1,storageKey:KEY,createdAt:new Date().toISOString(),data:current});
 if(conflicts.length)download('Aerovex-MERGE-CONFLICTS-'+new Date().toISOString().slice(0,10)+'.json',{conflicts});
 localStorage.setItem(KEY,JSON.stringify(next));
 alert('Safe merge complete. Added '+added+' records. Conflicts '+conflicts.length+' preserved separately; existing records unchanged. ERP will reload.');
 location.reload();
 }catch(e){alert('Safe merge cancelled: '+e.message)}finally{picker.value=''}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();