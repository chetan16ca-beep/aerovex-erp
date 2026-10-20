/* AEROVEX FILTRATION — per-invoice commission, expenses & profit.
 * Existing invoices, vouchers, stock and expense register are never edited by this module.
 * Commission accrues on GST-exclusive taxable sale (or positive job margin if selected).
 */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const n=v=>{const value=Number(v);return Number.isFinite(value)?value:0};
const round=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
const cash=v=>'₹ '+round(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const list=k=>Array.isArray(db[k])?db[k]:[];
const invoiceNo=x=>clean(x?.invoiceNo||x?.documentNo||x?.no);
const ident=x=>invoiceNo(x).toUpperCase();
const cancelled=x=>x?.cancelled===true||x?.status==='Cancelled'||x?.status==='Canceled'||x?.status==='Void';
const activeInvoices=()=>list('invoices').map((x,i)=>({x,i})).filter(({x})=>!cancelled(x));
const agents=()=>list('commissionAgents');
const ledger=()=>db.invoiceCommissionLedger&&typeof db.invoiceCommissionLedger==='object'&&!Array.isArray(db.invoiceCommissionLedger)?db.invoiceCommissionLedger:{};
const findAgent=id=>agents().find(x=>x.id===id);
const costNames=['material','labour','freight','other'];
const baseSale=x=>{
 if(x.taxable!==undefined&&x.taxable!==''&&Number.isFinite(Number(x.taxable)))return round(x.taxable);
 const parts=Array.isArray(x.items)?x.items:[];
 if(parts.length)return round(parts.reduce((s,it)=>s+n(it.taxable||n(it.qty)*n(it.rate)*(1-n(it.discount)/100)),0));
 if(x.rate!==undefined&&x.qty!==undefined)return round(n(x.rate)*n(x.qty));
 const total=x.total??x.amount;
 if(total!==undefined&&total!=='')return round(n(total)-n(x.gst)-n(x.other)-n(x.round));
 return 0;
};
function keyFor(invoice,index){
 const id=ident(invoice);
 if(!id)return null;
 if(list('invoices').some((x,i)=>i!==index&&ident(x)===id))return null;
 return id;
}
function config(invoice,index){
 const key=keyFor(invoice,index);
 return key?ledger()[key]||null:null;
}
function calculate(invoice,record){
 const taxable=baseSale(invoice);
 const costs=Object.fromEntries(costNames.map(k=>[k,round(record?.[k]||0)]));
 const cost=round(Object.values(costs).reduce((a,b)=>a+b,0));
 const rate=n(record?.rate);
 const basis=record?.basis==='margin'?'margin':'sales';
 const marginBeforeCommission=round(taxable-cost);
 const commissionBase=basis==='margin'?Math.max(0,marginBeforeCommission):Math.max(0,taxable);
 const commission=record?.agentId?round(commissionBase*rate/100):0;
 const paid=round(record?.paidAmount||0);
 const due=round(Math.max(0,commission-paid));
 const profit=round(marginBeforeCommission-commission);
 return {taxable,cost,costs,rate,basis,marginBeforeCommission,commissionBase,commission,paid,due,profit,
  complete:!!record&&record.costConfirmed===true,hasAgent:!!record?.agentId};
}
function aggregate(){
 let taxable=0,purchases=0,expenses=0,commission=0,paid=0,configured=0,unconfigured=0,jobRevenue=0,jobCosts=0,jobCommission=0,jobProfit=0;
 const byAgent=new Map();
 for(const {x,i} of activeInvoices()){
  taxable=round(taxable+baseSale(x));
  const r=config(x,i);
  if(!r){unconfigured++;continue}
  const d=calculate(x,r);
  commission=round(commission+d.commission);paid=round(paid+d.paid);
  const agent=findAgent(r.agentId);
  if(agent){
   const p=byAgent.get(agent.id)||{name:agent.name,total:0,paid:0,due:0,invoices:0};
   p.total=round(p.total+d.commission);p.paid=round(p.paid+d.paid);p.due=round(p.due+d.due);p.invoices++;byAgent.set(agent.id,p);
  }
  if(d.complete){configured++;jobRevenue=round(jobRevenue+d.taxable);jobCosts=round(jobCosts+d.cost);jobCommission=round(jobCommission+d.commission);jobProfit=round(jobProfit+d.profit)}
  else unconfigured++;
 }
 purchases=round(list('purchases').reduce((sum,x)=>sum+n(x.taxable),0));
 expenses=round(list('expenses').reduce((sum,x)=>sum+n(x.amount),0));
 return {taxable,purchases,expenses,commission,paid,due:round(commission-paid),
  estimatedCompanyProfit:round(taxable-purchases-expenses-commission),configured,unconfigured,
  jobRevenue,jobCosts,jobCommission,jobProfit,byAgent:[...byAgent.values()]};
}
function persistCollection(field,next){
 const prior=db[field];
 db[field]=next;
 try{save();return true}catch(e){db[field]=prior;alert('Nothing saved: '+e.message);return false}
}
const message='Commission is an accrued business expense, even if not yet paid. Recording a paid amount here does not transfer money, post a bank transaction, or add another Expense Voucher.';
function agentOptions(selected){
 return '<option value="">No commission person</option>'+agents().map(x=>'<option value="'+esc(x.id)+'" '+(x.id===selected?'selected':'')+'>'+esc(x.name)+' ('+n(x.rate)+'%)</option>').join('');
}
function masterOptions(){
 return agents().map(a=>'<div class="axCommissionRow"><div><b>'+esc(a.name)+'</b><small>'+n(a.rate)+'% on '+(a.basis==='margin'?'positive job margin':'taxable sales (excl. GST)')+'</small></div><button type="button" data-agent="'+esc(a.id)+'">Edit</button></div>').join('')||'<p>No commission person saved yet.</p>';
}
let editingAgent=null,selectedInvoice=null;
function screen(){
 const summary=aggregate();
 show('Commission • Expense • Profit','<p>Assign a commission person (e.g., 15%), enter actual material and other job expenses per invoice, and see your own profit. GST is excluded from commission and sales profit.</p>'+
 '<div class="axCommissionSummary"><div><small>Net Sales (excl. GST)</small><strong>'+cash(summary.taxable)+'</strong></div>'+
 '<div><small>Total Commission Due/Accrued</small><strong>'+cash(summary.commission)+'</strong></div>'+
 '<div><small>Commission Paid / Remaining</small><strong>'+cash(summary.paid)+' / '+cash(summary.due)+'</strong></div>'+
 '<div><small>Indicative Company P&L</small><strong>'+cash(summary.estimatedCompanyProfit)+'</strong></div></div>'+
 '<p class="axCommissionNote">Company P&L = sales excl. GST − recorded Purchase taxable values − general Expense Register − commission. This is indicative: purchases may include inventory; job-specific costs are shown separately, not subtracted again in company P&L to avoid double counting.</p>'+
 '<section class="axCommissionPanel"><h3>Commission Person Master</h3>'+
 '<form id="axCommissionAgentForm" class="form"><label>Person Name<input name="name" required maxlength="110" placeholder="Enter commission person"></label>'+
 '<label>Default Commission %<input name="rate" type="number" min="0" max="100" step="0.01" value="15" required></label>'+
 '<label class="full">Commission Based On<select name="basis"><option value="sales">Taxable Sales (excluding GST)</option><option value="margin">Positive Job Margin (after direct costs)</option></select></label>'+
 '<div class="full"><button class="primary" type="submit" id="axAgentSave">Save Person & Commission %</button> <button type="button" id="axAgentClear">Clear</button></div></form>'+
 '<div id="axAgentRows">'+masterOptions()+'</div></section>'+
 '<section class="axCommissionPanel"><h3>Invoice Commission & Profit</h3>'+
 '<label>Choose Saved Invoice<select id="axCommissionInvoiceSelect"><option value="">Select Invoice</option>'+
 activeInvoices().slice().reverse().map(({x,i})=>'<option value="'+i+'" '+(selectedInvoice===i?'selected':'')+'>'+esc(invoiceNo(x)||'Invoice #'+(i+1))+' — '+esc(x.party||'Customer')+'</option>').join('')+
 '</select></label><div id="axCommissionInvoiceDetail"></div></section>'+
 '<section class="axCommissionPanel"><h3>Person-wise Commission Summary</h3><div id="axCommissionPeople">'+
 (summary.byAgent.map(x=>'<div class="axCommissionRow"><div><b>'+esc(x.name)+'</b><small>'+x.invoices+' Bills · Accrued '+cash(x.total)+'</small></div><span>Paid '+cash(x.paid)+'<small>Balance '+cash(x.due)+'</small></span></div>').join('')||'<p>No commission assigned to Bills yet.</p>')+'</div></section>'+
 '<section class="axCommissionPanel"><h3>Invoice Profit Summary</h3><div class="axCommissionSummary"><div><small>Configured Bills</small><strong>'+summary.configured+'</strong></div><div><small>Awaiting Cost Confirmation</small><strong>'+summary.unconfigured+'</strong></div><div><small>Configured Invoice Profit</small><strong>'+cash(summary.jobProfit)+'</strong></div></div>'+
 '<p class="axCommissionNote">Configured invoice profit = sale (without GST) − material − labour − freight − other direct costs − commission. Confirm cost figures for an accurate job profit. Old bills without cost details are not counted as fully costed.</p></section>');
 const form=document.getElementById('axCommissionAgentForm');
 form.onsubmit=e=>{
  e.preventDefault();const fd=Object.fromEntries(new FormData(form));
  const name=clean(fd.name),rate=Number(fd.rate),basis=fd.basis;
  if(!name||!Number.isFinite(rate)||rate<0||rate>100||!['sales','margin'].includes(basis))return alert('Enter valid Person, rate 0–100% and basis.');
  const existing=agents();
  if(existing.some(a=>a.name.trim().toUpperCase()===name.toUpperCase()&&a.id!==editingAgent))return alert('This commission person is already saved. Edit that person instead.');
  const next=JSON.parse(JSON.stringify(existing));
  if(editingAgent){
   const index=next.findIndex(x=>x.id===editingAgent);if(index<0)return alert('Person not found; reopen and try.');
   next[index]={...next[index],name,rate,basis,updatedAt:new Date().toISOString()};
  }else{
   let number=next.reduce((max,a)=>Math.max(max,Number(String(a.id||'').match(/^AGT-(\d+)$/)?.[1]||0)),0)+1;
   while(next.some(a=>a.id==='AGT-'+number))number++;
   next.push({id:'AGT-'+number,name,rate,basis,createdAt:new Date().toISOString()});
  }
  if(!persistCollection('commissionAgents',next))return;
  editingAgent=null;screen();
 };
 document.getElementById('axAgentClear').onclick=()=>{editingAgent=null;form.reset();form.elements.namedItem('rate').value='15';document.getElementById('axAgentSave').textContent='Save Person & Commission %'};
 for(const b of document.querySelectorAll('#axAgentRows [data-agent]'))b.onclick=()=>{
  const a=findAgent(b.dataset.agent);if(!a)return;
  editingAgent=a.id;
  for(const key of ['name','rate','basis'])form.elements.namedItem(key).value=a[key];
  document.getElementById('axAgentSave').textContent='Update Commission Person';
  form.scrollIntoView({block:'center',behavior:'smooth'});
 };
 const select=document.getElementById('axCommissionInvoiceSelect');
 select.onchange=()=>{selectedInvoice=select.value===''?null:Number(select.value);invoiceEditor()};
 invoiceEditor();
}
function invoiceEditor(){
 const area=document.getElementById('axCommissionInvoiceDetail');if(!area)return;
 const i=selectedInvoice,inv=i===null?null:list('invoices')[i];
 if(!inv){area.innerHTML='<p>Choose a saved Invoice to enter costs and calculate person commission.</p>';return}
 const key=keyFor(inv,i);
 if(!key){area.innerHTML='<p class="axCommissionWarning">Invoice number missing or duplicate. Correct the invoice number before linking commission safely. No data changed.</p>';return}
 const old=config(inv,i)||{};
 const values=Object.fromEntries(costNames.map(k=>[k,n(old[k])]));
 const sample=calculate(inv,old);
 const showCost=(field,label)=>'<label>'+label+' (₹, without GST)<input name="'+field+'" type="number" min="0" step="0.01" value="'+n(old[field])+'"></label>';
 area.innerHTML='<div class="axCommissionInvoiceHead"><b>'+esc(invoiceNo(inv))+' — '+esc(inv.party||'')+'</b>'+
 '<p>Bill Value '+cash(n(inv.total??inv.amount))+' | GST '+cash(n(inv.gst))+' | Taxable Sale '+cash(baseSale(inv))+'</p></div>'+
 '<form id="axCommissionInvoiceForm" class="form"><label>Commission Person<select name="agentId" id="axInvoiceAgent">'+agentOptions(old.agentId||'')+'</select></label>'+
 '<label>Commission %<input name="rate" type="number" min="0" max="100" step="0.01" value="'+n(old.rate??findAgent(old.agentId)?.rate??0)+'"></label>'+
 '<label class="full">Commission Basis<select name="basis"><option value="sales" '+(old.basis!=='margin'?'selected':'')+'>Taxable Sales (excluding GST)</option>'+
 '<option value="margin" '+(old.basis==='margin'?'selected':'')+'>Positive Job Margin (after direct costs)</option></select></label>'+
 showCost('material','Material / Purchase Cost')+showCost('labour','Labour / Manufacturing Cost')+
 showCost('freight','Transport / Freight Cost')+showCost('other','Packing / Other Direct Expense')+
 '<label>Commission Paid (₹)<input name="paidAmount" type="number" min="0" step="0.01" value="'+n(old.paidAmount)+'"></label>'+
 '<label class="full">Notes<textarea name="note" rows="2">'+esc(old.note||'')+'</textarea></label>'+
 '<label class="full"><input type="checkbox" name="costConfirmed" value="yes" '+(old.costConfirmed?'checked':'')+'> I have entered/confirmed all applicable job costs (including zero where appropriate)</label>'+
 '<div class="full" id="axInvoiceProfitPreview"></div>'+
 '<div class="full"><button class="primary" type="submit">Save Commission & Expense</button><p class="axCommissionNote">'+esc(message)+'</p></div></form>';
 const form=document.getElementById('axCommissionInvoiceForm');
 const agent=form.elements.namedItem('agentId');
 agent.onchange=()=>{const found=findAgent(agent.value);form.elements.namedItem('rate').value=found?found.rate:0;form.elements.namedItem('basis').value=found?.basis||'sales';preview()};
 form.addEventListener('input',preview);
 form.addEventListener('change',preview);
 function draft(){
  const f=Object.fromEntries(new FormData(form));
  return {agentId:f.agentId,rate:f.rate,basis:f.basis,paidAmount:f.paidAmount,
   costConfirmed:!!f.costConfirmed,material:f.material,labour:f.labour,freight:f.freight,other:f.other,note:f.note};
 }
 function preview(){
  const d=calculate(inv,draft());
  document.getElementById('axInvoiceProfitPreview').innerHTML=
   '<div class="axCommissionCalc"><p>Sales excluding GST: <b>'+cash(d.taxable)+'</b></p>'+
   '<p>Material + Labour + Freight + Other: <b>− '+cash(d.cost)+'</b></p>'+
   '<p>Commission: <b>− '+cash(d.commission)+'</b> ('+d.rate+'% of '+(d.basis==='sales'?'taxable sales':'positive job margin')+')</p>'+
   '<p class="axCommissionProfit">Your Estimated Job Profit: <b>'+cash(d.profit)+'</b></p>'+
   '<p>Commission Paid: '+cash(d.paid)+' | Balance Payable: '+cash(d.due)+'</p>'+
   (!draft().costConfirmed?'<small>Profit is provisional until you tick Cost Confirmed.</small>':'')+'</div>';
 }
 form.onsubmit=e=>{
  e.preventDefault();const draftRecord=draft(),rate=Number(draftRecord.rate),paid=Number(draftRecord.paidAmount);
  if(!Number.isFinite(rate)||rate<0||rate>100)return alert('Commission rate must be 0–100%.');
  for(const field of [...costNames,'paidAmount'])if(!Number.isFinite(Number(draftRecord[field]))||Number(draftRecord[field])<0)return alert('Invalid '+field+'. Negative expense/paid amount is not allowed.');
  if(!['sales','margin'].includes(draftRecord.basis))return alert('Select a valid commission basis.');
  if(draftRecord.agentId&&!findAgent(draftRecord.agentId))return alert('Commission person missing. Reopen person master.');
  if(!draftRecord.agentId&&rate!==0)return alert('Choose commission person or set commission to 0%.');
  const d=calculate(inv,draftRecord);
  if(paid>d.commission+.005)return alert('Commission Paid cannot exceed Accrued Commission '+cash(d.commission)+'.');
  if(!keyFor(inv,i)||keyFor(inv,i)!==key)return alert('Invoice number changed; reopen to avoid wrong linking.');
  const next={...ledger(),[key]:{
   ...Object.fromEntries(costNames.map(k=>[k,round(draftRecord[k])])),
   invoiceNo:invoiceNo(inv),agentId:draftRecord.agentId,rate,basis:draftRecord.basis,
   paidAmount:round(paid),costConfirmed:draftRecord.costConfirmed,note:clean(draftRecord.note),
   updatedAt:new Date().toISOString()
  }};
  if(!persistCollection('invoiceCommissionLedger',next))return;
  alert('Commission and costs saved for '+invoiceNo(inv)+'. Profit report updated. No payment voucher was created.');
  screen();
 };
 preview();
}
window.axCommissionProfit=screen;
window.axCommissionForInvoice=i=>{selectedInvoice=Number.isInteger(i)?i:null;screen()};
window.axCommissionCalculate=calculate;
window.axCommissionAggregate=aggregate;
if(Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='Commission & Profit'))
 modules.accounts.unshift(['Commission & Profit','Person 15% • Invoice expenses • Net profit']);
const priorOpen=window.openModule;
window.openModule=function(name){if(name==='Commission & Profit'||name==='Profit Report')return screen();return priorOpen.apply(this,arguments)};
const oldPreview=window.axDocPreview;
if(typeof oldPreview==='function')window.axDocPreview=function(type,i){
 const result=oldPreview.apply(this,arguments);
 if(type==='Sales Invoice'){
  const root=document.querySelector('#modalBody .axDocActions');
  if(root&&!document.getElementById('axCommissionInvoiceButton')){
   const button=document.createElement('button');button.type='button';button.id='axCommissionInvoiceButton';button.className='primary';
   button.textContent='Commission / Expense / Profit';button.onclick=()=>window.axCommissionForInvoice(i);
   root.appendChild(button);
  }
 }
 return result;
};
const css=document.createElement('style');
css.textContent='.axCommissionPanel{padding:14px;border:1px solid #dce8ee;background:#f9fcff;margin:14px 0;border-radius:12px}.axCommissionPanel h3{margin:0 0 12px}.axCommissionRow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid #dce8ee}.axCommissionRow small{display:block;color:#637787;font-size:12px}.axCommissionRow button{flex-shrink:0}.axCommissionRow span{text-align:right}.axCommissionSummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0}.axCommissionSummary>div{border:1px solid #d7e5ea;border-radius:10px;padding:11px;background:#fff;min-width:0}.axCommissionSummary small{display:block;color:#627887;font-size:11px}.axCommissionSummary strong{font-size:16px;display:block;margin-top:4px;overflow-wrap:anywhere}.axCommissionNote{color:#647889;font-size:12px;line-height:1.55}.axCommissionWarning{color:#a12612;font-weight:700}.axCommissionInvoiceHead{background:#edf8fb;border-radius:9px;padding:12px;margin:12px 0}.axCommissionInvoiceHead p{margin:6px 0;font-size:12px}.axCommissionCalc{border:1px solid #c5dfe9;background:#eef8fb;padding:10px;border-radius:10px}.axCommissionCalc p{margin:6px 0}.axCommissionProfit{font-weight:800;font-size:16px;color:#12526b;border-top:1px solid #b7d2d8;padding-top:12px}@media(max-width:650px){.axCommissionSummary{grid-template-columns:1fr 1fr}.axCommissionSummary strong{font-size:13px}}';
document.head.append(css);
try{render()}catch(error){console.warn('Commission module menu render',error)}
})();
