/* Aerovex Filtration — purchase bill photo -> verified Purchase Entry.
   Additive feature. OCR runs in user's browser; never posts a guessed purchase. */
(function(){
'use strict';
const OWN_GSTIN='24BPCPB7271L1ZW';
const KEY='aerovex-erp-data-v1';
const OCR_URL='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
let imageUrl='', preparedImage='', sourceFile='', pendingText='', loading=false, ocrLoader=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const fmt=v=>(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=v=>Number(String(v??'').replace(/[₹,\s]/g,'').replace(/^Rs\.?/i,''))||0;
const tidy=v=>String(v??'').replace(/\s+/g,' ').trim();
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function dateValue(s){
 const x=tidy(s).replace(/[,]/g,'');
 let m=x.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
 if(m){const y=+m[1],mo=+m[2],d=+m[3];if(mo>=1&&mo<=12&&d>=1&&d<=31)return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
 m=x.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2}|\d{2})\b/);
 if(m){const d=+m[1],mo=+m[2],y=m[3].length===2?2000+(+m[3]):+m[3];if(mo>=1&&mo<=12&&d>=1&&d<=31)return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
 m=x.match(/\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](20\d{2}|\d{2})\b/);
 if(m&&months[m[2].slice(0,3).toLowerCase()]){const y=m[3].length===2?2000+(+m[3]):+m[3];return y+'-'+String(months[m[2].slice(0,3).toLowerCase()]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0')}
 return '';
}
function findTotal(lines){
 const rx=/\b(grand\s*total|net\s*(payable|amount|total)|invoice\s*total|total\s*amount|amount\s*payable|bill\s*total)\b/i;
 for(const line of [...lines].reverse()){
  if(!rx.test(line))continue;
  const numbers=line.match(/(?:₹|Rs\.?\s*)?\d[\d,]*(?:\.\d{1,2})?/gi)||[];
  const values=numbers.map(num).filter(x=>x>0);
  if(values.length)return values[values.length-1];
 }
 return '';
}
function extractItems(lines){
 const found=[];
 for(const line of lines){
  if(/\b(total|tax|bank|account|invoice|gstin|amount\s*in|round|discount\s*total|pan|mobile|phone|payment)\b/i.test(line))continue;
  const h=line.match(/\b\d{4}(?:\d{2}){0,2}\b/);
  if(!h)continue;
  const before=tidy(line.slice(0,h.index).replace(/^\s*\d{1,3}[\s.)-]+/,''));
  if(before.length<3||before.length>150||!/[a-z]/i.test(before))continue;
  const after=line.slice(h.index+h[0].length).replace(/[₹]/g,' ');
  const numbers=(after.match(/\d[\d,]*(?:\.\d+)?/g)||[]).map(num);
  let qty='',rate='';
  // Never guess item quantities/rates unless a line's amount reconciles.
  if(numbers.length>=3){
   for(let i=0;i<=numbers.length-3;i++){
    const q=numbers[i],r=numbers[i+1],amount=numbers[i+2];
    if(q>0&&r>=0&&amount>=0&&Math.abs(q*r-amount)<=Math.max(1,amount*0.002)){qty=q;rate=r;break}
   }
  }
  found.push({description:before,hsn:h[0],qty,rate,unit:'Nos',discount:0});
  if(found.length>=30)break;
 }
 return found;
}
function parseBill(text){
 const lines=String(text||'').split(/\r?\n/).map(tidy).filter(Boolean);
 const joined=lines.join('\n');
 const gstins=[...new Set((joined.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g)||[]))];
 const gstin=gstins.find(x=>x!==OWN_GSTIN)||'';
 let invoice='';
 const invRx=/\b(?:invoice|inv\.?|bill)\b\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{1,35})/i;
 for(const l of lines){
  const m=l.match(invRx);
  if(m&&!/^(?:no|number|date|tax|gst|gstin|invoice|bill)$/i.test(m[1])){invoice=m[1];break}
 }
 const dated=lines.filter(x=>/\b(invoice|bill)\s*date\b|\bdate\s*[:#-]/i.test(x));
 const date=([...dated,...lines].map(dateValue).find(Boolean))||'';
 let party='';
 for(const line of lines.slice(0,18)){
  const m=line.match(/^(?:supplier|seller|vendor|from|m\/s\.?)\s*[:\-]\s*(.{4,90})$/i);
  if(m&&!/\b(gstin|invoice|tax)\b/i.test(m[1])){party=m[1];break}
 }
 if(!party){
  const candidate=lines.slice(0,10).find(x=>x.length>=5&&x.length<=75&&/[A-Z]{3}/i.test(x)&&!/\b(tax invoice|invoice|gst|bill|date|original|duplicate|phone|mobile|email|address|state|supply|copy|cash memo|eway|bank|pan|www|road|street|amount)\b/i.test(x)&&!/\d{4,}/.test(x));
  party=candidate||'';
 }
 const isInter=/\bIGST\b/i.test(joined);
 const isIntra=/\bCGST\b|\bSGST\b/i.test(joined);
 const taxType=isInter&&!isIntra?'IGST':isIntra&&!isInter?'CGST+SGST':gstin?(gstin.slice(0,2)==='24'?'CGST+SGST':'IGST'):'';
 return {party,supplierInvoice:invoice,date,gstin,taxType,ocrTotal:findTotal(lines),items:extractItems(lines),ocrText:joined};
}
function status(t){
 const el=document.getElementById('axOCRStatus');
 if(el)el.textContent=t;
}
function loadOCR(){
 if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
 if(ocrLoader)return ocrLoader;
 ocrLoader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=OCR_URL;script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(Error('OCR library unavailable'));
  script.onerror=()=>reject(Error('OCR library download failed. Internet required for first scan.'));
  document.head.appendChild(script);
 }).catch(e=>{ocrLoader=null;throw e});
 return ocrLoader;
}
function imageForOCR(file){
 return new Promise((resolve,reject)=>{
  const image=new Image(),url=URL.createObjectURL(file);
  image.onload=()=>{
   try{
    const scale=Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
    const cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(image.naturalWidth*scale));
    cv.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.drawImage(image,0,0,cv.width,cv.height);
    resolve(cv.toDataURL('image/jpeg',0.92));
   }catch(e){reject(e)}finally{URL.revokeObjectURL(url)}
  };
  image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image cannot be opened'))};
  image.src=url;
 });
}
async function useFile(file){
 if(!file||loading)return;
 if(!/^image\//i.test(file.type))return status('Please select an image file (JPG, PNG, or phone photo).');
 if(file.size>18*1024*1024)return status('Image is too large. Please use a photo under 18 MB.');
 if(imageUrl)URL.revokeObjectURL(imageUrl);
 imageUrl=URL.createObjectURL(file);sourceFile=file.name||'camera-photo.jpg';loading=true;
 status('Preparing photo...');
 try{
  preparedImage=await imageForOCR(file);
  const ocr=await loadOCR();
  status('Reading bill on this device... (first use needs internet)');
  const worker=await ocr.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')status('Reading bill: '+Math.round((m.progress||0)*100)+'%')}});
  let result;
  try{result=await worker.recognize(preparedImage)}finally{await worker.terminate()}
  pendingText=result?.data?.text||'';
  showReview(parseBill(pendingText));
 }catch(e){
  console.error('Purchase bill OCR',e);
  status('Photo could not be read automatically: '+String(e.message||e)+'. Use Manual Review instead.');
  const b=document.getElementById('axOCRManual');if(b)b.hidden=false;
 }finally{loading=false}
}
function openUpload(){
 if(imageUrl)URL.revokeObjectURL(imageUrl);
 imageUrl='';preparedImage='';sourceFile='';pendingText='';loading=false;
 show('Purchase Bill Photo → Purchase Entry',
  '<div id="axBillUpload" style="line-height:1.65">'+
  '<p>Upload supplier bill photo. Bill details will fill an editable purchase draft. <b>No record is saved until you confirm.</b></p>'+
  '<label style="display:block;margin:12px 0">Choose bill photo (JPG / PNG)<input id="axOCRFile" type="file" accept="image/*" style="display:block;width:100%;margin-top:8px"></label>'+
  '<label style="display:block;margin:12px 0">Or take a new photo<input id="axOCRCamera" type="file" accept="image/*" capture="environment" style="display:block;width:100%;margin-top:8px"></label>'+
  '<p id="axOCRStatus" role="status">Ready for a clear, full-page bill photo. English printed bills work best.</p>'+
  '<button id="axOCRManual" type="button" hidden>Open manual Purchase draft</button>'+
  '<p><small>Recognition works in the browser using Tesseract; the picture is not uploaded to Aerovex cloud. Check the supplier, invoice number, date, HSN, GST and amounts before saving.</small></p></div>');
 for(const id of ['axOCRFile','axOCRCamera'])document.getElementById(id).addEventListener('change',e=>useFile(e.target.files?.[0]));
 document.getElementById('axOCRManual').addEventListener('click',()=>showReview(parseBill(pendingText)));
}
function input(label,name,value,type,more){
 return '<label>'+esc(label)+'<input name="'+name+'" type="'+(type||'text')+'" value="'+esc(value??'')+'" '+(more||'')+'></label>';
}
function itemHTML(z){
 z=z||{};
 return '<fieldset class="axOCRLine" style="border:1px solid #c3d5de;padding:9px;margin:8px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px">'+
 '<label style="grid-column:1/-1">Product / Description<input data-bill-field="description" value="'+esc(z.description||'')+'" required></label>'+
 '<label>HSN<input data-bill-field="hsn" inputmode="numeric" maxlength="8" value="'+esc(z.hsn||'')+'" required></label>'+
 '<label>Qty<input data-bill-field="qty" inputmode="decimal" type="number" min="0.001" step="any" value="'+esc(z.qty??'')+'" required></label>'+
 '<label>Unit<input data-bill-field="unit" value="'+esc(z.unit||'Nos')+'"></label>'+
 '<label>Rate (before GST)<input data-bill-field="rate" inputmode="decimal" type="number" min="0" step="any" value="'+esc(z.rate??'')+'" required></label>'+
 '<label>Discount %<input data-bill-field="discount" inputmode="decimal" type="number" min="0" max="100" step="any" value="'+esc(z.discount??0)+'"></label>'+
 '<button type="button" class="axOCRRemove" style="grid-column:1/-1">Remove item</button></fieldset>';
}
function showReview(info){
 info=info||{};
 const items=info.items?.length?info.items:[{description:'',hsn:'',qty:'',rate:'',unit:'Nos',discount:0}];
 const ttype=info.taxType||'';
 show('Review & Save Purchase Bill',
  '<p><b>Please verify the photo details.</b> OCR can misread invoice numbers, quantities and tax. Saving requires a valid HSN in Aerovex HSN & GST Tax Master.</p>'+
  (imageUrl?'<img alt="Original bill photo" src="'+esc(imageUrl)+'" style="max-width:100%;max-height:245px;object-fit:contain;border:1px solid #ddd;border-radius:9px;margin:6px 0">':'')+
  '<form id="axOCRPurchaseForm" class="form">'+
  input('Supplier Name','party',info.party,'text','required')+
  input('Supplier Bill No.','supplierInvoice',info.supplierInvoice,'text','required')+
  input('Bill Date','date',info.date||'','date','required')+
  input('Supplier GSTIN','gstin',info.gstin,'text','maxlength="15"')+
  '<label>Tax Type<select name="taxType" required><option value="">Choose GST Type</option>'+
   ['CGST+SGST','IGST','Exempt'].map(x=>'<option value="'+x+'"'+(ttype===x?' selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
  input('Place of Supply / State','place',info.gstin?.slice(0,2)==='24'?'Gujarat':'')+
  '<label>Payment Status<select name="paymentStatus"><option>Pending</option><option>Paid</option><option>Partial</option></select></label>'+
  '<label>Input Tax Credit<select name="itcEligible"><option value="Review">Review with CA</option><option value="Yes">Eligible (verified)</option><option value="No">Not eligible</option></select></label>'+
  input('Bill Total printed (for matching)','ocrTotal',info.ocrTotal,'number','min="0" step=".01" placeholder="Optional"')+
  input('Remarks','narration','Imported from bill photo')+
  '<div class="full"><h3>Bill Items</h3><div id="axOCRLines">'+items.map(itemHTML).join('')+'</div>'+
  '<button id="axOCRAddLine" type="button">+ Add item</button></div>'+
  '<div id="axOCRTotals" class="full" role="status" style="padding:12px;border:1px solid #ddd;border-radius:8px"></div>'+
  '<div class="full"><button id="axOCRSave" class="primary" type="submit">Confirm & Save Purchase Entry</button> <button id="axOCRBack" type="button">Choose another photo</button></div></form>'+
  '<details><summary>Show extracted OCR text (check against bill)</summary><textarea id="axOCRRaw" style="width:100%;min-height:160px" spellcheck="false">'+esc(info.ocrText||pendingText)+'</textarea><button id="axOCRReparse" type="button">Re-read corrected text</button></details>');
 const f=document.getElementById('axOCRPurchaseForm');
 const lines=document.getElementById('axOCRLines');
 lines.addEventListener('click',e=>{if(e.target.closest('.axOCRRemove')){if(lines.children.length===1)return alert('At least one item is required.');e.target.closest('.axOCRLine').remove();updateTotals()}});
 document.getElementById('axOCRAddLine').onclick=()=>{lines.insertAdjacentHTML('beforeend',itemHTML({}));updateTotals()};
 document.getElementById('axOCRBack').onclick=openUpload;
 document.getElementById('axOCRReparse').onclick=()=>{pendingText=document.getElementById('axOCRRaw').value;showReview(parseBill(pendingText))};
 f.addEventListener('input',updateTotals);f.addEventListener('change',updateTotals);
 f.addEventListener('submit',saveConfirmed);
 updateTotals();
}
function readItems(){
 return [...document.querySelectorAll('#axOCRLines .axOCRLine')].map(line=>{
  const read=k=>line.querySelector('[data-bill-field="'+k+'"]')?.value||'';
  return {description:tidy(read('description')),hsn:read('hsn').replace(/\D/g,''),qty:read('qty'),unit:tidy(read('unit'))||'Nos',rate:read('rate'),discount:read('discount')||0};
 });
}
function taxFrom(form){
 if(!window.axHSNApplyLines)return {ok:false,error:'HSN & GST module has not loaded. Reload ERP.'};
 return window.axHSNApplyLines(readItems(),form.elements.taxType.value);
}
function updateTotals(){
 const f=document.getElementById('axOCRPurchaseForm'),box=document.getElementById('axOCRTotals');
 if(!f||!box)return;
 const raw=readItems();
 if(raw.some(x=>!x.description||!x.hsn||!(Number(x.qty)>0)||String(x.rate).trim()==='')){
  box.textContent='Fill each item description, HSN, quantity and rate. GST and bill total will be calculated automatically.';return;
 }
 const tax=taxFrom(f);
 if(!tax.ok){box.textContent='⚠ '+tax.error;return}
 const printed=num(f.elements.ocrTotal.value);
 const difference=printed?Math.abs(tax.total-printed):0;
 box.innerHTML='<b>Taxable: ₹'+fmt(tax.taxable)+' | GST: ₹'+fmt(tax.gst)+' | Total: ₹'+fmt(tax.total)+'</b>'+
 (printed&&difference>1?'<p style="color:#a32923">⚠ Printed bill total ₹'+fmt(printed)+' differs by ₹'+fmt(difference)+'. Check items, freight, discounts, OCR and tax before saving. Clear the printed total only if OCR read it incorrectly.</p>':'');
}
function nextPurchaseNumber(){
 let max=0;for(const p of db.purchases||[]){
  const m=String(p.invoiceNo||p.documentNo||'').match(/^AFX\/PUR\/(\d+)$/i);
  if(m)max=Math.max(max,Number(m[1]));
 }
 return 'AFX/PUR/'+String(max+1).padStart(4,'0');
}
function saveConfirmed(e){
 e.preventDefault();
 const f=e.currentTarget,data=Object.fromEntries(new FormData(f)),items=readItems();
 const vendor=tidy(data.party),bill=tidy(data.supplierInvoice),gstin=tidy(data.gstin).toUpperCase().replace(/\s+/g,'');
 if(!vendor||!bill||!data.date||!data.taxType)return alert('Supplier, bill number, date and GST Type are required.');
 if(gstin&&!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin))return alert('Supplier GSTIN is invalid. Check 15 characters or leave blank if not registered.');
 if(items.some(x=>!x.description||!x.hsn||!(Number(x.qty)>0)||String(x.rate).trim()===''))return alert('Check product description, HSN, quantity and rate for every item.');
 const duplicates=(db.purchases||[]).filter(x=>{
  const id=tidy(x.supplierInvoice||'').replace(/[\s\/-]/g,'').toUpperCase();
  const sameVendor=gstin?tidy(x.gstin).toUpperCase()===gstin:tidy(x.party).toUpperCase()===vendor.toUpperCase();
  return id&&id===bill.replace(/[\s\/-]/g,'').toUpperCase()&&sameVendor;
 });
 if(duplicates.length)return alert('Duplicate purchase bill: this supplier invoice number is already saved. No new entry created.');
 const tax=taxFrom(f);if(!tax.ok)return alert(tax.error);
 const printed=num(data.ocrTotal);
 if(printed&&Math.abs(tax.total-printed)>1)return alert('Bill total mismatch. Please verify quantities, rates, discounts, GST and additional charges before saving. If OCR read total incorrectly, clear the printed total field.');
 const no=nextPurchaseNumber(),first=tax.items[0];
 const record={invoiceNo:no,documentNo:no,supplierInvoice:bill,date:data.date,party:vendor,gstin,
  place:tidy(data.place),taxType:data.taxType,items:tax.items,description:tax.items.length===1?first.description:first.description+' + '+(tax.items.length-1)+' more items',
  hsn:tax.items.length===1?first.hsn:'',qty:tax.items.length===1?Number(first.qty):tax.items.reduce((s,x)=>s+Number(x.qty),0),
  unit:tax.items.length===1?first.unit:'Mixed',rate:tax.items.length===1?Number(first.rate):0,
  taxable:tax.taxable,gst:tax.gst,gstRate:tax.gstRate,gstPercent:tax.gstRate,
  gstBreakup:tax.gstBreakup,cgst:tax.cgst,sgst:tax.sgst,igst:tax.igst,total:tax.total,
  itcEligible:data.itcEligible||'Review',paymentStatus:data.paymentStatus||'Pending',
  narration:tidy(data.narration),remarks:tidy(data.narration),ocrBillTotal:printed||null,
  source:'purchase-bill-photo-ocr',sourceFileName:sourceFile||'',createdAt:new Date().toISOString()};
 const beforeV=Array.isArray(db.vouchers)?db.vouchers.length:0;
 if(!Array.isArray(db.vouchers))db.vouchers=[];
 db.purchases.push(record);
 if(typeof postV==='function')postV('Purchase',no,record.date,vendor,0,tax.total,record.narration);
 try{
  save();
  const stored=JSON.parse(localStorage.getItem(KEY)||'{}');
  if(!Array.isArray(stored.purchases)||!stored.purchases.some(x=>x.invoiceNo===no&&x.supplierInvoice===bill))throw Error('Purchase could not be verified in local storage');
 }catch(error){
  db.purchases.pop();db.vouchers.splice(beforeV);
  alert('Purchase was NOT saved: '+String(error.message||error));return;
 }
 render();
 show('Purchase Entry Saved',
  '<h3>✓ Saved: '+esc(no)+'</h3><p>Supplier: '+esc(vendor)+'<br>Supplier Invoice: '+esc(bill)+
  '<br>Items: '+tax.items.length+'<br>Taxable: ₹'+fmt(tax.taxable)+'<br>GST: ₹'+fmt(tax.gst)+
  '<br><b>Purchase Total: ₹'+fmt(tax.total)+'</b></p>'+
  '<p>Purchase Register and Voucher updated on this device. Other devices need your existing Cloud Sync process.</p>'+
  '<button type="button" id="axOCRRegister">Open Purchase Register</button> <button type="button" id="axOCRNew">Scan another bill</button>');
 document.getElementById('axOCRRegister').onclick=()=>window.axDetailedDocument('Purchase');
 document.getElementById('axOCRNew').onclick=openUpload;
}
window.axPurchaseBillPhoto=openUpload;
// Keep the existing Purchase form, print, edit and cloud-sync behaviour.
const oldDetailed=window.axDetailedDocument;
if(typeof oldDetailed==='function'){
 window.axDetailedDocument=function(type){
  const r=oldDetailed.apply(this,arguments);
  if(type==='Purchase'){
   const box=document.getElementById('modalBody');
   if(box&&!document.getElementById('axOCRLaunch')){
    const button=document.createElement('button');button.id='axOCRLaunch';
    button.type='button';button.className='primary';button.textContent='📷 Bill Photo → Auto Purchase Entry';
    button.style.margin='9px 0 15px';
    button.onclick=openUpload;
    box.insertBefore(button,box.children[1]||null);
   }
  }
  return r;
 };
}
const oldOpen=window.openModule;
window.openModule=function(name){if(name==='Purchase Bill Photo')return openUpload();return oldOpen.apply(this,arguments)};
if(Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='Purchase Bill Photo')){
 const index=modules.accounts.findIndex(x=>x[0]==='Purchase');
 modules.accounts.splice(index<0?modules.accounts.length:index+1,0,['Purchase Bill Photo','📷 Photo → OCR → Purchase Entry']);
}
try{render()}catch(e){console.warn('Purchase photo shortcut unavailable',e)}
})();
