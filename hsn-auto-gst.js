/* Aerovex HSN-wise GST Master — additive, preserves historical records. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number(x)||0;
const round=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
const norm=x=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ');
const code=x=>String(x??'').replace(/\D/g,'');
const rupees=n=>'₹'+num(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
function ensure(){
 if(!Array.isArray(db.hsnTaxMaster))db.hsnTaxMaster=[];
 // Source: Notification 09/2025-Central Tax (Rate), Schedule II, entry 179.
 // Verified 56th GST Council rate changes (effective Sep 22, 2025).
 // These heading-level rules apply only when the product is correctly classified.
 const verified=[
  {hsn:'5911',rate:5,description:'Textile products & articles for technical use (including qualifying filter cloth / bags)',source:'GST Council 56th Meeting, Annexure II, Textile Sector: 5911, 12% to 5%',verifiedOn:'2026-10-20'},
  {hsn:'8421',rate:18,description:'Filtering or purifying machinery and apparatus for liquids or gases',source:'Notification 09/2025-Central Tax (Rate), Schedule II: 8421',verifiedOn:'2026-10-20'}
 ];
 const missing=verified.filter(x=>!db.hsnTaxMaster.some(y=>code(y.hsn)===x.hsn));
 if(missing.length){db.hsnTaxMaster.push(...missing);try{save()}catch(error){console.warn('Could not seed verified HSN rates',error)}}
 if(!db.hsnTaxMaster.some(x=>code(x.hsn)==='48120000')){
  db.hsnTaxMaster.push({hsn:'48120000',rate:18,description:'Filter blocks, slabs and plates of paper pulp (verify pad classification)',source:'CBIC 09/2025-CT(R), Schedule II entry 179',verifiedOn:'2026-10-20'});
  save();
 }
}
ensure();
window.axHSNLookup=function(value){
 const h=code(value);if(![4,6,8].includes(h.length))return null;
 const list=db.hsnTaxMaster.filter(x=>x&&Number.isFinite(Number(x.rate))&&code(x.hsn));
 const exact=list.find(x=>code(x.hsn)===h);
 if(exact)return exact;
 // A broad heading can cover longer codes; never infer a heading rate from
 // one narrower 8-digit record because other subcodes can differ.
 const fits=list.filter(x=>{const y=code(x.hsn);return h.length>y.length&&h.startsWith(y)});
 fits.sort((a,b)=>code(b.hsn).length-code(a.hsn).length);
 return fits[0]||null;
};
window.axHSNApplyLines=function(lines,taxType){
 const tt=String(taxType||'').trim();
 if(!['IGST','CGST+SGST','CGST + SGST','Exempt'].includes(tt))return {ok:false,error:'Choose the correct GST Type (CGST+SGST / IGST / Exempt).'};
 if(!Array.isArray(lines)||!lines.length)return {ok:false,error:'Add at least one product.'};
 const out=[],group={};let taxable=0,gst=0;
 for(let i=0;i<lines.length;i++){
  const x=lines[i],h=code(x.hsn),m=window.axHSNLookup(h);
  if(!h||![4,6,8].includes(h.length))return {ok:false,error:'Product '+(i+1)+': enter a valid 4, 6 or 8 digit HSN.'};
  if(!m&&tt!=='Exempt')return {ok:false,error:'HSN '+h+' is not in HSN & GST Master. Verify its rate and add it there before saving.'};
  const q=Number(x.qty),r=Number(x.rate),d=Number(x.discount||0);
  if(!(q>0)||!(r>=0)||!(d>=0&&d<=100))return {ok:false,error:'Product '+(i+1)+': check quantity, rate and discount.'};
  const gstRate=tt==='Exempt'?0:Number(m.rate);
  const base=round(q*r*(1-d/100)),tax=round(base*gstRate/100);
  const item={...x,hsn:h,gstRate,taxable:base,gst:tax};
  taxable+=base;gst+=tax;out.push(item);
  const key=h+'|'+gstRate;
  if(!group[key])group[key]={hsn:h,rate:gstRate,taxable:0,gst:0};
  group[key].taxable=round(group[key].taxable+base);
  group[key].gst=round(group[key].gst+tax);
 }
 taxable=round(taxable);gst=round(gst);
 const rates=[...new Set(out.map(x=>x.gstRate))];
 return {ok:true,items:out,taxable,gst,total:round(taxable+gst),amount:round(taxable+gst),
  gstRate:rates.length===1?rates[0]:'',gstBreakup:Object.values(group),
  cgst:tt==='IGST'?0:round(gst/2),sgst:tt==='IGST'?0:round(gst-round(gst/2)),igst:tt==='IGST'?gst:0};
};
window.axHSNTaxMaster=function(editCode=''){
 ensure();
 const rows=db.hsnTaxMaster.map(x=>'<tr><td>'+esc(x.hsn)+'</td><td>'+esc(x.description)+'</td><td><b>'+esc(x.rate)+'%</b></td><td><button type="button" onclick="axHSNEdit(\''+esc(x.hsn)+'\')">Edit</button></td></tr>').join('');
 show('HSN & GST Tax Master','<p>HSN ke hisaab se GST automatically niklega. Rate change sirf yahan karein. Tax notifications aur product classification verify karke hi rate save karein; purane invoices change nahi honge.</p>'+
 '<form id="axHSNForm" class="form"><label>HSN Code<input name="hsn" required inputmode="numeric" maxlength="8" pattern="[0-9]{4}([0-9]{2})?([0-9]{2})?"></label><label>GST Rate %<input name="rate" type="number" min="0" max="100" step=".01" required></label><label class="full">Product / Classification<input name="description" required></label><label class="full">Official Notification / Verification Reference<input name="source" placeholder="CBIC notification / CA verified" required></label><div class="full"><button class="primary">Save HSN Rate</button></div></form>'+
 '<div class="reportWrap"><table class="report"><thead><tr><th>HSN</th><th>Product</th><th>GST</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
 const form=document.getElementById('axHSNForm');
 form.onsubmit=ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(form));o.hsn=code(o.hsn);o.rate=Number(o.rate);if(![4,6,8].includes(o.hsn.length)||!Number.isFinite(o.rate)||o.rate<0||o.rate>100)return alert('Valid HSN and GST rate required.');
 const old=db.hsnTaxMaster.find(x=>code(x.hsn)===o.hsn);
 if(old&&!confirm('Update GST rate for '+o.hsn+'? Existing saved bills will keep their original rates.'))return;
 const entry={...o,verifiedOn:new Date().toLocaleDateString('en-CA')};
 if(old){old.history=[...(old.history||[]),{at:new Date().toISOString(),rate:old.rate,source:old.source}];Object.assign(old,entry)}
 else db.hsnTaxMaster.push(entry);
 save();axHSNTaxMaster();
 };
 if(editCode)axHSNEdit(editCode);
};
window.axHSNEdit=function(h){
 const p=db.hsnTaxMaster.find(x=>code(x.hsn)===code(h)),f=document.getElementById('axHSNForm');if(!p||!f)return;
 for(const k of ['hsn','rate','description','source'])if(f.elements.namedItem(k))f.elements.namedItem(k).value=p[k]??'';
 f.elements.namedItem('hsn').readOnly=true;
 f.scrollIntoView({block:'nearest',behavior:'smooth'});
};
const oldProductForm=window.productForm;
window.productForm=function(){
 const rows=(db.products||[]).map((p,i)=>'<tr><td>'+esc(p.code||'')+'</td><td>'+esc(p.name||'')+'</td><td>'+esc(p.hsn||'Not set')+'</td><td>'+esc(window.axHSNLookup(p.hsn)?.rate??'Not mapped')+'%</td><td><button type="button" onclick="axProductEdit('+i+')">Edit</button></td></tr>').join('');
 show('Product Master — HSN Auto GST','<p>Product save karein; HSN Tax Master se GST auto-link hoga. Existing products retained.</p><form id="axProductHSNForm" class="form">'+
 '<label>Product Code<input name="code" value="'+nextProduct()+'" readonly></label><label>Product Name<input name="name" required></label>'+
 '<label>Item Code<input name="item"></label><label>Standard Cloth<input name="cloth"></label>'+
 '<label>Standard Width<input name="width"></label><label>Micron / Mesh<input name="micron"></label>'+
 '<label>HSN Code<input name="hsn" inputmode="numeric" maxlength="8" required></label><label>GST (Auto)<input name="gstRate" readonly placeholder="Add HSN to Tax Master"></label>'+
 '<div class="full"><button class="primary">Save Product</button> <button type="button" onclick="axHSNTaxMaster()">HSN & GST Tax Master</button></div></form>'+
 '<div class="reportWrap"><table class="report"><thead><tr><th>Code</th><th>Product</th><th>HSN</th><th>GST</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
 document.getElementById('axProductHSNForm').onsubmit=e=>{
  e.preventDefault();const f=e.currentTarget,o=Object.fromEntries(new FormData(f)),m=axHSNLookup(o.hsn);
  if(!m)return alert('HSN '+code(o.hsn)+' ka GST rate Tax Master mein set karein.');
  o.hsn=code(o.hsn);o.gstRate=Number(m.rate);
  const i=Number(f.dataset.editIndex);
  if(f.dataset.editIndex!==undefined&&Number.isInteger(i)&&db.products[i]){
   db.products[i]={...db.products[i],...o,code:db.products[i].code};
  }else db.products.push(o);
  save();productForm();render();
 };
};
window.axProductEdit=function(i){
 productForm();const p=db.products[i],f=document.getElementById('axProductHSNForm');if(!p||!f)return;
 f.dataset.editIndex=String(i);
 for(const k of ['code','name','item','cloth','width','micron','hsn'])if(f.elements.namedItem(k))f.elements.namedItem(k).value=p[k]??'';
 hydrate();
};
const originalShow=window.show;
window.show=function(){const result=originalShow.apply(this,arguments);hydrate();return result};
function rowFor(target){return target.closest('.axMncLine,.axDocLine,.axEditItem')||target.form||target.closest('form')}
function getField(row,key){return row?.querySelector('[data-field="'+key+'"],[data-key="'+key+'"],[name="'+key+'"]')}
function hydrate(){
 const form=document.querySelector('#modalBody form');if(!form)return;
 const products=(db.products||[]).filter(p=>p.name);
 let list=document.getElementById('axHSNProductsList');
 if(!list){list=document.createElement('datalist');list.id='axHSNProductsList';document.body.appendChild(list)}
 list.innerHTML=products.map(p=>'<option value="'+esc(p.name)+'"></option>').join('');
 form.querySelectorAll('[data-field=description],input[name=description],[data-key=description]').forEach(el=>{if(el.tagName==='INPUT')el.setAttribute('list',list.id)});
 if(!form.matches('#axHSNForm')){
  const gstField=form.elements?.namedItem('gstRate')||form.elements?.namedItem('gstPercent');
  if(gstField&&gstField.tagName==='INPUT')gstField.readOnly=true;
 }
 recalc(form);
}
function recalc(form){
 if(!form||!form.isConnected)return;
 const lines=[...form.querySelectorAll('.axMncLine,.axDocLine,.axEditItem')];
 const one=lines.length?lines:[form];
 let taxable=0,gst=0,missing=[],rates=[];
 for(const row of one){
  const h=getField(row,'hsn'),rate=getField(row,'rate'),qty=getField(row,'qty'),disc=getField(row,'discount');
  if(!h)continue;const map=axHSNLookup(h.value);const tt=form.elements?.namedItem('taxType')?.value||'CGST+SGST';
  const r=tt==='Exempt'?0:map?Number(map.rate):null;
  let rateLabel=row.querySelector('.axHSNRowRate');
  if(!rateLabel&&row!==form){rateLabel=document.createElement('small');rateLabel.className='axHSNRowRate';rateLabel.style.cssText='grid-column:1/-1;color:#13677a;font-weight:700';row.appendChild(rateLabel)}
  if(rateLabel)rateLabel.textContent=h.value?(r===null?'⚠ GST rate not mapped for HSN '+h.value:'HSN '+h.value+' — GST '+r+'%'):'Enter HSN to load GST %';
  if(h.value&&!map&&tt!=='Exempt')missing.push(h.value);
  if(r!==null)rates.push(r);
  const base=round(num(qty?.value||1)*num(rate?.value)*(1-num(disc?.value)/100));
  taxable+=base;gst+=round(base*num(r)/100);
 }
 const gstField=form.elements?.namedItem('gstRate')||form.elements?.namedItem('gstPercent');
 if(gstField&&gstField.tagName==='INPUT'&&!form.matches('#axHSNForm')){
  const uniq=[...new Set(rates)];gstField.value=missing.length||uniq.length!==1?'':String(uniq[0]);
  gstField.placeholder=missing.length?'HSN not mapped':uniq.length>1?'Mixed GST rates (line wise)':'Enter HSN';
 }
 const previewAllowed=form.id==='axMncQuote'||form.id==='axDocForm'||form.id==='inv'||form.id==='axEditSavedForm';
 if(previewAllowed){
  let target=form.querySelector('#axLiveTax');
  if(!target){target=document.createElement('div');target.id='axLiveTax';target.className='full';target.style.cssText='padding:11px;border:1px solid #cddde6;border-radius:9px;background:#f3fafc;font-size:14px;font-weight:600';form.appendChild(target)}
  const tt=form.elements?.namedItem('taxType')?.value||'CGST+SGST';
  target.textContent=missing.length?'HSN GST rate missing: '+[...new Set(missing)].join(', ')+'. Open HSN & GST Tax Master.':
  'Estimated Taxable '+rupees(taxable)+' | '+(tt==='IGST'?'IGST':'GST')+' '+rupees(gst)+' | Total '+rupees(taxable+gst);
 }
}
document.addEventListener('focusin',e=>{if(e.target.closest('#modalBody form'))hydrate()});
document.addEventListener('input',e=>{
 const target=e.target,form=target.closest('#modalBody form');if(!form)return;
 if(target.matches('[data-field=description],[data-key=description],input[name=description]')){
  const p=(db.products||[]).find(x=>norm(x.name)===norm(target.value));
  if(p?.hsn){const h=getField(rowFor(target),'hsn');if(h)h.value=p.hsn}
 }
 recalc(form);
});
document.addEventListener('change',e=>{const form=e.target.closest('#modalBody form');if(form)recalc(form)});
if(!modules.masters.some(x=>x[0]==='HSN & GST Tax Master'))modules.masters.push(['HSN & GST Tax Master','HSN-wise product tax rates']);
const prevOpen=window.openModule;
window.openModule=function(name){if(name==='HSN & GST Tax Master')return axHSNTaxMaster();return prevOpen.apply(this,arguments)};
render();
})();