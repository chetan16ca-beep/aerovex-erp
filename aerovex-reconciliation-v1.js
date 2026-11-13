/* Aerovex GST / bank matching assistant v1.
 * Read-only, locally processed, no books edits, filings, or ITC claims.
 * Accepts normalized CSV exports; original source documents require CA review.
 */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S=v=>String(v??'').trim();
const N=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/[₹,\s]/g,''));return Number.isFinite(n)?n:null};
const money=v=>N(v)===null?'—':'₹ '+N(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=v=>S(v).toUpperCase().replace(/\s+/g,'');
const normInvoice=v=>norm(v).replace(/[-/\\]/g,'');
const gstin=v=>norm(v);
const byId=id=>document.getElementById(id);
const arr=k=>Array.isArray(db[k])?db[k]:[];
const fmt=(headers,rows)=>'<div style="overflow:auto;max-width:100%"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:12px"><thead><tr>'+headers.map(s=>'<th style="padding:9px;border:1px solid #dae5eb;background:#eef5f9;text-align:left">'+E(s)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td style="padding:9px;border:1px solid #dae5eb;vertical-align:top">'+E(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function parseCSV(input){
 const src=String(input).replace(/^\uFEFF/,'');let rows=[],r=[],cell='',quoted=false;
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(ch==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(ch===','&&!quoted){r.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){r.push(cell);cell='';if(r.some(x=>S(x)))rows.push(r);r=[];if(ch==='\r'&&src[i+1]==='\n')i++}
  else cell+=ch;
 }
 if(quoted)throw Error('CSV has an unclosed quote.');
 r.push(cell);if(r.some(x=>S(x)))rows.push(r);
 if(rows.length<2)throw Error('CSV needs a header and at least one data row.');
 if(rows.length>20001)throw Error('Maximum 20,000 CSV records per import.');
 const hdr=rows.shift().map(x=>norm(x).replace(/[^A-Z0-9]/g,''));
 return rows.map((cells,i)=>({line:i+2,get:(...names)=>{for(const name of names){const j=hdr.indexOf(norm(name).replace(/[^A-Z0-9]/g,''));if(j>=0)return S(cells[j])}return ''}}));
}
const key=(g,n)=>gstin(g)+'|'+normInvoice(n);
function gstRows(){
 return arr('purchases').map((x,i)=>({x,i,ref:S(x.supplierInvoice),gstin:S(x.gstin),amount:N(x.gst),taxable:N(x.taxable)})).filter(o=>!['cancelled','void'].includes(norm(o.x.status)));
}
function showGST(records){
 const idx=new Map();records.forEach(o=>{const k=key(o.gstin,o.invoice);idx.set(k,[...(idx.get(k)||[]),o])});
 const existing=gstRows(),out=[],seen=new Set();
 for(const a of existing){
  const k=key(a.gstin,a.ref),valid=a.gstin&&a.ref&&a.amount!==null;
  let label='Needs ERP details',reported='',difference='';
  if(valid){
   const found=idx.get(k)||[];
   if(found.length===0)label='Not in imported file';
   else if(found.length>1)label='Duplicate imported rows — review';
   else{
    seen.add(k);reported=money(found[0].gst);
    if(found[0].gst===null)label='Missing GST in import';
    else if(Math.abs(a.amount-found[0].gst)<=0.02 && (a.taxable===null||found[0].taxable===null||Math.abs(a.taxable-found[0].taxable)<=0.02))label='Matched amounts — CA review';
    else{label='Mismatch';difference=money(a.amount-found[0].gst)}
   }
  }
  out.push([a.x.party||'—',a.ref||'—',a.gstin||'—',money(a.amount),reported,label,difference]);
 }
 const keysOfERP=new Set(existing.map(o=>key(o.gstin,o.ref)));
 const extra=records.filter(o=>!keysOfERP.has(key(o.gstin,o.invoice)));
 const counts={matched:out.filter(x=>x[5]==='Matched amounts — CA review').length,mismatch:out.filter(x=>x[5]==='Mismatch').length,other:out.filter(x=>!['Matched amounts — CA review','Mismatch'].includes(x[5])).length,notInERP:extra.length};
 byId('axReconResult').innerHTML='<p><b>ERP Purchase Bills: '+out.length+'</b> | Amount-matched: '+counts.matched+' | Mismatch: '+counts.mismatch+' | Check missing/duplicates: '+counts.other+' | Import rows absent from ERP: '+counts.notInERP+'</p>'+fmt(['Supplier','Supplier Bill','GSTIN','ERP GST','Imported GST','Result','GST difference'],out.slice(0,500))+ (out.length>500?'<p>Showing first 500 bills; review all in your CA system.</p>':'')+
 (extra.length?'<h3>In import, not in ERP</h3>'+fmt(['GSTIN','Supplier Bill','GST'],extra.slice(0,100).map(o=>[o.gstin,o.invoice,money(o.gst)])):'')+
 '<p><b>Important:</b> This compares uploaded file only; no proof the supplier filed the correct return. ITC eligibility, reversals, B2B classification, periods, and statutory GST reconciliation require CA verification. No ITC status is written to ERP.</p>';
}
function gstScreen(){
 show('GSTR-2B Purchase Matching — Review Only','<div id="axReconGST"><p>Upload a <b>normalized CSV</b> with headers <code>GSTIN,InvoiceNo,Taxable,GST</code>. Convert portal exports to this four-column format first. Raw portal JSON formats are not accepted automatically.</p><input id="axGSTFile" type="file" accept=".csv,text/csv"><div id="axReconResult" aria-live="polite">No file imported. ERP purchase data is unchanged.</div></div>');
 byId('axGSTFile').onchange=async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  if(file.size>4000000){byId('axReconResult').textContent='Maximum CSV file size is 4 MB.';return}
  try{
   const rows=parseCSV(await file.text()).map(r=>({gstin:r.get('GSTIN','SupplierGSTIN','CTIN'),invoice:r.get('InvoiceNo','InvoiceNumber','SupplierBillNo'),gst:N(r.get('GST','TotalGST','TaxAmount')),taxable:N(r.get('Taxable','TaxableValue'))}));
   if(!rows.length||rows.some(x=>!x.gstin||!x.invoice||x.gst===null))throw Error('Required GSTIN, InvoiceNo and GST columns missing or invalid.');
   showGST(rows);
  }catch(e){byId('axReconResult').textContent='Import rejected: '+e.message}
 };
}
function bankEntries(){
 const rows=[];
 for(const [key,type] of [['receipts','Credit'],['payments','Debit']])arr(key).forEach((x,i)=>rows.push({type,party:S(x.party),amount:N(x.amount),ref:S(x.ref||x.utr||x.UTR||x.bankRef||x.reference),doc:S(x.invoiceNo||x.no||x.date||'#'+(i+1))}));
 return rows;
}
function bankScreen(){
 show('Bank Reconciliation — Review Only','<div><p>Upload a normalized bank statement CSV with <code>Date,Description,Type,Amount,UTR</code>. Type must be Credit or Debit, amount positive. A match needs an identical UTR and amount; it is only a suggestion, not a posted transaction.</p><input id="axBankFile" type="file" accept=".csv,text/csv"><div id="axBankResult" aria-live="polite">No bank file imported. Existing receipts/payments remain unchanged.</div></div>');
 byId('axBankFile').onchange=async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  if(file.size>4000000){byId('axBankResult').textContent='Maximum CSV file size is 4 MB.';return}
  try{
   const rows=parseCSV(await file.text()).map(r=>({date:r.get('Date'),desc:r.get('Description','Narration'),type:norm(r.get('Type','TransactionType')),amount:N(r.get('Amount')),utr:r.get('UTR','Reference','BankRef')}));
   if(!rows.length||rows.some(x=>!['CREDIT','DEBIT'].includes(x.type)||x.amount===null||x.amount<=0))throw Error('CSV requires Type = Credit/Debit and positive numeric Amount.');
   const erp=bankEntries(),counts={match:0,review:0,ambiguous:0};const used=new Set();
   const out=rows.map(r=>{
    let matches=[];
    if(r.utr)matches=erp.map((x,i)=>({...x,i})).filter(e=>!used.has(e.i)&&norm(e.ref)===norm(r.utr)&&e.type.toUpperCase()===r.type&&e.amount!==null&&Math.abs(e.amount-r.amount)<=0.02);
    let status;
    if(matches.length===1){used.add(matches[0].i);status='Reference and amount matched';counts.match++}
    else if(matches.length>1){status='Multiple ERP matches — review';counts.ambiguous++}
    else{status=r.utr?'Not matched — manual review':'UTR missing — manual review';counts.review++}
    return [r.date,r.desc,r.type,money(r.amount),r.utr||'—',status];
   });
   const noMatchERP=erp.filter((_,i)=>!used.has(i));
   byId('axBankResult').innerHTML='<p><b>Imported rows: '+out.length+'</b> | Unique matched: '+counts.match+' | Unmatched: '+counts.review+' | Ambiguous: '+counts.ambiguous+' | ERP records not matched: '+noMatchERP.length+'</p>'+fmt(['Date','Narration','Direction','Amount','UTR','Result'],out.slice(0,500))+(out.length>500?'<p>Showing first 500 transactions.</p>':'')+'<p><b>Note:</b> No ERP receipts, bank records, or payment statuses are written by this tool. Verify reversals and duplicate UTRs separately.</p>';
  }catch(e){byId('axBankResult').textContent='Import rejected: '+e.message}
 };
};
function install(){
 const spot=document.getElementById('accounts')?.closest('.panel')||document.querySelector('main');if(!spot||byId('axReconPanel'))return;
 const panel=document.createElement('section');panel.className='panel';panel.id='axReconPanel';panel.innerHTML='<div class="panelHead"><h2>Account Reconciliation</h2><span>Review only — no automatic posting</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" id="axGSTMatchOpen">GSTR-2B CSV Match</button><button type="button" id="axBankMatchOpen">Bank CSV Match</button></div>';
 spot.insertAdjacentElement('afterend',panel);byId('axGSTMatchOpen').onclick=gstScreen;byId('axBankMatchOpen').onclick=bankScreen;
}
window.axAerovexReconciliation={openGST:gstScreen,openBank:bankScreen};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();