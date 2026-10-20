/* Aerovex order-to-dispatch-to-bill flow. Additive; never overwrites saved records. */
(function(){
'use strict';
const KEY='aerovex-erp-data-v1';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=k=>Array.isArray(db[k])?db[k]:[];
const val=x=>Number(x||0);
const ident=x=>String(x?.documentNo||x?.orderNo||x?.challanNo||x?.invoiceNo||'').trim();
const norm=x=>String(x||'').trim().toUpperCase();
const amount=x=>val(x).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2});
const date=()=>new Date().toLocaleDateString('en-CA');
const items=x=>Array.isArray(x?.items)?x.items:[];
const same=(a,b)=>norm(a?.description)===norm(b?.description)&&norm(a?.size)===norm(b?.size)&&norm(a?.hsn)===norm(b?.hsn);
const linkMatches=(doc,source,index,from)=>{
 if(from==='order')return doc.sourceSalesOrder===ident(source)&&!!ident(source) || doc.sourceSalesOrderIndex===index&&Number.isInteger(doc.sourceSalesOrderIndex);
 return doc.sourceChallan===ident(source)&&!!ident(source) || doc.sourceChallanIndex===index&&Number.isInteger(doc.sourceChallanIndex);
};
function remaining(source,index,from){
 const originals=items(source),records=arr(from==='order'?'challans':'invoices');
 const used=originals.map(()=>0);const problems=[];
 const linked=records.filter(d=>linkMatches(d,source,index,from));
 for(const doc of linked){
  const parts=items(doc);
  if(!parts.length){problems.push('Linked document '+ident(doc)+' has no item details');continue}
  for(const part of parts){
   let at=Number(part.sourceLine);
   if(!Number.isInteger(at)||at<0||at>=originals.length||!same(originals[at],part)){
    const matches=originals.map((orig,j)=>same(orig,part)?j:-1).filter(j=>j>=0);
    if(matches.length!==1){problems.push('Cannot match product in '+ident(doc)+': '+(part.description||'unknown'));continue}
    at=matches[0];
   }
   used[at]+=val(part.qty);
  }
 }
 const rows=originals.map((item,j)=>({item,j,ordered:val(item.qty),used:used[j],pending:val(item.qty)-used[j]}));
 if(rows.some(r=>r.pending<-.00001))problems.push('Converted quantity exceeds original quantity; verify old documents');
 if(!ident(source))problems.push('This record has no document number. Add a document number before converting');
 return {rows,problems};
}
function nextNumber(prefix,key){
 const re=new RegExp('^'+prefix.replace('/','\\/')+'\\/(\\d+)$','i');let highest=0;
 for(const d of arr(key)){
  const m=ident(d).match(re);
  if(m)highest=Math.max(highest,Number(m[1]));
 }
 let next=highest+1,no;
 do{no=prefix+'/'+String(next++).padStart(3,'0')}while(arr(key).some(d=>ident(d).toUpperCase()===no.toUpperCase()));
 return no;
}
function makeOptions(key,chosen){
 return '<option value="">Select '+(key==='salesOrders'?'Sales Order':'Delivery Challan')+'</option>'+arr(key).map((x,i)=>{
  const name=ident(x)||'Legacy #'+(i+1);
  return '<option value="'+i+'" '+(chosen===i?'selected':'')+'>'+esc(name+' — '+(x.party||'Unnamed'))+'</option>';
 }).join('');
}
function quickButton(){
 if(document.getElementById('axSalesBillingShortcut'))return;
 const area=document.querySelector('.hero')||document.querySelector('#quick');
 if(!area)return;
 const btn=document.createElement('button');btn.id='axSalesBillingShortcut';btn.type='button';
 btn.className='primary';btn.textContent='🧾 Sales Order → Challan → Bill';
 btn.style.cssText='margin:8px 5px 8px 0;min-height:47px;font-weight:750';
 btn.onclick=()=>window.axOpenSalesBilling();
 area.append(btn);
}
const css=document.createElement('style');
css.textContent='.axFlowBox{border:1px solid #d8e4ef;border-radius:12px;background:#f7fbff;padding:15px;margin:12px 0}.axFlowBox h3{margin:4px 0 10px}.axFlowBox select,.axFlowBox input{width:100%;max-width:100%;box-sizing:border-box}.axFlowLine{display:grid;grid-template-columns:minmax(0,1fr) 105px;gap:12px;border-top:1px solid #d7e4ec;padding:12px 0;align-items:center}.axFlowLine small{display:block;color:#627384;margin-top:3px}.axFlowError{color:#a11818;font-weight:600}.axFlowHelp{color:#4a6377;font-size:13px}.axFlowBox button{margin-top:10px}.axFlowSummary{background:#e8f4f4;border-radius:8px;padding:10px;margin:12px 0}';
document.head.append(css);
let selectedOrder=null,selectedChallan=null,flash='';
function sections(){
 const so=document.getElementById('axFlowSO'),dc=document.getElementById('axFlowDC');
 if(so)so.innerHTML=makeOptions('salesOrders',selectedOrder);
 if(dc)dc.innerHTML=makeOptions('challans',selectedChallan);
 renderOrder();renderChallan();
}
window.axOpenSalesBilling=function(which='order',index=null){
 if(which==='order'&&Number.isInteger(index))selectedOrder=index;
 if(which==='challan'&&Number.isInteger(index))selectedChallan=index;
 show('Sales Order → Challan → Invoice',
 '<p class="axFlowHelp">Select an existing Sales Order, create a Delivery Challan, then create a GST Bill from that Challan. Old ERP records stay unchanged. Only confirmed new documents are saved.</p>'+
 (flash?'<p class="axFlowSummary">'+esc(flash)+'</p>':'')+
 '<div class="axFlowBox"><h3>1. Sales Order → Delivery Challan</h3><label>Choose Sales Order<select id="axFlowSO"></select></label><div id="axFlowOrderRows"></div></div>'+
 '<div class="axFlowBox"><h3>2. Delivery Challan → Sales Invoice</h3><label>Choose Delivery Challan<select id="axFlowDC"></select></label><div id="axFlowChallanRows"></div></div>');
 flash='';
 const so=document.getElementById('axFlowSO'),dc=document.getElementById('axFlowDC');
 so.addEventListener('change',()=>{selectedOrder=so.value===''?null:Number(so.value);renderOrder()});
 dc.addEventListener('change',()=>{selectedChallan=dc.value===''?null:Number(dc.value);renderChallan()});
 sections();
};
function rowsHtml(source,index,kind){
 const {rows,problems}=remaining(source,index,kind),pending=rows.filter(r=>r.pending>.00001);
 let html=problems.map(x=>'<p class="axFlowError">'+esc(x)+'</p>').join('');
 if(!rows.length)html+='<p class="axFlowError">This document has no saved product lines. Open and correct the original document before converting.</p>';
 if(rows.length&&!pending.length)html+='<p>All quantities already converted. No pending quantity to process.</p>';
 html+=pending.map(r=>'<div class="axFlowLine"><div><b>'+esc(r.item.description||'Unnamed product')+'</b><small>'+esc(r.item.size||'')+' · HSN '+esc(r.item.hsn||'Not entered')+' · Pending '+amount(r.pending)+' '+esc(r.item.unit||'Nos')+' (Original '+amount(r.ordered)+', converted '+amount(r.used)+')</small></div><div><label>Qty<input class="axFlowQty" type="number" min="0" max="'+r.pending+'" step="any" value="'+r.pending+'" data-line="'+r.j+'"></label></div></div>').join('');
 return {html,pending,problems};
}
function renderOrder(){
 const root=document.getElementById('axFlowOrderRows');if(!root)return;
 const order=selectedOrder==null?null:arr('salesOrders')[selectedOrder];
 if(!order){root.innerHTML='<p class="axFlowHelp">Create or select a Sales Order first.</p>';return}
 const state=rowsHtml(order,selectedOrder,'order');
 root.innerHTML=state.html+(state.pending.length&&!state.problems.length?'<button class="primary" type="button" id="axFlowMakeDC">Create Delivery Challan</button>':'')+
 '<p class="axFlowHelp">Only the selected dispatch quantities will be converted. No existing order will be deleted.</p>';
 document.getElementById('axFlowMakeDC')?.addEventListener('click',()=>convert('order',selectedOrder));
}
function renderChallan(){
 const root=document.getElementById('axFlowChallanRows');if(!root)return;
 const challan=selectedChallan==null?null:arr('challans')[selectedChallan];
 if(!challan){root.innerHTML='<p class="axFlowHelp">Create or select a Delivery Challan first.</p>';return}
 const state=rowsHtml(challan,selectedChallan,'challan');
 const tax=String(challan.taxType||'').trim();
 const rate=challan.gstRate??'';
 const options=['CGST+SGST','IGST','Exempt'].map(x=>'<option value="'+x+'" '+(tax===x?'selected':'')+'>'+x+'</option>').join('');
 root.innerHTML=state.html+(state.pending.length&&!state.problems.length?
 '<label>Tax Type<select id="axFlowTaxType"><option value="">Select GST Type</option>'+options+'</select></label>'+
 '<label>GST Rate % (verify HSN)<input id="axFlowGSTRate" type="number" min="0" max="100" step="any" value="'+esc(rate)+'" placeholder="Enter correct GST rate"></label>'+
 '<button class="primary" type="button" id="axFlowMakeINV">Create GST Invoice / Bill</button>':'')+
 '<p class="axFlowHelp">Invoice quantities cannot exceed the selected Challan. Confirm GSTIN, HSN, tax type and rate before billing.</p>';
 document.getElementById('axFlowMakeINV')?.addEventListener('click',()=>convert('challan',selectedChallan));
}
function convert(kind,index){
 const source=arr(kind==='order'?'salesOrders':'challans')[index];if(!source)return alert('Original document not found.');
 const st=remaining(source,index,kind);
 if(st.problems.length)return alert('Conversion blocked: '+st.problems.join('; '));
 const root=document.getElementById(kind==='order'?'axFlowOrderRows':'axFlowChallanRows');
 const chosen=[...root.querySelectorAll('input.axFlowQty')].map(input=>({j:Number(input.dataset.line),qty:Number(input.value)}));
 const pending=new Map(st.rows.map(x=>[x.j,x.pending]));
 if(chosen.some(x=>!Number.isFinite(x.qty)||x.qty<0||!pending.has(x.j)||x.qty>pending.get(x.j)+.00001))return alert('Invalid quantity. Check the pending quantity for each product.');
 const selected=chosen.filter(x=>x.qty>.00001);
 if(!selected.length)return alert('Enter at least one quantity above zero.');
 const key=kind==='order'?'challans':'invoices',prefix=kind==='order'?'AFX/DC':'AFX/INV';
 const number=nextNumber(prefix,key),srcNo=ident(source),taxType=kind==='order'?source.taxType:document.getElementById('axFlowTaxType')?.value;
 const taxRate=kind==='order'?source.gstRate:document.getElementById('axFlowGSTRate')?.value;
 if(kind==='challan'&&(!taxType||!['CGST+SGST','IGST','Exempt'].includes(taxType)))return alert('Choose GST tax type before creating the bill.');
 if(kind==='challan'&&taxType!=='Exempt'&&(taxRate===''||!Number.isFinite(Number(taxRate))||Number(taxRate)<0||Number(taxRate)>100))return alert('Enter and verify the GST percentage.');
 const docItems=selected.map(x=>{
  const orig=items(source)[x.j];
  return {...orig,qty:x.qty,sourceLine:x.j,...(kind==='challan'?{sourceSalesOrderLine:orig.sourceLine}: {})};
 });
 const taxable=docItems.reduce((sum,z)=>sum+val(z.qty)*val(z.rate)*(1-val(z.discount)/100),0);
 const gst=taxType==='Exempt'?0:taxable*val(taxRate)/100;
 const confirmed=kind==='order'?'Create Delivery Challan '+number+' from Sales Order '+srcNo+'?':'Create GST Invoice '+number+' from Challan '+srcNo+'? Check customer, HSN, rates and GST first.';
 if(!confirm(confirmed))return;
 // Recheck remaining just before writing; never overwrite the old ERP database.
 const fresh=remaining(source,index,kind);
 if(fresh.problems.length||selected.some(x=>x.qty>fresh.rows[x.j]?.pending+.00001))return alert('Quantities changed. Reopen and check the original document.');
 const result={...source,documentNo:number,date:date(),items:docItems,taxType:taxType||'',gstRate:taxRate??'',taxable,gst,total:taxable+gst,amount:taxable+gst,remarks:source.remarks||''};
 if(kind==='order'){
  delete result.invoiceNo;
  result.sourceSalesOrder=srcNo;result.sourceSalesOrderIndex=index;
  result.sourceSalesOrderDate=source.date||'';
  result.ref=source.ref||srcNo;
 }else{
  result.invoiceNo=number;
  result.sourceChallan=srcNo;result.sourceChallanIndex=index;
  result.sourceSalesOrder=source.sourceSalesOrder||'';
  result.ref=source.ref||srcNo;
 }
 if(!Array.isArray(db[key]))db[key]=[];
 if(db[key].some(x=>ident(x)===number))return alert('Duplicate document number detected. Please retry.');
 // One localStorage transaction: first persist the complete next state, then update live arrays.
 const next=JSON.parse(JSON.stringify(db));
 if(!Array.isArray(next[key]))next[key]=[];
 next[key].push(result);
 if(kind==='challan'){
  if(!Array.isArray(next.vouchers))next.vouchers=[];
  next.vouchers.push({type:'Sales',no:number,date:result.date,party:result.party||'',debit:result.total,credit:0,narration:'Invoice against Delivery Challan '+srcNo});
 }
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(error){alert('Nothing saved. Storage error: '+error.message);return}
 db[key].push(result);
 if(kind==='challan'){
  if(!Array.isArray(db.vouchers))db.vouchers=[];
  db.vouchers.push(next.vouchers[next.vouchers.length-1]);
 }
 const newIndex=db[key].length-1;
 if(kind==='order'){selectedChallan=newIndex;flash='Delivery Challan '+number+' saved. Select it below to create the Bill.';window.axOpenSalesBilling('challan',newIndex)}
 else {alert('GST Invoice '+number+' saved. You can now print / save PDF.');window.axDocPreview('Sales Invoice',newIndex)}
}
const prior=window.openModule;
window.openModule=function(name){if(name==='Sales Billing Flow')return window.axOpenSalesBilling();return prior.apply(this,arguments)};
const oldDetail=window.axDetailedDocument;
window.axDetailedDocument=function(type){
 const answer=oldDetail.apply(this,arguments);
 if(type==='Sales Order / PO'||type==='Delivery Challan'){
  const box=document.getElementById('modalBody');
  if(box&&!document.getElementById('axFlowOpenFromDoc')){
   const btn=document.createElement('button');btn.type='button';btn.className='primary';btn.id='axFlowOpenFromDoc';
   btn.textContent='🧾 Sales Order → Challan → Bill';btn.onclick=()=>window.axOpenSalesBilling();
   const form=document.getElementById('axDocForm');box.insertBefore(btn,form||box.firstChild);
  }
 }
 return answer;
};
window.axBillFromChallan=function(index){window.axOpenSalesBilling('challan',index)};
window.axFromSalesOrder=function(index,target){
 window.axOpenSalesBilling('order',index);
 if(target==='invoice')alert('Please create the Delivery Challan first. The Bill will be generated from the Challan to avoid duplicate billing.');
};
if(!modules.accounts.some(x=>x[0]==='Sales Billing Flow'))modules.accounts.unshift(['Sales Billing Flow','Sales Order → Challan → GST Bill']);
try{render()}catch(error){console.warn('Billing flow dashboard render:',error)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',quickButton);
else quickButton();
})();
