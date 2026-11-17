/* Aerovex Sales Order — authenticated live Cloud Customer selector.
 * Read-only cloud fetch; does not change ERP snapshots, existing documents or CFM.
 * Clear status on Sales Order; fills legacy + SAP Bill To fields. Ship To is untouched.
 */
(function(){
'use strict';
const ROOT='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
const APIKEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
const OWNER='aerovexfiltration@gmail.com';
const STORAGE='ax-erp-owner-session-v1';
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const customer=x=>({
 name:clean(x?.name||x?.party||x?.f0),
 gstin:clean(x?.gstin||x?.f1).toUpperCase(),
 address:clean(x?.billingAddress||x?.address),
 phone:clean(x?.phone||x?.f2),
 attention:clean(x?.attention||x?.contactName),
 place:clean(x?.place||x?.placeOfSupply||x?.city)
});
function isSalesOrder(form){
 const title=clean(document.querySelector('#modalBody > h2')?.textContent).toUpperCase();
 return form?.id==='axDocForm'&&title==='SALES ORDER';
}
function attach(){
 const form=document.querySelector('#modalBody #axDocForm');
 if(!isSalesOrder(form)||form.dataset.axLiveCustomerInitialized)return;
 const party=form.elements.namedItem('party');
 const anchor=party?.closest('label');
 if(!anchor)return;
 form.dataset.axLiveCustomerInitialized='1';
 const box=document.createElement('div');
 box.className='axSalesLiveSelector';
 const heading=document.createElement('label');
 heading.textContent='Cloud Customer — Select Saved Party';
 const select=document.createElement('select');
 select.id='axLiveSalesPartySelect';
 select.setAttribute('aria-label','Live saved Aerovex customer');
 select.innerHTML='<option value="">Loading Aerovex customers…</option>';
 heading.appendChild(select);
 const message=document.createElement('p');
 message.className='axSalesLiveStatus';
 message.setAttribute('role','status');
 message.textContent='Connecting securely to Aerovex Cloud…';
 const retry=document.createElement('button');
 retry.type='button';
 retry.className='axSalesLiveRetry';
 retry.textContent='↻ Reload Cloud Customers';
 box.appendChild(heading);
 box.appendChild(retry);
 box.appendChild(message);
 anchor.before(box);
 let rows=[];
 let running=false;
 function status(msg,isError=false){
   message.textContent=msg;
   message.style.color=isError?'#a32222':'#155b49';
 }
 function choose(item){
  if(!item?.name)return;
  const data={
   party:item.name,
   gstin:item.gstin,
   address:item.address,
   phone:item.phone,
   attention:item.attention,
   place:item.place,
   billToName:item.name,
   billToGstin:item.gstin,
   billToAddress:item.address,
   billToContact:item.attention||item.phone
  };
  form.dataset.axCustomerFilling='1';
  try{
   for(const [name,value] of Object.entries(data)){
    const el=form.elements.namedItem(name);
    if(el&&value)el.value=value;
   }
  }finally{delete form.dataset.axCustomerFilling}
  status('✓ '+item.name+' loaded from Cloud. GSTIN and Bill To filled. Confirm Ship To before saving.');
 }
 select.addEventListener('change',()=>{
  const i=Number(select.value);
  if(select.value===''||!rows[i])return;
  choose(rows[i]);
 });
 async function load(){
  if(running)return;
  running=true;
  retry.disabled=true;
  status('Reading live Aerovex Customer Master…');
  try{
   const session=JSON.parse(sessionStorage.getItem(STORAGE)||'null');
   if(!session?.access_token)throw Error('Login required. Reopen Aerovex and sign in.');
   const headers={apikey:APIKEY,Authorization:'Bearer '+session.access_token,Accept:'application/json'};
   const ownerRes=await fetch(ROOT+'/auth/v1/user',{headers,cache:'no-store'});
   if(!ownerRes.ok)throw Error('Owner login expired. Sign in again.');
   const owner=await ownerRes.json();
   if(clean(owner?.email).toLowerCase()!==OWNER||!owner.id)throw Error('Aerovex owner verification failed.');
   const response=await fetch(ROOT+'/rest/v1/erp_snapshots?select=payload&user_id=eq.'+encodeURIComponent(owner.id)+'&limit=1',{headers,cache:'no-store'});
   if(!response.ok)throw Error('Customer list request failed (HTTP '+response.status+').');
   const found=await response.json();
   if(!Array.isArray(found)||!Array.isArray(found[0]?.payload?.parties))
    throw Error('Cloud Customer Master not available.');
   if(!form.isConnected)return;
   const seen=new Set();
   rows=[];
   for(const source of found[0].payload.parties){
    if(!source||typeof source!=='object')continue;
    const item=customer(source);
    if(!item.name)continue;
    const key=item.gstin||norm(item.name);
    if(seen.has(key))continue;
    seen.add(key);
    rows.push(item);
   }
   rows.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
   select.replaceChildren(new Option('Select Customer from Cloud', ''));
   rows.forEach((c,i)=>select.add(new Option(c.name+(c.gstin?' — '+c.gstin:''),String(i))));
   form.classList.add('axSalesCloudReady');
   status('✓ Cloud connected: '+rows.length+' saved customer(s). Choose a customer above.');
   const typed=norm(party.value);
   const existing=rows.findIndex(c=>norm(c.name)===typed||c.gstin&&norm(c.gstin)===typed);
   if(existing>=0){select.value=String(existing);choose(rows[existing])}
  }catch(e){
   if(form.isConnected)status('⚠ '+e.message+' — Existing form data kept.',true);
  }finally{
   running=false;
   if(form.isConnected)retry.disabled=false;
  }
 }
 retry.addEventListener('click',load);
 // If the party was typed manually, match Cloud and fill on exact name.
 party.addEventListener('change',()=>{
  const index=rows.findIndex(c=>norm(c.name)===norm(party.value));
  if(index>=0){select.value=String(index);choose(rows[index])}
 });
 load();
}
const css=document.createElement('style');
css.textContent='.axSalesLiveSelector{padding:12px;margin:9px 0;border:1px solid #95c7d2;border-radius:11px;background:#f2fafb;display:flex;flex-wrap:wrap;gap:8px;color:#194b5a}.axSalesLiveSelector label{flex:1 1 230px;font-weight:700}.axSalesLiveSelector select{display:block;width:100%;min-height:44px;margin-top:7px;border:1px solid #a8cad5;border-radius:8px;background:white;color:#133b4f}.axSalesLiveRetry{flex:0 1 auto;align-self:center;min-height:42px}.axSalesLiveStatus{width:100%;font-size:13px;margin:4px 0 0}#axDocForm.axSalesCloudReady .axCustomerPicker{display:none!important}';
document.head.appendChild(css);
// Works for all New Sales Order entry paths and wrapped axDetailedDocument flows.
if(typeof window.axDetailedDocument==='function'){
 const prior=window.axDetailedDocument;
 window.axDetailedDocument=function(){
  const out=prior.apply(this,arguments);
  attach();
  return out;
 };
}
function observe(){
 const target=document.getElementById('modalBody');
 if(!target)return;
 new MutationObserver(attach).observe(target,{subtree:true,childList:true});
 attach();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);
else observe();
})();
