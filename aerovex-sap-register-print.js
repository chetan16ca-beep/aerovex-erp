/* Aerovex unified SAP-inspired register printing.
 * Read-only, with no bill/stock/GST mutation. Sales Order and Challan remain
 * completely commercial-value-free. The legacy CA/GST reports keep their
 * existing calculations and are not rewritten.
 */
(function(){
'use strict';
if(typeof db==='undefined')return;
const VALID=new Set(['quotations','salesOrders','challans','invoices','purchaseOrders','purchases','workOrders','store','cutting','departmentWork','packing','receipts','payments','expenses','ledger','suppliers','products','parties']);
const PROTECTED=new Set(['salesOrders','challans']);
const names={quotations:'Sales Quotations',salesOrders:'Sales Orders',challans:'Delivery Challans',invoices:'Tax Invoices',purchaseOrders:'Purchase Orders',purchases:'Purchase Register',workOrders:'Work Order Register',store:'Store / SRL Register',cutting:'Cutting Register',departmentWork:'Production Register',packing:'Packing Register',receipts:'Receipts',payments:'Payments',expenses:'Expense Register',ledger:'Party Ledger',suppliers:'Suppliers',products:'Products',parties:'Customer Master'};
const al={ 'Sales Order / PO':'salesOrders','Sales Order':'salesOrders','Delivery Challan':'challans','Sales Invoice':'invoices','Quotation':'quotations','Purchase Order':'purchaseOrders','Purchase':'purchases','Work Orders':'workOrders','Store / SRL':'store','Cutting':'cutting','Expenses':'expenses'};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=v=>String(v??'').trim();
const m=v=>v===undefined||v===null||v===''||!Number.isFinite(Number(v))?'—':'₹ '+Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const k=v=>al[v]||v;
const ref=x=>t(x.documentNo||x.invoiceNo||x.quotationNo||x.orderNo||x.challanNo||x.poNo||x.workNo||x.srl||x.no||x.code||x.id||'—');
const products=x=>Array.isArray(x.items)&&x.items.length?x.items:[x];
const desc=(x,key)=>key==='store'?[x.cloth&&'Cloth '+x.cloth,x.width&&'Width '+x.width,x.srl&&'SRL '+x.srl].filter(Boolean).join(' / '):products(x).map(z=>[z.description||z.name||z.product||z.cloth||'',z.moc||'',z.size||''].filter(Boolean).join(' / ')).filter(Boolean).join(' | ');
const qty=(x,key)=>key==='store'?(x.balance??x.opening??'—')+' m':key==='workOrders'?'Order '+(x.qty??x.orderQty??'—')+' | Done '+(x.done??x.doneQty??'—'):products(x).map(z=>t(z.qty??z.quantity??'—')+' '+t(z.unit||'')).join(' / ');
const logo=()=>{const x=window.axSAPLogoFix?.current?.()||localStorage.getItem('aerovex-logo-data')||'';return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x)?'<img src="'+E(x)+'" alt="Aerovex Filtration" class="axSapRegLogo">':''};
function printRegister(key,ttl,onlyIndex=null){
 const type=k(key);
 if(!VALID.has(type))return false;
 const list=Array.isArray(db[type])?(onlyIndex===null?db[type]:db[type].slice(onlyIndex,onlyIndex+1)):[];
 const hide=PROTECTED.has(type),details=names[type]||ttl||type;
 const head='<thead><tr><th>NO.</th><th>DOC / SRL NO.</th><th>DATE</th><th>PARTY / REFERENCE</th><th>ITEM / DETAILS</th><th>QTY / STATUS</th>'+(hide?'':'<th>VALUE</th>')+'</tr></thead>';
 const rows=list.map((x,i)=>'<tr><td>'+E(i+1)+'</td><td><b>'+E(ref(x))+'</b></td><td>'+E(x.date||x.createdAt||'—')+'</td><td>'+E(x.party||x.customer||x.supplier||x.person||x.name||'—')+'</td><td>'+E(desc(x,type)||x.remarks||x.remark||x.description||'—')+'</td><td>'+E(qty(x,type))+'</td>'+(hide?'':'<td>'+m(x.total??x.amount??(type==='store'?null:x.value))+'</td>')+'</tr>').join('');
 const count=list.length;
 const w=window.open('','_blank');if(!w){alert('Allow pop-ups to Print / Save PDF');return true}
 const write=()=>{
  if(w.closed)return;
  const doc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+E(details)+' — Aerovex</title><link rel="stylesheet" href="'+new URL('aerovex-sap-register-print.css?v=2',document.baseURI).href+'"></head><body>'+
  '<main class="axSapRegister"><header class="axSapRegHead"><div class="axSapRegCompany">'+logo()+'<div>'+(logo()?'':'<h1>AEROVEX FILTRATION</h1>')+'<small>Smart Filtration Solutions</small></div></div><div><small>ENTERPRISE PRINT REGISTER</small><h2>'+E(details)+'</h2><span>'+count+' RECORD(S)</span></div></header>'+
  '<div class="axSapRegControls"><div>REGISTER: '+E(details)+'</div><div>PRINTED ON: '+E(new Date().toLocaleDateString('en-IN'))+'</div></div>'+
  '<table class="axSapRegTable">'+head+'<tbody>'+rows+'</tbody></table>'+(count?'':'<p>No records found in the selected register.</p>')+
  '<footer>Smart Filtration Solutions · <b>For AEROVEX FILTRATION</b></footer></main></body></html>';
  if(typeof w.addEventListener==='function')w.addEventListener('load',()=>{w.focus();w.print()},{once:true});
  w.document.open();w.document.write(doc);w.document.close();
 };
 const task=window.axSAPLogoFix?.prepare?.();
 if(task&&typeof task.then==='function')task.then(write,write);
 else write();
 return true;
}
function printSingle(key,i){
 const type=k(key),rec=db[type]?.[i];if(!rec||!VALID.has(type))return false;
 const privateDoc=PROTECTED.has(type);
 if(['quotations','invoices','purchaseOrders','salesOrders','challans'].includes(type)&&typeof window.axSAPOpenDocument==='function'){
  window.axSAPOpenDocument(({quotations:'quotation',invoices:'invoice',purchaseOrders:'purchaseOrder',salesOrders:'salesOrder',challans:'deliveryChallan'})[type],i);
  return true;
 }
 // For detailed non-commercial records, the SAP-styled register lists all saved values without mutating them.
 return printRegister(type,names[type]+' — Single Record',i);
}
const previousList=window.axPrintList;
window.axPrintList=function(key,title){
 if(printRegister(key,title))return;
 return typeof previousList==='function'?previousList.apply(this,arguments):undefined;
};
const previousRegister=window.axPrintRegister;
window.axPrintRegister=function(key,title){
 // Protected documents should print registers directly, never leak original prices.
 if(PROTECTED.has(k(key)))return printRegister(key,title);
 return typeof previousRegister==='function'?previousRegister.apply(this,arguments):undefined;
};
const previousRecord=window.axPrintRecord;
window.axPrintRecord=function(key,i){
 if(VALID.has(k(key))&&printSingle(key,i))return;
 return typeof previousRecord==='function'?previousRecord.apply(this,arguments):undefined;
};
window.axSAPPrintRegister=printRegister;
})();
