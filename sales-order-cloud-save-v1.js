/* Aerovex Sales Order durable save status + safe cloud upload.
 * Preserves all existing cloud modules and never silently overwrites a document.
 * An SO is declared Cloud Saved only after an authenticated read-back.
 */
(function(){
'use strict';
const BASE='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
const KEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
const OWNER='aerovexfiltration@gmail.com';
const STORE='ax-erp-owner-session-v1';
const DATA='aerovex-erp-data-v1';
let uploading=false;
const text=v=>String(v??'').trim();
const getNo=o=>text(o?.documentNo||o?.orderNo||o?.no);
const json=async r=>r.json().catch(()=>null);
function showState(note,tone,number){
 const root=document.querySelector('#modalBody');
 if(!root)return;
 let box=document.getElementById('axSOCloudSaveResult');
 if(!box){
  box=document.createElement('section');
  box.id='axSOCloudSaveResult';
  box.setAttribute('role','status');
  box.setAttribute('aria-live','polite');
  root.insertBefore(box,root.children[1]||null);
 }
 box.style.cssText='margin:10px 0;padding:12px;border:1px solid #bbcdd8;background:#f4f9fb;border-radius:9px;color:#163b50;font-weight:650;line-height:1.6';
 box.textContent=note;
 if(number&&tone!=='success'){
  const retry=document.createElement('button');
  retry.type='button';
  retry.textContent='↻ Verify / Retry Cloud Save';
  retry.style.cssText='display:block;margin-top:10px;padding:10px;border-radius:8px';
  retry.onclick=()=>upload(number);
  box.appendChild(retry);
 }
}
function localOrder(number){
 const raw=localStorage.getItem(DATA);
 if(!raw)throw Error('Phone storage has no ERP data. Do NOT reset.');
 let o;
 try{o=JSON.parse(raw)}catch(e){throw Error('Phone ERP data cannot be read. Download backup first.')}
 const list=Array.isArray(o.salesOrders)?o.salesOrders:[];
 const matches=list.filter(x=>getNo(x)===number);
 if(matches.length!==1)throw Error(matches.length?'Duplicate Sales Order numbers on device. Do not upload until reviewed.':'Order not found in saved phone data.');
 return matches[0];
}
/* IndexedDB is a NON-DESTRUCTIVE emergency copy for a Sales Order when
 * the origin's synchronous localStorage quota is exhausted. */
function emergencyDB(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('IndexedDB not available.'));
  const req=window.indexedDB.open('aerovex-sales-emergency-v1',1);
  req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('orders'))d.createObjectStore('orders',{keyPath:'documentNo'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('IndexedDB access failed.'));
 });
}
async function emergencyWrite(order){
 const d=await emergencyDB();
 return new Promise((resolve,reject)=>{
  let tx;
  try{tx=d.transaction('orders','readwrite');
      tx.objectStore('orders').put({documentNo:getNo(order),order,recordedAt:new Date().toISOString()})}
  catch(e){d.close();return reject(e)}
  tx.oncomplete=()=>{d.close();resolve(true)};
  tx.onerror=()=>{const e=tx.error;d.close();reject(e||Error('Emergency order save failed'))};
  tx.onabort=()=>{const e=tx.error;d.close();reject(e||Error('Emergency order save aborted'))};
 });
}
async function emergencyRead(number){
 const d=await emergencyDB();
 return new Promise((resolve,reject)=>{
  let tx,req;
  try{tx=d.transaction('orders','readonly');req=tx.objectStore('orders').get(number)}
  catch(e){d.close();return reject(e)}
  req.onsuccess=()=>{const o=req.result?.order||null;d.close();resolve(o)};
  req.onerror=()=>{const e=req.error;d.close();reject(e||Error('Emergency order read failed'))};
 });
}
async function emergencyAll(){
 const d=await emergencyDB();
 return new Promise((resolve,reject)=>{
  let tx,req;
  try{tx=d.transaction('orders','readonly');req=tx.objectStore('orders').getAll()}
  catch(e){d.close();return reject(e)}
  req.onsuccess=()=>{const data=req.result||[];d.close();resolve(data)};
  req.onerror=()=>{const e=req.error;d.close();reject(e||Error('Emergency order list failed'))};
 });
}
function downloadEmergency(order){
 const data=JSON.stringify({app:'Aerovex ERP',type:'Emergency Sales Order backup',order},null,2);
 const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;
 a.download='Aerovex-SO-Emergency-'+getNo(order).replace(/[^a-z0-9_-]/gi,'-')+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),3000);
}
let mostRecentUnsaved=null;
function addEmergencyBackupButton(order){
 if(!order||!document.getElementById('axSOCloudSaveResult'))return;
 const box=document.getElementById('axSOCloudSaveResult');
 const btn=document.createElement('button');btn.type='button';
 btn.textContent='Download Emergency Sales Order Backup';
 btn.onclick=()=>downloadEmergency(order);
 box.appendChild(btn);
}
async function authorized(){
 let session;
 try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch(e){}
 if(!session?.access_token)throw Error('Aerovex owner login missing. Sign in, then retry.');
 const headers={apikey:KEY,Authorization:'Bearer '+session.access_token,Accept:'application/json'};
 let u=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store'});
 if(u.status===401&&session.refresh_token){
  const refresh=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),cache:'no-store'});
  if(refresh.ok){
   session=await json(refresh);
   sessionStorage.setItem(STORE,JSON.stringify(session));
   headers.Authorization='Bearer '+session.access_token;
   u=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store'});
  }
 }
 if(!u.ok)throw Error('Owner session expired. Log in again to verify the order.');
 const user=await json(u);
 if(!user?.id||text(user.email).toLowerCase()!==OWNER)throw Error('Aerovex owner verification failed.');
 return {headers,userId:user.id};
}
async function readCloud(ctx){
 const path='/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(ctx.userId)+'&limit=1';
 const res=await fetch(BASE+path,{headers:ctx.headers,cache:'no-store'});
 if(!res.ok)throw Error('Cloud read failed (HTTP '+res.status+').');
 const list=await json(res);
 if(!Array.isArray(list)||!list.length||!Array.isArray(list[0]?.payload?.salesOrders))
  throw Error('Existing cloud Sales Order list unavailable. Nothing uploaded.');
 return list[0];
}
function canon(x){
 if(Array.isArray(x))return x.map(canon);
 if(x&&typeof x==='object')
  return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])]));
 return x;
}
function equalDocs(a,b){
 // Compare ALL fields. Never mistake a different GSTIN, billing/ship-to
 // address, tax or commercial term for the same saved sales order.
 return JSON.stringify(canon(a))===JSON.stringify(canon(b));
}
async function upload(number,emergencyOrder=null,backupPersisted=false){
 if(uploading)return showState('Cloud Save already running. Please do not press Save again.','busy',null);
 uploading=true;
 let order=emergencyOrder,phoneSaved=false;
 try{
  if(!order){
   try{order=localOrder(number);phoneSaved=true}
   catch(error){order=await emergencyRead(number).catch(()=>null);if(!order)throw error}
  }
  if(getNo(order)!==number)throw Error('Sales Order number mismatch. Upload refused.');
  showState((phoneSaved?'✓ Phone Saved. ':'⚠ Phone storage full. ')+'Verifying Cloud Save for '+number+'…','busy',null);
  const ctx=await authorized();
  for(let attempt=0;attempt<3;attempt++){
   const c=await readCloud(ctx);
   const sameNo=c.payload.salesOrders.filter(x=>getNo(x)===number);
   if(sameNo.length){
    if(sameNo.length!==1||!equalDocs(sameNo[0],order))
     throw Error('Cloud already has '+number+' with different details. Existing order protected. Verify document numbers.');
    showState('✓ '+number+' — CLOUD SAVED & VERIFIED'+(phoneSaved?' + PHONE SAVED':backupPersisted?' (phone full; IndexedDB backup retained)':' (phone full; download an emergency backup)')+'. No duplicate created.','success');
    return;
   }
   // Clone the most recent cloud payload; append only the new SO,
   // keeping existing customer, supplier, products, invoices and stock unchanged.
   const payload={...c.payload,salesOrders:[...c.payload.salesOrders,order]};
   const updatedAt=new Date().toISOString();
   const where='/rest/v1/erp_snapshots?user_id=eq.'+
      encodeURIComponent(ctx.userId)+'&updated_at=eq.'+
      encodeURIComponent(c.updated_at)+'&select=updated_at';
   const h={...ctx.headers,'Content-Type':'application/json',Prefer:'return=representation'};
   const res=await fetch(BASE+where,{method:'PATCH',headers:h,
     body:JSON.stringify({payload,updated_at:updatedAt}),cache:'no-store'});
   if(!res.ok){
    const detail=await json(res);
    throw Error((detail?.message||detail?.details)||'Cloud write failed (HTTP '+res.status+').');
   }
   const rows=await json(res);
   if(!Array.isArray(rows)||rows.length!==1)continue; // concurrent change; read again
   const check=await readCloud(ctx);
   const found=check.payload.salesOrders.find(x=>getNo(x)===number);
   if(found&&equalDocs(found,order)){
    showState('✓ SALES ORDER CLOUD SAVED & VERIFIED: '+number+(phoneSaved?' — Phone also saved.':backupPersisted?' — Phone storage full; IndexedDB backup retained.':' — Phone storage full; download the emergency backup below.'),'success');
    return;
   }
  }
  throw Error('Cloud changed while saving. Your phone copy is safe; retry verification.');
 }catch(e){
  showState('⚠ '+(phoneSaved?'PHONE SAVED':'PHONE STORAGE FULL / EMERGENCY COPY')+' — CLOUD NOT VERIFIED: '+number+'. '+(e?.message||e)+'. Do not create another order.','warning',number);
  if(order&&!phoneSaved)addEmergencyBackupButton(order);
 }finally{uploading=false}
}
async function inspectOrders(node){
 node.textContent='Checking saved phone Sales Orders against Aerovex Cloud…';
 try{
  const raw=JSON.parse(localStorage.getItem(DATA)||'{}');
  const phone=Array.isArray(raw?.salesOrders)?raw.salesOrders:[];
  const ctx=await authorized();
  const cloud=await readCloud(ctx);
  node.textContent='';
  const heading=document.createElement('strong');
  heading.textContent='Phone: '+phone.length+' Sales Order(s) | Cloud: '+cloud.payload.salesOrders.length+' Sales Order(s)';
  node.appendChild(heading);
  if(!phone.length)return;
  let pending=0,conflicts=0,verified=0;
  for(const item of phone){
   const no=getNo(item);
   if(!no)continue;
   const found=cloud.payload.salesOrders.find(x=>getNo(x)===no);
   if(found&&equalDocs(found,item)){verified++;continue}
   if(found){conflicts++;const p=document.createElement('p');p.textContent='⚠ '+no+' has different details on phone and cloud. Not overwritten.';node.appendChild(p);continue}
   pending++;
   const row=document.createElement('div');
   row.style.cssText='padding:8px 0;border-bottom:1px solid #ccd9e0';
   const name=document.createElement('span');
   name.textContent='Pending cloud: '+no+' — '+text(item.party);
   const button=document.createElement('button');
   button.type='button';
   button.textContent='Upload / Verify '+no;
   button.style.cssText='margin:5px 0 0 10px';
   button.onclick=()=>upload(no);
   row.append(name,button);
   node.appendChild(row);
  }
  const summary=document.createElement('p');
  summary.textContent=verified+' already verified, '+pending+' pending, '+conflicts+' conflicting. No records automatically deleted or overwritten.';
  node.appendChild(summary);
 }catch(e){
  node.textContent='⚠ Could not compare orders: '+text(e?.message||e)+'. Local ERP data unchanged.';
 }
}
function salesOrderValidation(form){
 const errors=[], fields=[];
 const requireField=(key,message)=>{
  const el=form.elements?.namedItem(key);
  if(!el||!text(el.value)){errors.push(message);if(el)fields.push(el)}
 };
 requireField('party','Customer select करें');
 requireField('documentNo','Sales Order Number खाली है');
 const rows=[...form.querySelectorAll('.axDocLine')];
 if(!rows.length){errors.push('कम से कम 1 Product जोड़ें');return {errors,fields}}
 let anyProduct=false;
 rows.forEach((row,i)=>{
  const el=k=>row.querySelector('[data-field="'+k+'"]');
  const desc=el('description'),qty=el('qty'),hsn=el('hsn'),rate=el('rate');
  const d=text(desc?.value),q=text(qty?.value),h=text(hsn?.value),r=text(rate?.value);
  if(!d&&!q&&!h&&!r)return; // completely blank spare line
  anyProduct=true;
  if(!d){errors.push('Item '+(i+1)+': Product Name भरें');if(desc)fields.push(desc)}
  if(!q||!(Number(q)>0)){errors.push('Item '+(i+1)+': Quantity 0 से ज्यादा भरें');if(qty)fields.push(qty)}
  if(!/^\d{4}(\d{2})?(\d{2})?$/.test(h)){
   errors.push('Item '+(i+1)+': सही 4, 6 या 8 digit HSN भरें');
   if(hsn)fields.push(hsn);
  }else if(typeof window.axHSNLookup==='function'&&!window.axHSNLookup(h)){
   errors.push('Item '+(i+1)+': HSN '+h+' GST Master में नहीं है');
   if(hsn)fields.push(hsn);
  }
  if(r===''||!Number.isFinite(Number(r))||Number(r)<0){
   errors.push('Item '+(i+1)+': Rate भरें (free item हो तो 0 लिखें)');
   if(rate)fields.push(rate);
  }
 });
 if(!anyProduct)errors.push('Product Name, Quantity, HSN और Rate भरें');
 return {errors,fields};
}
function reconstructSalesOrder(form,number){
 // Some legacy handlers write a cloned ERP snapshot BEFORE adding the order
 // to db.salesOrders. If quota is exceeded there, recover the complete form.
 const record=Object.fromEntries(new FormData(form));
 const keys=['description','moc','micron','size','hsn','qty','unit','rate','discount'];
 record.items=[...form.querySelectorAll('.axDocLine')].map(row=>{
  const line={};
  for(const key of keys){
   const field=row.querySelector('[data-field="'+key+'"]');
   const value=field?.value??'';
   line[key]=['qty','rate','discount'].includes(key)?Number(value):value;
  }
  return line;
 }).filter(x=>text(x.description)&&x.qty>0);
 if(!record.items.length||getNo(record)!==number)throw Error('Order form incomplete. Nothing uploaded.');
 const taxes=window.axHSNApplyLines(record.items,record.taxType);
 if(!taxes?.ok)throw Error(taxes?.error||'HSN and GST validation failed.');
 Object.assign(record,taxes);
 return record;
}
function bind(form){
 if(form?.id!=='axDocForm'||form.dataset.axSOCSbound==='1')return;
 const h=document.querySelector('#modalBody > h2');
 if(!h||text(h.textContent).toUpperCase()!=='SALES ORDER')return;
 form.dataset.axSOCSbound='1';
 // Native required-field checks happen before submit; keep the error visible.
 form.addEventListener('invalid',event=>{
  const field=event.target;
  showState('✕ SALES ORDER NOT SAVED — '+(field?.name||'Required field')+' जरूरी है. Customer, Date और Order No. भरें.','error',null);
 },true);
 const audit=document.createElement('div');
 audit.className='axSOCloudAudit';
 audit.style.cssText='padding:10px;margin:9px 0;background:#f6fafc;border:1px solid #c7dbe3;border-radius:9px';
 const auditButton=document.createElement('button');
 auditButton.type='button';
 auditButton.textContent='☁ Check Saved Sales Orders (Phone vs Cloud)';
 const auditResult=document.createElement('div');
 auditResult.setAttribute('role','status');
 auditResult.style.cssText='font-size:12px;margin:5px 0';
 auditButton.onclick=()=>inspectOrders(auditResult);
 audit.append(auditButton,auditResult);
 form.prepend(audit);
 // Wrap the existing synchronous Sales Order save after all document
 // modules have bound it. Check that a new document really reached localStorage
 // before starting the separately verified cloud upload.
 const prior=form.onsubmit;
 if(typeof prior!=='function')return;
 form.onsubmit=function(event){
  event?.preventDefault?.();
  if(typeof window.axHSNApplyLines!=='function'||typeof window.axHSNLookup!=='function'){
   showState('✕ SALES ORDER NOT SAVED — HSN/GST module did not load. Reload ERP (do not clear data) and try again.','error',null);
   return false;
  }
  const check=salesOrderValidation(form);
  if(check.errors.length){
   showState('✕ SALES ORDER NOT SAVED — '+check.errors.join(' | ')+'. ये details भरकर Save दबाएँ.','error',null);
   check.fields[0]?.focus?.({preventScroll:false});
   return false;
  }
  const no=text(form.elements?.namedItem('documentNo')?.value);
  const entries=Array.isArray(db?.salesOrders)?db.salesOrders:[];
  const before=entries.slice();
  let result;
  try{
   result=prior.call(this,event);
  }catch(error){
   // Preview rendering can fail *after* the phone storage write succeeded.
   // Never roll back a genuinely persisted Sales Order.
   let persisted=false;
   if(no)try{localOrder(no);persisted=true}catch(ignore){}
   if(persisted){
    showState('✓ '+no+' saved on PHONE; Preview failed: '+text(error?.message||error)+'. Verifying Cloud…','warning',null);
    upload(no);
    return false;
   }
   // QuotaExceededError: the SO was created in RAM but localStorage
   // rejected the write. Preserve it outside localStorage and upload ONLY this
   // order using cloud's latest snapshot with atomic updated_at matching.
   const quota=error?.name==='QuotaExceededError'||/quota|storage full|setItem/i.test(text(error?.message||error));
   let pending=Array.isArray(db?.salesOrders)?db.salesOrders.find(x=>getNo(x)===no&&!before.includes(x)):null;
   if(quota&&!pending&&!before.some(x=>getNo(x)===no)){
    try{pending=reconstructSalesOrder(form,no)}
    catch(rebuildError){
     showState('✕ PHONE STORAGE FULL — Order not uploaded: '+text(rebuildError?.message||rebuildError)+'. Keep the form open and download an ERP backup.','error',null);
    }
   }
   if(quota&&pending){
    db.salesOrders=before; // do not claim the phone's original storage was changed
    mostRecentUnsaved=pending;
    showState('⚠ PHONE STORAGE FULL — '+no+' is NOT saved in localStorage. Making emergency backup and saving to Cloud…','warning',null);
    (async()=>{
      let protectedCopy=false;
      try{await emergencyWrite(pending);protectedCopy=true}
      catch(backupError){console.warn('Emergency IndexedDB unavailable',backupError)}
      // Always allow an explicit JSON backup, even without IndexedDB.
      await upload(no,pending,protectedCopy);
      if(!protectedCopy)addEmergencyBackupButton(pending);
    })();
    return false;
   }
   if(Array.isArray(db?.salesOrders))db.salesOrders=before;
   showState('✕ PHONE SAVE FAILED: '+text(error?.message||error)+'. Original orders kept. Check device storage and backup.','error',null);
   return false;
  }
  const after=Array.isArray(db?.salesOrders)?db.salesOrders:[];
  if(!no||before.some(x=>getNo(x)===no))return result;
  if(!after.some(x=>getNo(x)===no)){
   showState('⚠ Sales Order was NOT saved. Check Product, Quantity, HSN (4/6/8 digits), GST Type and duplicate Order No. Do not assume the order was created.','warning',null);
   return result;
  }
  try{localOrder(no)}
  catch(e){
   showState('⚠ Sales Order '+no+' NOT confirmed on phone: '+e.message,'warning',null);
   return result;
  }
  // Original handler has already shown Save & Preview. Cloud confirmation
  // appears in that preview and a retry option is provided on failure.
  upload(no);
  return result;
 };
}
function watch(){
 const root=document.getElementById('modalBody');
 if(!root)return;
 new MutationObserver(()=>bind(root.querySelector('#axDocForm'))).observe(root,{childList:true,subtree:true});
 bind(root.querySelector('#axDocForm'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);
else watch();
window.axSOSaveCloudCheck=upload;
})();