/* Aerovex Advanced Controls V30: additive modules, never destructive migrations. */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function'||typeof render!=='function')return;
const KEY='aerovex-erp-data-v1',SNAP='aerovex-erp-prechange-v30';
const titles=['Payment & Outstanding','Purchase Management','Dispatch Tracking','Quotation Follow-up','Rate & Margin History','Security & Backup','Sales Analytics','CFM Integration'];
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
const R=x=>Math.round((N(x)+Number.EPSILON)*100)/100;
const F=x=>'₹'+R(x).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const A=k=>Array.isArray(db[k])?db[k]:[];
const T=()=>new Date().toLocaleDateString('en-CA');
const U=()=>new Date().toISOString();
const ID=p=>p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const str=x=>String(x??'').trim();
const lower=x=>str(x).toLowerCase();
const invId=(x,i)=>str(x.invoiceNo||x.documentNo||x.no||'Bill #'+(i+1));
const quoteId=(x,i)=>str(x.quotationNo||x.documentNo||x.ref||'Quotation #'+(i+1));
const workId=x=>str(x.workNo||x.orderNo);
const list=(rows,cols)=>'<div class="axNextScroll"><table class="axNextTable"><thead><tr>'+cols.map(c=>'<th>'+E(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const tr=cells=>'<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const field=(label,name,type='text',extra='')=>'<label>'+E(label)+'<input name="'+name+'" type="'+type+'" '+extra+'></label>';
const btn=(name,action,id)=>'<button type="button" data-ax-action="'+action+'" data-ax-id="'+E(id)+'">'+E(name)+'</button>';
const select=(name,items)=>'<label>'+E(name)+'<select name="'+E(name)+'" required><option value="">Choose</option>'+items.map(x=>'<option value="'+E(x.value)+'">'+E(x.label)+'</option>').join('')+'</select></label>';
const empty=msg=>'<p class="axNextMuted">'+E(msg)+'</p>';
const page=(title,content,binder)=>{show(title,'<div class="axNext">'+content+'</div>');if(binder)binder(document.querySelector('#modalBody .axNext'))};
const cashInvoice=x=>{
 const t=Number(x.total),tax=Number(x.taxable),gst=N(x.gst);
 if(Number.isFinite(t))return Math.max(0,R(t));
 if(Number.isFinite(tax))return Math.max(0,R(tax+gst+N(x.other)+N(x.round)));
 return Math.max(0,R(x.amount));
};
const taxable=x=>{
 if(x.taxable!==undefined&&x.taxable!=='')return Math.max(0,R(x.taxable));
 if(Array.isArray(x.items)&&x.items.length)return R(x.items.reduce((s,y)=>s+N(y.qty)*N(y.rate)*(1-N(y.discount)/100),0));
 if(x.qty!==undefined&&x.rate!==undefined)return R(N(x.qty)*N(x.rate));
 return Math.max(0,R(cashInvoice(x)-N(x.gst)-N(x.other)-N(x.round)));
};
const counted=(k)=>A(k).length;
function commit(field,add,message){
 const original=localStorage.getItem(KEY)||'{}';
 const now={...db,[field]:add,auditLog:[...A('auditLog'),{date:U(),module:field,action:message}].slice(-400)};
 let prev;
 try{prev=localStorage.getItem(SNAP);localStorage.setItem(SNAP,original);localStorage.setItem(KEY,JSON.stringify(now));}
 catch(e){if(prev!==null){try{localStorage.setItem(SNAP,prev)}catch(_){}}alert('Save cancelled: safety snapshot/storage failed. Download a backup and free storage. '+e.message);return false}
 db=now;
 try{render()}catch(_){}
 return true;
}
function saveArray(name,item,desc){return commit(name,[...A(name),item],desc)}
function optionsFrom(rows,value,label){return rows.map((x,i)=>({value:String(i),label:label(x,i)}))}
function screenButtons(root,handler){root.querySelectorAll('[data-ax-action]').forEach(b=>b.onclick=()=>handler(b.dataset.axAction,b.dataset.axId))}
function onForm(root,callback){const form=root.querySelector('form');if(form)form.onsubmit=e=>{e.preventDefault();callback(Object.fromEntries(new FormData(form))) }}
function download(name,object){const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
const badges=(pairs)=>'<div class="axNextCards">'+pairs.map(([k,v])=>'<div><small>'+E(k)+'</small><strong>'+E(v)+'</strong></div>').join('')+'</div>';

function receiptsForInvoice(x,i){
 return A('receipts').filter(r=>str(r.invoiceNo||r.invoice||r.billNo)===invId(x,i)&&(!r.invoiceIndex&&r.invoiceIndex!==0||Number(r.invoiceIndex)===i)).reduce((s,r)=>s+N(r.amount),0);
}
function receiptsUnallocated(p){return A('receipts').filter(r=>lower(r.party)===lower(p)&&!str(r.invoiceNo||r.invoice||r.billNo)).reduce((s,r)=>s+N(r.amount),0)}
function paymentScreen(){
 const invoices=A('invoices'),receipts=A('receipts');
 const billed=invoices.reduce((s,x)=>s+cashInvoice(x),0),collected=receipts.reduce((s,x)=>s+N(x.amount),0);
 const customerData=new Map();
 for(const [i,x] of invoices.entries()){const key=lower(x.party),o=customerData.get(key)||{name:str(x.party),billed:0,paid:0};o.billed+=cashInvoice(x);customerData.set(key,o)}
 for(const x of receipts){const key=lower(x.party),o=customerData.get(key)||{name:str(x.party),billed:0,paid:0};o.paid+=N(x.amount);customerData.set(key,o)}
 const dateNow=new Date(T()+'T00:00:00');
 const rows=invoices.map((x,i)=>{
  const paid=receiptsForInvoice(x,i),due=R(cashInvoice(x)-paid);
  const days=x.date?Math.floor((dateNow-new Date(x.date+'T00:00:00'))/86400000):null;
  return tr([E(invId(x,i)),E(x.party),E(x.date||'—'),F(cashInvoice(x)),F(paid),F(Math.max(0,due)),E(days===null||!Number.isFinite(days)?'Unknown':days>60?'60+ days':days>30?'31–60 days':days>=0?'0–30 days':'Not due')]);
 });
 const people=[...customerData.values()].sort((a,b)=>(b.billed-b.paid)-(a.billed-a.paid)).map(x=>tr([E(x.name||'Unknown'),F(x.billed),F(x.paid),F(R(x.billed-x.paid))]));
 const opt=optionsFrom(invoices,null,(x,i)=>invId(x,i)+' — '+str(x.party)+' • '+F(Math.max(0,cashInvoice(x)-receiptsForInvoice(x,i))));
 page('Payment & Outstanding',badges([['Total Billed',F(billed)],['Recorded Receipts',F(collected)],['Net Receivable',F(billed-collected)]])+
 '<p class="axNextMuted">Old receipts without invoice numbers remain customer-level credits, not silently assigned to bills. Invoice-wise outstanding excludes such credits; customer totals include them.</p>'+
 '<h3>Record Payment Against Invoice</h3><form class="axNextForm">'+select('Invoice',opt)+field('Amount (₹)','amount','number','min="0.01" step="0.01" required')+field('Receipt Date','date','date','value="'+T()+'" required')+field('Bank / UTR / Reference','ref')+'<button class="primary">Save Receipt</button></form>'+
 '<h3>Customer Ledger Summary</h3>'+list(people,['Customer','Billed','Receipts','Net Due'])+
 '<h3>Invoice-wise Collection</h3>'+list(rows,['Invoice','Party','Date','Amount','Linked Paid','Balance','Age'])+
 '<p class="axNextMuted">Payment received here creates a Receipt entry; it does not alter original invoices.</p>',root=>onForm(root,v=>{
  const i=Number(v.Invoice),x=invoices[i],amount=N(v.amount);if(!x||!Number.isFinite(amount)||amount<=0)return alert('Choose invoice and valid amount');
  const due=R(cashInvoice(x)-receiptsForInvoice(x,i));if(amount>due+0.01)return alert('Amount exceeds remaining invoice balance '+F(due));
  if(saveArray('receipts',{id:ID('REC'),date:v.date,party:x.party,invoiceNo:invId(x,i),invoiceIndex:i,amount:R(amount),ref:str(v.ref),mode:'Bank',source:'Aerovex Advanced V30'},'Received '+F(amount)+' against '+invId(x,i)))paymentScreen();
 }));
}
function purchaseScreen(){
 const po=A('purchaseOrders'),received=A('purchaseOrderReceipts'),payments=A('payments'),purchases=A('purchases');
 const rows=po.map((x,i)=>{const qty=received.filter(r=>r.poId===x.id).reduce((s,r)=>s+N(r.qty),0);
  return tr([E(x.no),E(x.party),E(x.description),E(x.date),E(x.qty),F(x.taxable),E(qty)+' / '+E(x.qty),btn('Receive','receive',i)])});
 const poTotal=po.reduce((s,x)=>s+N(x.taxable),0);
 const supplierBalance=purchases.reduce((s,x)=>s+N(x.total||x.amount),0)-payments.reduce((s,x)=>s+N(x.amount),0);
 page('Purchase Management',badges([['Open / Total POs',String(po.filter(x=>received.filter(r=>r.poId===x.id).reduce((s,r)=>s+N(r.qty),0)<N(x.qty)).length)+' / '+po.length],['PO Value (excl. GST)',F(poTotal)],['Purchase Less Payments',F(supplierBalance)]])+
 '<h3>New Supplier Purchase Order</h3><form class="axNextForm">'+field('Supplier','party','text','required')+field('Product / Material','description','text','required')+
 field('Quantity','qty','number','min="0.001" step="any" required')+field('Rate (excl. GST)','rate','number','min="0" step="0.01" required')+field('Order Date','date','date','value="'+T()+'" required')+field('Supplier Ref / Remark','ref')+'<button class="primary">Save Purchase Order</button></form>'+
 '<h3>Purchase Orders & Receiving</h3>'+list(rows,['PO No','Supplier','Material','Date','Qty','Taxable','Received','Action'])+
 '<p class="axNextMuted">PO values are commitments, not GST purchase bills. Use existing Purchase module to post supplier bills; purchase records are not duplicated automatically.</p>',root=>{
  onForm(root,v=>{const qty=N(v.qty),rate=N(v.rate);if(!str(v.party)||!str(v.description)||qty<=0||rate<0)return alert('Enter valid supplier/item/quantity/rate');
   const taken=new Set(po.map(x=>x.no)),max=po.reduce((s,x)=>Math.max(s,N(String(x.no||'').match(/(\d+)$/)?.[1])),0);let num=max+1,no='AFX/PO/'+String(num).padStart(3,'0');while(taken.has(no)){num++;no='AFX/PO/'+String(num).padStart(3,'0')}
   if(saveArray('purchaseOrders',{id:ID('PO'),no,date:v.date,party:str(v.party),description:str(v.description),qty,rate,taxable:R(qty*rate),ref:str(v.ref),createdAt:U()},'Created '+no))purchaseScreen();
  });
  screenButtons(root,(act,ix)=>{if(act!=='receive')return;const x=po[Number(ix)];if(!x)return;const done=received.filter(r=>r.poId===x.id).reduce((s,r)=>s+N(r.qty),0),rem=R(N(x.qty)-done);
   if(rem<=0)return alert('Already fully received.');
   const reply=prompt('Received quantity for '+x.no+' (remaining '+rem+'):',String(rem));if(reply===null)return;const q=Number(reply);
   if(!Number.isFinite(q)||q<=0||q>rem+0.00001)return alert('Enter quantity up to '+rem);
   if(saveArray('purchaseOrderReceipts',{id:ID('GRN'),poId:x.id,date:T(),qty:q},'Material receipt '+x.no+' Qty '+q))purchaseScreen();
  });
 });
}
function dispatchScreen(){
 const works=A('workOrders'),dispatches=A('dispatchTracking'),events=A('dispatchEvents');
 const shipped=id=>dispatches.filter(d=>d.workNo===id).reduce((s,d)=>s+N(d.qty),0);
 const latestStatus=d=>events.filter(x=>x.dispatchId===d.id).slice(-1)[0]?.status||'Dispatched';
 const rows=dispatches.slice().reverse().map(d=>tr([E(d.workNo),E(d.date),E(d.party),E(d.qty),E(d.transport),E(d.lr),E(d.challan),E(latestStatus(d)),btn('Delivered','delivered',d.id)]));
 const sel=works.map((x,i)=>({value:String(i),label:workId(x)+' — '+str(x.party)+' (remaining '+Math.max(0,R(N(x.qty||x.items?.reduce((s,y)=>s+N(y.qty),0))-shipped(workId(x))))+')'}));
 page('Dispatch Tracking',badges([['Dispatch Entries',String(dispatches.length)],['Delivered Entries',String(dispatches.filter(d=>latestStatus(d)==='Delivered').length)],['Open Delivery',String(dispatches.filter(d=>latestStatus(d)!=='Delivered').length)]])+
 '<h3>Record Dispatch</h3><form class="axNextForm">'+select('WorkOrder',sel)+field('Dispatch Qty','qty','number','min="0.001" step="any" required')+field('Date','date','date','value="'+T()+'" required')+field('Transport','transport')+field('LR / Docket No','lr')+field('Delivery Challan No','challan')+'<button class="primary">Save Dispatch</button></form>'+
 '<h3>Dispatch Register</h3>'+list(rows,['Work No','Date','Customer','Qty','Transport','LR','Challan','Status','Action'])+
 '<p class="axNextMuted">This register does not issue stock or create challans automatically. Update original challan/invoice separately to avoid duplicate documents.</p>',root=>{
  onForm(root,v=>{
   const w=works[Number(v.WorkOrder)],q=N(v.qty);if(!w||q<=0)return alert('Choose Work Order and valid quantity');
   const no=workId(w),orderQty=N(w.qty)||A('workOrders')[Number(v.WorkOrder)]?.items?.reduce((s,x)=>s+N(x.qty),0)||0;
   if(!orderQty)return alert('Work Order quantity missing. Verify Work Order.');
   if(q>R(orderQty-shipped(no))+0.00001)return alert('Dispatch exceeds unshipped Work Order quantity.');
   const packed=N(w.done);if(packed>0&&q>Math.max(0,packed-shipped(no))&&!confirm('Dispatch exceeds registered packed quantity. Have you verified packing physically?'))return;
   if(saveArray('dispatchTracking',{id:ID('DSP'),workNo:no,party:str(w.party),date:v.date,qty:q,transport:str(v.transport),lr:str(v.lr),challan:str(v.challan),createdAt:U()},'Dispatched '+q+' for '+no))dispatchScreen();
  });
  screenButtons(root,(act,id)=>{if(act!=='delivered')return;const d=dispatches.find(x=>x.id===id);if(!d||latestStatus(d)==='Delivered')return;
   if(!confirm('Confirm delivered for '+d.workNo+'?'))return;
   if(saveArray('dispatchEvents',{id:ID('DSE'),dispatchId:id,status:'Delivered',date:U()},'Delivered '+d.workNo))dispatchScreen();
  });
 });
}
function followScreen(){
 const qs=A('quotations'),follow=A('quotationFollowups');
 const last=i=>follow.filter(x=>x.quotationIndex===i).slice(-1)[0];
 const statuses=['Sent','Follow-up Due','Negotiation','Won','Lost','On Hold'];
 const rows=qs.map((x,i)=>{const z=last(i);return tr([E(quoteId(x,i)),E(x.party),E(z?.status||'Not tracked'),E(z?.nextDate||'—'),E(z?.remark||'—')])});
 const now=T(),due=qs.filter((x,i)=>{const z=last(i);return z&&z.nextDate&&z.nextDate<=now&&!['Won','Lost'].includes(z.status)}).length;
 page('Quotation Follow-up',badges([['Quotations',String(qs.length)],['Follow-ups Due',String(due)],['Won',String(qs.filter((x,i)=>last(i)?.status==='Won').length)]])+
 '<h3>Save Follow-up Entry</h3><form class="axNextForm">'+select('Quotation',optionsFrom(qs,null,(x,i)=>quoteId(x,i)+' — '+str(x.party)))+
 '<label>Status<select name="status" required>'+statuses.map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
 field('Next Follow-up','nextDate','date')+field('Remark','remark')+'<button class="primary">Save Follow-up</button></form>'+
 '<h3>Quotation Pipeline</h3>'+list(rows,['Quotation','Party','Last Status','Next Follow-up','Remarks'])+
 '<p class="axNextMuted">A follow-up does not change or overwrite the original quotation.</p>',root=>onForm(root,v=>{
  const i=Number(v.Quotation);if(!qs[i]||!statuses.includes(v.status))return alert('Choose a quotation');
  if(saveArray('quotationFollowups',{id:ID('FU'),quotationIndex:i,quotationNo:quoteId(qs[i],i),status:v.status,nextDate:str(v.nextDate),remark:str(v.remark),date:U()},'Quotation '+quoteId(qs[i],i)+' → '+v.status))followScreen();
 }));
}
function rateScreen(){
 const items=(obj,type)=>{
  const raw=Array.isArray(obj.items)&&obj.items.length?obj.items:[obj];
  return raw.map(y=>({name:str(y.description||y.product||obj.description||obj.product),rate:N(y.rate),qty:N(y.qty),party:str(obj.party),date:str(obj.date),type})).filter(y=>y.name&&y.rate>0&&y.qty>0);
 };
 const sales=A('invoices').flatMap(x=>items(x,'Sale')),purchases=A('purchases').flatMap(x=>items(x,'Purchase'));
 const groups=new Map();
 for(const x of [...sales,...purchases]){const k=lower(x.name),g=groups.get(k)||{name:x.name,sales:[],purchases:[]};g[x.type==='Sale'?'sales':'purchases'].push(x);groups.set(k,g)}
 const rows=[...groups.values()].map(g=>{
  const s=g.sales.sort((a,b)=>b.date.localeCompare(a.date))[0],p=g.purchases.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const margin=s&&p?R((s.rate-p.rate)/s.rate*100):null;
  return {margin,html:tr([E(g.name),s?F(s.rate):'—',p?F(p.rate):'—',margin===null?'Not available':E(margin.toFixed(1)+'%'),E(s?.date||'—'),E(p?.date||'—')])};
 });
 page('Rate & Margin History',badges([['Sale Lines',String(sales.length)],['Purchase Lines',String(purchases.length)],['Low Margin (<25%)',String(rows.filter(x=>x.margin!==null&&x.margin<25).length)]])+
 '<p class="axNextMuted">Margin is an indicative rate comparison only for matching product descriptions: (sale rate − purchase rate) ÷ sale rate. Labour, freight and commission are NOT included here. Rates are GST-exclusive only where existing records saved them that way.</p>'+
 list(rows.map(x=>x.html),['Product','Last Sale Rate','Last Purchase Rate','Rate Margin','Sale Date','Purchase Date'])+
 '<h3>Latest Customer Sale Rates</h3>'+list(sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,50).map(x=>tr([E(x.date),E(x.party),E(x.name),F(x.rate),E(x.qty)])),['Date','Customer','Product','Rate','Qty']),null);
}
function securityScreen(){
 const logs=A('auditLog').slice(-40).reverse(),snap=localStorage.getItem(SNAP);
 let snapshot='No safety snapshot yet';
 try{if(snap){const obj=JSON.parse(snap);snapshot='Available: '+Object.keys(obj).filter(k=>Array.isArray(obj[k])).map(k=>k+' '+obj[k].length).slice(0,12).join(' • ')}}catch(_){snapshot='Unreadable snapshot – download current backup'}
 page('Security & Backup',badges([['Existing Login','Owner sign-in'],['Audit Entries',String(A('auditLog').length)],['Safety Snapshot',snap?'Available':'Not created']])+
 '<p class="axNextMuted">The existing Supabase owner login is unchanged. This module records its own business edits locally; it is not a server-side multi-user permission or automatic cloud backup system.</p>'+
 '<div class="axNextActions">'+btn('Download Full ERP Backup','backup','full')+btn('Download Pre-change Snapshot','backup','snapshot')+'</div>'+
 '<p class="axNextMuted">'+E(snapshot)+'</p><h3>New Module Activity</h3>'+
 list(logs.map(x=>tr([E(x.date),E(x.module),E(x.action)])),['Date','Module','Action'])+
 '<p class="axNextMuted">A pre-change safety snapshot is stored before each successful new-module save. Use the existing Safe Restore flow for backup imports. Never overwrite live data without inspection.</p>',root=>screenButtons(root,(act,id)=>{
  if(act!=='backup')return;
  if(id==='full'){download('Aerovex-ERP-V30-FULL-'+T(),{application:'Aerovex ERP',storageKey:KEY,formatVersion:1,createdAt:U(),data:db})}
  else if(snap){try{download('Aerovex-ERP-V30-PRECHANGE-'+T(),{application:'Aerovex ERP',storageKey:KEY,formatVersion:1,createdAt:U(),data:JSON.parse(snap)})}catch(e){alert('Snapshot invalid: '+e.message)}}
  else alert('No pre-change snapshot exists yet.');
 }));
}
function analyticsScreen(){
 const invoices=A('invoices'),purchases=A('purchases'),receipts=A('receipts'),orders=A('salesOrders');
 const total=invoices.reduce((s,x)=>s+taxable(x),0),gst=invoices.reduce((s,x)=>s+N(x.gst),0),paid=receipts.reduce((s,x)=>s+N(x.amount),0);
 const byMonth=new Map(),byCustomer=new Map();
 for(const x of invoices){const month=str(x.date).slice(0,7)||'Undated',amt=taxable(x),c=str(x.party)||'Unknown';
  byMonth.set(month,(byMonth.get(month)||0)+amt);byCustomer.set(c,(byCustomer.get(c)||0)+amt)}
 const monthly=[...byMonth].sort((a,b)=>b[0].localeCompare(a[0])).map(([m,a])=>tr([E(m),F(a)]));
 const customers=[...byCustomer].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([c,a])=>tr([E(c),F(a)]));
 page('Sales Analytics',badges([['Net Sales (excl. GST)',F(total)],['Output GST',F(gst)],['Receipts (incl. GST)',F(paid)],['Sales Orders',String(orders.length)]])+
 '<h3>Monthly Net Sales</h3>'+list(monthly,['Month','Sales excl. GST'])+'<h3>Top Customers</h3>'+list(customers,['Customer','Net Sales'])+
 '<p class="axNextMuted">Numbers are calculated from saved device records. Invoice amounts without complete item/tax fields are estimates; this is not an audited tax report. Gross receipt and net sales have different GST treatment.</p>',null);
}
function cfmScreen(){
 const works=A('workOrders'),links=A('cfmLinks'),statuses=['Not Started','Cutting','Stitching','Thread Cutting','Gun Finishing','Packing','Ready to Dispatch','Completed','On Hold'];
 const latest=new Map(links.map(x=>[x.erpWorkNo,x]));
 const rows=works.map(w=>{const k=latest.get(workId(w));return tr([E(workId(w)),E(w.party),E(k?.cfmWorkNo||'Not linked'),E(k?.stage||'—'),E(k?.completedQty??'—'),E(k?.updatedAt?.slice(0,10)||'—')])});
 page('CFM Integration — Manual Bridge',badges([['Aerovex Work Orders',String(works.length)],['Linked with CFM',String([...latest.keys()].length)],['Manual Ready Status',String([...latest.values()].filter(x=>x.stage==='Ready to Dispatch').length)]])+
 '<p class="axNextMuted"><b>Manual bridge only:</b> Record the CFM Work No and stage here. The CFM Plant Tracker is a separate app, so no live cross-app sync is enabled until its backend/API and access controls are verified.</p>'+
 '<h3>Link or Update CFM Work</h3><form class="axNextForm">'+select('ERPWork',works.map((w,i)=>({value:String(i),label:workId(w)+' — '+str(w.party)})))+
 field('CFM Work No','cfmWorkNo','text','required')+
 '<label>Latest CFM Stage<select name="stage" required>'+statuses.map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label>'+
 field('Completed Qty','completedQty','number','min="0" step="any" value="0" required')+field('Remark','remark')+'<button class="primary">Save CFM Link / Stage</button></form>'+
 '<h3>ERP ↔ CFM Work Mapping</h3>'+list(rows,['ERP Work No','Customer','CFM Work No','Manual Stage','Done Qty','Updated'])+
 '<p class="axNextMuted">CFM production/stock records are NOT edited by this module; manual status needs verification with the plant.</p>',root=>onForm(root,v=>{
  const w=works[Number(v.ERPWork)],no=str(v.cfmWorkNo),q=Number(v.completedQty);if(!w||!no||!Number.isFinite(q)||q<0||!statuses.includes(v.stage))return alert('Complete valid CFM details');
  const other=links.find(x=>x.cfmWorkNo===no&&x.erpWorkNo!==workId(w));
  if(other&&!confirm('CFM '+no+' is already linked to '+other.erpWorkNo+'. Link anyway?'))return;
  const next=[...links.filter(x=>x.erpWorkNo!==workId(w)),{id:ID('CFM'),erpWorkNo:workId(w),cfmWorkNo:no,stage:v.stage,completedQty:q,remark:str(v.remark),updatedAt:U()}];
  if(commit('cfmLinks',next,'CFM linked '+workId(w)+' / '+no+' / '+v.stage))cfmScreen();
 }));
}
const views={
 'Payment & Outstanding':paymentScreen,'Purchase Management':purchaseScreen,'Dispatch Tracking':dispatchScreen,
 'Quotation Follow-up':followScreen,'Rate & Margin History':rateScreen,'Security & Backup':securityScreen,
 'Sales Analytics':analyticsScreen,'CFM Integration':cfmScreen
};
const originalOpen=window.openModule;
window.openModule=function(name){if(views[name])return views[name]();return originalOpen.apply(this,arguments)};
function insert(){
 if(document.querySelector('#axAdvancedPanel'))return;
 const main=document.querySelector('main');if(!main)return;
 const panel=document.createElement('section');panel.id='axAdvancedPanel';panel.className='panel';
 panel.innerHTML='<div class="panelHead"><h2>Advanced Business Controls <small>V30</small></h2><span>8 New Modules • Existing Records Protected</span></div><div class="axNextTiles"></div>';
 const grid=panel.querySelector('.axNextTiles');
 const icons=['₹','🛒','🚚','📞','📈','🔒','📊','🏭'];
 titles.forEach((t,i)=>{const b=document.createElement('button');b.type='button';b.textContent=icons[i]+' '+t;b.addEventListener('click',()=>views[t]());grid.appendChild(b)});
 const quick=document.querySelector('#quick')?.closest('.panel');if(quick)quick.insertAdjacentElement('afterend',panel);else main.prepend(panel);
}
const css=document.createElement('style');css.textContent='.axNextTiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px}.axNextTiles button{background:#f2f8fb;border:1px solid #cfdee8;border-radius:12px;min-height:66px;padding:13px;text-align:left;color:#16475c;font-weight:700;cursor:pointer}.axNextTiles button:active{background:#d6f0f7}.axNext{font-size:14px;color:#233c4a}.axNext h3{margin:20px 0 10px}.axNextMuted{color:#627787;line-height:1.55;font-size:12px}.axNextCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.axNextCards>div{border:1px solid #dfebf1;border-radius:12px;padding:13px;background:#f6f9fc;display:flex;flex-direction:column;gap:6px}.axNextCards small{color:#547084}.axNextCards strong{font-size:17px;color:#103d53}.axNextForm{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px;padding:14px;border:1px solid #dbe7ed;background:#fafcfd;border-radius:12px}.axNextForm label{display:flex;flex-direction:column;font-weight:600;gap:6px;font-size:12px}.axNextForm input,.axNextForm select{padding:10px;border:1px solid #cddae2;border-radius:8px;background:white;color:#173d4f;min-width:0}.axNextForm button{min-height:42px;align-self:end}.axNextScroll{overflow:auto;max-width:100%;border:1px solid #dae5eb;border-radius:9px}.axNextTable{width:100%;border-collapse:collapse;min-width:620px;font-size:12px}.axNextTable th,.axNextTable td{padding:9px;text-align:left;border-bottom:1px solid #e7edf2;vertical-align:top}.axNextTable th{background:#edf5fa;color:#25566b;position:sticky;top:0}.axNextTable td button,.axNextActions button{background:#e6f4fa;border:1px solid #b9d9e5;color:#144b64;padding:8px;border-radius:8px;cursor:pointer}.axNextActions{display:flex;flex-wrap:wrap;gap:10px}@media(max-width:680px){.axNextTiles{grid-template-columns:repeat(2,minmax(0,1fr))}.axNextTiles button{padding:10px;font-size:12px}.axNextForm{grid-template-columns:1fr}.axNextCards{grid-template-columns:repeat(2,minmax(0,1fr))}}';
document.head.appendChild(css);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',insert);else insert();
window.axAdvancedV30={open:name=>views[name]?.(),version:'30',modules:titles.slice()};
})();