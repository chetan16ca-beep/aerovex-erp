/* Aerovex Supplier Master v1. Safe additive validation, no historical rewrites. */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function'||typeof save!=='function')return;
const str=x=>String(x??'').trim();
const norm=x=>str(x).toLocaleLowerCase('en-IN').replace(/\s+/g,' ');
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=x=>str(x?.name||x?.party||x?.supplier||x?.supplierName||x?.companyName||x?.f0);
const tax=x=>str(x?.gstin||x?.f1).toUpperCase();
const keys=['suppliers','purchases','purchaseOrders'];
function records(){
 const a=[];
 for(const key of keys)if(Array.isArray(db[key]))for(const x of db[key])if(x&&typeof x==='object'&&pick(x))a.push({name:pick(x),gstin:tax(x),key});
 return a;
}
function duplicate(name,gstin){
 const n=norm(name),g=norm(gstin);
 return records().find(x=>{
   const old=norm(x.name),oldG=norm(x.gstin);
   return Boolean(g&&oldG&&g===oldG || (n===old&&(!oldG||!g||oldG===g)));
 });
}
/* Only imports remote supplier master records into the local Supplier Master.
   No removal, no overwriting of existing suppliers or purchasing records. */
let axSupplierImportBusy=false;
async function axImportCloudSuppliers(manual=false){
 if(axSupplierImportBusy)return;
 const report=message=>{const e=document.getElementById('axSupplierCloudStatus');if(e)e.textContent=message};
 let session;
 try{session=JSON.parse(sessionStorage.getItem('ax-erp-owner-session-v1')||'null')}catch(e){}
 if(!session?.access_token){if(manual)report('Log in to Aerovex ERP first. Existing records unchanged.');return}
 axSupplierImportBusy=true;
 report('Checking Aerovex cloud suppliers…');
 try{
  const root='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
  const apikey='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
  const headers={apikey,Authorization:'Bearer '+session.access_token,Accept:'application/json'};
  const meRes=await fetch(root+'/auth/v1/user',{headers,cache:'no-store'});
  if(!meRes.ok)throw Error('Sign in again to refresh the owner session.');
  const me=await meRes.json();
  if(!me.id||str(me.email).toLowerCase()!=='aerovexfiltration@gmail.com')throw Error('Only Aerovex owner can import suppliers.');
  const r=await fetch(root+'/rest/v1/erp_snapshots?select=payload&user_id=eq.'+encodeURIComponent(me.id)+'&limit=1',{headers,cache:'no-store'});
  if(!r.ok)throw Error('Cloud supplier list unavailable (HTTP '+r.status+').');
  const rows=await r.json();
  const remote=rows?.[0]?.payload?.suppliers;
  if(!Array.isArray(remote))throw Error('Cloud Supplier Master not available. No records were changed.');
  if(!Array.isArray(db.suppliers))throw Error('Local Supplier Master is not a valid list.');
  const before=JSON.stringify(db.suppliers);
  let added=0,skipped=0;
  for(const entry of remote){
   if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;
   const name=pick(entry),gstin=tax(entry);
   if(!name)continue;
   const existing=db.suppliers.find(x=>
     (gstin&&tax(x)===gstin) ||
     (norm(pick(x))===norm(name)&&(!tax(x)||!gstin||tax(x)===gstin)));
   if(existing){skipped++;continue}
   db.suppliers.push({...entry,name,party:name,f0:name,gstin,f1:gstin});
   added++;
  }
  if(added){
   try{save()}catch(e){db.suppliers=JSON.parse(before);throw Error('Storage full or blocked; original supplier list restored.')}
   const form=document.getElementById('axSupplierUniqueForm');
   const isEditing=Array.from(form?.elements||[]).some(e=>['INPUT','TEXTAREA'].includes(e.tagName)&&str(e.value));
   if(form&&!isEditing)window.axSupplierMaster();
  }
  report('✓ Supplier list checked: '+added+' new, '+skipped+' already saved. No historical records deleted.');
 }catch(e){report('Import not completed: '+e.message+' Existing data unchanged.')}
 finally{axSupplierImportBusy=false}
}
window.axSupplierMaster=function(){
 const list=Array.isArray(db.suppliers)?db.suppliers:[];
 const rows=list.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(pick(x))+'</td><td>'+esc(tax(x))+'</td><td>'+esc(x.phone||x.f2)+'</td></tr>').join('');
 show('Supplier Master','<p>Select previous suppliers in Purchase. Add a new supplier here only once. Previous Purchase/Purchase Order names are also available in dropdowns.</p>'+
 '<form id="axSupplierUniqueForm" class="form"><label>Supplier Name<input name="name" required maxlength="150"></label><label>GSTIN<input name="gstin" maxlength="15"></label><label>Phone<input name="phone" maxlength="30"></label><label>Email<input type="email" name="email" maxlength="150"></label><div class="full"><button class="primary" type="submit">Save New Supplier</button></div></form>'+
 '<p><button type="button" id="axSupplierCloudImport">↻ Import Missing Cloud Suppliers</button></p><p id="axSupplierCloudStatus" role="status" aria-live="polite"></p>'+ 
 '<h3>Saved Supplier Master</h3><div class="reportWrap"><table class="report"><thead><tr><th>#</th><th>Supplier</th><th>GSTIN</th><th>Phone</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
 const f=document.getElementById('axSupplierUniqueForm');if(!f)return;
 document.getElementById('axSupplierCloudImport').onclick=()=>axImportCloudSuppliers(true);
 f.onsubmit=event=>{
  event.preventDefault();
  const v=Object.fromEntries(new FormData(f)),name=str(v.name),gstin=str(v.gstin).toUpperCase();
  if(!name)return alert('Enter Supplier Name.');
  if(gstin&&!/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin))return alert('Verify 15-character GSTIN.');
  const found=duplicate(name,gstin);
  if(found)return alert('Existing supplier: '+found.name+'. Use that supplier from dropdown instead of creating a duplicate.');
  if(!Array.isArray(db.suppliers))return alert('Supplier Master unavailable. Backup existing ERP data before retrying.');
  const item={name,party:name,gstin,phone:str(v.phone),email:str(v.email),f0:name,f1:gstin,f2:str(v.phone),f3:str(v.email)};
  db.suppliers.push(item);
  try{save()}catch(err){db.suppliers.pop();return alert('Supplier not saved: '+err.message)}
  if(typeof render==='function')render();
  window.axSupplierMaster();
 };
};
const original=window.openModule;
window.openModule=function(name){
 if(name==='Supplier Master'){window.axSupplierMaster();axImportCloudSuppliers(false);return}
 return typeof original==='function'?original.apply(this,arguments):undefined;
};
})();