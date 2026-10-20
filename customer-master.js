/* Aerovex customer master: import customers from saved invoices, autofill sales documents.
   Never deletes or resets orders, customers, stock, invoices or any other module. */
(function(){
'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=x=>String(x??'').trim();
const norm=x=>clean(x).replace(/[^a-z0-9]/gi,'').toUpperCase();
const all=()=>Array.isArray(db.parties)?db.parties:[];
const customer=x=>({
 name:clean(x?.name||x?.party||x?.customerName||x?.companyName||x?.f0),
 gstin:clean(x?.gstin||x?.gst||x?.f1).toUpperCase(),
 phone:clean(x?.phone||x?.mobile||x?.f2),
 email:clean(x?.email||x?.f3),
 address:clean(x?.address||x?.billingAddress||x?.billing),
 attention:clean(x?.attention||x?.contactName),
 place:clean(x?.place||x?.placeOfSupply)
});
function find(p){
 const allCustomers=all();
 const gst=norm(p.gstin),name=norm(p.name);
 if(gst){const i=allCustomers.findIndex(x=>norm(customer(x).gstin)===gst);if(i>=0)return i}
 return name?allCustomers.findIndex(x=>{
  const c=customer(x);
  return norm(c.name)===name&&(!c.gstin||!p.gstin||norm(c.gstin)===gst);
 }): -1;
}
function billCustomer(invoice){
 const c=customer(invoice);
 if(!c.name)return null;
 if(invoice.status==='Cancelled'||invoice.cancelled===true||invoice.isDemo===true)return null;
 // Backfill missing invoicing fields from matching existing sales/quotation documents.
 for(const key of ['salesOrders','quotations','challans']){
  for(const item of (Array.isArray(db[key])?db[key]:[])){
   const candidate=customer(item);
   const isSame=norm(candidate.name)===norm(c.name)&&(!candidate.gstin||!c.gstin||norm(candidate.gstin)===norm(c.gstin));
   if(!isSame)continue;
   for(const field of ['gstin','address','phone','email','attention','place'])if(!c[field]&&candidate[field])c[field]=candidate[field];
  }
 }
 return c;
}
function mergeBlank(existing,source){
 const current=customer(existing);let changed=false;
 for(const k of ['gstin','phone','email','address','attention','place']){
  if(!current[k]&&source[k]){existing[k]=source[k];changed=true}
 }
 return changed;
}
function addOrFill(c){
 if(!c?.name)return false;
 if(!Array.isArray(db.parties)){console.warn('Customer Master has an unexpected format: no records changed');return false}
 const index=find(c);
 if(index>=0){
  const p=db.parties[index];
  return mergeBlank(p,c);
 }
 db.parties.push({name:c.name,party:c.name,f0:c.name,gstin:c.gstin,f1:c.gstin,
  phone:c.phone,f2:c.phone,email:c.email,f3:c.email,address:c.address,
  attention:c.attention,place:c.place,customerSource:'Sales Invoice'});
 return true;
}
function syncBills(){
 const invoices=Array.isArray(db.invoices)?db.invoices:[];
 if(!invoices.length||!Array.isArray(db.parties))return 0;
 let before=JSON.stringify(all()),added=0;
 const snapshot=JSON.parse(before);
 for(const invoice of invoices)if(addOrFill(billCustomer(invoice)))added++;
 if(!added)return 0;
 try{save();return added}catch(error){
  db.parties=snapshot;console.warn('Customer Master sync did not save',error);return 0
 }
}
function list(){
 return all().map((p,i)=>({...customer(p),i})).filter(x=>x.name);
}
function fill(form,selected,overwrite=true){
 const data=customer(all()[selected]);if(!data.name)return;
 for(const k of ['name','gstin','address','attention','place','phone','email']){
  const target=form.elements?.namedItem(k==='name'?'party':k);
  if(target&&data[k]&&(overwrite||!clean(target.value))){
   target.value=data[k];target.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
}
function bind(form){
 if(form.dataset.axCustomerBound||form.id==='axCustomerMasterForm'||form.id==='axEditSavedForm')return;
 const input=form.elements?.namedItem('party');
 if(!input)return;
 const title=clean(document.querySelector('#modalBody > h2')?.textContent).toUpperCase();
 if(/PURCHASE|SUPPLIER|PAYMENT|RECEIPT|LEDGER/.test(title))return;
 form.dataset.axCustomerBound='1';
 const parent=input.closest('label')||input.parentNode;
 if(!parent)return;
 // The older Tally invoice form had no address field; add it before customer selection.
 if(form.id==='inv'&&!form.elements.namedItem('address')){
  const address=document.createElement('label');
  address.className='full';
  address.textContent='Customer Billing Address';
  const textarea=document.createElement('textarea');
  textarea.name='address';textarea.rows=3;textarea.placeholder='Auto-filled from Customer Master';
  address.appendChild(textarea);parent.after(address);
 }
 const label=document.createElement('label');
 label.className='axCustomerPicker';label.textContent='Choose Saved Customer (auto-fill)';
 const select=document.createElement('select');
 select.className='axCustomerSelect';
 const options=()=>'<option value="">Select customer / type new customer below</option>'+
  list().map(x=>'<option value="'+x.i+'">'+E(x.name)+(x.gstin?' — '+E(x.gstin):'')+'</option>').join('');
 select.innerHTML=options();
 label.appendChild(select);parent.before(label);
 select.addEventListener('change',()=>{if(select.value!=='')fill(form,Number(select.value))});
 input.addEventListener('change',()=>{
  const c=list().find(x=>norm(x.name)===norm(input.value));
  if(c){select.value=String(c.i);fill(form,c.i,false)}
  else select.value='';
 });
 const current=list().find(x=>norm(x.name)===norm(input.value));
 if(current)select.value=String(current.i);
}
function bindCurrent(){
 const root=document.getElementById('modalBody');
 if(!root)return;
 for(const form of root.querySelectorAll('form'))bind(form);
}
const css=document.createElement('style');
css.textContent='.axCustomerPicker{display:block;padding:8px;border:1px solid #c7dfe5;background:#eff8fb;border-radius:10px;color:#124d61;font-weight:700}.axCustomerPicker select{display:block;width:100%;margin-top:8px;min-height:42px}.axCustomerRow{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #dde7ed;background:white;border-radius:9px;padding:10px;margin:7px 0;flex-wrap:wrap}.axCustomerRow small{color:#556f80;display:block}.axCustomerMasterTools{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}';
document.head.append(css);
let editing=null;
function master(searchTerm=''){
 const records=list(),matches=records.filter(x=>!searchTerm||[x.name,x.gstin,x.phone,x.address].join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
 show('Customer Master','<p>Customer details save once, then choose from Quotation, Sales Order, Delivery Challan or Invoice. A customer is also added after its first saved bill. Existing records are not deleted.</p>'+
 '<form id="axCustomerMasterForm" class="form">'+
 '<label>Customer / Company Name<input name="name" required maxlength="180"></label>'+
 '<label>GSTIN<input name="gstin" maxlength="15"></label>'+
 '<label>Phone<input name="phone" inputmode="tel"></label>'+
 '<label>Email<input name="email" type="email"></label>'+
 '<label>Contact Person<input name="attention"></label>'+
 '<label>Place of Supply<input name="place"></label>'+
 '<label class="full">Customer Address<textarea name="address" rows="3"></textarea></label>'+
 '<div class="full"><button class="primary" type="submit" id="axCustomerSave">Save Customer</button><button type="button" id="axCustomerClear">New / Clear</button></div></form>'+
 '<h3>Saved Customers ('+records.length+')</h3>'+
 '<label>Search Customer<input id="axCustomerSearch" type="search" placeholder="Name, GSTIN or mobile" value="'+E(searchTerm)+'"></label>'+
 '<div id="axCustomerResults">'+matches.map(x=>'<div class="axCustomerRow"><div><b>'+E(x.name)+'</b><small>'+E(x.gstin)+' '+E(x.phone)+'</small><small>'+E(x.address)+'</small></div><button type="button" data-edit="'+x.i+'">Edit</button></div>').join('')+'</div>');
 const form=document.getElementById('axCustomerMasterForm');
 form.onsubmit=event=>{
  event.preventDefault();
  const c=Object.fromEntries(new FormData(form));
  for(const k of Object.keys(c))c[k]=clean(c[k]);
  c.gstin=c.gstin.toUpperCase();
  if(!c.name)return alert('Enter Customer Name.');
  if(c.gstin&&!/^[0-9]{2}[A-Z0-9]{13}$/.test(c.gstin))return alert('Verify 15-character GSTIN or leave blank.');
  if(!Array.isArray(db.parties))return alert('Customer Master data needs checking. No records changed. Download an ERP backup first.');
  const index=editing!==null?editing:find(c);
  const snapshot=JSON.parse(JSON.stringify(all()));
  if(index>=0){
   const existing=db.parties[index];
   if(!existing)return alert('Customer no longer exists. Reopen.');
   Object.assign(existing,c,{party:c.name,f0:c.name,f1:c.gstin,f2:c.phone,f3:c.email});
  }else db.parties.push({...c,party:c.name,f0:c.name,f1:c.gstin,f2:c.phone,f3:c.email});
  try{save()}catch(error){db.parties=snapshot;return alert('Customer was not saved: '+error.message)}
  editing=null;master();
 };
 document.getElementById('axCustomerClear').onclick=()=>{editing=null;form.reset();document.getElementById('axCustomerSave').textContent='Save Customer'};
 document.getElementById('axCustomerSearch').oninput=function(){const q=this.value.toLowerCase();for(const el of document.querySelectorAll('#axCustomerResults .axCustomerRow'))el.hidden=!el.textContent.toLowerCase().includes(q)};
 for(const b of document.querySelectorAll('#axCustomerResults [data-edit]'))b.onclick=()=>{
  const i=Number(b.dataset.edit),c=customer(all()[i]);editing=i;
  for(const k of Object.keys(c)){const input=form.elements.namedItem(k);if(input)input.value=c[k]}
  document.getElementById('axCustomerSave').textContent='Update Existing Customer';
  form.scrollIntoView({block:'start',behavior:'smooth'});
 };
}
window.axCustomerMaster=()=>{editing=null;master()};
window.axCustomerSyncBills=syncBills;
const prior=window.openModule;
window.openModule=function(name){if(name==='Customer Master'||name==='Party Master')return window.axCustomerMaster();return prior.apply(this,arguments)};
if(Array.isArray(modules.masters)&&!modules.masters.some(x=>x[0]==='Customer Master'))modules.masters.unshift(['Customer Master','Auto-save billed customers • Auto-fill']);
function start(){
 syncBills();
 bindCurrent();
 const target=document.getElementById('modalBody');
 if(target&&typeof MutationObserver!=='undefined')new MutationObserver(bindCurrent).observe(target,{subtree:true,childList:true});
 // Invoice creation by any existing form or Sales Order → Challan → Invoice conversion.
 document.addEventListener('submit',event=>{
  const form=event.target;
  if(form?.matches?.('#inv')||(form?.matches?.('#axDocForm')&&/INVOICE/i.test(document.querySelector('#modalBody > h2')?.textContent||'')))setTimeout(syncBills,0);
 },false);
 const oldPreview=window.axDocPreview;
 if(typeof oldPreview==='function')window.axDocPreview=function(type){
  if(type==='Sales Invoice')syncBills();
  return oldPreview.apply(this,arguments);
 };
 const oldPrint=window.axPrintInvoice;
 if(typeof oldPrint==='function')window.axPrintInvoice=function(){syncBills();return oldPrint.apply(this,arguments)};
 try{render()}catch(error){console.warn('Customer Master tile render',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
