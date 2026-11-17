/* Aerovex Filtration — 29 AFX product codes. Source: user-approved CFM
 * category-wise numbered master; only company prefix changed EFPPL => AFX.
 * No changes to historical documents, tax, prices, stock or supplier data.
 */
(function(){
'use strict';
const rows=[
[1008,'FBD Finger Bag','AFX-FBD-019','FBD Finger Bag - 19 Finger'],
[1009,'FBD Finger Bag','AFX-FBD-037','FBD Finger Bag - 37 Finger'],
[1010,'FBD Finger Bag','AFX-FBD-31','FBD Finger Bag - 31 Finger'],
[1011,'FBD Finger Bag','AFX-FBD-12','FBD Finger Bag - 12 Finger'],
[1012,'FBD Finger Bag','AFX-FBD-08','FBD Finger Bag - 8 Finger'],
[2000,'CF Bag','AFX-CF-48-TLT','CF Bag 48" Top L/T'],
[2001,'CF Bag','AFX-CF-48-ORD','CF Bag 48" Ordinary'],
[2002,'CF Bag','AFX-CF-60-TLT','CF Bag 60" Top L/T'],
[2003,'CF Bag','AFX-CF-60-ORD','CF Bag 60" Ordinary'],
[2004,'CF Bag','AFX-CF-36-TLT','CF Bag 36" Top L/T'],
[2005,'CF Bag','AFX-CF-36-ORD','CF Bag 36" Ordinary'],
[2006,'CF Bag','AFX-CF-12-TLT','CF Bag 12" Top L/T'],
[2007,'CF Bag','AFX-CF-12-ORD','CF Bag 12" Ordinary'],
[2008,'CF Bag','AFX-CF-18-TLT','CF Bag 18" Top L/T'],
[2009,'CF Bag','AFX-CF-18-ORD','CF Bag 18" Ordinary'],
[3000,'Other Filter Bags','AFX-RNF','RNF Filter Bag'],
[3001,'Other Filter Bags','AFX-SNF','SNF Filter Bag'],
[3002,'Other Filter Bags','AFX-BFB','Basket Filter Bag'],
[3003,'Other Filter Bags','AFX-CAN','Candle Filter Bag'],
[3004,'Other Filter Bags','AFX-PNFB','Pressure Nutch Filter Bag'],
[4000,'Filter Press Cloth','AFX-FPC-26X30','Filter Press Cloth 26" x 30"'],
[4001,'Filter Press Cloth','AFX-FPC-38X42','Filter Press Cloth 38" x 42"'],
[4002,'Filter Press Cloth','AFX-FPC-52X54','Filter Press Cloth 52" x 54"'],
[4003,'Filter Press Cloth','AFX-FPC-62X64','Filter Press Cloth 62" x 64"'],
[5000,'ANFD','AFX-ANFD-DC','ANFD Dust Collector Bag'],
[5001,'ANFD','AFX-ANFD-FC','ANFD Filter Cloth'],
[6000,'Sparkler Filter Cloth Pad','AFX-SFP-19X43','Sparkler Filter Cloth Pad 19" x 43"'],
[6001,'Sparkler Filter Cloth Pad','AFX-SFP-15X43','Sparkler Filter Cloth Pad 15" x 43"'],
[6002,'Sparkler Filter Cloth Pad','AFX-SFP-25X55','Sparkler Filter Cloth Pad 25" x 55"']
].map(([itemNo,category,legacyCode,name])=>{const code='AFX-'+String(itemNo)+'-'+legacyCode.replace(/^AFX-/,'');return Object.freeze({itemNo:String(itemNo),itemCode:String(itemNo),category,code,shortCode:'AFX-'+String(itemNo),technicalCode:legacyCode,legacyCode,name,description:name,productCode:code,productName:name,source:'CFM exact category-wise numbering with AFX prefix'});});
const norm=v=>String(v??'').toUpperCase().trim().replace(/[×]/g,'X').replace(/["'″]/g,'').replace(/[^A-Z0-9]+/g,' ');
const compact=v=>norm(v).replace(/\s+/g,'');
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byCode=new Map(rows.map(x=>[x.code,x]));
const byTechnical=new Map(rows.map(x=>[x.technicalCode,x]));
const byShort=new Map(rows.map(x=>[x.shortCode,x]));
const byEFPPL=new Map(rows.flatMap(x=>[[x.code.replace(/^AFX-/,'EFPPL-'),x],[x.technicalCode.replace(/^AFX-/,'EFPPL-'),x]]));
const byItem=new Map(rows.map(x=>[x.itemNo,x]));
const byName=new Map(rows.map(x=>[compact(x.name),x]));
function resolve(value){
 const item=typeof value==='string'?{description:value}:value||{};
 const code=String(item.productCode||item.code||'').trim().toUpperCase();
 if(byCode.has(code))return byCode.get(code);
 if(byTechnical.has(code))return byTechnical.get(code);
 if(byShort.has(code))return byShort.get(code);
 if(byEFPPL.has(code))return byEFPPL.get(code);
 const itemNo=String(item.itemNo||item.itemCode||'').trim();
 if(byItem.has(itemNo))return byItem.get(itemNo);
 const desc=String(item.description||item.productName||item.name||'').trim();
 const size=String(item.size||'').trim();
 const all=norm(desc+' '+size),flat=compact(desc+' '+size),name=compact(desc);
 if(byName.has(name))return byName.get(name);
 const literal=desc.toUpperCase().match(/AFX-(?:FBD|CF|FPC|ANFD|SFP|RNF|SNF|BFB|CAN|PNFB)[A-Z0-9-]*/);
 if(literal&&byTechnical.has(literal[0]))return byTechnical.get(literal[0]);
 const lookupSize=values=>values.find(z=>flat.includes(z))||'';
 if(/\bFBD\b|\bFINGER\b/.test(all)){
  const finger=lookupSize(['19FINGER','37FINGER','31FINGER','12FINGER','8FINGER','08FINGER']);
  const digits=finger.replace('FINGER','').padStart(2,'0');
  const row=rows.find(x=>x.technicalCode.startsWith('AFX-FBD-')&&x.technicalCode.split('-').pop().replace(/^0+/,'')===String(Number(digits)));
  if(row)return row;
 }
 if(/\bCF\b|\bCENTRIFUGE\b/.test(all)){
  const sz=lookupSize(['48','60','36','12','18']);
  const top=/\bTOP\b|TLT|L\/T|TOPL\/T/i.test(desc);
  const ordinary=/\bORDINARY\b|\bORD\b/i.test(desc);
  if(sz&&(top!==ordinary)){
   const code='AFX-CF-'+sz+'-'+(top?'TLT':'ORD');
   return byTechnical.get(code)||null;
  }
 }
 if(/\bFILTER\b.*\bPRESS\b|\bFPC\b/.test(all)){
  const sz=lookupSize(['26X30','38X42','52X54','62X64']);
  if(sz)return byTechnical.get('AFX-FPC-'+sz)||null;
 }
 if(/\bSPARKLER\b|\bSFP\b/.test(all)){
  const sz=lookupSize(['19X43','15X43','25X55']);
  if(sz)return byTechnical.get('AFX-SFP-'+sz)||null;
 }
 if(/\bANFD\b|\bANF\b/.test(all)){
  if(/DUST\s*COLLECTOR|\bDC\b/i.test(desc))return byTechnical.get('AFX-ANFD-DC');
  if(/FILTER\s*CLOTH/i.test(desc))return byTechnical.get('AFX-ANFD-FC');
 }
 if(/\bRNF\b/.test(all))return byTechnical.get('AFX-RNF');
 if(/\bSNF\b/.test(all))return byTechnical.get('AFX-SNF');
 if(/\bBASKET\b/.test(all))return byTechnical.get('AFX-BFB');
 if(/\bCANDLE\b/.test(all))return byTechnical.get('AFX-CAN');
 if(/\bPRESSURE\b.*\bNUTCH\b|\bPNFB\b/.test(all))return byTechnical.get('AFX-PNFB');
 return null; // ambiguous product remains UNCODED, never guess
}
function enrich(item){
 if(!item||typeof item!=='object')return item;
 const linked=resolve(item);if(!linked)return item;
 return {...item,productCode:linked.code,itemNo:linked.itemNo,itemCode:linked.itemNo};
}
function selectedForLines(items){
 if(typeof document==='undefined')return items;
 const rowGroups=['#axMncQuote .axMncLine','#axDocForm .axDocLine','#axEditSavedForm .axEditItem'];
 for(const selector of rowGroups){
  const nodes=[...document.querySelectorAll(selector)].filter(el=>{
   const d=el.querySelector('[data-field="description"],[data-key="description"]');
   const q=el.querySelector('[data-field="qty"],[data-key="qty"]');
   return String(d?.value||'').trim()&&Number(q?.value||0)>0;
  });
  if(nodes.length!==items.length)continue;
  if(nodes.every((el,i)=>compact(el.querySelector('[data-field="description"],[data-key="description"]')?.value)===compact(items[i].description))){
   return items.map((x,i)=>{
    const el=nodes[i],code=el.querySelector('[data-field="productCode"],[data-key="productCode"]')?.value||'';
    const itemNo=el.querySelector('[data-field="itemNo"],[data-key="itemNo"]')?.value||'';
    return {...x,...(code?{productCode:code}:{}),...(itemNo?{itemNo}: {})};
   });
  }
 }
 return items;
}
function hsnWrapper(){
 const fn=window.axHSNApplyLines;
 if(typeof fn!=='function'||fn.__axAFXWrapped)return;
 const wrapped=function(items,...args){
  if(!Array.isArray(items))return fn.apply(this,arguments);
  const supplied=selectedForLines(items).map(enrich);
  const result=fn.call(this,supplied,...args);
  if(result?.ok&&Array.isArray(result.items)){
   result.items=result.items.map((x,i)=>({...x,...(supplied[i]?.productCode?{
    productCode:supplied[i].productCode,itemNo:supplied[i].itemNo,itemCode:supplied[i].itemCode
   }: {})}));
  }
  return result;
 };
 wrapped.__axAFXWrapped=true;
 window.axHSNApplyLines=wrapped;
}
function formField(row,key){
 const marker=row.classList.contains('axWOLine')?'data-k':
 row.classList.contains('axOCRLine')?'data-bill-field':
 row.classList.contains('axEditItem')?'data-key':'data-field';
 let el=row.querySelector('['+marker+'="'+key+'"]');
 if(!el){
  el=document.createElement('input');el.type='hidden';el.setAttribute(marker,key);row.appendChild(el);
 }
 return el;
}
function bindRow(row){
 if(row.dataset.axAFXBound==='1')return;
 row.dataset.axAFXBound='1';
 const desc=row.querySelector('[data-field="description"],[data-k="description"],[data-bill-field="description"],[data-key="description"]');
 if(!desc)return;
 const label=document.createElement('label');
 label.className='axAFXProductCodeChoice';
 label.style.cssText='display:block;grid-column:1/-1;padding:9px;background:#edf6fb;border:1px solid #c2dbe6;border-radius:8px;margin:6px 0;font-size:12px;font-weight:700;color:#0b4961';
 label.textContent='Main Heading — AFX Product Code (29 approved products)';
 const select=document.createElement('select');
 select.className='axAFXProductCodeSelect';select.style.cssText='display:block;width:100%;padding:11px;margin-top:6px;min-height:43px';
 select.innerHTML='<option value="">Select product code (or leave blank for custom item)</option>'+
  rows.map(x=>'<option value="'+html(x.code)+'">'+html(x.itemNo+' · '+x.code+' · '+x.name)+'</option>').join('');
 label.appendChild(select);
 const existing=String(row.querySelector('[data-field="productCode"],[data-k="productCode"],[data-bill-field="productCode"],[data-key="productCode"]')?.value||'').toUpperCase();
 const found=byCode.get(existing)||byTechnical.get(existing)||byShort.get(existing)||byEFPPL.get(existing)||resolve({description:desc.value,size:row.querySelector('[data-field="size"],[data-k="size"],[data-key="size"]')?.value});
 if(found)select.value=found.code;
 select.onchange=()=>{
  const selected=byCode.get(select.value);
  const code=formField(row,'productCode'),number=formField(row,'itemNo');
  code.value=selected?.code||'';number.value=selected?.itemNo||'';
  if(selected){
   if(!String(desc.value||'').trim())desc.value=selected.name;
   desc.dispatchEvent(new Event('input',{bubbles:true}));
  }
 };
 if(found){formField(row,'productCode').value=found.code;formField(row,'itemNo').value=found.itemNo;}
 row.prepend(label);
}
function bindSimple(form){
 if(form.dataset.axAFXSimple==='1')return;
 const input=form.querySelector('[name="description"]');
 if(!input||form.querySelector('.axWOLine,.axDocLine,.axMncLine,.axOCRLine,.axEditItem'))return;
 const heading=String(document.querySelector('#modalBody > h2')?.textContent||'').toUpperCase();
 if(!/PRODUCT|QUOTATION|WORK ORDER/.test(heading))return;
 form.dataset.axAFXSimple='1';
 const wrapper=document.createElement('label');
 wrapper.textContent='Main Heading — AFX Product Code';
 const select=document.createElement('select');select.style.cssText='display:block;width:100%;padding:12px';
 select.innerHTML='<option value="">Select 29-item product code</option>'+rows.map(x=>'<option value="'+html(x.code)+'">'+html(x.itemNo+' · '+x.code+' · '+x.name)+'</option>').join('');
 const code=document.createElement('input');code.type='hidden';code.name='productCode';
 const num=document.createElement('input');num.type='hidden';num.name='itemNo';
 select.onchange=()=>{const x=byCode.get(select.value);code.value=x?.code||'';num.value=x?.itemNo||'';if(x&&!input.value.trim())input.value=x.name;};
 wrapper.append(select,code,num);
 input.closest('label')?.before(wrapper);
}
function bind(){
 const modal=document.getElementById('modalBody');if(!modal)return;
 modal.querySelectorAll('.axMncLine,.axDocLine,.axWOLine,.axOCRLine,.axEditItem').forEach(bindRow);
 modal.querySelectorAll('form').forEach(bindSimple);
}
function renderMaster(){
 const extras=(Array.isArray(db.products)?db.products:[]).filter(x=>{const code=String(x.code||x.productCode||'').toUpperCase();return !byCode.has(code)&&!byTechnical.has(code)&&!byShort.has(code)&&!byEFPPL.has(code)});
 const content='<section style="font:13px Arial;max-width:100%;overflow:auto">'+
 '<h3>AEROVEX FILTRATION — AFX Product Code Master</h3>'+
 '<p>29 approved products • Full heading AFX-ItemNo-TechnicalCode • CFM sequence with EFPPL replaced by AFX. Custom specifications stay in Description; rates, GST and past invoices remain unchanged.</p>'+
 '<input id="axAFXMasterSearch" placeholder="Search code / item no. / description" style="width:100%;padding:12px;margin-bottom:10px">'+
 '<table style="width:100%;border-collapse:collapse;min-width:540px;font-size:12px"><thead><tr>'+
 ['Item No.','Category','AFX Product Code','Product Description'].map(v=>'<th style="padding:9px;text-align:left;border:1px solid #ccd">'+v+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(x=>'<tr class="axAFXMasterRow" data-search="'+html(norm(x.itemNo+' '+x.category+' '+x.code+' '+x.name))+'">'+
 [x.itemNo,x.category,x.code,x.name].map(v=>'<td style="padding:8px;border:1px solid #dde">'+html(v)+'</td>').join('')+'</tr>').join('')+
 '</tbody></table><p>Existing custom products: '+extras.length+' (preserved; no deletion).</p>'+
 '<p><button id="axAFXCustomProduct">Add Custom Product</button></p></section>';
 show('AFX Product Code Master — 29 Items',content);
 document.getElementById('axAFXMasterSearch').oninput=function(){
  const q=norm(this.value);
  document.querySelectorAll('.axAFXMasterRow').forEach(el=>el.hidden=!el.dataset.search.includes(q));
 };
 document.getElementById('axAFXCustomProduct').onclick=()=>previousOpen('Product Master');
}
const previousOpen=window.openModule||openModule;
window.openModule=function(name){
 if(name==='Product Master')return renderMaster();
 return previousOpen.apply(this,arguments);
};
window.axAFXCodeMaster=Object.freeze({rows:rows.slice(),resolve,enrich,match:resolve,bind,seedRows:()=>rows.map(x=>({...x}))});
hsnWrapper();
function start(){bind();const modal=document.getElementById('modalBody');if(modal&&typeof MutationObserver!=='undefined')new MutationObserver(bind).observe(modal,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
