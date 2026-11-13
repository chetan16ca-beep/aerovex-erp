/* Aerovex: privacy-safe commercial document printing.
 * Only sales order and delivery challan PDF/print omit rates, amounts and tax totals.
 * Existing saved records, invoices, quotes and underlying calculations remain untouched.
 */
(function(){
'use strict';
if(typeof db==='undefined')return;
const TYPES={salesOrders:'Sales Order / PO',challans:'Delivery Challan'};
const protectedType=x=>x==='salesOrders'||x==='challans';
const text=v=>String(v??'');
const escape=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const items=x=>Array.isArray(x.items)&&x.items.length?x.items:[x];
function register(key,title){
  const list=Array.isArray(db[key])?db[key]:[];
  const header=title||TYPES[key];
  const rows=list.map((x,i)=>{
    const no=x.documentNo||x.orderNo||x.challanNo||x.no||('#'+(i+1));
    const specs=items(x).map(z=>[z.description||z.name||'',z.qty??'',z.unit||''].filter(v=>text(v).trim()!=='').join(' ')).filter(Boolean).join(' | ');
    return '<tr><td>'+escape(no)+'</td><td>'+escape(x.date)+'</td><td>'+escape(x.party)+'</td><td>'+escape(specs)+'</td></tr>';
  }).join('');
  const w=window.open('','_blank');
  if(!w){alert('Please allow popups for Print / Save PDF.');return}
  w.document.open();
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Aerovex '+escape(header)+' Register</title><style>@page{size:A4;margin:12mm}body{font:12px Arial,sans-serif;color:#172b3a}h1{font-size:19px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #a9b8c2;padding:8px;vertical-align:top;text-align:left;overflow-wrap:anywhere}th{background:#edf4f8}th:nth-child(1){width:20%}th:nth-child(2){width:15%}th:nth-child(3){width:25%}th:nth-child(4){width:40%}tr{break-inside:avoid}</style></head><body><h1>AEROVEX FILTRATION</h1><h2>'+escape(header)+' — Register</h2><table><thead><tr><th>Document No.</th><th>Date</th><th>Customer</th><th>Product / Qty</th></tr></thead><tbody>'+rows+'</tbody></table><p>For AEROVEX FILTRATION</p></body></html>');
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}
const previousRecord=window.axPrintRecord;
window.axPrintRecord=function(key,i){
  if(!protectedType(key))return typeof previousRecord==='function'?previousRecord.apply(this,arguments):undefined;
  if(typeof window.axDocPreview==='function')return window.axDocPreview(TYPES[key],i);
};
const previousList=window.axPrintList;
window.axPrintList=function(key,title){
  if(protectedType(key))return register(key,title||TYPES[key]);
  if(typeof previousList==='function')return previousList.apply(this,arguments);
};
const previousRegister=window.axPrintRegister;
window.axPrintRegister=function(key,title){
  const canonical=key==='Sales Order / PO'?'salesOrders':key==='Delivery Challan'?'challans':key;
  if(protectedType(canonical))return register(canonical,title||TYPES[canonical]);
  if(typeof previousRegister==='function')return previousRegister.apply(this,arguments);
};
})();