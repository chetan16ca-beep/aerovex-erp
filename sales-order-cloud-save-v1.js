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
function equalDocs(a,b){
 // JSONB reorders object properties. Compare the business-critical fields
 // when checking a saved document (never overwrite conflicting same numbers).
 const pick=o=>({
  no:getNo(o),party:text(o?.party),date:text(o?.date),
  items:(Array.isArray(o?.items)?o.items:[]).map(x=>({
   description:text(x.description),hsn:text(x.hsn),
   qty:Number(x.qty),rate:Number(x.rate),size:text(x.size),unit:text(x.unit)
  }))
 });
 return JSON.stringify(pick(a))===JSON.stringify(pick(b));
}
async function upload(number){
 if(uploading)return showState('Cloud Save already running. Please do not press Save again.','busy',null);
 uploading=true;
 try{
  const order=localOrder(number);
  showState('✓ Sales Order '+number+' saved on this device. Checking secure Cloud Save…','busy',null);
  const ctx=await authorized();
  for(let attempt=0;attempt<3;attempt++){
   const c=await readCloud(ctx);
   const sameNo=c.payload.salesOrders.filter(x=>getNo(x)===number);
   if(sameNo.length){
    if(sameNo.length!==1||!equalDocs(sameNo[0],order))
     throw Error('Cloud already has '+number+' with different details. Existing order protected. Verify document numbers.');
    showState('✓ '+number+' — CLOUD SAVED & VERIFIED. No duplicate created.','success');
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
    showState('✓ SALES ORDER SAVED — Phone + Cloud verified: '+number,'success');
    return;
   }
  }
  throw Error('Cloud changed while saving. Your phone copy is safe; retry verification.');
 }catch(e){
  showState('⚠ PHONE SAVED / CLOUD NOT VERIFIED — '+number+'. '+(e?.message||e)+'. Do not create another order.','warning',number);
 }finally{uploading=false}
}
function bind(form){
 if(form?.id!=='axDocForm'||form.dataset.axSOCSbound==='1')return;
 const h=document.querySelector('#modalBody > h2');
 if(!h||text(h.textContent).toUpperCase()!=='SALES ORDER')return;
 form.dataset.axSOCSbound='1';
 // Wrap the existing synchronous Sales Order save after all document
 // modules have bound it. Check that a new document really reached localStorage
 // before starting the separately verified cloud upload.
 const prior=form.onsubmit;
 if(typeof prior!=='function')return;
 form.onsubmit=function(event){
  const no=text(form.elements?.namedItem('documentNo')?.value);
  const entries=Array.isArray(db?.salesOrders)?db.salesOrders:[];
  const before=entries.slice();
  let result;
  try{
   result=prior.call(this,event);
  }catch(error){
   // The native Save handler may push the order before localStorage throws.
   // Restore just that in-memory SO list. Previous phone files are untouched.
   if(Array.isArray(db?.salesOrders))db.salesOrders=before;
   showState('✕ PHONE SAVE FAILED: '+text(error?.message||error)+'. Download device backup; do not assume it saved.','error',null);
   return false;
  }
  const after=Array.isArray(db?.salesOrders)?db.salesOrders:[];
  if(!no||before.some(x=>getNo(x)===no)||!after.some(x=>getNo(x)===no))return result;
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