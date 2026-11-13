/* Aerovex Theme Studio v2 — 10 different A4 document structures.
   Read-only: never modifies bill, quotation, GST, cash, stock or document records.
   Sales Order and Delivery Challan pricing privacy remains in separate module. */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const K='aerovex-print-themes-v1', STYLE='aerovex-print-layouts-v2.css?v=2';
const names={
corporate:'01 · Executive Axis — Split Masthead',
gst:'02 · Tax Registry — Ruled GST Ledger',
minimal:'03 · Editorial Paper — Typography',
blueprint:'04 · Blueprint — Engineering Sheet',
matrix:'05 · Modular Matrix — Product Cards',
industrial:'06 · Industrial Docket — Vertical Rail',
statement:'07 · Statement — Transaction Lines',
compact:'08 · Smart Compact — Dense A4',
letterhead:'09 · Formal Letterhead — Signature',
folio:'10 · Financial Folio — Sidebar'
};
const notes={
corporate:'Split masthead, two client panels, financial side column',
gst:'Formal registry frame, full-border bill and detailed GST accounts',
minimal:'Typographic poster-like heading, open line items, fine rules',
blueprint:'Engineering drawing control grid and technical item columns',
matrix:'Dashboard-style modular cards for each line item',
industrial:'Technical vertical rail and specification-first presentation',
statement:'Account statement style, transaction rows instead of a table',
compact:'High-density print sheet with compact headers and bottom financial split',
letterhead:'Centered formal letterhead with correspondence-style subject and signature',
folio:'Asymmetric index spine and narrow right-side finance summary'
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const s=v=>String(v??'').trim();
const n=v=>v===undefined||v===null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const money=v=>n(v)===null?'Not recorded':'₹ '+n(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const $=id=>document.getElementById(id);
const kind=()=>$('axTSKind')?.value==='invoice'?'invoice':'quote';
const docs=k=>Array.isArray(db[k==='invoice'?'invoices':'quotations'])?db[k==='invoice'?'invoices':'quotations']:[];
const number=(x,k,i)=>s(x.quotationNo||x.invoiceNo||x.documentNo||x.no)||((k==='quote'?'Quotation ':'Invoice ')+(i+1));
const lines=x=>Array.isArray(x.items)&&x.items.length?x.items:[x];
const total=z=>n(z.taxable)!==null?money(z.taxable):n(z.qty)!==null&&n(z.rate)!==null?money(n(z.qty)*n(z.rate)*(1-(n(z.discount)||0)/100)):'Not recorded';
const settings=()=>db.companySettings&&typeof db.companySettings==='object'?db.companySettings:{};
const type=k=>k==='quote'?'TECHNO-COMMERCIAL QUOTATION':'TAX INVOICE';
function preference(){try{const p=JSON.parse(localStorage.getItem(K)||'{}');return{quote:names[p.quote]?p.quote:'corporate',invoice:names[p.invoice]?p.invoice:'gst'}}catch(e){return{quote:'corporate',invoice:'gst'}}}
function logo(){const v=localStorage.getItem('aerovex-logo-data')||'';return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)?'<img class="axLogo" src="'+esc(v)+'" alt="Aerovex Filtration">':''}
function issuer(x){
 const a=settings(),gst=s(x.issuerGstin||x.companyGstin||a.gstin||a.companyGstin||'24BPCPB7271L1ZW');
 const arr=['GSTIN: '+gst,a.msmeNo?'MSME: '+a.msmeNo:'',a.phone||a.mobile||a.contact||'',a.email||a.companyEmail||''].filter(Boolean);
 return '<div class="axIssuer">'+arr.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div>';
}
function brand(x){return '<div class="axBrand">'+logo()+'<div><strong>AEROVEX FILTRATION</strong><small>Smart Filtration Solutions</small>'+issuer(x)+'</div></div>'}
function customer(x,k){return '<section class="axField"><small>'+(k==='quote'?'QUOTATION TO':'BILL TO')+'</small><b>'+esc(x.party||'—')+'</b><div>'+esc(x.address||'')+'</div><div>GSTIN: '+esc(x.gstin||'—')+'</div></section>'}
function references(x){return '<section class="axField"><small>REFERENCE / SUPPLY</small><div>RFQ / PO: '+esc(x.ref||x.poRef||'—')+'</div><div>Place of Supply: '+esc(x.place||'—')+'</div><div>Attention: '+esc(x.attention||'—')+'</div></section>'}
function metadata(x,k,i){return '<section class="axField"><small>DOCUMENT CONTROL</small><b>'+esc(number(x,k,i))+'</b><div>Date: '+esc(x.date||'—')+'</div>'+(k==='quote'?'<div>Revision: '+esc(x.revision||'—')+' · Validity: '+esc(x.validity||'—')+' days</div>':'')+'</section>'}
function field(label,value){return '<div class="axFact"><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>'}
function spec(z){return [['MOC',z.moc],['MICRON',z.micron],['SIZE',z.size]].filter(p=>s(p[1])).map(p=>p[0]+': '+esc(p[1])).join(' | ')}
function tr6(x){
 return lines(x).map((z,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(z.description||'Description unavailable')+'</b><small>'+spec(z)+'</small></td><td>'+esc(z.hsn||x.hsn||'—')+'</td><td>'+esc(z.qty??'—')+' '+esc(z.unit??x.unit??'')+'</td><td>'+money(z.rate)+'</td><td>'+total(z)+'</td></tr>').join('');
}
function table(x,technical){
 if(technical)return '<table class="axItems axTechnical"><thead><tr><th>NO</th><th>TECHNICAL PRODUCT</th><th>MOC / SIZE</th><th>HSN</th><th>QTY</th><th>RATE</th><th>VALUE</th></tr></thead><tbody>'+lines(x).map((z,i)=>'<tr><td>'+String(i+1).padStart(2,'0')+'</td><td><b>'+esc(z.description||'Description unavailable')+'</b></td><td>'+spec(z)+'</td><td>'+esc(z.hsn||x.hsn||'—')+'</td><td>'+esc(z.qty??'—')+' '+esc(z.unit??x.unit??'')+'</td><td>'+money(z.rate)+'</td><td>'+total(z)+'</td></tr>').join('')+'</tbody></table>';
 return '<table class="axItems"><thead><tr><th>NO</th><th>PRODUCT / DESCRIPTION</th><th>HSN</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>'+tr6(x)+'</tbody></table>';
}
function productCards(x){
 return '<div class="axCardList">'+lines(x).map((z,i)=>'<div class="axProductCard"><div class="axCardIndex">ITEM '+String(i+1).padStart(2,'0')+'</div><div><b>'+esc(z.description||'Description unavailable')+'</b><small>'+spec(z)+'</small><small>HSN: '+esc(z.hsn||x.hsn||'—')+'</small></div><div><small>QUANTITY</small>'+esc(z.qty??'—')+' '+esc(z.unit??x.unit??'')+'</div><div><small>UNIT RATE</small>'+money(z.rate)+'</div><div class="axCardValue"><small>LINE VALUE</small><b>'+total(z)+'</b></div></div>').join('')+'</div>';
}
function statementRows(x){
 return '<div class="axStatementRows">'+lines(x).map((z,i)=>'<div class="axTransaction"><strong class="axSeq">'+String(i+1).padStart(2,'0')+'</strong><div class="axTransactionText"><b>'+esc(z.description||'Description unavailable')+'</b><small>'+spec(z)+' · HSN '+esc(z.hsn||x.hsn||'—')+'</small></div><div class="axTransactionValue"><small>'+esc(z.qty??'—')+' '+esc(z.unit??x.unit??'')+' × '+money(z.rate)+'</small><strong>'+total(z)+'</strong></div></div>').join('')+'</div>';
}
function tax(x){
 const t=s(x.taxType).replace(/\s+/g,'').toUpperCase(),gst=n(x.gst);
 if(t==='EXEMPT')return '<div class="axMoneyRow"><span>GST</span><b>Exempt (as saved)</b></div>';
 if(t==='IGST')return '<div class="axMoneyRow"><span>IGST</span><b>'+money(x.igst??x.gst)+'</b></div>';
 if(t==='CGST+SGST'&&gst!==null)return '<div class="axMoneyRow"><span>CGST</span><b>'+money(x.cgst??gst/2)+'</b></div><div class="axMoneyRow"><span>SGST</span><b>'+money(x.sgst??gst/2)+'</b></div>';
 return '<div class="axMoneyRow"><span>GST</span><b>Verify tax breakdown</b></div>';
}
function finance(x){return '<div class="axFinance"><div class="axMoneyRow"><span>Taxable Value</span><b>'+money(x.taxable)+'</b></div>'+tax(x)+'<div class="axGrand"><span>GRAND TOTAL</span><strong>'+money(x.total??x.amount)+'</strong></div></div>'}
function terms(x){
 const cfg=settings();return '<section class="axTerms"><h3>COMMERCIAL TERMS</h3><div>Payment: '+esc(x.payment||'—')+'</div><div>Delivery: '+esc(x.delivery||'—')+'</div>'+(x.deliveryLocation?'<div>Delivery Location: '+esc(x.deliveryLocation)+'</div>':'')+(x.validity?'<div>Validity: '+esc(x.validity)+' days</div>':'')+(x.freight?'<div>Freight: '+esc(x.freight)+'</div>':'')+(x.packing?'<div>Packing: '+esc(x.packing)+'</div>':'')+(x.warranty?'<div>Warranty: '+esc(x.warranty)+'</div>':'')+(x.remarks?'<div>Remarks: '+esc(x.remarks)+'</div>':'')+(cfg.terms?'<div class="axOwnTerms">'+esc(cfg.terms)+'</div>':'')+'</section>';
}
function bank(){
 const a=settings(),fields=[['Bank',a.bankName],['Account Name',a.accountName],['Account Number',a.accountNo],['IFSC',a.ifsc],['Branch',a.branch]].filter(v=>s(v[1]));
 return fields.length?'<section class="axBank"><h3>BANK DETAILS</h3>'+fields.map(x=>'<div><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('')+'</section>':'';
}
function sign(){return '<div class="axSign"><b>For AEROVEX FILTRATION</b><div class="axSignArea"></div><span>Authorized Signatory</span></div>'}
function layout(theme,x,k,i){
 const H=type(k),no=esc(number(x,k,i)),dt=esc(x.date||'—');
 switch(theme){
 case 'corporate':
  return '<header class="axExecutiveHeader"><div>'+brand(x)+'</div><div class="axExecutiveTitle"><small>AEROVEX / COMMERCIAL</small><h1>'+H+'</h1><b>'+no+'</b><span>'+dt+'</span></div></header><div class="axExecutiveInfo">'+customer(x,k)+'<div>'+references(x)+metadata(x,k,i)+'</div></div><h3 class="axSectionLabel">01 / ITEM SCHEDULE</h3>'+table(x,false)+'<div class="axExecutiveBottom"><div><h3 class="axSectionLabel">02 / CONDITIONS</h3>'+terms(x)+bank()+'</div><div><h3 class="axSectionLabel">03 / FINANCIAL SUMMARY</h3>'+finance(x)+sign()+'</div></div>';
 case 'gst':
  return '<div class="axRegistry"><header class="axRegistryHeader">'+brand(x)+'<div><h1>'+H+'</h1><b>'+no+'</b></div></header><div class="axRegistryFacts">'+field('ISSUED',x.date)+field('DOC ID',number(x,k,i))+field('SUPPLY STATE',x.place)+field('TAX TYPE',k==='quote'?'QUOTATION':x.taxType)+'</div><div class="axRegistryParties">'+customer(x,k)+references(x)+'</div><h3 class="axRegistryBar">GOODS / SERVICES TAX REGISTER</h3>'+table(x,false)+'<div class="axRegistryBottom"><div>'+terms(x)+bank()+'</div><div><h3>GST ACCOUNT</h3>'+finance(x)+'</div></div><footer>'+sign()+'</footer></div>';
 case 'minimal':
  return '<header class="axEditorialHeader">'+brand(x)+'<span>DOCUMENT SERIES / '+String(i+1).padStart(3,'0')+'</span></header><h1 class="axEditorialTitle">'+(k==='quote'?'QUOTATION':'INVOICE')+'</h1><div class="axEditorialInfo"><div><small>PREPARED FOR</small><b>'+esc(x.party||'—')+'</b><span>'+esc(x.address||'')+'</span></div><div><small>NUMBER / DATE</small><b>'+no+'</b><span>'+dt+'</span></div><div><small>REFERENCE</small><b>'+esc(x.ref||x.poRef||'—')+'</b><span>GSTIN '+esc(x.gstin||'—')+'</span></div></div>'+statementRows(x)+'<div class="axEditorialTotals">'+finance(x)+'</div><div class="axEditorialFooter">'+terms(x)+sign()+'</div>'+bank();
 case 'blueprint':
  return '<div class="axBlueprintBorder"><header class="axBlueprintHeader"><div><small>TECHNICAL / COMMERCIAL DRAWING SHEET</small><h1>AEROVEX FILTRATION</h1><span>Smart Filtration Solutions</span></div><div><b>'+H+'</b><span>'+no+'</span></div></header><div class="axBlueprintIssuer">'+issuer(x)+'</div><div class="axBlueprintGrid">'+field('DOCUMENT NO.',number(x,k,i))+field('ISSUE DATE',x.date)+field('REVISION',x.revision)+field('CUSTOMER',x.party)+field('CUSTOMER GSTIN',x.gstin)+field('PROJECT / PO',x.ref||x.poRef)+'</div><h3 class="axBlueprintBar">BILL OF MATERIALS / PRODUCT SPECIFICATIONS</h3>'+table(x,true)+'<div class="axBlueprintLower"><div>'+references(x)+terms(x)+bank()+'</div><div>'+finance(x)+'</div></div><footer><div>DOCUMENT CONTROL / '+no+' / '+dt+'</div>'+sign()+'</footer></div>';
 case 'matrix':
  return '<header class="axMatrixHeader">'+brand(x)+'<div><strong>'+H+'</strong><span>'+no+'</span></div></header><div class="axMatrixFacts"><div>'+field('CUSTOMER',x.party)+'</div><div>'+field('GSTIN',x.gstin)+'</div><div>'+field('ISSUE DATE',x.date)+'</div><div>'+field('ORDER REF',x.ref||x.poRef)+'</div></div><div class="axMatrixHeading"><b>PRODUCT CARDS</b><span>'+lines(x).length+' LINE ITEMS</span></div>'+productCards(x)+'<div class="axMatrixSplit">'+terms(x)+finance(x)+'</div><div class="axMatrixEnd">'+bank()+sign()+'</div>';
 case 'industrial':
  return '<div class="axIndustrial"><aside class="axIndustrialRail"><b>AX</b><strong>'+(k==='quote'?'QUOTATION':'INVOICE')+'</strong><small>INDUSTRIAL DIVISION</small></aside><main><header>'+brand(x)+'<h1>'+H+'</h1></header><div class="axIndustrialFacts">'+field('DOCUMENT',number(x,k,i))+field('DATE',x.date)+field('CUSTOMER',x.party)+'</div><div class="axIndustrialParties">'+customer(x,k)+references(x)+'</div><h3 class="axIndustrialBar">TECHNICAL SCHEDULE / INDUSTRIAL PRODUCTS</h3>'+table(x,true)+'<div class="axIndustrialClose"><div>'+terms(x)+bank()+'</div>'+finance(x)+'</div>'+sign()+'</main></div>';
 case 'statement':
  return '<header class="axStatementHeader"><div><small>CLIENT SERVICES / BILLING</small>'+brand(x)+'</div><div><small>REFERENCE CODE</small><strong>'+no+'</strong></div></header><h1 class="axStatementTitle">'+H+'</h1><div class="axStatementFacts">'+field('DATE',x.date)+field('CUSTOMER',x.party)+field('SUPPLY',x.place)+field('PO / REF',x.ref||x.poRef)+'</div><div class="axStatementParties">'+customer(x,k)+references(x)+'</div><h3 class="axStatementBar">TRANSACTION DETAILS</h3>'+statementRows(x)+'<div class="axStatementBottom"><div><h3>TERMS & INFORMATION</h3>'+terms(x)+bank()+'</div><div><h3>STATEMENT SUMMARY</h3>'+finance(x)+'</div></div>'+sign();
 case 'compact':
  return '<header class="axCompactHeader">'+brand(x)+'<div><strong>'+H+'</strong><b>'+no+'</b><span>'+dt+'</span></div></header><div class="axCompactFacts">'+field('BILL TO',x.party)+field('GSTIN',x.gstin)+field('REFERENCE',x.ref||x.poRef)+field('PLACE',x.place)+'</div><div class="axCompactAddress">'+esc(x.address||'')+' / ATTENTION: '+esc(x.attention||'—')+'</div>'+table(x,false)+'<div class="axCompactBottom"><div>'+terms(x)+bank()+'</div>'+finance(x)+'</div>'+sign();
 case 'letterhead':
  return '<header class="axLetterHead">'+logo()+'<h1>AEROVEX FILTRATION</h1><p>Smart Filtration Solutions</p>'+issuer(x)+'</header><div class="axLetterRef"><b>'+H+'</b><span>NO. '+no+' · DATE '+dt+'</span></div><div class="axLetterAddress"><div><small>TO</small><b>'+esc(x.party||'—')+'</b><div>'+esc(x.address||'')+'</div><div>GSTIN: '+esc(x.gstin||'—')+'</div></div><div>REF: '+esc(x.ref||x.poRef||'—')+'<br>ATTN: '+esc(x.attention||'—')+'<br>PLACE: '+esc(x.place||'—')+'</div></div><div class="axLetterSubject"><b>SUBJECT:</b> '+H+' — '+no+'</div><p class="axLetterIntro">Please find below the goods / services details recorded for this document.</p>'+table(x,false)+'<div class="axLetterFinance">'+finance(x)+'</div>'+terms(x)+bank()+sign();
 case 'folio':
  return '<div class="axFolio"><aside class="axFolioSpine"><strong>'+(k==='quote'?'QUOTATION':'INVOICE')+'</strong><span>AEROVEX<br>ERP</span></aside><main><header>'+brand(x)+'<small>DOCUMENT INDEX / '+String(i+1).padStart(3,'0')+'</small></header><h1>'+H+'</h1><div class="axFolioFacts">'+field('DOC NO',number(x,k,i))+field('DATE',x.date)+field('ORDER REF',x.ref||x.poRef)+'</div><div class="axFolioParties">'+customer(x,k)+references(x)+'</div><div class="axFolioWork"><section><h3>ITEM SCHEDULE</h3>'+table(x,false)+'</section><aside><h3>FINANCIALS</h3>'+finance(x)+'</aside></div><div class="axFolioTerms">'+terms(x)+bank()+'</div>'+sign()+'</main></div>';
 default:throw Error('Invalid theme ID');
 }
}
function docHTML(x,k,t,i){return '<article class="axTSPaper axTS-'+esc(t)+'" data-layout="'+esc(t)+'">'+layout(t,x,k,i)+'<footer class="axLegal">AEROVEX FILTRATION · Smart Filtration Solutions</footer></article>'}
function redraw(){
 if(!$('axTSApp'))return;
 const k=kind(),arr=docs(k),sel=$('axTSDoc'),before=sel.value;
 sel.innerHTML=arr.map((x,i)=>'<option value="'+i+'">'+esc(number(x,k,i)+' — '+(x.party||'Unknown'))+'</option>').join('');
 sel.value=before!==''&&arr[Number(before)]?before:arr.length?String(arr.length-1):'';
 $('axTSTheme').value=preference()[k];preview();
}
function preview(){
 if(!$('axTSApp'))return;
 const k=kind(),i=Number($('axTSDoc').value),x=docs(k)[i],t=$('axTSTheme').value;
 $('axTSNotice').textContent=notes[t]||'';
 $('axTSPreview').innerHTML=x?'<div class="axThemeViewport">'+docHTML(x,k,t,i)+'</div>':'<p>No saved '+(k==='quote'?'Quotation':'Tax Invoice')+' on this device. Existing records remain unchanged.</p>';
 const deck=$('axTSDeck');if(deck)deck.querySelectorAll('button[data-layout]').forEach(b=>{const sel=b.dataset.layout===t;b.setAttribute('aria-pressed',String(sel));b.style.borderColor=sel?'#0b4961':'#d8e4eb';b.style.background=sel?'#eaf5f8':'#fff'});
}
function storePref(){
 const t=$('axTSTheme').value,k=kind();if(!names[t])return;
 try{localStorage.setItem(K,JSON.stringify({...preference(),[k]:t}));$('axTSNotice').textContent='Theme preference saved on this device. Saved bills unchanged. '+notes[t]}catch(e){alert('Cannot save preference: '+e.message)}
}
function printDoc(){
 const k=kind(),i=Number($('axTSDoc').value),x=docs(k)[i],t=$('axTSTheme').value;if(!x||!names[t])return alert('Select a saved bill and layout.');
 const w=window.open('','_blank');if(!w)return alert('Allow pop-ups to Print / Save PDF.');
 const cssUrl=new URL(STYLE,document.baseURI).href;
 w.addEventListener('load',()=>{w.focus();w.print()},{once:true});
 w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(number(x,k,i))+'</title><link rel="stylesheet" href="'+cssUrl+'"></head><body>'+docHTML(x,k,t,i)+'</body></html>');w.document.close();
}
window.axDocumentThemeStudio=function(){
 const deck='<div id="axTSDeck" class="axThemeDeck">'+Object.entries(names).map(([t,caption])=>'<button data-layout="'+esc(t)+'" type="button" aria-pressed="false"><b>'+esc(caption)+'</b></button>').join('')+'</div>';
 show('Aerovex Document Theme Studio','<div id="axTSApp"><p><b>10 original A4 print designs</b> — each has a different page structure, table/line presentation, header and footer. Saved data is read-only.</p>'+deck+'<div class="axThemeControls"><label>Document<select id="axTSKind"><option value="quote">Quotation</option><option value="invoice">Tax Invoice</option></select></label><label>Saved Entry<select id="axTSDoc"></select></label><label>Layout<select id="axTSTheme">'+Object.entries(names).map(([t,label])=>'<option value="'+t+'">'+esc(label)+'</option>').join('')+'</select></label></div><p><button type="button" id="axTSSaveTheme">Save Theme Preference</button> <button type="button" id="axTSPrint" class="primary">Print / Save PDF</button></p><p id="axTSNotice" role="status"></p><div id="axTSPreview"></div></div>');
 $('axTSKind').onchange=redraw;$('axTSDoc').onchange=preview;$('axTSTheme').onchange=preview;$('axTSSaveTheme').onclick=storePref;$('axTSPrint').onclick=printDoc;
 $('axTSDeck').querySelectorAll('button[data-layout]').forEach(b=>b.onclick=()=>{$('axTSTheme').value=b.dataset.layout;preview()});redraw();
};
function install(){
 if($('axThemePanel'))return;
 const anchor=$('accounts')?.closest('.panel')||document.querySelector('main');if(!anchor)return;
 const p=document.createElement('section');p.className='panel';p.id='axThemePanel';
 p.innerHTML='<div class="panelHead"><h2>Document Theme Studio</h2><span>10 Unique Layouts · Quotation / Invoice</span></div><div><button type="button" id="axThemeOpen" class="primary">🎨 Preview 10 Premium Print Layouts</button><p>Every layout has different structure — not simply a new color.</p></div>';anchor.insertAdjacentElement('afterend',p);$('axThemeOpen').onclick=window.axDocumentThemeStudio;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
