/* Aerovex commercial comparison v1.
 * Read-only ERP comparisons; supplier bids and manual review history are stored separately.
 * Does NOT alter sales orders, quotations, invoices, GST or approvals in other modules.
 */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const QKEY='aerovex-po-quote-reviews-v1',SKEY='aerovex-supplier-bids-v1';
const $=id=>document.getElementById(id);
const str=v=>String(v??'').trim();
const norm=v=>str(v).replace(/\s+/g,' ').toUpperCase();
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const round=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
const rupee=v=>'₹'+round(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const list=k=>Array.isArray(db[k])?db[k]:[];
const load=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
function persist(k,value){try{localStorage.setItem(k,JSON.stringify(value));return true}catch(e){alert('Storage error: '+e.message+'. Nothing saved.');return false}}
const lines=x=>Array.isArray(x.items)&&x.items.length?x.items:(x.description?[x]:[]);
const id=(x,kind,i)=>str(x.quotationNo||x.orderNo||x.documentNo||x.ref)||kind+' #'+(i+1);
const td=(v,extra='')=>'<td'+extra+'>'+esc(v)+'</td>';
const caution='<p class="axCMPNote">Comparison is advisory and cannot post, edit or approve Sales Orders automatically. Verify actual PO, tax breakup and commercial terms before proceeding.</p>';
const css=document.createElement('style');
css.textContent='.axCMP{font:14px Arial,sans-serif;color:#17364b}.axCMP label{display:flex;flex-direction:column;gap:5px;font-weight:600;font-size:12px}.axCMP input,.axCMP select,.axCMP textarea{padding:10px;border:1px solid #a9c2d1;border-radius:7px;min-width:0;box-sizing:border-box;width:100%}.axCMP form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.axCMP .full{grid-column:1/-1}.axCMP .axCMPTable{overflow:auto;margin:12px 0}.axCMP table{width:100%;min-width:670px;border-collapse:collapse;font-size:12px}.axCMP td,.axCMP th{border:1px solid #d5e4ec;padding:9px;text-align:left}.axCMP th{background:#eaf3f8}.axCMPNote{font-size:12px;background:#f5f8fa;padding:10px;border-left:3px solid #55758b;line-height:1.6}.axCMPWarn{color:#a02020;font-weight:700}.axCMPGood{color:#23724b;font-weight:700}.axCMPTiles{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.axCMPTiles button{padding:12px;border:1px solid #c4dbe6;border-radius:9px;background:#eaf5fa;color:#0d4c6a;font-weight:700}';
document.head.appendChild(css);
function options(k,kind){return list(k).map((x,i)=>'<option value="'+i+'">'+esc(id(x,kind,i)+' — '+(x.party||'Unknown party'))+'</option>').join('')}
function mismatch(name,a,b,kind='text'){
 if(kind==='number'){
  if(a===undefined||a===null||a===''||b===undefined||b===null||b==='')return name+' missing';
  return Math.abs(num(a)-num(b))>0.01?name+' differs':'';
 }
 return norm(a)===norm(b)?'':name+' differs';
}
function compare(q,o){
 const issues=[];
 const check=(field,a,b,k)=>{const result=mismatch(field,a,b,k);if(result)issues.push(result)};
 check('Customer',q.party,o.party);
 check('GSTIN',q.gstin,o.gstin);
 check('Tax type',q.taxType,o.taxType);
 const a=lines(q),b=lines(o);
 if(!a.length||!b.length)issues.push('Items missing: enter or inspect full PO before accepting');
 if(a.length!==b.length)issues.push('Product line count differs ('+a.length+' vs '+b.length+')');
 const rows=[];
 for(let j=0;j<Math.max(a.length,b.length);j++){
  const x=a[j],y=b[j];
  if(!x||!y){rows.push({index:j+1,product:x?.description||y?.description||'',issues:['Unmatched product line']});continue}
  const diffs=[];
  for(const [label,prop,type] of [['Description','description','text'],['HSN','hsn','text'],['Size','size','text'],['Unit','unit','text'],['Quantity','qty','number'],['Rate','rate','number'],['Discount','discount','number']]){
   const d=mismatch(label,x[prop],y[prop],type);if(d)diffs.push(d)
  }
  if(x.gstRate!==undefined||y.gstRate!==undefined){const d=mismatch('Item GST %',x.gstRate,y.gstRate,'number');if(d)diffs.push(d)}
  if(diffs.length)issues.push('Line '+(j+1)+': '+diffs.join(', '));
  rows.push({index:j+1,product:str(x.description)||str(y.description),qQty:x.qty,oQty:y.qty,qRate:x.rate,oRate:y.rate,issues:diffs});
 }
 for(const [field,key] of [['Taxable amount','taxable'],['GST amount','gst'],['Grand total','total']]){
  const d=mismatch(field,q[key],o[key],'number');if(d)issues.push(d)
 }
 // The comparison intentionally errs toward warning for ambiguous legacy records.
 if(!str(o.ref)&&!str(o.poRef))issues.push('Customer PO reference missing or not linked');
 return {issues,rows};
}
function selected(k,selector){const i=Number($(selector)?.value);return Number.isInteger(i)?list(k)[i]:null}
function reviewKey(q,o){
 const pick=x=>({number:x.quotationNo||x.orderNo||x.documentNo||'',date:x.date||'',party:x.party||'',gstin:x.gstin||'',taxType:x.taxType||'',taxable:x.taxable,gst:x.gst,total:x.total,items:lines(x).map(z=>({description:z.description,hsn:z.hsn,size:z.size,unit:z.unit,qty:z.qty,rate:z.rate,discount:z.discount,gstRate:z.gstRate}))});
 return JSON.stringify([pick(q),pick(o)]);
}
function renderPO(){
 const q=selected('quotations','axCMPQuote'),o=selected('salesOrders','axCMPOrder'),out=$('axCMPPOResult');
 if(!out)return;
 if(!q||!o){out.innerHTML='<p>Save at least one quotation and sales order, then select both.</p>';return}
 const result=compare(q,o),issues=result.issues;
 const rows=result.rows.map(r=>'<tr>'+td(r.index)+td(r.product)+td(r.qQty??'—')+td(r.oQty??'—')+td(r.qRate??'—')+td(r.oRate??'—')+td(r.issues.length?r.issues.join('; '):'Matched')+'</tr>').join('');
 const records=load(QKEY),key=reviewKey(q,o),record=records.find(x=>x.key===key);
 out.innerHTML='<p class="'+(issues.length?'axCMPWarn':'axCMPGood')+'">'+(issues.length?issues.length+' checks required':'No differences in compared fields')+'</p>'+
 '<div class="axCMPTable"><table><thead><tr><th>#</th><th>Product</th><th>Quote Qty</th><th>PO Qty</th><th>Quote Rate</th><th>PO Rate</th><th>Checks</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p><b>Quotation:</b> '+rupee(q.total)+' | <b>Sales Order:</b> '+rupee(o.total)+'</p>'+
 (issues.length?'<p class="axCMPWarn">'+issues.map(esc).join('; ')+'</p>':'')+
 '<p>Manual review status: <b>'+esc(record?'Reviewed '+record.reviewedAt:'Not reviewed')+'</b></p>'+
 '<label>Review remarks / approved exceptions<textarea id="axCMPReviewNote" rows="3" placeholder="State customer PO verification / exception approval"></textarea></label>'+
 '<button type="button" id="axCMPMarkReviewed">Save Manual Review (no SO changes)</button>';
 $('axCMPMarkReviewed').onclick=()=>{
  const note=str($('axCMPReviewNote').value);
  if(issues.length&&!note)return alert('Explain the mismatches and approval in remarks.');
  if(!confirm('Mark comparison as manually reviewed? This does NOT authorize or save an order.'))return;
  const next=load(QKEY).filter(x=>x.key!==key);
  next.push({key,quote:id(q,'Q',0),order:id(o,'SO',0),reviewedAt:new Date().toISOString(),issues:issues.slice(),remarks:note});
  if(persist(QKEY,next))renderPO();
 };
}
window.axPOQuotationMatching=function(){
 show('PO vs Quotation — Review Only','<div class="axCMP"><h3>Customer PO / Sales Order vs Saved Quotation</h3>'+
 '<label>Saved Quotation<select id="axCMPQuote">'+options('quotations','Q')+'</select></label>'+
 '<label>Saved Customer PO / Sales Order<select id="axCMPOrder">'+options('salesOrders','SO')+'</select></label>'+caution+'<div id="axCMPPOResult"></div></div>');
 $('axCMPQuote').onchange=renderPO;$('axCMPOrder').onchange=renderPO;renderPO();
};
function cost(x){
 const qty=num(x.qty),rate=num(x.rate),disc=num(x.discount);
 const taxable=round(qty*rate*(1-disc/100)+num(x.freight)+num(x.packing)+num(x.other));
 const gst=round(taxable*num(x.gstRate)/100);
 return {taxable,gst,cash:round(taxable+gst),afterAssumedITC:round(taxable+gst*(1-num(x.assumedITC)/100))};
}
function showBids(){
 const records=load(SKEY),root=$('axCMPBids');
 if(!root)return;
 const item=norm($('axCMPItemFilter')?.value);
 const groups=records.filter(x=>!item||norm(x.item)===item);
 const rows=groups.map(x=>({x,c:cost(x)})).sort((a,b)=>a.c.cash-b.c.cash);
 const sameQty=rows.length>1 && rows.every(r=>num(r.x.qty)===num(rows[0].x.qty));
 const comparable=!!item && sameQty && rows.length>1;
 root.innerHTML='<h3>Saved Supplier Quotes ('+rows.length+')</h3>'+
 '<p class="axCMPNote">Cash outflow includes GST. Post-ITC estimate is only a scenario; claimable ITC must be verified with the CA/GSTR-2B. Freight, packing and other charges are assumed taxable at the item GST rate; edit assumptions to match each invoice. Compare the same product, specification, quantity and delivery basis.</p>'+
 (rows.length?'<div class="axCMPTable"><table><tr><th>Supplier</th><th>Product</th><th>Qty</th><th>Basic incl. extras</th><th>GST</th><th>Cash payable</th><th>Potential net after assumed ITC</th></tr>'+
 rows.map(({x,c})=>'<tr>'+td(x.supplier)+td(x.item)+td(x.qty)+td(rupee(c.taxable))+td(rupee(c.gst))+td(rupee(c.cash))+td(rupee(c.afterAssumedITC))+'</tr>').join('')+'</table></div>'+
 (comparable?'<p class="axCMPGood">Lowest quoted cash payable for selected item & identical quantity: '+esc(rows[0].x.supplier)+' — '+rupee(rows[0].c.cash)+'</p>':'<p class="axCMPWarn">No lowest-cost ranking: choose an exact product/specification and enter at least two quotes with identical quantities. Verify delivery, payment and GST terms independently.</p>'):'<p>No supplier quotes for this filter.</p>')+
 '<button type="button" id="axCMPExport">Export comparison JSON backup</button>';
 $('axCMPExport').onclick=()=>{
  const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='aerovex-supplier-bids-backup.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}
window.axSupplierRateComparison=function(){
 show('Supplier Rate Comparison','<div class="axCMP"><h3>Compare Supplier Landed Cost</h3>'+
 '<p class="axCMPNote">Manual comparison records are stored only on this device until an approved cloud-storage integration. Keep a separate JSON backup.</p>'+
 '<form id="axCMPBidForm">'+
 [['supplier','Supplier','text'],['item','Product / specification','text'],['qty','Quantity','number'],['rate','Unit basic rate ₹','number'],['discount','Discount %','number'],['freight','Freight ₹','number'],['packing','Packing ₹','number'],['other','Other taxable charges ₹','number'],['gstRate','GST rate %','number'],['assumedITC','Assumed credit % of GST (scenario only)','number']].map(([k,label,type])=>'<label>'+esc(label)+'<input name="'+k+'" type="'+type+'" '+(['supplier','item','qty','rate'].includes(k)?'required':'')+' '+(type==='number'?'min="0" step="0.01" ':'')+(['discount','gstRate','assumedITC'].includes(k)?'max="100" ':'')+'value="'+(['qty','rate','supplier','item'].includes(k)?'':'0')+'"></label>').join('')+
 '<button type="submit" class="primary full">Save Supplier Quote (comparison only)</button></form>'+
 '<label>Filter same product/specification<input id="axCMPItemFilter" placeholder="Type exact product name (blank: all)"></label><div id="axCMPBids"></div></div>');
 const form=$('axCMPBidForm');
 form.onsubmit=e=>{
  e.preventDefault();const x=Object.fromEntries(new FormData(form));
  if(!str(x.supplier)||!str(x.item)||!(num(x.qty)>0)||!Number.isFinite(Number(x.rate))||num(x.rate)<0)return alert('Enter supplier, product, valid quantity and rate.');
  for(const k of ['qty','rate','discount','freight','packing','other','gstRate','assumedITC'])if(x[k]===''||!Number.isFinite(Number(x[k]))||Number(x[k])<0)return alert('Enter a valid nonnegative number for '+k+'.');
  for(const k of ['discount','gstRate','assumedITC'])if(num(x[k])>100)return alert('Check '+k+' (0–100).');
  const next=load(SKEY);next.push({...x,savedAt:new Date().toISOString(),id:'BID-'+Date.now()});
  if(persist(SKEY,next)){form.reset();showBids()}
 };
 $('axCMPItemFilter').oninput=showBids;showBids();
};
function install(){
 const main=document.querySelector('main');if(!main||$('axCMPPanel'))return;
 const panel=document.createElement('section');panel.id='axCMPPanel';panel.className='panel';
 panel.innerHTML='<div class="panelHead"><h2>Commercial Verification</h2><span>Non-destructive review tools</span></div><div class="axCMPTiles"><button type="button" id="axCMPOpenPO">Customer PO ↔ Quotation</button><button type="button" id="axCMPOpenSupplier">Supplier Rate Comparison</button></div>';
 const account=$('accounts')?.closest('.panel');
 if(account)account.insertAdjacentElement('afterend',panel);else main.appendChild(panel);
 $('axCMPOpenPO').onclick=window.axPOQuotationMatching;
 $('axCMPOpenSupplier').onclick=window.axSupplierRateComparison;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
