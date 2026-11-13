/* Aerovex document theme studio v1: safe, read-only renderers.
 * Select a quotation or invoice, preview one of three A4 themes and print/PDF.
 * Does not modify existing document records, numbers, GST or accounting.
 */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const K='aerovex-print-themes-v1';
const names={corporate:'Premium Corporate (Navy + Gold)',gst:'Modern GST (Blue + White)',minimal:'Minimal Professional (B/W)'};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S=v=>String(v??'').trim();
const N=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const M=v=>v===undefined||v===null||v===''||N(v)===null?'Not recorded':'₹ '+N(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const current=()=>{try{const x=JSON.parse(localStorage.getItem(K)||'{}');return {quote:names[x.quote]?x.quote:'corporate',invoice:names[x.invoice]?x.invoice:'gst'}}catch(e){return {quote:'corporate',invoice:'gst'}}};
const root=()=>document.getElementById('axTSApp');
const kind=()=>document.getElementById('axTSKind')?.value==='invoice'?'invoice':'quote';
const records=k=>Array.isArray(db[k==='invoice'?'invoices':'quotations'])?db[k==='invoice'?'invoices':'quotations']:[];
const title=(x,k,i)=>S(x?.quotationNo||x?.invoiceNo||x?.documentNo||x?.no)||((k==='invoice'?'Invoice':'Quotation')+' #'+(i+1));
const rows=x=>Array.isArray(x.items)&&x.items.length?x.items:[x];
const price=z=>N(z?.taxable)!==null?M(z.taxable):N(z?.qty)!==null&&N(z?.rate)!==null?M(N(z.qty)*N(z.rate)*(1-(N(z.discount)||0)/100)):M(undefined);
function logo(){
 const data=localStorage.getItem('aerovex-logo-data')||'';
 return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)?'<img class="axLogo" src="'+E(data)+'" alt="Aerovex logo">':'';
}
function css(theme){
 const colors=theme==='corporate'?['#102c4b','#c69e55','#f4f6f8']:theme==='gst'?['#1468a0','#54a7d8','#f0f7fc']:['#222','#777','#f6f6f6'];
 return '.axTSPaper{--axAccent:'+colors[0]+';--axLine:'+colors[1]+';--axTint:'+colors[2]+';font-family:Arial,Helvetica,sans-serif;color:#20313c;background:white;padding:22px;box-sizing:border-box;max-width:800px;margin:auto;font-size:12px;line-height:1.55}.axTSPaper *{box-sizing:border-box}.axTSPaper .axHeader{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid var(--axLine);padding-bottom:14px}.axTSPaper h1{font-size:22px;letter-spacing:.035em;color:var(--axAccent);margin:0 0 4px}.axTSPaper h2{font-size:15px;color:var(--axAccent);margin:0}.axTSPaper .axLogo{max-width:100px;max-height:70px;object-fit:contain}.axTSPaper .axHeadLeft{display:flex;gap:12px;align-items:flex-start}.axTSPaper .axInfo{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}.axTSPaper .axLabel{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#65717a;font-weight:bold}.axTSPaper table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}.axTSPaper th{background:var(--axAccent);color:white;text-align:left}.axTSPaper th,.axTSPaper td{padding:8px 6px;border:1px solid #b9c9d2;vertical-align:top;overflow-wrap:anywhere}.axTSPaper td{white-space:pre-wrap}.axTSPaper .axGrand{font-size:17px;font-weight:bold;color:var(--axAccent);background:var(--axTint);padding:9px}.axTSPaper .axTotals{margin:17px 0 12px auto;max-width:340px;text-align:right}.axTSPaper .axTerms{margin:20px 0;padding:12px;background:var(--axTint);border-left:3px solid var(--axLine)}.axTSPaper .axSign{text-align:right;margin-top:50px;break-inside:avoid}.axTSPaper .axFoot{font-size:10px;border-top:1px solid #d8dfe3;margin-top:35px;padding-top:8px;color:#60707a}.axTSPaper .axMuted{color:#64717b}.axTSPaper tr{break-inside:avoid}@page{size:A4;margin:12mm}@media print{body{margin:0!important;background:white!important}.axTSPaper{max-width:none!important;padding:0!important;box-shadow:none!important}}';
}
function companyHeader(x){
 const settings=db&&db.companySettings&&typeof db.companySettings==='object'?db.companySettings:{};
 const gstin=S(x.issuerGstin||x.companyGstin||settings.gstin||settings.companyGstin);
 const msme=S(settings.msmeNo||settings.udyam);
 const email=S(settings.email||settings.companyEmail);
 const phone=S(settings.phone||settings.mobile||settings.contact);
 return '<div>GSTIN: '+E(gstin||'Not recorded — verify')+'</div>'+
 (msme?'<div>MSME: '+E(msme)+'</div>':'')+
 (phone||email?'<div>'+E([phone,email].filter(Boolean).join(' | '))+'</div>':'');
}
function doc(x,k,t){
 const isQ=k==='quote',no=title(x,k,0),head=isQ?'TECHNO-COMMERCIAL QUOTATION':'TAX INVOICE';
 const itemLines=rows(x).map((z,i)=>'<tr><td style="width:6%">'+(i+1)+'</td><td style="width:43%"><b>'+E(z.description||'Description unavailable')+'</b><div class="axMuted">'+['MOC: '+S(z.moc),'Micron: '+S(z.micron),'Size: '+S(z.size)].filter(s=>!s.endsWith(': ')).map(E).join(' | ')+'</div></td><td style="width:12%">'+E(z.hsn||x.hsn||'—')+'</td><td style="width:12%">'+E(z.qty??'—')+' '+E(z.unit??x.unit??'')+'</td><td style="width:13%">'+M(z.rate)+'</td><td style="width:14%">'+price(z)+'</td></tr>').join('');
 const type=S(x.taxType).toUpperCase(),gst=N(x.gst);
 const gstParts=type==='EXEMPT'?'<p>GST: Exempt (as recorded)</p>':type==='IGST'?'<p>IGST: '+M(x.igst??x.gst)+'</p>':type==='CGST+SGST'&&gst!==null?'<p>CGST: '+M(x.cgst??gst/2)+'</p><p>SGST: '+M(x.sgst??gst/2)+'</p>':'<p>GST breakup: Verify tax type and amount in saved document</p>';
 return '<div class="axTSPaper axTS-'+t+'"><div class="axHeader"><div class="axHeadLeft">'+logo()+'<div><h1>AEROVEX FILTRATION</h1><div>Smart Filtration Solutions</div>'+companyHeader(x)+'</div></div><div style="text-align:right"><h2>'+head+'</h2><b>'+E(no)+'</b><br>Date: '+E(x.date||'—')+(isQ?'<br>Rev: '+E(x.revision||'—')+'<br>Validity: '+E(x.validity||'—')+' days':'')+'</div></div><div class="axInfo"><div><div class="axLabel">'+(isQ?'Quotation to':'Bill to')+'</div><b>'+E(x.party||'—')+'</b><div>'+E(x.address||'')+'</div><div>Customer GSTIN: '+E(x.gstin||'—')+'</div></div><div><div class="axLabel">Reference & delivery</div><div>RFQ / PO: '+E(x.ref||x.poRef||'—')+'</div><div>Place of supply: '+E(x.place||'—')+'</div><div>Attention: '+E(x.attention||'—')+'</div></div></div><table><thead><tr><th>#</th><th>Product / Specification</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+itemLines+'</tbody></table><div class="axTotals"><p>Taxable value: '+M(x.taxable)+'</p>'+gstParts+'<div class="axGrand">Grand Total: '+M(x.total??x.amount)+'</div></div><div class="axTerms"><b>Commercial Terms</b><div>Payment: '+E(x.payment||'—')+'</div><div>Delivery: '+E(x.delivery||'—')+'</div><div>Freight / Packing: '+E(x.freight||'—')+'</div><div>Remarks: '+E(x.remarks||'—')+'</div></div><div class="axSign"><b>For AEROVEX FILTRATION</b><br><br><br>Authorized Signatory</div><div class="axFoot">Rendered from existing saved Aerovex ERP records. Review invoice number, HSN, GST and banking terms before sharing.</div></div>';
}
function redraw(){
 const app=root();if(!app)return;
 const k=kind(),list=records(k),select=document.getElementById('axTSDoc'),prefs=current();
 const old=select.value;select.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+E(title(x,k,i)+' — '+(x.party||'Unknown'))+'</option>').join('');
 if(old!==''&&list[Number(old)])select.value=old;else if(list.length)select.value=String(list.length-1);
 const them=document.getElementById('axTSTheme');them.value=prefs[k];
 renderPreview();
}
function renderPreview(){
 const app=root();if(!app)return;
 const k=kind(),idx=Number(document.getElementById('axTSDoc')?.value);
 const x=records(k)[idx],theme=document.getElementById('axTSTheme')?.value;
 document.getElementById('axTSPreview').innerHTML=x?'<style>'+css(theme)+'</style>'+doc(x,k,theme):'<p>No saved '+(k==='quote'?'quotation':'invoice')+' on this device. Existing records are not changed.</p>';
}
function saveTheme(){
 const t=document.getElementById('axTSTheme').value,k=kind();
 if(!names[t])return;
 try{localStorage.setItem(K,JSON.stringify({...current(),[k]:t}));document.getElementById('axTSNotice').textContent='Theme preference saved on this device only. Old bills unchanged.'}
 catch(e){alert('Could not save theme preference: '+e.message)}
}
function printDoc(){
 const k=kind(),idx=Number(document.getElementById('axTSDoc').value),x=records(k)[idx],t=document.getElementById('axTSTheme').value;
 if(!names[t])return alert('Choose a valid theme first.');
 if(!x)return alert('Select a saved document first.');
 const w=window.open('','_blank');
 if(!w)return alert('Please allow pop-ups to print or Save PDF.');
 w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+E(title(x,k,idx))+'</title><style>'+css(t)+'</style></head><body>'+doc(x,k,t)+'</body></html>');
 w.document.close();w.focus();setTimeout(()=>w.print(),350);
}
window.axDocumentThemeStudio=function(){
 show('Aerovex Document Theme Studio','<div id="axTSApp"><p>Choose a theme for a saved Aerovex quotation or tax invoice. Preview/Print only; no existing amounts, GST, or bill numbers are edited.</p><div style="display:flex;flex-wrap:wrap;gap:10px"><label>Document type<select id="axTSKind"><option value="quote">Quotation</option><option value="invoice">Tax Invoice</option></select></label><label>Saved document<select id="axTSDoc"></select></label><label>Print theme<select id="axTSTheme">'+Object.entries(names).map(([v,n])=>'<option value="'+v+'">'+E(n)+'</option>').join('')+'</select></label></div><p><button id="axTSSaveTheme" type="button">Save Theme Preference</button> <button id="axTSPrint" class="primary" type="button">Print / Save PDF</button></p><p id="axTSNotice" role="status"></p><div id="axTSPreview"></div></div>');
 document.getElementById('axTSKind').onchange=redraw;
 document.getElementById('axTSDoc').onchange=renderPreview;
 document.getElementById('axTSTheme').onchange=renderPreview;
 document.getElementById('axTSSaveTheme').onclick=saveTheme;
 document.getElementById('axTSPrint').onclick=printDoc;
 redraw();
};
function install(){
 if(document.getElementById('axThemePanel'))return;
 const spot=document.getElementById('accounts')?.closest('.panel')||document.querySelector('main');if(!spot)return;
 const panel=document.createElement('section');panel.className='panel';panel.id='axThemePanel';
 panel.innerHTML='<div class="panelHead"><h2>Document Theme Studio</h2><span>Aerovex Quotations & Invoices</span></div><div><button type="button" id="axThemeOpen" class="primary">🎨 Preview Premium Print Themes</button><p style="font-size:12px;color:#64748b">Premium Corporate • Modern GST • Minimal. A4 PDF via browser Print.</p></div>';
 spot.insertAdjacentElement('afterend',panel);
 document.getElementById('axThemeOpen').onclick=window.axDocumentThemeStudio;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();