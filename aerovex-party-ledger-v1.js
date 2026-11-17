/* Aerovex Party-wise Detailed Ledger v1.
 * Read-only: individual party, dates, invoices/purchases/receipts/payments,
 * non-duplicate vouchers & manual journal lines, running balance, A4 PDF.
 * Does NOT modify localStorage, IndexedDB, Cloud, voucher, invoice or stock.
 */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const round=v=>Math.round((Number(v)||0)*100)/100;
const norm=v=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
const array=k=>Array.isArray(db[k])?db[k]:[];
const pos=x=>Number(x)>0&&Number.isFinite(Number(x))?round(x):0;
const no=x=>String(x.documentNo||x.invoiceNo||x.no||x.supplierInvoice||x.ref||x.voucherNo||'').trim();
function dateOf(x){
 const value=String(x.date||x.invoiceDate||x.createdAt||'').trim();
 if(/^\d{4}-\d{2}-\d{2}/.test(value))return value.slice(0,10);
 const india=value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
 if(india)return india[3]+'-'+india[2].padStart(2,'0')+'-'+india[1].padStart(2,'0');
 return '';
}
function displayDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8)+'-'+value.slice(5,7)+'-'+value.slice(0,4):value||'—'}
function allParties(){
 const found=new Map();
 const add=x=>{
  const value=String(x??'').trim().replace(/\s+/g,' ');
  const key=norm(value);if(value&&key&&!found.has(key))found.set(key,value);
 };
 for(const k of ['invoices','receipts','purchases','payments','vouchers','ledger'])
  for(const x of array(k))add(x.party||x.ledgerName||x.accountName);
 for(const k of ['parties','suppliers'])
  for(const x of array(k))add(x.party||x.name||x.customerName||x.supplierName||x.f0);
 return [...found.values()].sort((a,b)=>a.localeCompare(b,'en-IN'));
}
function gather(party){
 const p=norm(party);const entries=[],alerts=[];
 const primary=new Map();
 function push(source,type,x,debit,credit){
  if(norm(x.party||x.ledgerName||x.accountName)!==p)return;
  debit=pos(debit);credit=pos(credit);
  if(!debit&&!credit)return;
  entries.push({source,type,date:dateOf(x),number:no(x),debit,credit,ref:String(x.ref||x.remarks||x.remark||x.narration||'').trim()});
 }
 const primarySpec=[
  {key:'invoices',type:'Sales Invoice',voucher:'SALES',debit:x=>x.total??(Number(x.taxable||0)+Number(x.gst||0)),credit:()=>0},
  {key:'purchases',type:'Purchase Invoice',voucher:'PURCHASE',debit:()=>0,credit:x=>x.total??x.amount},
  {key:'receipts',type:'Receipt',voucher:'RECEIPT',debit:()=>0,credit:x=>x.amount},
  {key:'payments',type:'Payment',voucher:'PAYMENT',debit:x=>x.amount,credit:()=>0}
 ];
 for(const spec of primarySpec){
  for(const x of array(spec.key)){
   if(norm(x.party)!==p)continue;
   const key=spec.voucher+'|'+norm(no(x));
   if(no(x))primary.set(key,{total:round(pos(spec.debit(x))+pos(spec.credit(x))),source:spec.type});
   push(spec.key,spec.type,x,spec.debit(x),spec.credit(x));
  }
 }
 const seenVouchers=new Set();
 for(const x of array('vouchers')){
  if(norm(x.party)!==p)continue;
  const kind=norm(x.type).replace(/\s+/g,'');
  const key=kind+'|'+norm(no(x));
  const amt=round(pos(x.debit)+pos(x.credit));
  if(primary.has(key)){
   if(Math.abs(primary.get(key).total-amt)>.009)
    alerts.push('Voucher '+(no(x)||'(unnumbered)')+' differs from '+primary.get(key).source+'; voucher not counted twice. Review amount.');
   continue;
  }
  const signature=kind+'|'+norm(no(x))+'|'+dateOf(x)+'|'+amt;
  if(seenVouchers.has(signature)){alerts.push('Duplicate voucher '+(no(x)||'(unnumbered)')+' not counted twice.');continue}
  seenVouchers.add(signature);
  push('vouchers',x.type||'Voucher',x,x.debit,x.credit);
 }
 for(const x of array('ledger')){
  if(norm(x.party||x.ledgerName||x.accountName)!==p)continue;
  if(!pos(x.debit)&&!pos(x.credit))continue;
  const signature=norm(x.type||x.voucherType)+'|'+norm(no(x))+'|'+dateOf(x)+'|'+round(pos(x.debit)+pos(x.credit));
  if(seenVouchers.has(signature))continue;
  if(no(x)&&[...primary.keys()].some(k=>k.endsWith('|'+norm(no(x))))){alerts.push('Ledger duplicate for '+no(x)+' excluded; original invoice/payment is counted.');continue}
  seenVouchers.add(signature);
  push('ledger',x.type||'Journal Entry',x,x.debit,x.credit);
 }
 entries.sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||
   (a.number||'').localeCompare(b.number||'')||a.type.localeCompare(b.type));
 return {entries,alerts};
}
function report(party,from='',to=''){
 const {entries,alerts}=gather(party);
 if(from&&to&&from>to)throw Error('From Date cannot be after To Date.');
 let opening=0,debit=0,credit=0;
 const rows=[];
 for(const x of entries){
  if(from&&x.date&&x.date<from){opening=round(opening+x.debit-x.credit);continue}
  if(to&&x.date&&x.date>to)continue;
  if((from||to)&&!x.date){alerts.push('Undated '+x.type+' '+x.number+' excluded from date filter.');continue}
  debit=round(debit+x.debit);credit=round(credit+x.credit);
  rows.push({...x,balance:round(opening+debit-credit)});
 }
 return {party,from,to,opening,debit,credit,closing:round(opening+debit-credit),rows,alerts};
}
function meta(party){
 const item=[...array('parties'),...array('suppliers')].find(x=>norm(x.party||x.name||x.customerName||x.f0)===norm(party));
 return {gstin:item?.gstin||item?.GSTIN||'',address:item?.billingAddress||item?.address||item?.f1||''};
}
function logo(){
 let result='';
 try{result=window.axSAPLogoFix?.current?.()||localStorage.getItem('aerovex-logo-data')||''}catch(_){}
 return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(result)?
 '<img alt="Aerovex Filtration original logo" src="'+E(result)+'" style="max-width:125px;max-height:72px;object-fit:contain">':'<b style="font-size:22px;color:#094d6a">AEROVEX</b>';
}
function statementHtml(model){
 const {party,from,to,opening,debit,credit,closing,rows,alerts}=model,m=meta(party);
 const dateRange=from||to?(from?displayDate(from):'Beginning')+' to '+(to?displayDate(to):'Today'):'All Transactions';
 const tableRows=[
 (from?'<tr class="opening"><td>—</td><td>OPENING</td><td>Opening Balance</td><td>—</td><td>—</td><td>'+money(opening)+(opening>=0?' Dr':' Cr')+'</td></tr>':''),
 ...rows.map((x,i)=>'<tr><td>'+E(displayDate(x.date))+'</td><td>'+E(x.type)+'</td><td><strong>'+E(x.number||'—')+'</strong>'+(x.ref?'<small style="display:block;color:#556">'+E(x.ref)+'</small>':'')+'</td><td class="amt">'+(x.debit?money(x.debit):'—')+'</td><td class="amt">'+(x.credit?money(x.credit):'—')+'</td><td class="amt">'+money(Math.abs(x.balance))+(x.balance>=0?' Dr':' Cr')+'</td></tr>')
 ].join('');
 const warnings=alerts.length?'<section class="notice"><b>Reconciliation Notes (Review):</b><ul>'+[...new Set(alerts)].map(x=>'<li>'+E(x)+'</li>').join('')+'</ul></section>':'';
 return '<article class="axPartyLedgerPrint"><style>'+
 '@page{size:A4 portrait;margin:13mm}.axPartyLedgerPrint{font:11px/1.45 Arial,sans-serif;color:#18394b;background:#fff;max-width:100%;width:100%;padding:3px}.axPartyLedgerPrint *{box-sizing:border-box}.axPartyLedgerPrint header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0b4961;padding-bottom:12px;gap:12px}.axPartyLedgerPrint header h1{font-size:18px;margin:0}.axPartyLedgerPrint header h2{font-size:16px;color:#0b4961;text-align:right;margin:0}.axPartyLedgerPrint small{font-size:10px}.axPartyLedgerPrint .party{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:13px 0}.axPartyLedgerPrint .party>div{min-width:180px;max-width:65%}.axPartyLedgerPrint .party strong{font-size:14px}.axPartyLedgerPrint .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:12px}.axPartyLedgerPrint .summary div{border:1px solid #8fb5c9;background:#f4f9fc;padding:8px}.axPartyLedgerPrint .summary b{display:block;font-size:12px}.axPartyLedgerPrint table{width:100%;border-collapse:collapse;table-layout:fixed}.axPartyLedgerPrint th,.axPartyLedgerPrint td{border:1px solid #9cb6c5;padding:7px 5px;vertical-align:top;overflow-wrap:anywhere}.axPartyLedgerPrint th{background:#dcebf3;font-size:10px;text-align:left}.axPartyLedgerPrint td.amt{text-align:right;font-variant-numeric:tabular-nums}.axPartyLedgerPrint th:nth-child(1){width:13%}.axPartyLedgerPrint th:nth-child(2){width:18%}.axPartyLedgerPrint th:nth-child(3){width:27%}.axPartyLedgerPrint th:nth-child(4),.axPartyLedgerPrint th:nth-child(5),.axPartyLedgerPrint th:nth-child(6){width:14%}.axPartyLedgerPrint thead{display:table-header-group}.axPartyLedgerPrint tr{break-inside:avoid;page-break-inside:avoid}.axPartyLedgerPrint .opening{font-weight:bold;background:#f1f6f9}.axPartyLedgerPrint tfoot{font-weight:bold;background:#eaf2f7}.axPartyLedgerPrint .notice{border:1px solid #c8a87d;background:#fff8ec;padding:8px;margin-top:12px}.axPartyLedgerPrint footer{display:flex;justify-content:space-between;margin-top:30px;gap:10px;border-top:1px solid #a0b6c2;padding-top:10px}.axPartyLedgerPrint .mark{color:#557;font-size:10px}@media print{.axPartyLedgerPrint{width:100%!important;max-width:none!important;padding:0!important}.axPartyLedgerPrint .summary div{background:#fff!important}.axPartyLedgerPrint header,.axPartyLedgerPrint tr,.axPartyLedgerPrint footer{break-inside:avoid}.axPartyLedgerPrint .notice{break-inside:avoid}}'+
 '</style><header><div>'+logo()+'<div><strong>AEROVEX FILTRATION</strong><br><small>Smart Filtration Solutions</small></div></div><div><h2>PARTY ACCOUNT LEDGER</h2><small>Statement of Account · '+E(dateRange)+'</small></div></header>'+
 '<section class="party"><div><small>PARTY / ACCOUNT</small><br><strong>'+E(party)+'</strong>'+(m.gstin?'<br>GSTIN: '+E(m.gstin):'')+(m.address?'<br>'+E(m.address):'')+'</div><div><small>Statement Generated</small><br>'+E(new Date().toLocaleDateString('en-IN'))+'<br><span class="mark">Amounts in INR</span></div></section>'+
 '<section class="summary"><div>Opening<b>'+money(Math.abs(opening))+(opening>=0?' Dr':' Cr')+'</b></div><div>Debit<b>₹ '+money(debit)+'</b></div><div>Credit<b>₹ '+money(credit)+'</b></div><div>Closing<b>'+money(Math.abs(closing))+(closing>=0?' Dr':' Cr')+'</b></div></section>'+
 '<table><thead><tr><th>Date</th><th>Type</th><th>Voucher / Invoice No.</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Balance (₹)</th></tr></thead><tbody>'+tableRows+
 (rows.length?'':'<tr><td colspan="6">No transactions found in selected period.</td></tr>')+
 '</tbody><tfoot><tr><td colspan="3">TOTAL / CLOSING BALANCE</td><td class="amt">'+money(debit)+'</td><td class="amt">'+money(credit)+'</td><td class="amt">'+money(Math.abs(closing))+(closing>=0?' Dr':' Cr')+'</td></tr></tfoot></table>'+
 warnings+'<footer><span>Prepared by: _______________</span><span>For AEROVEX FILTRATION<br>Authorized Signatory: _______________</span></footer></article>';
}
function currentReport(){
 const party=document.getElementById('axPartyLedgerSelect')?.value||'';
 if(!party)throw Error('Select a party first.');
 const from=document.getElementById('axPartyLedgerFrom')?.value||'',to=document.getElementById('axPartyLedgerTo')?.value||'';
 return report(party,from,to);
}
function update(){
 const out=document.getElementById('axPartyLedgerStatement');if(!out)return;
 try{
  const model=currentReport();
  out.innerHTML='<p><b>'+E(model.party)+'</b> · '+model.rows.length+' transactions</p>'+
   '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px"><span>Opening ₹'+money(Math.abs(model.opening))+'</span><span>Debit ₹'+money(model.debit)+'</span><span>Credit ₹'+money(model.credit)+'</span><strong>Closing ₹'+money(Math.abs(model.closing))+(model.closing>=0?' Dr':' Cr')+'</strong></div>'+
   '<p style="font-size:12px">Only this party will print. For transaction rows, use Print / Save PDF.</p>'+
   (model.alerts.length?'<p style="color:#8c4c07">⚠ '+E(model.alerts.join(' | '))+'</p>':'');
 }catch(e){out.textContent=e.message}
}
function printParty(){
 let model;try{model=currentReport()}catch(e){return alert(e.message)}
 const html=statementHtml(model),title='Aerovex Party Ledger — '+model.party;
 if(typeof window.axPrintSafe==='function')return window.axPrintSafe({html,title,landscape:false});
 const w=window.open('','_blank');
 if(!w)return alert('Please allow popups, or use updated Chrome to Print / Save PDF.');
 w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+E(title)+'</title></head><body>'+html+'</body></html>');
 w.document.close();w.focus();
 // On legacy browsers, print only on explicit second click.
 const btn=w.document.createElement('button');btn.textContent='Print / Save PDF';btn.onclick=()=>w.print();w.document.body.prepend(btn);
}
function summary(){
 const names=allParties(),rows=names.map(name=>report(name));
 const header='<h1>AEROVEX FILTRATION</h1><h2>All Parties — Ledger Summary</h2><table style="border-collapse:collapse;width:100%;font:12px Arial"><thead><tr><th>Party</th><th>Debit ₹</th><th>Credit ₹</th><th>Balance ₹</th></tr></thead><tbody>';
 const entries=rows.map(r=>'<tr><td>'+E(r.party)+'</td><td>'+money(r.debit)+'</td><td>'+money(r.credit)+'</td><td>'+money(r.closing)+'</td></tr>').join('');
 const html='<div style="font:13px Arial;color:#153c4e">'+header+entries+'</tbody></table><small>Debit positive / credit negative.</small></div>';
 return window.axPrintSafe?.({html,title:'Aerovex All Parties Summary',landscape:false})||alert('Updated PDF printing is unavailable. Reload ERP before printing.');
}
function openLedger(){
 const names=allParties();
 const opts=names.map(p=>'<option value="'+E(p)+'">'+E(p)+'</option>').join('');
 const html='<div class="axPartyLedgerUI" style="border:1px solid #bfd4e0;background:#f4fafc;padding:12px;border-radius:10px">'+
  '<p style="font-weight:bold">INDIVIDUAL PARTY LEDGER / STATEMENT</p>'+
  '<label style="display:block">Select Party / Account<select id="axPartyLedgerSelect" style="width:100%;padding:12px;margin-top:6px"><option value="">-- Select Party --</option>'+opts+'</select></label>'+
  '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0"><label>From Date (optional)<input id="axPartyLedgerFrom" type="date" style="display:block;padding:10px"></label><label>To Date (optional)<input id="axPartyLedgerTo" type="date" style="display:block;padding:10px"></label></div>'+
  '<div id="axPartyLedgerStatement" role="status" style="padding:10px;border:1px solid #c4dce6;background:#fff">Select a party to see their ledger.</div>'+
  '<p style="display:flex;flex-wrap:wrap;gap:8px"><button id="axPartyLedgerPrintOne" type="button" class="primary" style="min-height:48px">🖨 Print Selected Party / Save PDF</button>'+
  '<button id="axPartyLedgerPrintAll" type="button" style="min-height:48px">Print All Parties Summary</button></p>'+
  '<p style="color:#46637a;font-size:12px">Read-only. Invoice + Purchase + Receipt + Payment + unmatched vouchers. Existing documents and cloud data will not change.</p></div>';
 show('Party Ledger — Individual Print',html);
 for(const key of ['axPartyLedgerSelect','axPartyLedgerFrom','axPartyLedgerTo']){
  const node=document.getElementById(key);if(node)node.onchange=update;
 }
 document.getElementById('axPartyLedgerPrintOne').onclick=printParty;
 document.getElementById('axPartyLedgerPrintAll').onclick=summary;
}
window.axPartyLedgerOpen=openLedger;
window.axPartyLedgerPrint=printParty;
window.axPartyLedgerReadOnly={allParties,report,statementHtml};
const former=window.openModule||openModule;
window.openModule=function(name){if(name==='Party Ledger')return openLedger();return former.apply(this,arguments)};
})();
