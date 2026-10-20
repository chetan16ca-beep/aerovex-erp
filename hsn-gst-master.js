/* Aerovex HSN to GST engine. Uses verified built-in headings and editable user HSN master. */
(function(){
'use strict';
const codes={
 '5911':{rate:5,description:'Textile products and articles for technical use',source:'GST Council 56th meeting, Sep 2025: 12% to 5%'},
 '8421':{rate:18,description:'Industrial filtering and purifying machinery',source:'Notification 09/2025 Central Tax (Rate), Schedule II'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=x=>String(x??'').replace(/\D/g,'').slice(0,8);
const round=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
function master(){return db.hsnGSTMaster&&typeof db.hsnGSTMaster==='object'&&!Array.isArray(db.hsnGSTMaster)?db.hsnGSTMaster:{}}
function lookup(value){
 const key=normalize(value);
 if(!key)return null;
 const custom=master();
 for(const n of [key,key.slice(0,6),key.slice(0,4)]){
  if(n.length<4)continue;
  if(Object.prototype.hasOwnProperty.call(custom,n)){
   const r=custom[n],rate=Number(typeof r==='object'?r.rate:r);
   if(Number.isFinite(rate)&&rate>=0&&rate<=40)return {code:n,rate,source:'Approved in Aerovex HSN Master',description:r.description||'',custom:true};
  }
 }
 const prefix=key.slice(0,4),def=codes[prefix];
 return def?{code:prefix,...def,custom:false}:null;
}
function compute(items,taxType){
 const category=String(taxType||'CGST+SGST').replace(/\s/g,'').toUpperCase();
 const exempt=category==='EXEMPT';
 const intrastate=category==='CGST+SGST'||category==='CGSTSGST';
 if(!['IGST','EXEMPT','CGST+SGST','CGSTSGST'].includes(category))throw Error('Unknown GST tax type: '+taxType);
 if(!Array.isArray(items)||!items.length)throw Error('Add at least one Product.');
 let taxable=0,gst=0,cgst=0,sgst=0,igst=0;
 const lines=items.map((x,i)=>{
  const hsn=normalize(x.hsn),selected=lookup(hsn),manual=x.gstRate;
  const hasManual=manual!==undefined&&manual!==null&&String(manual).trim()!=='';
  if(!hsn)throw Error('Product '+(i+1)+': HSN is required for auto GST. Add the correct HSN.');
  const value=selected?selected.rate:hasManual?Number(manual):NaN;
  if(!Number.isFinite(value)||value<0||value>40)throw Error('HSN '+hsn+' has no verified rate. Open HSN / GST Master or enter and verify this product rate.');
  const qty=Number(x.qty),rate=Number(x.rate),discount=Number(x.discount||0);
  if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(rate)||rate<0||!Number.isFinite(discount)||discount<0||discount>100)
    throw Error('Product '+(i+1)+': Check quantity, rate and discount.');
  const base=round(qty*rate*(1-discount/100));
  const tax=exempt?0:round(base*value/100);
  const taxCGST=exempt||!intrastate?0:round(tax/2);
  const taxSGST=exempt||!intrastate?0:round(tax-taxCGST);
  const taxIGST=category==='IGST'?tax:0;
  taxable=round(taxable+base);gst=round(gst+tax);
  cgst=round(cgst+taxCGST);sgst=round(sgst+taxSGST);igst=round(igst+taxIGST);
  return {...x,hsn,gstRate:value,taxable:base,gst:tax,cgst:taxCGST,sgst:taxSGST,igst:taxIGST,gstSource:selected?selected.source:'Manual rate: verify',gstType:category};
 });
 const rates=[...new Set(lines.map(x=>Number(x.gstRate)))];
 return {items:lines,taxable,gst,cgst,sgst,igst,total:round(taxable+gst),gstRate:rates.length===1?rates[0]:'Mixed HSN rates'};
}
window.axHSNGST={lookup,compute,normalize,round,defaults:codes};
const style=document.createElement('style');
style.textContent='.axGSTTag{font-size:12px;color:#195b78;font-weight:600;margin:3px 0 9px}.axGSTTag.warn{color:#ac4d11}.axGSTMasterRow{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin:8px 0;padding:12px;border:1px solid #dae5e9;border-radius:10px}.axGSTMasterRow small{display:block;color:#5b7180;margin-top:3px}.axGSTRateLabel input{max-width:115px}.axGSTInfo{color:#49697b;font-size:12px}.axGSTMasterAlert{padding:8px 12px;color:#984418;background:#fff7ee;border-radius:8px}';
document.head.append(style);
function setRate(hsnInput,rateInput,hint,clearUnknown){
 const found=lookup(hsnInput.value);
 if(found){
  rateInput.value=String(found.rate);
  rateInput.dataset.axRateSource=found.custom?'master':'official';
  hint.textContent='HSN '+normalize(hsnInput.value)+' → '+found.rate+'% GST ('+(found.custom?'HSN Master':'Verified heading')+')';
  hint.classList.remove('warn');
 }else{
  if(clearUnknown)rateInput.value='';
  rateInput.dataset.axRateSource='unverified';
  hint.textContent=normalize(hsnInput.value)?'HSN rate not in Master. Verify and enter GST rate for this product.':'Enter HSN to auto-fill GST';
  hint.classList.add('warn');
 }
}
function bindLine(row){
 if(row.dataset.axGSTBound)return;
 const hsn=row.querySelector('[data-field="hsn"],[data-key="hsn"]');
 if(!hsn)return;
 row.dataset.axGSTBound='1';
 let rate=row.querySelector('[data-field="gstRate"],[data-key="gstRate"]');
 if(!rate){
  const label=document.createElement('label');
  label.className='axGSTRateLabel';
  label.textContent='GST % from HSN';
  rate=document.createElement('input');rate.type='number';rate.step='0.01';rate.min='0';rate.max='40';
  rate.setAttribute('data-field',row.classList.contains('axEditItem')?'':'gstRate');
  rate.removeAttribute(row.classList.contains('axEditItem')?'data-field':'data-key');
  if(row.classList.contains('axEditItem'))rate.setAttribute('data-key','gstRate');
  label.append(rate);
  hsn.closest('label')?.after(label);
 }
 const hint=document.createElement('div');hint.className='axGSTTag';
 rate.closest('label')?.append(hint);
 const oldRate=rate.value;
 setRate(hsn,rate,hint,false);
 if(oldRate!==''&&!lookup(hsn.value))rate.value=oldRate;
 hsn.addEventListener('input',()=>setRate(hsn,rate,hint,true));
 rate.addEventListener('input',()=>{
  const found=lookup(hsn.value);
  if(found&&Number(rate.value)!==found.rate){
   hint.textContent='Master rate is '+found.rate+'%. Change HSN Master if classification/rate differs; calculated tax follows Master.';
   hint.classList.add('warn');
  }else if(!found){
   hint.textContent='Manual GST rate entered. Please verify the notification/classification.';
   hint.classList.add('warn');
  }
 });
}
function bindSingle(form){
 if(form.dataset.axGSTBound)return;
 const hsn=form.elements?.namedItem('hsn');
 if(!hsn)return;
 const rate=form.elements?.namedItem('gstPercent')||form.elements?.namedItem('gstRate');
 if(!rate)return;
 form.dataset.axGSTBound='1';
 const note=document.createElement('div');note.className='axGSTTag';
 hsn.closest('label')?.after(note);
 function update(clear){
  const found=lookup(hsn.value);
  if(found){
   rate.value=String(found.rate);
   note.textContent='HSN '+normalize(hsn.value)+' → GST '+found.rate+'%';
   note.classList.remove('warn');
  }else{
   if(clear)rate.value='';
   note.textContent='Unknown HSN: enter/verify GST or add to HSN Master';
   note.classList.add('warn');
  }
 }
 hsn.addEventListener('input',()=>update(true));update(false);
}
function bindProduct(form){
 if(form.dataset.axGSTBound)return;
 if(!form.elements?.namedItem('code')||!form.elements?.namedItem('micron'))return;
 form.dataset.axGSTBound='1';
 const create=(name,title)=>{const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.name=name;input.autocomplete='off';label.append(input);return label};
 const hsnLabel=create('hsn','Product HSN Code');const rateLabel=create('gstRate','Auto GST Rate (%)');
 rateLabel.querySelector('input').type='number';rateLabel.querySelector('input').readOnly=true;
 const button=form.querySelector('button.primary');
 if(button?.closest('.full'))button.closest('.full').before(hsnLabel,rateLabel);else form.append(hsnLabel,rateLabel);
 const hsn=hsnLabel.querySelector('input'),rate=rateLabel.querySelector('input');
 const hint=document.createElement('div');hint.className='axGSTTag';rateLabel.append(hint);
 hsn.addEventListener('input',()=>setRate(hsn,rate,hint,true));setRate(hsn,rate,hint,false);
 form.addEventListener('submit',e=>{
  if(hsn.value&&!lookup(hsn.value)){e.preventDefault();e.stopImmediatePropagation();alert('HSN rate not configured. Save correct rate in HSN / GST Master before saving Product.')}
 },true);
}
function bindAll(){
 const modal=document.getElementById('modalBody');if(!modal)return;
 for(const row of modal.querySelectorAll('.axDocLine,.axMncLine,.axEditItem'))bindLine(row);
 for(const form of modal.querySelectorAll('form')){if(form.id==='inv'||form.id==='axQuoteForm')bindSingle(form);bindProduct(form)}
}
function masterScreen(){
 const custom=master();
 const builtins=Object.keys(codes).map(code=>{
  const x=lookup(code);
  return '<div class="axGSTMasterRow"><div><b>HSN '+code+' — '+x.rate+'%</b><small>'+esc(x.description||'')+'</small><small>'+esc(x.source||'')+'</small></div><button type="button" data-code="'+code+'">Edit Rate</button></div>';
 }).join('');
 const entries=Object.keys(custom).filter(code=>!codes[code]).map(code=>{
  const x=lookup(code);
  if(!x)return '';
  return '<div class="axGSTMasterRow"><div><b>HSN '+esc(code)+' — '+x.rate+'%</b><small>'+esc(x.description||'Saved')+'</small></div><button type="button" data-code="'+esc(code)+'">Edit Rate</button><button type="button" data-delete="'+esc(code)+'">Remove</button></div>';
 }).join('');
 show('HSN / GST Master','<p>Auto GST based on HSN at product level. Verified example headings are preloaded; enter additional HSN rates only after checking the official notification or your CA. Unknown codes are never assigned 18% by default.</p>'+
 '<form id="axHSNMasterForm" class="form"><label>HSN (4, 6 or 8 digits)<input name="hsn" inputmode="numeric" pattern="[0-9]{4}([0-9]{2}([0-9]{2})?)?" required></label><label>GST Rate %<input type="number" step=".01" min="0" max="40" name="rate" required></label><label class="full">Product type / Source / Classification Note<input name="description" placeholder="Confirm with CBIC notification / CA" maxlength="200"></label><div class="full"><button type="submit" class="primary">Save HSN GST Rate</button></div></form>'+
 '<h3>HSN Rate List</h3>'+builtins+entries+
 '<p class="axGSTMasterAlert">HSN alone cannot prove every product classification or exemption. Verify the product description and latest rate before issuing a tax invoice.</p>'+
 '<p><a href="https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf" target="_blank" rel="noopener">GST Council 56th meeting (rates)</a> · <a href="https://cbic-gst.gov.in/gst-goods-services-rates.html" target="_blank" rel="noopener">CBIC rate schedule</a></p>');
 const form=document.getElementById('axHSNMasterForm');
 form.onsubmit=e=>{
  e.preventDefault();const raw=Object.fromEntries(new FormData(form)),hsn=normalize(raw.hsn),rate=Number(raw.rate);
  if(![4,6,8].includes(hsn.length)||!/^\d+$/.test(hsn)||!Number.isFinite(rate)||rate<0||rate>40)return alert('Enter HSN of 4/6/8 digits and GST rate between 0–40%.');
  if(!confirm('Save GST '+rate+'% for HSN '+hsn+'? Use only after verifying product classification and official rate.'))return;
  const before=db.hsnGSTMaster,next={...master(),[hsn]:{rate,description:String(raw.description||'').trim(),updatedAt:new Date().toISOString()}};
  db.hsnGSTMaster=next;
  try{save()}catch(error){db.hsnGSTMaster=before;return alert('HSN was NOT saved: '+error.message)}
  masterScreen();
 };
 for(const btn of document.querySelectorAll('#modalBody [data-code]'))btn.onclick=()=>{
  const code=btn.getAttribute('data-code'),found=lookup(code);
  form.elements.namedItem('hsn').value=code;
  form.elements.namedItem('rate').value=found?.rate??'';
  form.elements.namedItem('description').value=found?.description||'';
  form.scrollIntoView({block:'start',behavior:'smooth'});
 };
 for(const btn of document.querySelectorAll('#modalBody [data-delete]'))btn.onclick=()=>{
  const hsn=btn.getAttribute('data-delete');
  if(!confirm('Remove custom GST rate for HSN '+hsn+'?'))return;
  const before=db.hsnGSTMaster,next={...master()};
  delete next[hsn];db.hsnGSTMaster=next;
  try{save()}catch(error){db.hsnGSTMaster=before;return alert('Remove failed: '+error.message)}
  masterScreen();
 };
}
window.axHSNGSTMaster=masterScreen;
if(Array.isArray(modules.masters)&&!modules.masters.some(x=>x[0]==='HSN / GST Master'))
 modules.masters.unshift(['HSN / GST Master','Product-wise tax rates (5% / 18% etc)']);
const oldOpen=window.openModule;
window.openModule=function(name){if(name==='HSN / GST Master')return masterScreen();return oldOpen.apply(this,arguments)};
function start(){
 bindAll();
 const modal=document.getElementById('modalBody');
 if(modal&&typeof MutationObserver!=='undefined')new MutationObserver(bindAll).observe(modal,{childList:true,subtree:true});
 try{render()}catch(error){console.warn('HSN/GST tile',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
