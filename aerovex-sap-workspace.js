/* Aerovex enterprise documents and address entry v1
 * Visual/entry extension. No migration and no changes to old saved records.
 * Sales Order and Delivery Challan price confidentiality is unchanged.
 */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const s=v=>String(v??'').trim();
const amount=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>amount(v)===null?'Not recorded':'₹ '+amount(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const get=(x,...keys)=>{for(const k of keys)if(s(x?.[k]))return s(x[k]);return ''};
const logo=()=>{const data=window.axSAPLogoFix?.current?.()||localStorage.getItem('aerovex-logo-data')||'';return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)?'<img class="axSapLogo" alt="Aerovex Filtration" src="'+esc(data)+'">':''};
const hasLogo=()=>!!logo();
const company=()=>db.companySettings&&typeof db.companySettings==='object'?db.companySettings:{};
function entries(record){return Array.isArray(record.items)&&record.items.length?record.items:[record]}
function docLabel(t){return t==='quotation'?'SALES QUOTATION':t==='purchaseOrder'?'PURCHASE ORDER':t==='salesOrder'?'SALES ORDER':t==='deliveryChallan'?'DELIVERY CHALLAN':'TAX INVOICE'}
function identifier(x,t,i){return get(x,'quotationNo','documentNo','invoiceNo','poNo','orderNo','no')||('Legacy '+docLabel(t)+' #'+(i+1))}
function group(k){return k==='quotation'?'quotations':k==='purchaseOrder'?'purchaseOrders':k==='salesOrder'?'salesOrders':k==='deliveryChallan'?'challans':'invoices'}
function numberFormat(x){return amount(x)===null?'—':money(x)}
function totals(x){
 const tax=s(x.taxType).replace(/\s+/g,'').toUpperCase();
 let taxes='';
 const gst=amount(x.gst);
 if(tax==='EXEMPT')taxes='<div class="axSAPSumRow"><span>GST</span><b>Exempt (saved)</b></div>';
 else if(tax==='IGST')taxes='<div class="axSAPSumRow"><span>IGST</span><b>'+money(x.igst??x.gst)+'</b></div>';
 else if(tax==='CGST+SGST'&&gst!==null)taxes='<div class="axSAPSumRow"><span>CGST</span><b>'+money(x.cgst??gst/2)+'</b></div><div class="axSAPSumRow"><span>SGST</span><b>'+money(x.sgst??gst/2)+'</b></div>';
 else taxes='<div class="axSAPSumRow"><span>GST</span><b>Verify saved tax values</b></div>';
 return '<div class="axSAPSummary"><div class="axSAPSumRow"><span>Taxable Value</span><b>'+money(x.taxable)+'</b></div>'+taxes+
 '<div class="axSAPGrand"><span>GRAND TOTAL</span><strong>'+money(x.total??x.amount)+'</strong></div></div>';
}
function itemTable(x,hideCommercial=false){
 const rows=entries(x).map((z,i)=>{
  const q=amount(z.qty),r=amount(z.rate),d=amount(z.discount)||0;
  // Line values are derived only for display, while grand total uses saved ERP fields.
  const base=amount(z.taxable??z.amount);
  const line=base!==null?money(base):q!==null&&r!==null?money(q*r*(1-d/100)):'Not recorded';
  return '<tr><td>'+String((i+1)*10).padStart(4,'0')+'</td><td><b>'+esc(get(z,'description','name')||'Description not recorded')+'</b>'+
  '<small>'+[['MOC',z.moc],['MICRON',z.micron],['SIZE',z.size]].filter(v=>s(v[1])).map(v=>esc(v[0])+': '+esc(v[1])).join(' / ')+'</small></td>'+
  '<td>'+esc(get(z,'hsn')||get(x,'hsn')||'—')+'</td><td>'+esc(z.qty??'—')+'</td><td>'+esc(get(z,'unit')||get(x,'unit')||'—')+'</td>'+
  (hideCommercial?'':'<td>'+numberFormat(z.rate)+'</td><td>'+line+'</td>')+'</tr>';
 }).join('');
 return '<table class="axSAPDocTable'+(hideCommercial?' axSAPPrivateTable':'')+'"><thead><tr><th>ITEM</th><th>MATERIAL / DESCRIPTION</th><th>HSN / SAC</th><th>QTY</th><th>UOM</th>'+(hideCommercial?'':'<th>NET RATE</th><th>NET VALUE</th>')+'</tr></thead><tbody>'+rows+'</tbody></table>';
}
function addressBox(title,name,address,gstin,contact,extra=''){
 const missing='<span class="axSapMissing">Not recorded — complete address before issuing</span>';
 return '<section class="axSAPAddress"><h3>'+esc(title)+'</h3><div class="axSapAddressContents"><b>'+esc(name||'—')+'</b><div class="axSAPMultiline">'+(s(address)?esc(address):missing)+'</div>'+
 (s(gstin)?'<div>GSTIN: '+esc(gstin)+'</div>':'')+(s(contact)?'<div>ATTN: '+esc(contact)+'</div>':'')+extra+'</div></section>';
}
function bank(){const v=company(),parts=[['Bank',v.bankName],['Account Name',v.accountName],['Account No.',v.accountNo],['IFSC',v.ifsc],['Branch',v.branch]].filter(x=>s(x[1]));return parts.length?'<div class="axSapBank"><h3>BANK DETAILS</h3>'+parts.map(p=>'<div><span>'+esc(p[0])+'</span><b>'+esc(p[1])+'</b></div>').join('')+'</div>':''}
function printBody(type,rec,i){
 const x=rec,v=company(),doc=identifier(x,type,i),hideCommercial=type==='deliveryChallan'||type==='salesOrder';
 const seller='<div class="axSAPCompany">'+logo()+'<div>'+(hasLogo()?'':'<h1>AEROVEX FILTRATION</h1>')+'<small>Smart Filtration Solutions</small><div>GSTIN: '+esc(get(v,'gstin','companyGstin')||'24BPCPB7271L1ZW')+'</div>'+(get(v,'msmeNo','udyam')?'<div>MSME: '+esc(get(v,'msmeNo','udyam'))+'</div>':'')+(get(v,'phone','email')?'<div>'+esc([get(v,'phone','mobile'),get(v,'email','companyEmail')].filter(Boolean).join(' · '))+'</div>':'')+'</div></div>';
 const billAddress=get(x,'billToAddress','billingAddress','address');
 const shipAddress=get(x,'shipToAddress','shippingAddress','deliveryAddress','deliveryLocation');
 const partnerName=get(x,'billToName','party','customerName','name');
 const shipName=get(x,'shipToName')||(type==='purchaseOrder'?'AEROVEX FILTRATION':partnerName);
 let blocks='';
 if(type==='purchaseOrder'){
  blocks=addressBox('SUPPLIER / ORDER TO',get(x,'party','supplierName'),get(x,'vendorAddress','supplierAddress','address'),get(x,'gstin'),get(x,'attention'))+
   addressBox('BILL TO',get(x,'billToName')||'AEROVEX FILTRATION',get(x,'billToAddress')||get(v,'address','companyAddress'),get(x,'billToGstin')||get(v,'gstin','companyGstin'),get(x,'billToContact'))+
   addressBox('SHIP TO / DELIVERY',shipName,shipAddress,get(x,'shipToGstin'),get(x,'shipToContact'));
 }else{
  blocks=addressBox('BILL TO / SOLD-TO PARTY',partnerName,billAddress,get(x,'billToGstin','gstin'),get(x,'billToContact','attention'))+
   addressBox('SHIP TO / DELIVERY',shipName,shipAddress,get(x,'shipToGstin'),get(x,'shipToContact','attention'));
 }
 let conditions=(hideCommercial?[['Delivery Terms',x.delivery],['Dispatch Instructions',x.shippingInstructions||x.dispatchInstructions]]:[['Payment Terms',x.payment],['Delivery Terms',x.delivery],['Freight',x.freight],['Packing',x.packing],['Warranty',x.warranty],['Remarks',x.remarks]]).filter(z=>s(z[1])).map(z=>'<div class="axSAPTerm"><b>'+esc(z[0])+':</b> '+esc(z[1])+'</div>').join('');
 if(!conditions)conditions='<span class="axSapMissing">Commercial terms not recorded</span>';
 return '<article class="axSAPDocument" data-ax-sap-type="'+esc(type)+'"><header class="axSAPDocumentHead">'+seller+
 '<div class="axSAPDocIdentity"><small>ENTERPRISE COMMERCIAL DOCUMENT</small><h2>'+esc(docLabel(type))+'</h2><strong>'+esc(doc)+'</strong></div></header>'+
 '<div class="axSAPDocMeta">'+[['DOCUMENT NUMBER',doc],['DOCUMENT DATE',x.date],['PO / RFQ REFERENCE',get(x,'poRef','ref')],['PLACE OF SUPPLY',x.place]].map(p=>'<div><small>'+esc(p[0])+'</small><b>'+esc(p[1]||'—')+'</b></div>').join('')+'</div>'+
 '<div class="axSAPAddressGrid '+(type==='purchaseOrder'?'axSAPTriple':'')+'">'+blocks+'</div>'+
 '<div class="axSAPBar"><strong>10 · MATERIAL & SERVICE OVERVIEW</strong><span>'+entries(x).length+' LINE(S)</span></div>'+
 '<div class="axSAPTableScroll">'+itemTable(x,hideCommercial)+'</div>'+
 (hideCommercial?'<div class="axSAPBottom axSAPNoCommercial"><div><h3>20 · ORDER / DISPATCH TERMS</h3><div class="axSAPTerms">'+conditions+'</div></div><div><h3>30 · DISPATCH REFERENCE</h3><div>Reference: '+esc(get(x,'ref','poRef','sourceSalesOrder')||'—')+'</div><div>Document: '+esc(doc)+'</div><div>Quantities are shown without commercial prices.</div></div></div>':'<div class="axSAPBottom"><div><h3>20 · COMMERCIAL TERMS</h3><div class="axSAPTerms">'+conditions+'</div>'+bank()+'</div><div><h3>30 · PRICING & TAX</h3>'+totals(x)+'</div></div>')+
 '<div class="axSAPEnd"><div class="axSAPVerify">'+(hideCommercial?'Please verify the saved items, quantities and delivery address before issue.':'Values are displayed from the saved ERP document. Verify HSN, GST and addresses before issuing.')+'</div><div class="axSAPSign"><b>For AEROVEX FILTRATION</b><div class="axSAPSignSpace"></div><span>Authorized Signatory</span></div></div></article>';
}
let active=null;
function preview(type,index){
 const key=group(type),entry=Array.isArray(db[key])?db[key][index]:null;
 if(!entry)return alert('Saved '+docLabel(type)+' record not available.');
 active={type,index};
 const markup=printBody(type,entry,index);
 const workflows=type==='deliveryChallan'?'<button type="button" id="axSAPFromChallan">Create Bill / Tax Invoice</button>':type==='salesOrder'?'<button type="button" id="axSAPFromSOChallan">Create Delivery Challan</button> <button type="button" id="axSAPFromSOInvoice">Create Tax Invoice</button>':'';
 show(docLabel(type)+' — SAP Preview','<div class="axSAPDocActions"><button type="button" id="axSAPPrintButton" class="primary">Print / Save PDF</button> '+workflows+' <button type="button" id="axSAPBackButton">Close Preview</button></div><div class="axSAPDocViewport">'+markup+'</div>');
 window.axSAPLogoFix?.apply?.(document.querySelector('.axSAPDocViewport'));
 const invoiceAction=document.getElementById('axSAPFromChallan');
 if(invoiceAction)invoiceAction.onclick=()=>{if(typeof window.axBillFromChallan==='function')window.axBillFromChallan(index)};
 const dcAction=document.getElementById('axSAPFromSOChallan');
 if(dcAction)dcAction.onclick=()=>{if(typeof window.axFromSalesOrder==='function')window.axFromSalesOrder(index,'challan')};
 const soInvoiceAction=document.getElementById('axSAPFromSOInvoice');
 if(soInvoiceAction)soInvoiceAction.onclick=()=>{if(typeof window.axFromSalesOrder==='function')window.axFromSalesOrder(index,'invoice')};
 const btn=document.getElementById('axSAPPrintButton'),back=document.getElementById('axSAPBackButton');
 if(btn)btn.onclick=print;
 if(back)back.onclick=()=>{if(typeof closeModal==='function')closeModal()};
}
function print(){
 if(!active)return;
 const x=db[group(active.type)]?.[active.index];if(!x)return alert('Saved record not found.');
 const w=window.open('','_blank');if(!w)return alert('Please allow popups for Print / Save PDF.');
 const uri=new URL('aerovex-sap-documents.css?v=2',document.baseURI).href;
 const no=identifier(x,active.type,active.index);
 // Open synchronously from the user click; wait only for logo conversion,
 // so the saved original logo is never overwritten and popup blockers stay off.
 const write=()=>{
  if(w.closed)return;
  w.addEventListener('load',()=>{w.focus();w.print()},{once:true});
  w.document.open();
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(no)+'</title><link rel="stylesheet" href="'+esc(uri)+'"></head><body>'+printBody(active.type,x,active.index)+'</body></html>');
  w.document.close();
 };
 const task=window.axSAPLogoFix?.prepare?.();
 if(task&&typeof task.then==='function')task.then(write,write);
 else write();
}
function appendAddressFields(form,mode){
 if(!form||form.dataset.axSapAddressReady==='1')return;
 const anchor=form.querySelector('.full')||form.querySelector('[name="remarks"]')?.closest('label');
 if(!anchor)return;
 const container=document.createElement('div');container.className='axSAPAddressFields';
 const isPo=mode==='purchaseOrder';
 const fields=[
 ['billToName',isPo?'Bill To — Company Name':'Bill To — Customer Name','input'],
 ['billToAddress','Bill To — Full Billing Address','textarea'],
 ['billToGstin','Bill To — GSTIN','input'],
 ['billToContact','Bill To — Contact / Attention','input'],
 ['shipToName','Ship To — Delivery Company / Site','input'],
 ['shipToAddress','Ship To — Full Delivery Address','textarea'],
 ['shipToGstin','Ship To — GSTIN (if different)','input'],
 ['shipToContact','Ship To — Contact / Attention','input']];
 const h=document.createElement('div');h.className='axSAPAddressTitle';h.textContent='SAP DOCUMENT ADDRESSES · BILL TO / SHIP TO';
 const hint=document.createElement('div');hint.className='axSAPAddressHint';hint.textContent=isPo?'Purchase Order: Supplier is the ordered-from party; Bill To and Ship To refer to your company and delivery location.':'Billing and shipping addresses are separate. A missing Ship To will not be invented or copied automatically.';
 anchor.before(h);anchor.before(hint);
 const recordName=form.querySelector('[name="party"]')?.value||'';
 for(const [key,label,type]of fields){
  if(form.querySelector('[name="'+key+'"]'))continue;
  const wrapper=document.createElement('label');if(type==='textarea')wrapper.className='full';
  wrapper.textContent=label;
  const input=document.createElement(type);
  input.name=key;input.autocomplete='off';
  if(type==='textarea')input.rows=3;
  if(key==='billToName'&&!isPo)input.value=recordName;
  if(key==='billToName'&&isPo)input.value='AEROVEX FILTRATION';
  wrapper.appendChild(input);
  anchor.before(wrapper);
 }
 form.dataset.axSapAddressReady='1';
 // FormData(this) already includes the new named fields. No existing handler replaced.
}
function fillAddressEditor(form,original){
 if(!form||form.dataset.axSapAddressReady==='1')return;
 appendAddressFields(form,'edit');
 for(const name of ['billToName','billToAddress','billToGstin','billToContact','shipToName','shipToAddress','shipToGstin','shipToContact']){
  const el=form.querySelector('[name="'+name+'"]');
  if(el&&s(original[name]))el.value=original[name];
 }
}
// Wrap only display/entry points. Never update db here.
const oldQuote=window.axCorporateQuotation;
if(typeof oldQuote==='function')window.axCorporateQuotation=function(){const out=oldQuote.apply(this,arguments);appendAddressFields(document.getElementById('axMncQuote')||document.getElementById('axQuoteForm'),'quotation');return out};
const oldDetailed=window.axDetailedDocument;
if(typeof oldDetailed==='function')window.axDetailedDocument=function(t){const out=oldDetailed.apply(this,arguments);if(['Purchase Order','Sales Invoice','Delivery Challan','Sales Order / PO'].includes(t))appendAddressFields(document.getElementById('axDocForm'),t==='Purchase Order'?'purchaseOrder':t==='Delivery Challan'?'deliveryChallan':t==='Sales Order / PO'?'salesOrder':'invoice');return out};
const oldInvoiceForm=window.invoiceForm;
if(typeof oldInvoiceForm==='function')window.invoiceForm=function(){const out=oldInvoiceForm.apply(this,arguments);appendAddressFields(document.querySelector('#modalBody form.form'),'invoice');return out};
const oldEdit=window.axEditSavedDocument;
if(typeof oldEdit==='function')window.axEditSavedDocument=function(key,i){const out=oldEdit.apply(this,arguments);if(['quotations','invoices','purchaseOrders'].includes(key))fillAddressEditor(document.getElementById('axEditSavedForm'),db[key]?.[i]||{});return out};
window.axQuotationPreview=function(i){return preview('quotation',i)};
const oldDocPreview=window.axDocPreview;
window.axDocPreview=function(t,i){
 if(t==='Quotation')return preview('quotation',i);
 if(t==='Purchase Order')return preview('purchaseOrder',i);
 if(t==='Sales Invoice')return preview('invoice',i);
 if(t==='Sales Order / PO')return preview('salesOrder',i);
 if(t==='Delivery Challan')return preview('deliveryChallan',i);
 return typeof oldDocPreview==='function'?oldDocPreview.apply(this,arguments):undefined;
};
window.axPrintInvoice=function(i){return preview('invoice',i)};
const oldPrintRecord=window.axPrintRecord;
window.axPrintRecord=function(key,i){
 if(key==='quotations')return preview('quotation',i);
 if(key==='invoices')return preview('invoice',i);
 if(key==='purchaseOrders')return preview('purchaseOrder',i);
 if(key==='salesOrders')return preview('salesOrder',i);
 if(key==='challans')return preview('deliveryChallan',i);
 return typeof oldPrintRecord==='function'?oldPrintRecord.apply(this,arguments):undefined;
};
window.axSAPOpenDocument=preview;
window.axSAPPrintCurrent=print;
// SAP is now the only active commercial print layout; retired Theme Studio is not loaded.
function install(){
 const quick=document.getElementById('quick');if(!quick||quick.querySelector('#axSAPNewPO'))return;
 const button=document.createElement('button');button.id='axSAPNewPO';button.type='button';button.textContent='＋ New Purchase Order';
 button.onclick=()=>{if(typeof window.axDetailedDocument==='function')window.axDetailedDocument('Purchase Order')};
 quick.appendChild(button);
}
const previousRender=window.render;
if(typeof previousRender==='function')window.render=function(){const result=previousRender.apply(this,arguments);install();return result};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
