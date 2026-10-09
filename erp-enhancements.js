/* Aerovex ERP visual refresh, watermark and safe record correction tools */
(function(){
const style=document.createElement('style');
style.textContent=`
:root{--ax-accent:#12637b;--ax-navy:#102f44}
body{background:linear-gradient(145deg,#eef5f8,#f9fbfc)!important;color:#173245}
body>header{background:linear-gradient(110deg,#0e3449,#176b83)!important;color:#fff!important;box-shadow:0 4px 18px #102f4422}
body>header .brand b,body>header .brand small{color:white!important}
.panel,.tile,.sheet{border:1px solid #dce9ef!important;box-shadow:0 8px 28px #1732450d;border-radius:15px!important}
.panelHead h2{color:#153d51}
button.primary,.primary{background:#12637b!important;color:#fff!important;border-radius:9px!important}
input,select,textarea{border:1px solid #b8cbd4!important;border-radius:8px!important;padding:9px!important}
.axQuotePrint{position:relative;isolation:isolate}
.axQuotePrint::before{content:'';position:absolute;inset:18% 8%;background-image:var(--ax-watermark-url,none);background-size:75% auto;background-repeat:no-repeat;background-position:center;opacity:.075;pointer-events:none;z-index:0}
.axQuotePrint>*{position:relative;z-index:1}
@media print{.axQuotePrint::before{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;document.head.appendChild(style);
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.axDeleteRecord=function(key,index){if(!Array.isArray(db[key])||!db[key][index])return;const item=db[key][index],id=item.quotationNo||item.invoiceNo||item.challanNo||item.orderNo||item.poNo||item.ref||item.party||'record';if(!confirm('Delete '+id+'? This action cannot be undone.'))return;if(!confirm('FINAL CONFIRMATION: permanently delete '+id+'?'))return;db[key].splice(index,1);save();closeModal();render();alert('Record deleted.');};
window.axRecordManager=function(key,title){if(!Array.isArray(db[key]))return;const rows=db[key].map((x,i)=>'<div style="padding:10px;border-bottom:1px solid #dce9ef;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>'+safe(x.quotationNo||x.invoiceNo||x.challanNo||x.orderNo||x.poNo||x.ref||'#'+(i+1))+' — '+safe(x.party||'')+'</span><button type="button" style="color:#ad2637" onclick="axDeleteRecord(\''+key+'\','+i+')">Delete</button></div>').join('');show(title+' — Manage Entries','<p>Only delete mistaken entries. Check related vouchers or ledgers separately before deleting financial documents.</p>'+(rows||'<p>No saved entries.</p>'))};
const originalOpen=openModule;
openModule=function(name){const keys={'Quotation':'quotations','Sales Order / PO':'salesOrders','Delivery Challan':'challans','Purchase Order':'purchaseOrders','Purchase':'purchases','Sales Invoice':'invoices'};const result=originalOpen(name);if(keys[name]){const box=document.getElementById('modalBody');if(box){const b=document.createElement('button');b.type='button';b.textContent='Manage / Delete Mistake Entry';b.style.margin='12px 0';b.onclick=()=>axRecordManager(keys[name],name);box.appendChild(b)}}return result};
const oldCorporate=window.axCorporateQuotation;if(typeof oldCorporate==='function')window.axCorporateQuotation=function(){oldCorporate();const root=document.getElementById('modalBody');if(root){const b=document.createElement('button');b.type='button';b.textContent='Manage / Delete Mistake Quotation';b.onclick=()=>axRecordManager('quotations','Quotation');root.appendChild(b)}};
const logo=localStorage.getItem('aerovex-logo-data');if(logo)document.documentElement.style.setProperty('--ax-watermark-url','url("'+logo+'")');
window.axSetDocumentLogo=function(){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=()=>{const f=input.files&&input.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('aerovex-logo-data',reader.result);document.documentElement.style.setProperty('--ax-watermark-url','url("'+reader.result+'")');alert('Logo watermark saved on this device')}catch(e){alert('Use a smaller logo image')}};reader.readAsDataURL(f)};input.click()};
const btn=document.createElement('button');btn.textContent='Logo / Watermark';btn.type='button';btn.style.margin='8px';btn.onclick=window.axSetDocumentLogo;document.querySelector('.hero')?.appendChild(btn);
})();