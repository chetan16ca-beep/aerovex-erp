/* Read-only Aerovex Demo Test — never modifies records, browser storage or Cloud. */
(function(){
'use strict';
function numberFor(kind){
 const cfg={invoice:['invoices','AFX/INV',3],challan:['challans','AFX/DC',3],work:['workOrders','AFX-WO',4]}[kind];
 const rows=db[cfg[0]]||[],values=[];
 for(const row of rows)for(const key of ['documentNo','invoiceNo','workNo','no'])if(row[key])values.push(String(row[key]));
 if(kind==='invoice')for(const row of db.vouchers||[])if(row.type==='Sales'&&row.no)values.push(String(row.no));
 let max=0;
 for(const v of values){const p=cfg[1]+'/';if(v.toUpperCase().startsWith(p.toUpperCase())){const n=v.slice(p.length);if(/^\d+$/.test(n))max=Math.max(max,Number(n));}}
 return cfg[1]+'/'+String(max+1).padStart(cfg[2],'0');
}
function view(kind){
 const number=numberFor(kind);
 const name={invoice:'GST Invoice',challan:'Delivery Challan',work:'Work Order'}[kind];
 const box=document.getElementById('axDemoPreview');
 if(box)box.textContent='DEMO '+name+' | Proposed next number '+number+' | Sample item: FILTER CLOTH, Qty 2 Nos | No records saved.';
 return {name,number};
}
window.axAerovexDemo=function(){
 const markup='<div style="border:2px solid #00658c;background:#f0f8fb;border-radius:10px;padding:15px">'+
 '<h3>SAFE DEMO — No data saved</h3><p>Only a sample preview: Invoice, Challan, Work Order. No database, GST, stock or Cloud entry.</p>'+
 '<select id="axDemoKind" style="width:100%;padding:13px"><option value="invoice">GST Invoice</option><option value="challan">Delivery Challan</option><option value="work">Work Order</option></select>'+
 '<p id="axDemoPreview" role="status"></p><button id="axDemoDryRun" type="button">Test Number — No Save</button> <button id="axDemoPDF" type="button">DEMO A4 Print / Save PDF</button>'+
 '<p style="font-weight:bold;color:#8b2538">DEMO ONLY — NOT VALID FOR CUSTOMER</p></div>';
 if(typeof show!=='function')return alert('Demo not available yet; nothing was saved.');
 show('Aerovex Safe Demo',markup);
 const kind=document.getElementById('axDemoKind');
 const run=()=>view(kind.value);
 kind.onchange=run;
 document.getElementById('axDemoDryRun').onclick=run;
 document.getElementById('axDemoPDF').onclick=()=>{
  const data=run();
  const w=window.open('','_blank');
  if(!w)return alert('Allow pop-ups to preview DEMO A4 PDF.');
  const html='<!doctype html><html><head><meta charset="utf-8"><title>Aerovex DEMO ONLY</title><style>@page{size:A4;margin:15mm}body{font:14px Arial;padding:20px;color:#16384a}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:35px 0}td,th{border:1px solid #789;padding:12px}.mark{font-size:27px;font-weight:bold;color:#b32339;border:3px dashed #b32339;padding:16px;text-align:center}</style></head><body>'+
   '<h1>AEROVEX FILTRATION</h1><h2>'+data.name+' '+data.number+'</h2><p>Sample Customer — Not Real</p><div class="mark">DEMO ONLY — NOT VALID</div><table><tr><th>Product</th><th>Qty</th></tr><tr><td>FILTER CLOTH (sample)</td><td>2 Nos</td></tr></table><p>For testing preview/printing only. Nothing was saved to ERP or Cloud.</p></body></html>';
  w.document.open();w.document.write(html);w.document.close();
  w.focus();setTimeout(()=>w.print(),500);
 };
 run();
};
if(typeof modules!=='undefined'&&Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='Demo Test'))modules.accounts.push(['Demo Test','Invoice, Challan, Work Order preview — no save']);
const oldOpen=window.openModule||openModule;
window.openModule=function(name){if(name==='Demo Test')return window.axAerovexDemo();return oldOpen.apply(this,arguments)};
try{render()}catch(e){console.warn('Demo tile render unavailable',e)}
})();
