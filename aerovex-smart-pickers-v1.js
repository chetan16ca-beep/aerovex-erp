/* Aerovex searchable names and products v1.
   Read-only suggestions from current masters and saved Aerovex commercial documents.
   No CFM data, no ERP record writes, and never auto-fills purchase/sale rates.
*/
(function(){
'use strict';
if(typeof db==='undefined')return;
const str=v=>String(v??'').trim().replace(/\s+/g,' ');
const norm=v=>str(v).toLocaleLowerCase('en-IN');
const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const arr=k=>Array.isArray(db[k])?db[k]:[];
const docs=['quotations','salesOrders','challans','invoices','purchases','purchaseOrders'];
const isValid=x=>x&&typeof x==='object'&&!x.cancelled&&!['cancelled','void','canceled'].includes(norm(x.status));
const partyName=x=>str(x?.name||x?.party||x?.companyName||x?.customerName||x?.supplierName||x?.supplier||x?.f0);
function savedNames(kind){
 const source=kind==='supplier'?['suppliers','purchases','purchaseOrders']:['parties','quotations','salesOrders','challans','invoices','receipts'];
 const m=new Map();
 for(const k of source)for(const x of arr(k)){
  if(!isValid(x))continue;
  const name=partyName(x),key=norm(name);
  if(key&&!m.has(key))m.set(key,{name,detail:x});
 }
 return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
}
function products(){
 const map=new Map(),ambiguous=new Set();
 const add=(x,master)=>{
  if(!x||typeof x!=='object')return;
  const name=str(master?(x.name||x.description):x.description||x.productName||x.name);
  if(!name)return;
  const key=norm(name),hsn=str(x.hsn),current=map.get(key);
  const data={name,code:str(x.code||x.productCode||x.item),hsn,
   moc:str(x.moc||x.cloth),micron:str(x.micron),size:str(x.size),
   unit:str(x.unit)};
  if(!current){map.set(key,{...data,master});return}
  if(master&&!current.master){map.set(key,{...data,master});ambiguous.delete(key);return}
  if(current.master&&!master)return;
  if(current.hsn&&hsn&&current.hsn!==hsn)ambiguous.add(key);
  if(!current.hsn&&hsn)current.hsn=hsn;
  for(const f of ['code','moc','micron','size','unit'])if(!current[f]&&data[f])current[f]=data[f];
 };
 for(const x of arr('products'))add(x,true);
 for(const k of docs)for(const doc of arr(k)){
  if(!isValid(doc))continue;
  const lines=Array.isArray(doc.items)&&doc.items.length?doc.items:[doc];
  for(const item of lines)add(item,false);
 }
 for(const k of ambiguous){const x=map.get(k);if(x&&!x.master)x.hsn=''}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
}
function optHTML(items,label){
 return '<option value="">'+esc(label)+'</option>'+
   items.map((x,i)=>'<option value="'+i+'">'+esc(x.name+(x.code?' — '+x.code:'')+(x.detail?.gstin?' — '+x.detail.gstin:''))+'</option>').join('');
}
const partyCache={customer:[],supplier:[]};
let productCache=[];
function partyRole(form){
 if(form.id==='axCustomerMasterForm'||form.id==='axProductHSNForm'||form.id==='axHSNForm'||form.id==='axFixSupplierBill'||form.id==='axEditSavedForm')return null;
 const title=str(document.querySelector('#modalBody > h2')?.textContent).toUpperCase();
 if(/SUPPLIER|PURCHASE/.test(title))return 'supplier';
 if(/PAYMENT|RECEIPT|VOUCHER|LEDGER|EXPENSE|CASH|BANK/.test(title))return null;
 if(/QUOTATION|SALES ORDER|INVOICE|CHALLAN/.test(title))return 'customer';
 return null;
}
function field(form,name){
 return form.elements?.namedItem(name)||null;
}
function fillParty(form,x){
 const info=x.detail||{};
 const values={party:x.name,gstin:str(info.gstin||info.f1),address:str(info.address||info.billingAddress),
  attention:str(info.attention||info.contactName),phone:str(info.phone||info.f2),
  email:str(info.email||info.f3),place:str(info.place||info.placeOfSupply)};
 for(const [key,value] of Object.entries(values)){
  const el=field(form,key);
  if(el&&value&&(key==='party'||!str(el.value))){
   el.value=value;
   el.dispatchEvent(new Event('input',{bubbles:true}));
  }
 }
}
function bindParty(form){
 const kind=partyRole(form),input=field(form,'party');
 if(!kind||!input||input.dataset.axSmartParty)return;
 input.dataset.axSmartParty='1';
 const values=savedNames(kind);
 partyCache[kind]=values;
 const dl=document.createElement('datalist');
 dl.id='axSmart'+kind+'-'+String(++uid);
 dl.innerHTML=values.map(x=>'<option value="'+esc(x.name)+'"></option>').join('');
 document.body.appendChild(dl);
 input.setAttribute('list',dl.id);
 input.setAttribute('autocomplete','off');
 input.placeholder=kind==='supplier'?'Choose saved supplier or type a new one':'Choose saved customer or type a new one';
 const parent=input.closest('label');
 if(!parent)return;
 // The existing Customer Master already provides a customer select; avoid duplicating it.
 if(kind==='supplier'&&!form.querySelector('.axSmartSupplierPicker')){
  const label=document.createElement('label');
  label.className='axSmartSupplierPicker';
  label.textContent='Saved Suppliers (search by typing below)';
  const select=document.createElement('select');select.innerHTML=optHTML(values,'Select existing supplier / enter a new name');
  label.appendChild(select);parent.before(label);
  select.addEventListener('change',()=>{
   const row=values[Number(select.value)];
   if(select.value!==''&&row)fillParty(form,row);
  });
 }
 input.addEventListener('change',()=>{
  const row=values.find(x=>norm(x.name)===norm(input.value));
  if(row)fillParty(form,row);
 });
}
function lookupProduct(value){
 const key=norm(value);
 return productCache.find(x=>norm(x.name)===key||x.code&&norm(x.code)===key)||null;
}
function getLineField(row,name){
 return row.querySelector('[data-field="'+name+'"],[data-key="'+name+'"],[name="'+name+'"]');
}
function fillProduct(input,product,fromSelect){
 const row=input.closest('.axMncLine,.axDocLine,.axEditItem')||input.form;
 if(!row||!product)return;
 const desc=getLineField(row,'description');
 if(fromSelect&&desc)desc.value=product.name;
 const fields={hsn:product.hsn,moc:product.moc,micron:product.micron,size:product.size,unit:product.unit,productCode:product.code};
 for(const [key,value] of Object.entries(fields)){
  const target=getLineField(row,key);
  if(target&&value&&(!str(target.value)||(key==='unit'&&target.value==='Nos'&&fromSelect))){
   target.value=value;
   target.dispatchEvent(new Event('input',{bubbles:true}));
  }
 }
 if(desc)desc.dispatchEvent(new Event('input',{bubbles:true}));
}
let uid=0;
function bindProduct(input){
 if(input.dataset.axSmartProduct)return;
 const form=input.form;
 if(!form||form.id==='axProductHSNForm'||form.id==='axHSNForm'||form.id==='axCustomerMasterForm'||form.id==='axEditSavedForm')return;
 const title=str(document.querySelector('#modalBody > h2')?.textContent).toUpperCase();
 if(!/QUOTATION|SALES ORDER|INVOICE|CHALLAN|PURCHASE|WORK ORDER/.test(title))return;
 input.dataset.axSmartProduct='1';
 productCache=products();
 const dl=document.createElement('datalist');dl.id='axSmartProduct-'+String(++uid);
 dl.innerHTML=productCache.map(x=>'<option value="'+esc(x.name)+'" label="'+esc(x.code)+'"></option>').join('');
 document.body.appendChild(dl);
 if(input.tagName==='INPUT')input.setAttribute('list',dl.id);
 const parent=input.closest('label');if(!parent)return;
 const label=document.createElement('label');
 label.className='axSmartProductPicker';
 label.textContent='Choose Saved Product (or enter a new one below)';
 const select=document.createElement('select');
 select.innerHTML=optHTML(productCache,'Select product name / code');
 label.appendChild(select);parent.before(label);
 select.addEventListener('change',()=>{
  if(select.value==='')return;
  const product=productCache[Number(select.value)];
  if(product)fillProduct(input,product,true);
 });
 input.addEventListener('change',()=>{
  const found=lookupProduct(input.value);
  if(found)fillProduct(input,found,false);
 });
}
function bind(){
 const root=document.getElementById('modalBody');if(!root)return;
 for(const form of root.querySelectorAll('form'))bindParty(form);
 for(const input of root.querySelectorAll('.axMncLine [data-field="description"],.axDocLine [data-field="description"],.axEditItem [data-key="description"],input[name="description"],textarea[name="description"]'))bindProduct(input);
}
const style=document.createElement('style');
style.textContent='.axSmartProductPicker,.axSmartSupplierPicker{display:block;min-width:0;padding:8px;border:1px solid #c7dfe5;border-radius:9px;background:#f3f9fc;color:#164d64;font-size:13px;font-weight:600}.axSmartProductPicker select,.axSmartSupplierPicker select{width:100%;min-height:42px;margin-top:7px;font-size:14px}';
document.head.appendChild(style);
function start(){
 bind();
 const root=document.getElementById('modalBody');
 if(root&&typeof MutationObserver!=='undefined')new MutationObserver(bind).observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.axSmartPickerStatus=function(){return {customers:savedNames('customer').length,suppliers:savedNames('supplier').length,products:products().length}};
})();