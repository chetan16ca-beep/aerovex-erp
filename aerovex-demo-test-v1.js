/* Read-only Aerovex Demo Test — never modifies records, browser storage or Cloud. */
(function(){
'use strict';
function numberFor(kind){
 const cfg={invoice:['invoices','AFX/INV',3],challan:['challans','AFX/DC',3],work:['workOrders','AFX-WO',4]}[kind];
 const rows=db[cfg[0]]||[],values=[];
 for(const row of rows)for(const key of ['documentNo','invoiceNo','workNo','no'])if(row[key])values.push(String(row[key]));
 if(kind==='invoice')for(const row of db.vouchers||[])if(row.type==='Sales'&&row.no)values.push(String(row.no));
 let max=0;
 for(const v of values){const p=cfg[1]+(kind==='work'?'-':'/');if(v.toUpperCase().startsWith(p.toUpperCase())){const n=v.slice(p.length);if(/^\d+$/.test(n))max=Math.max(max,Number(n));}}
 return cfg[1]+(kind==='work'?'-':'/')+String(max+1).padStart(cfg[2],'0');
}
function getLogo(){
 let data='';
 try{data=window.axSAPLogoFix?.current?.()||localStorage.getItem('aerovex-logo-data')||''}catch(_){}
 return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)?data:'';
}
function showLogoPreview(){
 const element=document.getElementById('axDemoLogo');
 const hint=document.getElementById('axDemoLogoHint');
 if(!element||!hint)return;
 const src=getLogo();
 if(src){
  element.src=src;element.hidden=false;
  hint.textContent='Original Aerovex logo loaded from this device (unchanged).';
 }else{
  element.removeAttribute('src');element.hidden=true;
  hint.textContent='No original logo saved on this device. Demo will show company name only; use ERP Set Invoice Logo to upload the original.';
 }
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
 '<h3>SAFE DEMO — No data saved</h3><p>Only a sample preview: Invoice, Challan, Work Order. No database, GST, stock or Cloud entry.</p>'+' <div style="display:flex;gap:12px;align-items:center;padding:9px;background:white"><img id="axDemoLogo" hidden alt="Original Aerovex logo" style="width:100px;max-height:76px;object-fit:contain"><div><b>AEROVEX FILTRATION</b><br><small>Smart Filtration Solutions</small><p id="axDemoLogoHint" style="font-size:12px;margin:4px 0"></p></div></div>'+
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
   '<header id="axDemoHeader"><h1>AEROVEX FILTRATION</h1><h2>'+data.name+' '+data.number+'</h2></header><p>Sample Customer — Not Real</p><div class="mark">DEMO ONLY — NOT VALID</div><table><tr><th>Product</th><th>Qty</th></tr><tr><td>FILTER CLOTH (sample)</td><td>2 Nos</td></tr></table><p>For testing preview/printing only. Nothing was saved to ERP or Cloud.</p></body></html>';
  w.document.open();w.document.write(html);w.document.close();const originalLogo=getLogo();if(originalLogo){const logo=w.document.createElement('img');logo.src=originalLogo;logo.alt='Aerovex Filtration original logo';logo.style.cssText='display:block;max-width:145px;max-height:85px;object-fit:contain;margin:0 0 8px';w.document.getElementById('axDemoHeader')?.prepend(logo);}
  w.focus();setTimeout(()=>w.print(),500);
 };
 showLogoPreview();
 run();
};
if(typeof modules!=='undefined'&&Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='Demo Test'))modules.accounts.push(['Demo Test','Invoice, Challan, Work Order preview — no save']);
const oldOpen=window.openModule||openModule;
window.openModule=function(name){if(name==='Demo Test')return window.axAerovexDemo();return oldOpen.apply(this,arguments)};
try{render()}catch(e){console.warn('Demo tile render unavailable',e)}
})();
