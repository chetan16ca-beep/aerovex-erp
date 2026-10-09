/* Aerovex ERP visual refresh, watermark and safe record correction tools */
(function(){
const style=document.createElement('style');
style.textContent=`
:root{--ax-ink:#182d40;--ax-blue:#16617c;--ax-line:#e3e9ef}
body{background:#f5f7fa!important;color:#243548!important;font-family:Inter,Arial,sans-serif!important}
body>header{height:76px!important;background:#fff!important;color:#172c3c!important;border-bottom:1px solid #e4eaf0!important;box-shadow:0 2px 12px #172c3c08!important}
body>header .brand b{color:#12394f!important;letter-spacing:.06em;font-size:16px}
body>header .brand small{color:#697b88!important}
.brand .mark{background:#edf4f7!important;color:#12617b!important;border:1px solid #d4e3eb!important;border-radius:10px!important}
main{max-width:1380px!important;padding:24px!important}
.hero{background:#fff!important;color:#19384c!important;border:1px solid #e0e8ef!important;border-left:5px solid #16708a!important;box-shadow:0 5px 20px #1c3c5408!important;border-radius:12px!important;padding:25px 30px!important}
.hero h1{font-size:30px!important;font-weight:800!important;color:#19384c!important}
.hero p,.hero small{color:#607987!important}
.hero .status{background:#eff7f8!important;color:#17627b!important;border:1px solid #d6e8ed!important}
.panel,.tile,.kpi,.quick button,.sheet{background:#fff!important;border:1px solid #e0e7ee!important;box-shadow:0 3px 14px #24354809!important;border-radius:11px!important}
.panel{padding:22px!important}
.panelHead h2{color:#183a50!important;font-size:17px!important}
.tile:hover,.quick button:hover{border-color:#3d8fa8!important;background:#f3fafc!important}
button.primary,.primary{background:#156780!important;color:white!important;border-radius:7px!important}
input,select,textarea{border:1px solid #c6d4df!important;border-radius:6px!important;padding:10px!important}
.axQuotePrint,.axDocPaper{position:relative;isolation:isolate}
.axQuotePrint::before,.axDocPaper::before{content:'';position:absolute;inset:15% 8%;background-image:var(--ax-watermark-url,none);background-size:72% auto;background-repeat:no-repeat;background-position:center;opacity:.065;pointer-events:none;z-index:0}
.axQuotePrint>*,.axDocPaper>*{position:relative;z-index:1}
.axBrandLogo{width:44px;height:44px;object-fit:contain;display:block}
@media(max-width:700px){main{padding:12px!important}.hero{padding:17px!important}.hero h1{font-size:25px!important}.brand .mark{width:40px;height:40px}}
@media print{.axQuotePrint::before,.axDocPaper::before{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;document.head.appendChild(style);
function applyLogo(){const logo=localStorage.getItem('aerovex-logo-data');if(!logo)return;document.documentElement.style.setProperty('--ax-watermark-url','url("'+logo+'")');const mark=document.querySelector('.brand .mark');if(mark){mark.innerHTML='';const img=document.createElement('img');img.className='axBrandLogo';img.alt='Aerovex logo';img.src=logo;mark.appendChild(img)}}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.axDeleteRecord=function(key,index){if(!Array.isArray(db[key])||!db[key][index])return;const item=db[key][index],id=item.quotationNo||item.invoiceNo||item.challanNo||item.orderNo||item.poNo||item.ref||item.party||'record';if(!confirm('Delete '+id+'? This action cannot be undone.'))return;if(!confirm('FINAL CONFIRMATION: permanently delete '+id+'?'))return;db[key].splice(index,1);save();closeModal();render();alert('Record deleted.');};
window.axRecordManager=function(key,title){if(!Array.isArray(db[key]))return;const rows=db[key].map((x,i)=>'<div style="padding:10px;border-bottom:1px solid #dce9ef;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>'+safe(x.quotationNo||x.invoiceNo||x.challanNo||x.orderNo||x.poNo||x.ref||'#'+(i+1))+' — '+safe(x.party||'')+'</span><button type="button" style="color:#ad2637" onclick="axDeleteRecord(\''+key+'\','+i+')">Delete</button></div>').join('');show(title+' — Manage Entries','<p>Only delete mistaken entries. Check related vouchers or ledgers separately before deleting financial documents.</p>'+(rows||'<p>No saved entries.</p>'))};
const originalOpen=openModule;
openModule=function(name){const keys={'Quotation':'quotations','Sales Order / PO':'salesOrders','Delivery Challan':'challans','Purchase Order':'purchaseOrders','Purchase':'purchases','Sales Invoice':'invoices'};const result=originalOpen(name);if(keys[name]){const box=document.getElementById('modalBody');if(box){const b=document.createElement('button');b.type='button';b.textContent='Manage / Delete Mistake Entry';b.style.margin='12px 0';b.onclick=()=>axRecordManager(keys[name],name);box.appendChild(b)}}return result};
const oldCorporate=window.axCorporateQuotation;if(typeof oldCorporate==='function')window.axCorporateQuotation=function(){oldCorporate();const root=document.getElementById('modalBody');if(root){const b=document.createElement('button');b.type='button';b.textContent='Manage / Delete Mistake Quotation';b.onclick=()=>axRecordManager('quotations','Quotation');root.appendChild(b)}};
applyLogo();
window.axSetDocumentLogo=function(){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=()=>{const f=input.files&&input.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('aerovex-logo-data',reader.result);applyLogo();window.dispatchEvent(new Event('aerovex-logo-updated'));alert('Logo saved. Dashboard theme will match your logo.')}catch(e){alert('Use a smaller logo image')}};reader.readAsDataURL(f)};input.click()};
const btn=document.createElement('button');btn.textContent='Logo / Watermark';btn.type='button';btn.style.margin='8px';btn.onclick=window.axSetDocumentLogo;document.querySelector('.hero')?.appendChild(btn);
})();