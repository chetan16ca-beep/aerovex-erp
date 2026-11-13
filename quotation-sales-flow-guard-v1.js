/* Aerovex guarded document flow: Quotation -> Sales Order -> Delivery Challan -> GST Invoice.
   New Sales Order creation never bypasses a saved quotation.
   Printed Sales Orders/Challans hide financial columns; saved rates/taxes remain untouched. */
(function(){
'use strict';
const KEY='aerovex-erp-data-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=k=>Array.isArray(db[k])?db[k]:[];
const norm=v=>String(v??'').trim().toUpperCase();
const docId=x=>String(x?.documentNo||x?.orderNo||'').trim();
const quoteId=x=>String(x?.quotationNo||'').trim();
const today=()=>new Date().toLocaleDateString('en-CA');
const fmt=v=>Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const btn=(label,action)=>'<button type="button" data-flow-action="'+action+'">'+esc(label)+'</button>';
const style=document.createElement('style');
style.textContent='#kpis .kpi{cursor:pointer;transition:box-shadow .12s ease}#kpis .kpi:focus-visible{outline:3px solid #1976b8;outline-offset:2px}#kpis .kpi:hover{box-shadow:0 3px 14px #18455a26}.axFlowTable{width:100%;border-collapse:collapse}.axFlowTable th,.axFlowTable td{border:1px solid #d9e2ea;padding:8px;text-align:left;overflow-wrap:anywhere}.axFlowTable th{background:#eef5fa}.axFlowInfo{font-size:13px;color:#536776}.axFlowActions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}';
document.head.append(style);
function convertedIndex(q,i){
 const id=quoteId(q);
 return arr('salesOrders').findIndex(x=>
   (id&&norm(x.sourceQuotation)===norm(id)) ||
   (Number.isInteger(x.sourceQuotationIndex)&&x.sourceQuotationIndex===i)
 );
}
function nextOrderNo(){
 const re=/^AFX\/SO\/(\d+)$/i;
 let max=0;
 arr('salesOrders').forEach(x=>{const m=docId(x).match(re);if(m)max=Math.max(max,Number(m[1]))});
 let n=max+1,s='';
 do{s='AFX/SO/'+String(n++).padStart(3,'0')}while(arr('salesOrders').some(x=>norm(docId(x))===norm(s)));
 return s;
}
function quoteLines(q){
 const list=Array.isArray(q.items)&&q.items.length?q.items:[q];
 return list.map(x=>({
  description:String(x.description||'').trim(),moc:x.moc||'',micron:x.micron||'',size:x.size||'',hsn:x.hsn||'',
  qty:Number(x.qty),unit:x.unit||'Nos',rate:Number(x.rate),discount:Number(x.discount||0)
 }));
}
window.axCreateSalesOrderFromQuote=function(index){
 const q=arr('quotations')[index];
 if(!q)return alert('Quotation not found. No document saved.');
 const qno=quoteId(q);
 if(!qno)return alert('Quotation number missing. Add/verify it before conversion.');
 if(!String(q.party||'').trim())return alert('Customer name missing in quotation.');
 if(q.currency&&norm(q.currency)!=='INR')return alert('Please verify foreign-currency quotation before creating an INR Sales Order.');
 if(convertedIndex(q,index)>=0)return alert('Sales Order already exists for this quotation. Open the linked Sales Order instead.');
 const lines=quoteLines(q);
 if(!lines.length||lines.some(x=>!x.description||!Number.isFinite(x.qty)||x.qty<=0||!Number.isFinite(x.rate)||x.rate<0||!Number.isFinite(x.discount)||x.discount<0||x.discount>100))
  return alert('Quotation items have missing description, invalid quantity, rate or discount. Correct the quotation first.');
 if(typeof window.axHSNApplyLines!=='function')return alert('HSN/GST validation unavailable. Nothing saved.');
 const taxType=q.taxType||'CGST+SGST';
 const tax=window.axHSNApplyLines(lines,taxType);
 if(!tax||!tax.ok)return alert('HSN/GST verification: '+(tax?.error||'Unable to calculate tax')+'. No Sales Order saved.');
 const number=nextOrderNo();
 if(!confirm('Create Sales Order '+number+' from saved Quotation '+qno+' for '+q.party+'? Rates remain stored internally; Sales Order print hides prices.'))return;
 // Revalidate the stored snapshot: do not overwrite newer data from another tab/sync.
 const current=localStorage.getItem(KEY);
 let next;try{next=JSON.parse(current||'{}')}catch(e){return alert('Saved ERP data unreadable; nothing changed.')}
 if(!Array.isArray(next.quotations)||!Array.isArray(next.salesOrders)||
    JSON.stringify(next.quotations)!==JSON.stringify(arr('quotations'))||
    JSON.stringify(next.salesOrders)!==JSON.stringify(arr('salesOrders')))
  return alert('ERP data changed during conversion. Reload and retry to avoid duplicate or lost records.');
 if(next.salesOrders.some(x=>norm(x.sourceQuotation)===norm(qno)||norm(docId(x))===norm(number)))
  return alert('Duplicate linked order/number detected. Nothing saved.');
 const so={
  documentNo:number,date:today(),party:q.party,attention:q.attention||'',gstin:q.gstin||'',
  address:q.address||'',ref:q.poRef||q.ref||qno,place:q.place||'',payment:q.payment||'',
  delivery:q.delivery||'',deliveryLocation:q.deliveryLocation||'',freight:q.freight||'',
  warranty:q.warranty||'',remarks:q.remarks||'',currency:'INR',status:'Open',
  taxType,sourceQuotation:qno,sourceQuotationIndex:index,sourceQuotationDate:q.date||'',
  items:tax.items,taxable:tax.taxable,gst:tax.gst,sgst:tax.sgst,cgst:tax.cgst,
  igst:tax.igst,total:tax.total,amount:tax.amount,gstRate:tax.gstRate,gstBreakup:tax.gstBreakup
 };
 next.salesOrders.push(so);
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(error){return alert('Storage error: '+error.message+'. No Sales Order saved.')}
 db.salesOrders.push(so);
 if(typeof window.axDocPreview==='function')window.axDocPreview('Sales Order / PO',db.salesOrders.length-1);
 else alert('Sales Order '+number+' saved. Open Sales Order to view.');
};
window.axQuotationToOrderList=function(){
 const quotes=arr('quotations');
 let html='<p class="axFlowInfo">Step 1: Save a Quotation. Step 2: Convert it to exactly one Sales Order. Step 3: Create Delivery Challan. Step 4: Create GST Invoice from Challan only.</p>'+
  '<div class="axFlowActions"><button type="button" id="axNewQuoteFromFlow" class="primary">＋ New Quotation</button></div>';
 html+='<div style="overflow-x:auto"><table class="axFlowTable"><thead><tr><th>Quotation</th><th>Customer</th><th>Status / Action</th></tr></thead><tbody>';
 quotes.forEach((q,i)=>{
  const j=convertedIndex(q,i);
  html+='<tr><td>'+esc(quoteId(q)||'Missing quotation number')+'</td><td>'+esc(q.party||'')+'</td><td>'+
   (j>=0?'<button type="button" data-order-preview="'+j+'">Open Sales Order</button>':
    '<button type="button" data-quote-convert="'+i+'">Create Sales Order</button>')+'</td></tr>';
 });
 html+='</tbody></table></div>';
 if(!quotes.length)html+='<p>No quotation saved yet. Create a quotation first.</p>';
 show('Quotation → Sales Order',html);
 const root=document.getElementById('modalBody');
 root.querySelector('#axNewQuoteFromFlow')?.addEventListener('click',()=>window.axCorporateQuotation());
 root.querySelectorAll('[data-quote-convert]').forEach(b=>b.addEventListener('click',()=>window.axCreateSalesOrderFromQuote(Number(b.dataset.quoteConvert))));
 root.querySelectorAll('[data-order-preview]').forEach(b=>b.addEventListener('click',()=>window.axDocPreview('Sales Order / PO',Number(b.dataset.orderPreview))));
};
const oldOpen=window.openModule;
window.openModule=function(name){
 if(name==='New Sales Order'||name==='Sales Order / PO')return window.axQuotationToOrderList();
 return oldOpen.apply(this,arguments);
};
const originalQuotePreview=window.axQuotationPreview;
if(typeof originalQuotePreview==='function')window.axQuotationPreview=function(index){
 const result=originalQuotePreview.apply(this,arguments);
 const box=document.getElementById('modalBody');
 if(!box||!box.querySelector('.axQuotePrint'))return result;
 const q=arr('quotations')[index];if(!q)return result;
 const j=convertedIndex(q,index);
 const bar=document.createElement('div');bar.className='axFlowActions';
 const button=document.createElement('button');button.type='button';button.className='primary';
 button.textContent=j>=0?'Open Linked Sales Order':'Create Sales Order from Quotation';
 button.addEventListener('click',()=>j>=0?window.axDocPreview('Sales Order / PO',j):window.axCreateSalesOrderFromQuote(index));
 bar.append(button);box.append(bar);
 return result;
};
const oldCorporate=window.axCorporateQuotation;
if(typeof oldCorporate==='function')window.axCorporateQuotation=function(){
 const result=oldCorporate.apply(this,arguments);
 const form=document.getElementById('axMncQuote'),box=document.getElementById('modalBody');
 if(form&&box&&!box.querySelector('#axOpenQuoteToSO')){
  const button=document.createElement('button');button.type='button';button.id='axOpenQuoteToSO';
  button.textContent='View Quotations → Sales Orders';
  button.onclick=()=>window.axQuotationToOrderList();
  box.insertBefore(button,form);
 }
 return result;
};
const oldDocPreview=window.axDocPreview;
if(typeof oldDocPreview==='function')window.axDocPreview=function(type,index){
 const result=oldDocPreview.apply(this,arguments);
 const box=document.getElementById('modalBody');
 if(!box)return result;
 if(type==='Sales Order / PO'){
  // Do not offer direct Invoice creation; strict path requires Delivery Challan first.
  box.querySelectorAll('.axDocActions button').forEach(b=>{
   if(/Create Tax Invoice/i.test(b.textContent||''))b.remove();
  });
 }
 if(type==='Sales Order / PO'||type==='Delivery Challan'){
  const paper=box.querySelector('.axDocPaper');
  if(paper){
   paper.querySelectorAll('table tr').forEach(row=>{
    Array.from(row.children).filter(c=>/^(TH|TD)$/i.test(c.tagName)).slice(4).forEach(c=>c.remove());
   });
   paper.querySelector('.totals')?.remove();
   // HSN is kept as a classification, but GST percentages are financial data on these documents.
   paper.querySelectorAll('table td').forEach(cell=>{
    cell.querySelectorAll('br').forEach(br=>{
     if(br.nextSibling&&/^\s*GST\s+\d/.test(br.nextSibling.textContent||'')){
      const next=br.nextSibling;br.remove();next.remove();
     }
    });
   });
  }
 }
 return result;
};
window.axFromSalesOrder=function(index){window.axOpenSalesBilling('order',index)};
// KPI cards were numerical divs with no click handlers. Open read-only relevant records.
function table(head,rows){
 return '<div style="overflow-x:auto"><table class="axFlowTable"><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(x=>'<tr>'+x.map(y=>'<td>'+esc(y)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
  (rows.length?'':'<p>No matching saved records.</p>');
}
window.axOpenKpiRecords=function(which){
 const wo=arr('workOrders'),srl=arr('store');
 if(which==='Open Orders'){
  const records=wo.filter(x=>x.status!=='Closed');
  return show(which,table(['Work No.','Party','Product','Order Qty','Done','Pending'],
   records.map(x=>[x.workNo||'',x.party||'',x.description||'',fmt(x.qty),fmt(x.done),fmt(Math.max(0,Number(x.qty||0)-Number(x.done||0)))])));
 }
 if(which==='Pending Production'){
  const records=wo.filter(x=>Math.max(0,Number(x.qty||0)-Number(x.done||0))>0);
  return show(which,table(['Work No.','Party','Product','Pending Qty'],
   records.map(x=>[x.workNo||'',x.party||'',x.description||'',fmt(Math.max(0,Number(x.qty||0)-Number(x.done||0)))])));
 }
 if(which==='Stock SRL'){
  const records=srl.filter(x=>Number(x.balance||0)>0);
  return show(which,table(['SRL No.','Cloth / Material','Width','Balance'],
   records.map(x=>[x.srl||'',x.cloth||'',x.width||'',fmt(x.balance)])));
 }
 if(which==='Receivable'){
  const totals=new Map();
  arr('invoices').forEach(x=>{const p=String(x.party||'Unassigned').trim();totals.set(p,(totals.get(p)||0)+Number(x.total||0))});
  arr('receipts').forEach(x=>{const p=String(x.party||'Unassigned').trim();totals.set(p,(totals.get(p)||0)-Number(x.amount||0))});
  const rows=[...totals.entries()].filter(([,v])=>Math.abs(v)>.005).map(([p,v])=>[p,'₹ '+fmt(v)]);
  return show('Customer Receivable', '<p class="axFlowInfo">Invoice totals minus saved receipts by exact customer name. Verify unmatched credits in Party Ledger before collection.</p>'+table(['Customer','Net balance'],rows));
 }
};
const kpi=document.getElementById('kpis');
if(kpi){
 const names=['Open Orders','Pending Production','Receivable','Stock SRL'];
 const enhance=()=>kpi.querySelectorAll('.kpi').forEach((el,i)=>{el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Open '+names[i]+' details')});
 kpi.addEventListener('click',e=>{const item=e.target.closest('.kpi');if(!item||!kpi.contains(item))return;const i=Array.from(kpi.querySelectorAll('.kpi')).indexOf(item);if(names[i])window.axOpenKpiRecords(names[i])});
 kpi.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const item=e.target.closest('.kpi');if(!item)return;const i=Array.from(kpi.querySelectorAll('.kpi')).indexOf(item);if(names[i]){e.preventDefault();window.axOpenKpiRecords(names[i])}});
 enhance();
 new MutationObserver(enhance).observe(kpi,{childList:true});
}
})();
