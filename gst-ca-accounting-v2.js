/* Aerovex GST & CA Accounting v2 — additive, working reports only.
   Never files GST returns or silently changes books. */
(function(){
'use strict';
const esc = v => String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => {const n=Number(v);return Number.isFinite(n)?n:0;};
const rnd = v => Math.round((num(v)+Number.EPSILON)*100)/100;
const fmt = v => '₹ '+rnd(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const str = v => String(v==null?'':v).trim();
const rows = kind => Array.isArray(db[kind])?db[kind]:[];
const isCancelled = x => x.cancelled===true || ['cancelled','canceled','void'].includes(str(x.status).toLowerCase());
const itcKey='aerovex-gst-ca-status-v1';
const statusSet=['Pending','Sent to CA','Filed'];
const todayMonth=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const dateMonth=x=>str(x.date).slice(0,7);
const typeOf=x=>str(x.taxType).replace(/\s/g,'').toUpperCase();
const internal=x=>str(x.invoiceNo||x.documentNo||x.no);
const billNo=(x,purchase)=>purchase?str(x.supplierInvoice):str(x.invoiceNo||x.documentNo||x.no);
const signedMoney=x=>String(rnd(x));
function taxParts(x){
 const total=rnd(x.gst);
 const t=typeOf(x);
 if(t==='EXEMPT')return {cgst:0,sgst:0,igst:0};
 if(t==='IGST')return {cgst:0,sgst:0,igst:total};
 if(t==='CGST+SGST'){
  const c=x.cgst!==undefined?rnd(x.cgst):rnd(total/2);
  const s=x.sgst!==undefined?rnd(x.sgst):rnd(total-c);
  return {cgst:c,sgst:s,igst:0};
 }
 return {cgst:rnd(x.cgst),sgst:rnd(x.sgst),igst:rnd(x.igst)};
}
function issueFlags(x,purchase){
 const flags=[];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(str(x.date)))flags.push('Check bill date');
 if(!billNo(x,purchase))flags.push(purchase?'Missing supplier bill no.':'Missing invoice no.');
 if(!str(x.party))flags.push('Missing party');
 const gstin=str(x.gstin).replace(/\s/g,'').toUpperCase();
 if(purchase&&!gstin&&num(x.gst)>0)flags.push('Verify supplier GSTIN');
 if(gstin&&!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin))flags.push('Check GSTIN');
 if(!['CGST+SGST','IGST','EXEMPT'].includes(typeOf(x)))flags.push('Check tax type');
 if(x.taxable==null||x.gst==null)flags.push('Incomplete tax values');
 const lineItems=Array.isArray(x.items)&&x.items.length?x.items:[x];
 if(lineItems.some(z=>!str(z.hsn)))flags.push('Missing HSN');
 const declared=rnd(num(x.taxable)+num(x.gst)+num(x.roundOff??x.round)+num(x.other));
 if(x.total!==undefined&&Math.abs(declared-num(x.total))>0.06)flags.push('Total/GST/round-off mismatch');
 if(purchase&&str(x.itcEligible).toLowerCase()==='yes'&&str(x.gstr2bStatus)!=='Matched')flags.push('ITC claimed without 2B match — verify');
 if(purchase&&!str(x.itcEligible))flags.push('ITC eligibility not reviewed');
 return [...new Set(flags)];
}
function records(month,purchase){
 const source=rows(purchase?'purchases':'invoices');
 return source.map((x,index)=>({x,index})).filter(o=>dateMonth(o.x)===month&&!isCancelled(o.x)).map(o=>({...o,flags:issueFlags(o.x,purchase)}));
}
function status(){
 try{const o=JSON.parse(localStorage.getItem(itcKey)||'{}');return o&&typeof o==='object'?o:{}}catch(e){return {}}
}
function monthValue(){return document.getElementById('axCAmonth')?.value||todayMonth()}
function overview(month){
 const s=records(month,false),p=records(month,true);
 const sum=(xs,k)=>rnd(xs.reduce((a,r)=>a+num(r.x[k]),0));
 const matched=p.filter(r=>str(r.x.itcEligible).toLowerCase()==='yes'&&r.x.gstr2bStatus==='Matched');
 const potential=sum(matched,'gst');
 const flagged=s.filter(r=>r.flags.length).length+p.filter(r=>r.flags.length).length;
 const output=sum(s,'gst'),input=sum(p,'gst');
 return {s,p,output,input,potential,flagged,salesTaxable:sum(s,'taxable'),purchaseTaxable:sum(p,'taxable')};
}
function invoiceLines(month,purchase){
 const collection=records(month,purchase);
 return collection.flatMap(({x,index,flags})=>{
  const items=Array.isArray(x.items)&&x.items.length?x.items:[x];
  const billTax=num(x.taxable),billGST=num(x.gst);
  const lineTaxes=items.map(z=>z.taxable!==undefined?num(z.taxable):rnd(num(z.qty)*num(z.rate)*(1-num(z.discount)/100)));
  const totalLineTax=rnd(lineTaxes.reduce((a,b)=>a+b,0));
  const allTaxEntries=items.every(z=>z.gst!==undefined&&Number.isFinite(Number(z.gst)));
  const lineGst=items.map((z,i)=>allTaxEntries?num(z.gst):items.length===1?billGST:(totalLineTax>0?rnd(billGST*lineTaxes[i]/totalLineTax):0));
  if(items.length>1&&(!allTaxEntries||Math.abs(totalLineTax-billTax)>0.06||Math.abs(rnd(lineGst.reduce((a,b)=>a+b,0))-billGST)>0.06))
   flags=flags.concat('Verify multi-item tax breakup');
  return items.map((z,i)=>{
   const gst=rnd(lineGst[i]);const tx=typeOf(x);
   const cgst=tx==='CGST+SGST'?rnd(gst/2):0;
   const sgst=tx==='CGST+SGST'?rnd(gst-cgst):0;
   const igst=tx==='IGST'?gst:0;
   return [
    x.date||'',billNo(x,purchase),purchase?internal(x):'',x.party||'',x.gstin||'',
    x.place||'',z.hsn||'',z.description||x.description||'',z.qty??x.qty??'',
    z.unit||x.unit||'',z.rate??x.rate??'',rnd(lineTaxes[i]),z.gstRate??x.gstRate??'',
    cgst,sgst,igst,gst,num(x.total),rnd(num(x.roundOff??x.round)),tx,
    purchase?(x.itcEligible||'Review'):'',purchase?(x.gstr2bStatus||'Not Checked'):'',
    [...new Set(flags)].join('; ')
   ];
  });
 });
}
const headers=['Bill Date','Supplier Bill / Sales Invoice No','Aerovex Internal Purchase ID','Party','GSTIN','Place','HSN','Item','Qty','Unit','Rate','Taxable','GST Rate %','CGST','SGST','IGST','GST Line Amount','Bill Total','Bill Round Off','Tax Type','ITC Review','GSTR-2B Status','Checks / Notes'];
function exportCSV(name,data){
 const escapeCSV=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const content='\uFEFF'+data.map(row=>row.map(escapeCSV).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function billRows(month,purchase){
 return records(month,purchase).map(({x,flags})=>{
  const t=taxParts(x);
  return [x.date||'',billNo(x,purchase),purchase?internal(x):'',x.party||'',x.gstin||'',x.place||'',
   x.hsn||'',x.description||'',x.qty??'',x.unit||'',x.rate??'',num(x.taxable),x.gstRate??'',
   t.cgst,t.sgst,t.igst,num(x.gst),num(x.total),num(x.roundOff??x.round),typeOf(x),
   purchase?(x.itcEligible||'Review'):'',purchase?(x.gstr2bStatus||'Not Checked'):'',flags.join('; ')];
 });
}
function saveITC(index,statusValue,matchValue){
 const x=rows('purchases')[index];if(!x)return alert('Purchase record not found.');
 if(!['Review','Yes','No'].includes(statusValue)||!['Not Checked','Matched','Mismatch'].includes(matchValue))return alert('Invalid review status.');
 if(x.itcEligible===statusValue&&x.gstr2bStatus===matchValue)return;
 if(statusValue==='Yes'&&!confirm('Confirm ITC eligibility was reviewed against the supplier invoice and your CA guidance? This does not file or claim ITC.'))return;
 if(matchValue==='Matched'&&!confirm('You have personally matched this purchase with GSTR-2B on GST portal? The ERP cannot verify portal data automatically.'))return;
 const original=localStorage.getItem('aerovex-erp-data-v1')||'{}';
 try{localStorage.setItem('aerovex-gst-itc-prechange-v2',original)}catch(error){return alert('ITC review NOT saved: backup failed. '+error.message)}
 const oldEligible=x.itcEligible,oldMatch=x.gstr2bStatus,oldHistory=x.editHistory;
 x.itcEligible=statusValue;x.gstr2bStatus=matchValue;
 x.editHistory=(Array.isArray(oldHistory)?oldHistory:[]).concat([{at:new Date().toISOString(),action:'GST ITC review',before:{itcEligible:oldEligible||'',gstr2bStatus:oldMatch||''}}]);
 try{
  save();
  const check=JSON.parse(localStorage.getItem('aerovex-erp-data-v1')||'{}');
  const updated=check.purchases?.[index];
  if(!updated||updated.itcEligible!==statusValue||updated.gstr2bStatus!==matchValue)throw Error('Storage verification failed');
 }catch(error){
  x.itcEligible=oldEligible;x.gstr2bStatus=oldMatch;x.editHistory=oldHistory;
  alert('ITC review NOT saved: '+error.message);return;
 }
 window.axGSTCAv2();
}
function table(headers_,body){
 return '<div style="overflow-x:auto;border:1px solid #d6e2e8;border-radius:9px"><table class="report" style="min-width:790px;width:100%"><thead><tr>'+headers_.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body.join('')+'</tbody></table></div>';
}
window.axGSTCAv2=function(){
 const m=window.axCALastMonth||todayMonth();const statuses=status();
 show('AEROVEX • GST & CA Accounting',
  '<p style="font-size:12px;color:#506878">Working GST and CA handover report. It does not file GSTR-1/GSTR-3B or confirm GSTR-2B; reconcile with GST portal and CA before filing.</p>'+
  '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px"><label>Report Month <input id="axCAmonth" type="month" value="'+esc(m)+'"></label><label>CA Status <select id="axCAstatus">'+statusSet.map(s=>'<option'+((statuses[m]||'Pending')===s?' selected':'')+'>'+s+'</option>').join('')+'</select></label></div>'+
  '<div id="axCAresults"></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" id="axCASalesCSV">Sales Bills CSV</button><button type="button" id="axCAPurchasesCSV">Purchase Bills CSV</button><button type="button" id="axCASalesHSN">Sales HSN-wise CSV</button><button type="button" id="axCAPurchaseHSN">Purchase HSN-wise CSV</button><button type="button" id="axCAPrint">Print / Save PDF</button></div>');
 const month=document.getElementById('axCAmonth'),ca=document.getElementById('axCAstatus');
 month.onchange=()=>{window.axCALastMonth=month.value;ca.value=status()[month.value]||'Pending';refresh()};
 ca.onchange=()=>{
  const old=status();old[month.value]=ca.value;
  try{localStorage.setItem(itcKey,JSON.stringify(old));}catch(e){alert('Status not saved: '+e.message)}
 };
 function dload(isPurchase,hsn){
  const value=month.value,data=hsn?invoiceLines(value,isPurchase):billRows(value,isPurchase);
  exportCSV('Aerovex-CA-'+(isPurchase?'Purchase':'Sales')+(hsn?'-HSN':'-Bills')+'-'+value+'.csv',[headers,...data]);
 }
 document.getElementById('axCASalesCSV').onclick=()=>dload(false,false);
 document.getElementById('axCAPurchasesCSV').onclick=()=>dload(true,false);
 document.getElementById('axCASalesHSN').onclick=()=>dload(false,true);
 document.getElementById('axCAPurchaseHSN').onclick=()=>dload(true,true);
 document.getElementById('axCAPrint').onclick=()=>{
  const x=overview(month.value),w=window.open('','_blank');
  if(!w){alert('Please allow popup windows for printing.');return}
  const content='<h2>AEROVEX FILTRATION — GST & CA working summary</h2><p>Month: '+esc(month.value)+' | Status: '+esc(status()[month.value]||'Pending')+'</p>'+
   '<table><tr><td>Sales invoices</td><td>'+x.s.length+'</td></tr><tr><td>Taxable sales</td><td>'+fmt(x.salesTaxable)+'</td></tr><tr><td>Output GST</td><td>'+fmt(x.output)+'</td></tr>'+
   '<tr><td>Purchase invoices</td><td>'+x.p.length+'</td></tr><tr><td>Purchase GST (unverified)</td><td>'+fmt(x.input)+'</td></tr><tr><td>CA-review potential ITC (flagged only)</td><td>'+fmt(x.potential)+'</td></tr><tr><td>Bills needing checks</td><td>'+x.flagged+'</td></tr></table>'+
   '<p>NOT an official GST return, final ITC entitlement, or tax payable computation. CA must check GSTR-2B, debit/credit notes, RCM, adjustments and portal records.</p>';
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Aerovex GST Working Report</title><style>body{font:13px Arial;padding:20px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:10px}</style></head><body>'+content+'</body></html>');
  w.document.close();setTimeout(()=>{w.focus();w.print()},350);
 };
 function refresh(){
  const x=overview(month.value),f=fmt;
  const flagged=[...x.s.map(z=>({...z,purchase:false})),...x.p.map(z=>({...z,purchase:true}))].filter(r=>r.flags.length);
  const badges='<div class="summaryCards" style="grid-template-columns:repeat(auto-fit,minmax(135px,1fr))">'+
   [['Sales',x.s.length],['Taxable Sales',f(x.salesTaxable)],['Output GST',f(x.output)],['Purchases',x.p.length],['Purchase GST',f(x.input)],['Potential ITC for CA review',f(x.potential)],['Check Required',x.flagged]].map(a=>'<div><small>'+esc(a[0])+'</small><b style="font-size:17px">'+esc(a[1])+'</b></div>').join('')+'</div>';
  const flagsTable=table(['Type','Bill Number','Party','Issue'],flagged.map(z=>'<tr><td>'+(z.purchase?'Purchase':'Sales')+'</td><td>'+esc(billNo(z.x,z.purchase))+'</td><td>'+esc(z.x.party)+'</td><td>'+esc(z.flags.join('; '))+'</td></tr>'));
  const review=x.p.map(({x:r,index,flags})=>{
   const curr=['Review','Yes','No'].includes(r.itcEligible)?r.itcEligible:'Review',matched=r.gstr2bStatus||'Not Checked';
   return '<tr><td>'+esc(billNo(r,true)||'MISSING')+'<br><small>Internal: '+esc(internal(r))+'</small></td><td>'+esc(r.party)+'</td><td>'+f(r.gst)+'</td>'+
    '<td><select data-role="eligibility" data-index="'+index+'">'+['Review','Yes','No'].map(opt=>'<option'+(curr===opt?' selected':'')+'>'+opt+'</option>').join('')+'</select></td>'+
    '<td><select data-role="2b" data-index="'+index+'">'+['Not Checked','Matched','Mismatch'].map(opt=>'<option'+(matched===opt?' selected':'')+'>'+opt+'</option>').join('')+'</select></td>'+
    '<td><button type="button" data-action="saveITC" data-index="'+index+'">Save Review</button></td></tr>';
  });
  document.getElementById('axCAresults').innerHTML=badges+
   '<p style="font-size:12px">Potential ITC is only an internal review indicator, not confirmed eligible credit or GST payable. Bills with missing GSTIN, HSN, or mismatched totals appear below.</p>'+
   '<h3>Checks before CA submission</h3>'+(flagged.length?flagsTable:'<p>All currently recorded bills passed basic field checks. CA/portal verification is still required.</p>')+
   '<h3>Purchase ITC & GSTR-2B manual review</h3>'+table(['Supplier Bill','Supplier','GST','ITC Review','GSTR-2B','Action'],review)+
   '<p style="font-size:12px">GST portal is not connected. Mark a purchase Matched only after verifying it yourself; the report does not automatically claim any credit.</p>';
  document.querySelectorAll('#axCAresults [data-action="saveITC"]').forEach(button=>{
   button.onclick=()=>{
    const i=Number(button.dataset.index);
    const eligibility=document.querySelector('#axCAresults select[data-role="eligibility"][data-index="'+i+'"]')?.value||'Review';
    const matched=document.querySelector('#axCAresults select[data-role="2b"][data-index="'+i+'"]')?.value||'Not Checked';
    saveITC(i,eligibility,matched);
   };
  });
 }
 refresh();
};
const previousOpen=window.openModule;
window.openModule=function(name){if(name==='GST Reports / CA Export'||name==='GST & CA Accounting')return window.axGSTCAv2();return previousOpen.apply(this,arguments)};
window.axGSTCA=window.axGSTCAv2;
if(Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='GST & CA Accounting'))modules.accounts.push(['GST & CA Accounting','GSTR working checks • ITC review • CA CSV']);
try{render()}catch(error){console.warn('GST CA menu refresh',error)}
})();