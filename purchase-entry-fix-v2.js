/* Aerovex Purchase: supplier bill is the primary external reference.
   Additive and non-destructive: legacy records are not silently rewritten. */
(function(){
'use strict';
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round = v => Math.round((Number(v)+Number.EPSILON)*100)/100;
const fmt = v => (Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const clean = v => String(v||'').trim();
const key = v => clean(v).replace(/[\s\/-]+/g,'').toUpperCase();
function sameSupplier(a,party,gstin){
 return (gstin && key(a.gstin)===key(gstin)) || (key(a.party)!=='' && key(a.party)===key(party));
}
function duplicate(party,gstin,bill,exclude){
 return (db.purchases||[]).some((r,i)=>i!==exclude && key(r.supplierInvoice)!=='' && key(r.supplierInvoice)===key(bill) && sameSupplier(r,party,gstin));
}
function nextInternalId(){
 let max=0;
 for(const p of db.purchases||[]){
  const match=String(p.invoiceNo||p.documentNo||'').match(/^AFX\/PUR\/(\d+)$/i);
  if(match)max=Math.max(max,Number(match[1]));
 }
 return 'AFX/PUR/'+String(max+1).padStart(4,'0');
}
function fixPurchaseForm(){
 const form=document.getElementById('axDocForm');
 if(!form || form.dataset.axPurchaseFix==='yes')return;
 form.dataset.axPurchaseFix='yes';
 const no=form.elements.namedItem('documentNo');
 if(no){
  no.value=nextInternalId();
  no.readOnly=true;
  no.closest('label').firstChild.textContent='Internal Purchase ID (automatic)';
 }
 const label=document.createElement('label');
 label.innerHTML='Supplier Bill No. (as printed on supplier invoice)<input name="supplierInvoice" type="text" maxlength="80" required autocomplete="off" placeholder="e.g. AAT/26-27/40">';
 if(no)no.closest('label').after(label);else form.prepend(label);
 const off=document.createElement('label');
 off.innerHTML='Round Off (+ / -)<input name="roundOff" type="number" step="0.01" value="0">';
 const billTotal=document.createElement('label');
 billTotal.innerHTML='Supplier Printed Bill Total (₹)<input name="printedBillTotal" type="number" min="0" step="0.01" placeholder="Optional cross-check">';
 const terms=form.querySelector('[name="freight"]')?.closest('label');
 (terms||form.querySelector('[name="remarks"]')?.closest('label')||label).after(off,billTotal);
 form.onsubmit=function(event){
  event.preventDefault();
  const x=Object.fromEntries(new FormData(form));
  x.party=clean(x.party);x.supplierInvoice=clean(x.supplierInvoice);
  x.documentNo=clean(x.documentNo);x.invoiceNo=x.documentNo;
  x.gstin=clean(x.gstin).toUpperCase();
  if(!x.party || !x.supplierInvoice || !x.date){alert('Supplier, Supplier Bill No. and Bill Date are mandatory.');return;}
  if(!/^AFX\/PUR\/\d+$/i.test(x.documentNo)){alert('Invalid internal purchase ID.');return;}
  if(db.purchases.some(r=>r.documentNo===x.documentNo||r.invoiceNo===x.documentNo)){alert('Internal Purchase ID already exists. Reopen Purchase Entry to get next number.');return;}
  if(duplicate(x.party,x.gstin,x.supplierInvoice,-1)){alert('This supplier bill number is already saved for the supplier. Duplicate purchase blocked.');return;}
  const items=[...form.querySelectorAll('.axDocLine')].map(el=>{
   const get=n=>el.querySelector('[data-field="'+n+'"]')?.value||'';
   return {description:clean(get('description')),moc:clean(get('moc')),size:clean(get('size')),hsn:clean(get('hsn')),qty:Number(get('qty')),unit:clean(get('unit'))||'Nos',rate:Number(get('rate')),discount:Number(get('discount'))};
  }).filter(z=>z.description&&z.qty>0);
  if(!items.length){alert('Add at least one valid product.');return;}
  const tax=window.axHSNApplyLines(items,x.taxType);
  if(!tax.ok){alert(tax.error);return;}
  const rawOff=String(x.roundOff||'0');
  const offValue=Number(rawOff),printed=clean(x.printedBillTotal);
  if(!Number.isFinite(offValue)||Math.abs(offValue)>10000){alert('Invalid round-off.');return;}
  if(printed && (!Number.isFinite(Number(printed)) || Number(printed)<0)){alert('Invalid supplier bill total.');return;}
  const total=round(tax.total+offValue);
  if(total<0){alert('Final total cannot be negative.');return;}
  if(printed && Math.abs(total-Number(printed))>0.02){alert('Bill total mismatch. Check items, GST and round-off against supplier invoice before saving.');return;}
  Object.assign(x,tax);
  x.supplierInvoice=clean(x.supplierInvoice);
  x.roundOff=round(offValue);
  x.subTotal=round(tax.total);
  x.total=total;x.amount=total;
  x.ocrBillTotal=printed?Number(printed):null;
  x.items=tax.items;
  x.source=x.source||'purchase-entry';
  x.createdAt=new Date().toISOString();
  const voucherStart=Array.isArray(db.vouchers)?db.vouchers.length:0;
  db.purchases.push(x);
  if(typeof postV==='function')postV('Purchase',x.invoiceNo,x.date,x.party,0,x.total,x.remarks);
  try{
   save();
   const stored=JSON.parse(localStorage.getItem('aerovex-erp-data-v1')||'{}');
   if(!Array.isArray(stored.purchases)||!stored.purchases.some(p=>p.invoiceNo===x.invoiceNo&&p.supplierInvoice===x.supplierInvoice))throw Error('Purchase did not persist');
  }catch(err){
   db.purchases.pop();
   if(Array.isArray(db.vouchers))db.vouchers.splice(voucherStart);
   alert('Purchase NOT saved: '+String(err.message||err));return;
  }
  window.axDocPreview('Purchase',db.purchases.length-1);
 };
}
function improveSavedList(){
 const root=document.getElementById('axDocSaved');
 if(!root)return;
 const records=db.purchases||[];
 root.querySelectorAll('p').forEach((p,i)=>{
  const x=records[i];if(!x)return;
  const text=p.firstChild;
  if(text && text.nodeType===3)text.textContent=(clean(x.supplierInvoice)?'Supplier Bill: '+clean(x.supplierInvoice):'⚠ Supplier Bill No. missing')+' | Internal: '+clean(x.invoiceNo||x.documentNo||'—')+' — '+clean(x.party)+' ';
  if(!p.querySelector('.axCorrectSupplierBill')){
   const button=document.createElement('button');
   button.type='button';button.className='axCorrectSupplierBill';
   button.textContent='Correct Supplier Bill No.';
   button.onclick=()=>window.axCorrectSupplierBill(i);
   p.appendChild(button);
  }
 });
}
window.axCorrectSupplierBill=function(i){
 const x=db.purchases?.[i];if(!x)return;
 const ref=clean(x.invoiceNo||x.documentNo||'Legacy purchase');
 const value=clean(x.supplierInvoice);
 show('Correct Supplier Bill Number','<p><b>Internal Purchase ID:</b> '+esc(ref)+'</p><p><b>Supplier:</b> '+esc(x.party||'')+'</p><form id="axFixSupplierBill" class="form"><label class="full">Supplier Bill No. from original supplier invoice<input name="bill" required maxlength="80" value="'+esc(value)+'"></label><div class="full"><button type="submit" class="primary">Save Correct Bill No.</button></div></form><p>This updates only the supplier bill reference. Existing total, GST, items and voucher stay unchanged.</p>');
 const form=document.getElementById('axFixSupplierBill');
 form.onsubmit=e=>{
  e.preventDefault();
  const bill=clean(form.elements.bill.value);
  if(!bill){alert('Supplier bill number is required.');return;}
  if(duplicate(x.party,x.gstin,bill,i)){alert('This supplier bill already exists for the same supplier.');return;}
  if(value===bill){window.axDocPreview('Purchase',i);return;}
  if(!confirm('Change supplier bill number for '+ref+' to '+bill+'?'))return;
  const previous=x.supplierInvoice,history=Array.isArray(x.editHistory)?x.editHistory.slice():[];
  x.supplierInvoice=bill;
  x.editHistory=history.concat([{at:new Date().toISOString(),field:'supplierInvoice',previous:previous||''}]);
  try{save();}catch(error){x.supplierInvoice=previous;x.editHistory=history;alert('Update failed: '+error.message);return;}
  window.axDocPreview('Purchase',i);
 };
};
const oldDetailed=window.axDetailedDocument;
if(typeof oldDetailed==='function'){
 window.axDetailedDocument=function(type){
  const result=oldDetailed.apply(this,arguments);
  if(type==='Purchase'){fixPurchaseForm();improveSavedList();}
  return result;
 };
}
const oldPreview=window.axDocPreview;
if(typeof oldPreview==='function'){
 window.axDocPreview=function(type,i){
  const result=oldPreview.apply(this,arguments);
  if(type!=='Purchase')return result;
  const x=db.purchases?.[i];const paper=document.querySelector('#modalBody .axDocPaper');
  if(!x||!paper)return result;
  paper.querySelectorAll('.axExtraBankTerms,.axMSMEMaster').forEach(el=>el.remove());
  paper.classList.add('axSupplierPurchasePaper');
  const supplierBill=clean(x.supplierInvoice);
  const internal=clean(x.invoiceNo||x.documentNo||'—');
  const header=paper.querySelector('header');
  if(header){
   header.style.cssText+=';height:auto!important;min-height:0!important;position:static!important;display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)!important;gap:16px!important;align-items:start!important;padding:10px 0!important;';
   const heads=header.children;
   const right=heads[1];
   if(right){
    right.innerHTML='<h2>SUPPLIER PURCHASE ENTRY</h2><p style="margin:6px 0"><b>Supplier Bill No.:</b><br><strong style="font-size:17px;overflow-wrap:anywhere">'+esc(supplierBill||'NOT ENTERED — CORRECTION REQUIRED')+'</strong></p><p style="margin:5px 0;font-size:11px"><b>Internal Purchase ID:</b> '+esc(internal)+'</p><p style="margin:5px 0"><b>Bill Date:</b> '+esc(x.date||'')+'</p>';
   }
  }
  const para=paper.querySelector('header + p');
  if(para)para.innerHTML='<b>Supplier:</b> '+esc(x.party||'')+'<br>'+esc(x.address||'')+'<br><b>Supplier GSTIN:</b> '+esc(x.gstin||'')+(x.ref?'<br><b>Reference:</b> '+esc(x.ref):'');
  const totals=paper.querySelector('.totals');
  if(totals){
   const grand=totals.querySelector('h2');
   if(grand){
    grand.textContent='Grand Total: ₹ '+fmt(x.total??x.amount);
    const subtotal=document.createElement('div');
    subtotal.innerHTML='<b>Before Round Off:</b> ₹ '+fmt(x.subTotal??round(Number(x.taxable||0)+Number(x.gst||0)))+'<br><b>Round Off:</b> ₹ '+fmt(x.roundOff??0);
    grand.before(subtotal);
   }
  }
  const style=document.createElement('style');
  style.textContent='.axSupplierPurchasePaper header{height:auto!important;min-height:0!important;position:static!important;display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)!important;gap:16px!important;align-items:start!important;padding:10px 0!important}.axSupplierPurchasePaper header>div{min-width:0!important;overflow-wrap:anywhere!important;line-height:1.45!important}.axSupplierPurchasePaper header h1{font-size:18px!important;line-height:1.25!important}.axSupplierPurchasePaper header h2{font-size:16px!important;line-height:1.25!important}.axSupplierPurchasePaper table{width:100%;table-layout:fixed;border-collapse:collapse}.axSupplierPurchasePaper td,.axSupplierPurchasePaper th{overflow-wrap:anywhere!important}@media print{.axSupplierPurchasePaper header{height:auto!important;position:static!important;break-inside:avoid!important}}';
  paper.prepend(style);
  const actions=document.querySelector('#modalBody .axDocActions:last-child');
  if(actions&&!actions.querySelector('.axCorrectSupplierBill')){
   const b=document.createElement('button');b.type='button';b.className='axCorrectSupplierBill';
   b.textContent='Correct Supplier Bill No.';b.onclick=()=>window.axCorrectSupplierBill(i);
   actions.appendChild(b);
  }
  return result;
 };
}
})();