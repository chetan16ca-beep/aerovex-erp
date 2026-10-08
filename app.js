const KEY='aerovex-erp-data-v1';
const blank=()=>({parties:[],suppliers:[],products:[],quotations:[],salesOrders:[],workOrders:[],store:[],cutting:[],departmentWork:[],packing:[],challans:[],invoices:[],receipts:[],payments:[],purchases:[],expenses:[],ledger:[]});
let db=blank();try{db=Object.assign(blank(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const modules={
production:[['Work Orders','Order Qty • Pending Qty • Status'],['Store / SRL','Opening • Issue • Balance'],['Cutting','Cut Qty • Meter Consumption'],['Stitching','Daily production entry'],['Thread Cutting','Daily production entry'],['Gun Finishing','Daily production entry'],['Packing','Slip • Labels • Ready Qty'],['QC','Inspection & release']],
accounts:[['Quotation','Customer quotation'],['Sales Order / PO','Customer PO tracking'],['Delivery Challan','Dispatch document'],['Sales Invoice','GST-ready billing'],['Purchase','Supplier purchase'],['Receipt','Customer payment'],['Payment','Supplier / expense payment'],['Party Ledger','Debit • Credit • Balance'],['Outstanding','Receivable / Payable'],['Expenses','Daily business expenses'],['Cash / Bank','Voucher-style register'],['Profit Report','Sales − Purchase − Expense']],
masters:[['Party Master','Customers'],['Supplier Master','Vendors'],['Product Master','Auto Aerovex product code'],['Stock Report','Material / SRL stock'],['Pending Orders','Open work orders'],['Batch Report','Production stage status'],['Plant Head Work List','Daily 9 AM–6 PM'],['Reports','Print / PDF ready']]
};
const kpis=[['Open Orders',()=>db.workOrders.filter(x=>x.status!=='Closed').length],['Pending Production',()=>db.workOrders.reduce((a,x)=>a+Math.max(0,+x.qty-(+x.done||0)),0)],['Receivable',()=>money(db.invoices.reduce((a,x)=>a+(+x.total||0),0)-db.receipts.reduce((a,x)=>a+(+x.amount||0),0))],['Stock SRL',()=>db.store.filter(x=>(+x.balance||0)>0).length]];
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN')}
function render(){document.querySelector('#kpis').innerHTML=kpis.map(x=>'<div class="kpi"><small>'+x[0]+'</small><strong>'+x[1]()+'</strong></div>').join('');
document.querySelector('#quick').innerHTML=['New Quotation','New Work Order','Store / SRL Entry','Production Entry'].map(x=>'<button onclick="openModule(\''+x+'\')">＋ '+x+'</button>').join('');
for(const g of ['production','accounts','masters'])document.querySelector('#'+g).innerHTML=modules[g].map(x=>'<div class="tile" onclick="openModule(\''+x[0]+'\')"><b>'+x[0]+'</b><small>'+x[1]+'</small></div>').join('')}
function closeModal(){document.querySelector('#modal').classList.add('hidden')}
function show(title,body){document.querySelector('#modalBody').innerHTML='<h2>'+title+'</h2>'+body;document.querySelector('#modal').classList.remove('hidden')}
function openModule(name){
 if(name==='New Work Order'||name==='Work Orders')return workForm();
 if(name==='Party Master')return masterForm('Party Master','parties',['Party Name','GSTIN','Phone','Email']);
 if(name==='Supplier Master')return masterForm('Supplier Master','suppliers',['Supplier Name','GSTIN','Phone','Email']);
 if(name==='Product Master')return productForm();
 if(name==='Store / SRL'||name==='Store / SRL Entry')return storeForm();
 if(name==='Production Entry'||['Cutting','Stitching','Thread Cutting','Gun Finishing','Packing'].includes(name))return productionForm(name==='Production Entry'?'':name);
 if(name==='Quotation'||name==='New Quotation')return docForm('Quotation','quotations');
 if(name==='Sales Invoice')return invoiceForm();
 if(name==='Receipt')return amountForm('Receipt','receipts');
 if(name==='Payment')return amountForm('Payment','payments');
 if(name==='Expenses')return amountForm('Expense','expenses');
 if(name==='Plant Head Work List')return plantHead();
 const map={'Sales Order / PO':'salesOrders','Delivery Challan':'challans','Purchase':'purchases'};
 if(map[name])return docForm(name,map[name]);
 const arr=[...modules.production,...modules.accounts,...modules.masters].find(x=>x[0]===name);show(name,'<div class="empty">'+(arr?arr[1]:'Module')+'<br><br>ZERO DATA • Ready for next ERP build stage.</div>')
}
function masterForm(title,key,fields){show(title,'<form class="form" onsubmit="event.preventDefault();const f=new FormData(this);db.'+key+'.push(Object.fromEntries(f));save();closeModal();render()>'+fields.map((x,i)=>'<label>'+x+'<input name="f'+i+'" '+(i===0?'required':'')+'></label>').join('')+'<div class="full"><button class="primary">Save</button></div></form><p><small>Records: '+db[key].length+'</small></p>')}
function nextProduct(){let m=db.products.map(x=>+(String(x.code||'').match(/\d+/)||[0])[0]);return 'AFX-P'+String((Math.max(0,...m)+1)).padStart(4,'0')}
function productForm(){show('Product Master','<form class="form" onsubmit="event.preventDefault();const f=new FormData(this);db.products.push(Object.fromEntries(f));save();closeModal();render()"><label>Product Code<input name="code" value="'+nextProduct()+'" readonly></label><label>Product Name<input name="name" required></label><label>Item Code<input name="item"></label><label>Standard Cloth<input name="cloth"></label><label>Standard Width<input name="width"></label><label>Micron / Mesh<input name="micron"></label><div class="full"><button class="primary">Save Product</button></div></form>')}
function nextWO(){return 'AFX-WO-'+String(db.workOrders.length+1).padStart(4,'0')}
function workForm(){show('New Work Order','<form class="form" onsubmit="event.preventDefault();const f=new FormData(this),o=Object.fromEntries(f);o.done=0;o.status=\'Open\';db.workOrders.push(o);save();closeModal();render()"><label>Work No<input name="workNo" value="'+nextWO()+'" readonly></label><label>Party<input name="party" required></label><label>Product / Description<input name="description" required></label><label>Product Code<input name="productCode"></label><label>Order Qty<input name="qty" type="number" min="0" required></label><label>PO No.<input name="po"></label><label>Cloth<input name="cloth"></label><label>Width<input name="width"></label><div class="full"><button class="primary">Create Work Order</button></div></form>')}
function storeForm(){show('Store / SRL Entry','<form class="form" onsubmit="event.preventDefault();const f=new FormData(this),o=Object.fromEntries(f);o.balance=o.opening;db.store.push(o);save();closeModal();render()"><label>SRL No.<input name="srl" required></label><label>Cloth<input name="cloth" required></label><label>Width<input name="width" required></label><label>Opening Meter<input name="opening" type="number" step=".01" required></label><div class="full"><button class="primary">Open SRL</button></div></form>')}
function productionForm(stage){let opts=['CUTTING','STITCHING','THREAD CUTTING','GUN FINISHING','PACKING'];show('Production Entry','<form class="form" onsubmit="event.preventDefault();const f=new FormData(this),o=Object.fromEntries(f);db.departmentWork.push(o);const w=db.workOrders.find(x=>x.workNo===o.workNo);if(w&&o.process===\'PACKING\')w.done=(+w.done||0)+(+o.qty||0);save();closeModal();render()"><label>Work No.<select name="workNo" required><option></option>'+db.workOrders.map(x=>'<option>'+x.workNo+'</option>').join('')+'</select></label><label>Process<select name="process">'+opts.map(x=>'<option '+(stage&&stage.toUpperCase().startsWith(x.split(' ')[0])?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Done Qty<input name="qty" type="number" min="0" required></label><label>Person<input name="person"></label><label class="full">Remark<input name="remark"></label><div class="full"><button class="primary">Save Daily Entry</button></div></form>')}
function docForm(title,key){show(title,'<form class="form" onsubmit="event.preventDefault();const f=new FormData(this);db.'+key+'.push(Object.fromEntries(f));save();closeModal();render()"><label>Party<input name="party" required></label><label>Date<input name="date" type="date" required></label><label>Reference No.<input name="ref"></label><label>Amount<input name="amount" type="number" step=".01"></label><label class="full">Description<textarea name="description"></textarea></label><div class="full"><button class="primary">Save '+title+'</button></div></form>')}
function invoiceForm(){show('Sales Invoice','<form class="form" onsubmit="event.preventDefault();const f=new FormData(this),o=Object.fromEntries(f);o.total=(+o.taxable||0)+(+o.gst||0);db.invoices.push(o);save();closeModal();render()"><label>Party<input name="party" required></label><label>Invoice No.<input name="invoiceNo" required></label><label>Taxable Value<input name="taxable" type="number" step=".01" required></label><label>GST Amount<input name="gst" type="number" step=".01" value="0"></label><div class="full"><button class="primary">Save Invoice</button></div></form>')}
function amountForm(title,key){show(title,'<form class="form" onsubmit="event.preventDefault();const f=new FormData(this);db.'+key+'.push(Object.fromEntries(f));save();closeModal();render()"><label>Party / Head<input name="party" required></label><label>Amount<input name="amount" type="number" step=".01" required></label><label>Date<input name="date" type="date"></label><label>Mode<select name="mode"><option>Cash</option><option>Bank</option><option>UPI</option></select></label><label class="full">Remark<input name="remark"></label><div class="full"><button class="primary">Save '+title+'</button></div></form>')}
function plantHead(){let tasks=['Attendance & Manpower Check','Pending / Urgent Work Orders Check','Work Order Label dena','Cutting Plan + SRL / Cloth Issue','Production Floor Round','Quality / Measurement Check','Store & Material Shortage Check','Target vs Actual Production','Packing / Dispatch Readiness','ERP Entries Verify','Tomorrow Priority'];show('Plant Head – Today Work List','<div>'+tasks.map((x,i)=>'<p><label><input type="checkbox"> '+(i+1)+'. '+x+'</label></p>').join('')+'<button class="primary" onclick="window.print()">Print</button></div>')}
document.querySelector('#menu').onclick=()=>show('Aerovex ERP','<div class="tiles">'+[...modules.production,...modules.accounts,...modules.masters].map(x=>'<div class="tile" onclick="closeModal();openModule(\''+x[0]+'\')"><b>'+x[0]+'</b><small>'+x[1]+'</small></div>').join('')+'</div>');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));render();

/* AEROVEX TALLY STYLE ACCOUNTING EXTENSION */
if(!db.vouchers)db.vouchers=[];if(!db.purchaseOrders)db.purchaseOrders=[];
if(!modules.accounts.some(function(x){return x[0]==='Purchase Order'}))modules.accounts.splice(4,0,['Purchase Order','Supplier PO']);
modules.accounts.push(['Voucher Register','Sales • Purchase • Receipt • Payment'],['GST Summary','Output GST • Input GST']);
function n(v){return Number(v||0)}
function tday(){return new Date().toISOString().slice(0,10)}
function vno(p,a){return p+'/'+String(a.length+1).padStart(4,'0')}
function postV(t,no,d,p,dr,cr,nar){db.vouchers.push({type:t,no:no,date:d,party:p,debit:n(dr),credit:n(cr),narration:nar||''})}
function openModule(name){
 if(name==='New Work Order'||name==='Work Orders')return workForm();
 if(name==='Party Master')return masterForm('Party Master','parties',['Party Name','GSTIN','Phone','Email']);
 if(name==='Supplier Master')return masterForm('Supplier Master','suppliers',['Supplier Name','GSTIN','Phone','Email']);
 if(name==='Product Master')return productForm();
 if(name==='Store / SRL'||name==='Store / SRL Entry')return storeForm();
 if(name==='Production Entry'||['Cutting','Stitching','Thread Cutting','Gun Finishing','Packing'].includes(name))return productionForm(name==='Production Entry'?'':name);
 if(name==='Quotation'||name==='New Quotation')return docForm('Quotation','quotations');
 if(name==='Sales Order / PO')return docForm('Sales Order / PO','salesOrders');
 if(name==='Delivery Challan')return docForm('Delivery Challan','challans');
 if(name==='Purchase Order')return docForm('Purchase Order','purchaseOrders');
 if(name==='Sales Invoice')return invoiceForm();
 if(name==='Purchase')return purchaseForm();
 if(name==='Receipt')return tallyAmount('Receipt','receipts');
 if(name==='Payment')return tallyAmount('Payment','payments');
 if(name==='Expenses')return tallyAmount('Expense','expenses');
 if(name==='Party Ledger')return ledgerView();
 if(name==='Outstanding')return outstandingView();
 if(name==='Cash / Bank')return cashView();
 if(name==='Profit Report')return profitView();
 if(name==='Voucher Register')return voucherView();
 if(name==='GST Summary')return gstView();
 if(name==='Plant Head Work List')return plantHead();
 const arr=[...modules.production,...modules.accounts,...modules.masters].find(function(x){return x[0]===name});
 show(name,'<div class="empty">'+(arr?arr[1]:'Module')+'<br><br>ZERO DATA</div>')
}
function invoiceForm(){
 var no=vno('AFX/INV',db.invoices);
 show('Sales Invoice – Tally Style','<form id="inv" class="form" onsubmit="event.preventDefault();saveInvoice(this)">'+
 '<label>Invoice No.<input name="invoiceNo" value="'+no+'" readonly></label><label>Date<input name="date" type="date" value="'+tday()+'"></label>'+
 '<label>Party Name<input name="party" required></label><label>GSTIN<input name="gstin"></label>'+
 '<label>Place of Supply<input name="place" value="Gujarat"></label><label>GST Type<select name="taxType"><option>CGST + SGST</option><option>IGST</option><option>Exempt</option></select></label>'+
 '<label class="full">Item / Description<input name="description" required></label><label>HSN/SAC<input name="hsn"></label>'+
 '<label>Qty<input name="qty" type="number" step=".01" value="1" required></label><label>Rate<input name="rate" type="number" step=".01" required></label>'+
 '<label>GST %<input name="gstPercent" type="number" step=".01" value="18"></label><label>Freight / Other<input name="other" type="number" step=".01" value="0"></label>'+
 '<label>Round Off<input name="round" type="number" step=".01" value="0"></label><label>PO / Reference<input name="ref"></label>'+
 '<label class="full">Narration<input name="narration"></label><div class="full"><button class="primary">Save & Post Sales Voucher</button></div></form>')
}
function saveInvoice(form){var o=Object.fromEntries(new FormData(form));o.qty=n(o.qty);o.rate=n(o.rate);o.taxable=o.qty*o.rate;o.gst=o.taxable*n(o.gstPercent)/100;o.total=o.taxable+o.gst+n(o.other)+n(o.round);db.invoices.push(o);postV('Sales',o.invoiceNo,o.date,o.party,o.total,0,o.narration);save();closeModal();render()}
function purchaseForm(){
 var no=vno('AFX/PUR',db.purchases);
 show('Purchase Invoice – Tally Style','<form class="form" onsubmit="event.preventDefault();savePurchase(this)">'+
 '<label>Purchase No.<input name="invoiceNo" value="'+no+'" readonly></label><label>Date<input name="date" type="date" value="'+tday()+'"></label>'+
 '<label>Supplier<input name="party" required></label><label>Supplier Invoice No.<input name="supplierInvoice"></label>'+
 '<label>GSTIN<input name="gstin"></label><label>Item / Description<input name="description" required></label>'+
 '<label>HSN/SAC<input name="hsn"></label><label>Qty<input name="qty" type="number" step=".01" value="1"></label>'+
 '<label>Rate<input name="rate" type="number" step=".01"></label><label>GST %<input name="gstPercent" type="number" step=".01" value="18"></label>'+
 '<label class="full">Narration<input name="narration"></label><div class="full"><button class="primary">Save & Post Purchase Voucher</button></div></form>')
}
function savePurchase(form){var o=Object.fromEntries(new FormData(form));o.qty=n(o.qty);o.rate=n(o.rate);o.taxable=o.qty*o.rate;o.gst=o.taxable*n(o.gstPercent)/100;o.total=o.taxable+o.gst;db.purchases.push(o);postV('Purchase',o.invoiceNo,o.date,o.party,0,o.total,o.narration);save();closeModal();render()}
function tallyAmount(title,key){show(title+' Voucher','<form class="form" data-title="'+title+'" data-key="'+key+'" onsubmit="event.preventDefault();saveAmt(this.dataset.title,this.dataset.key,this)"><label>Voucher No.<input name="no" value="'+vno('AFX/'+title.slice(0,3).toUpperCase(),db[key])+'" readonly></label><label>Date<input name="date" type="date" value="'+tday()+'"></label><label>Party / Ledger<input name="party" required></label><label>Amount<input name="amount" type="number" step=".01" required></label><label>Mode<select name="mode"><option>Bank</option><option>Cash</option><option>UPI</option></select></label><label>Reference<input name="ref"></label><label class="full">Narration<input name="remark"></label><div class="full"><button class="primary">Save Voucher</button></div></form>')}
function saveAmt(title,key,form){var o=Object.fromEntries(new FormData(form));o.amount=n(o.amount);db[key].push(o);var rec=title==='Receipt';postV(title,o.no,o.date,o.party,rec?0:o.amount,rec?o.amount:0,o.remark);save();closeModal();render()}
function tbl(h,r){return '<div class="reportWrap"><table class="report"><thead><tr>'+h.map(function(x){return '<th>'+x+'</th>'}).join('')+'</tr></thead><tbody>'+r.map(function(a){return '<tr>'+a.map(function(x){return '<td>'+x+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function ledgerView(){var ps=[...new Set(db.invoices.map(x=>x.party).concat(db.receipts.map(x=>x.party),db.purchases.map(x=>x.party),db.payments.map(x=>x.party)).filter(Boolean))],r=ps.map(function(p){var dr=db.invoices.filter(x=>x.party===p).reduce((a,x)=>a+n(x.total),0)+db.payments.filter(x=>x.party===p).reduce((a,x)=>a+n(x.amount),0),cr=db.receipts.filter(x=>x.party===p).reduce((a,x)=>a+n(x.amount),0)+db.purchases.filter(x=>x.party===p).reduce((a,x)=>a+n(x.total),0);return[p,money(dr),money(cr),money(dr-cr)]});show('Party Ledger',tbl(['Ledger','Debit','Credit','Balance'],r)+(r.length?'':'<div class="empty">ZERO LEDGER DATA</div>'))}
function outstandingView(){var r=db.invoices.reduce((a,x)=>a+n(x.total),0)-db.receipts.reduce((a,x)=>a+n(x.amount),0),p=db.purchases.reduce((a,x)=>a+n(x.total),0)-db.payments.reduce((a,x)=>a+n(x.amount),0);show('Outstanding','<div class="summaryCards"><div><small>Receivable</small><b>'+money(r)+'</b></div><div><small>Payable</small><b>'+money(p)+'</b></div></div>')}
function cashView(){var i=db.receipts.reduce((a,x)=>a+n(x.amount),0),o=db.payments.reduce((a,x)=>a+n(x.amount),0)+db.expenses.reduce((a,x)=>a+n(x.amount),0);show('Cash / Bank','<div class="summaryCards"><div><small>Money In</small><b>'+money(i)+'</b></div><div><small>Money Out</small><b>'+money(o)+'</b></div><div><small>Net</small><b>'+money(i-o)+'</b></div></div>')}
function profitView(){var s=db.invoices.reduce((a,x)=>a+n(x.taxable),0),p=db.purchases.reduce((a,x)=>a+n(x.taxable),0),e=db.expenses.reduce((a,x)=>a+n(x.amount),0);show('Profit Report','<div class="summaryCards"><div><small>Sales</small><b>'+money(s)+'</b></div><div><small>Purchase</small><b>'+money(p)+'</b></div><div><small>Expense</small><b>'+money(e)+'</b></div><div><small>Profit View</small><b>'+money(s-p-e)+'</b></div></div>')}
function voucherView(){show('Voucher Register',tbl(['Type','No.','Date','Party','Debit','Credit'],db.vouchers.map(x=>[x.type,x.no,x.date||'',x.party||'',money(x.debit),money(x.credit)]))+(db.vouchers.length?'':'<div class="empty">ZERO VOUCHERS</div>'))}
function gstView(){var out=db.invoices.reduce((a,x)=>a+n(x.gst),0),inp=db.purchases.reduce((a,x)=>a+n(x.gst),0);show('GST Summary','<div class="summaryCards"><div><small>Output GST</small><b>'+money(out)+'</b></div><div><small>Input GST</small><b>'+money(inp)+'</b></div><div><small>Net GST</small><b>'+money(out-inp)+'</b></div></div>')}
save();render();



function axEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function axInvoices(){let rows=db.invoices.map((x,i)=>[axEsc(x.invoiceNo),axEsc(x.date),axEsc(x.party),money(x.total),'<button type="button" onclick="axPrintInvoice('+i+')">View / Print</button>']);show('Sales Invoices','<button class="primary" onclick="invoiceForm()">＋ New Invoice</button> <button onclick="axLogoSetup()">🖼 Set Invoice Logo</button><br><br>'+tbl(['Invoice','Date','Party','Total','Print'],rows)+(rows.length?'':'<p>No invoices saved yet.</p>'))}
function axPrintInvoice(i){const x=db.invoices[i];if(!x)return;const num=v=>Number(v||0),fmt=v=>num(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});const tax=num(x.taxType==='Exempt'?0:x.gst),igst=x.taxType==='IGST',cg=igst?0:tax/2,sg=cg;const other=num(x.other),round=num(x.round),total=num(x.total);
const html='<section class="axBill"><header><div><h1>AEROVEX</h1><strong>FILTRATION</strong><br><small>Smart Filtration Solutions</small></div><div><h2>AEROVEX FILTRATION</h2><p>Ankleshwar, Gujarat<br>GSTIN: 24BPCPB7271L1ZW<br>Phone: 7405915266<br>aerovexfiltration@gmail.com</p></div></header><h2 class="axBillTitle">TAX INVOICE</h2><div class="axBillMeta"><div><b>Bill To:</b><br>'+axEsc(x.party)+'<br>GSTIN: '+axEsc(x.gstin)+'<br>Place of Supply: '+axEsc(x.place)+'</div><div><b>Invoice:</b> '+axEsc(x.invoiceNo)+'<br><b>Date:</b> '+axEsc(x.date)+'<br><b>PO / Ref:</b> '+axEsc(x.ref)+'<br><b>Tax Type:</b> '+axEsc(x.taxType)+'</div></div><table><thead><tr><th>Sr.</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable Amount</th></tr></thead><tbody><tr><td>1</td><td>'+axEsc(x.description)+'</td><td>'+axEsc(x.hsn)+'</td><td>'+axEsc(x.qty)+'</td><td>'+fmt(x.rate)+'</td><td>'+fmt(x.taxable)+'</td></tr></tbody></table><div class="axBillTotals"><div>Taxable Value <b>₹ '+fmt(x.taxable)+'</b></div>'+(igst?'<div>IGST <b>₹ '+fmt(tax)+'</b></div>':'<div>CGST <b>₹ '+fmt(cg)+'</b></div><div>SGST <b>₹ '+fmt(sg)+'</b></div>')+'<div>Freight / Other <b>₹ '+fmt(other)+'</b></div><div>Round Off <b>₹ '+fmt(round)+'</b></div><div class="axGrand">Grand Total <b>₹ '+fmt(total)+'</b></div></div><p><b>Narration:</b> '+axEsc(x.narration)+'</p><div class="axBillFoot"><div><b>Bank Details</b><br>Bank: ___________________<br>Account: ___________________<br>IFSC: ___________________</div><div><b>For AEROVEX FILTRATION</b><br><br><br>Authorized Signatory</div></div></section><div class="axPrintControls"><button class="primary" onclick="window.print()">🖨 Print / Save PDF</button><button onclick="axInvoices()">Back to Invoices</button></div>';show('Invoice Preview',html)}
const axOriginalInvoiceForm=invoiceForm;
invoiceForm=function(){axOriginalInvoiceForm();const box=document.querySelector('#modalBody');if(box){const saved=db.invoices.map((x,i)=>'<div style="padding:10px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;gap:8px"><span>'+axEsc(x.invoiceNo||'Invoice '+(i+1))+' — '+axEsc(x.party)+'</span><button type="button" onclick="axPrintInvoice('+i+')">🖨 PRINT</button></div>').join('');box.insertAdjacentHTML('beforeend','<section style="margin-top:20px"><h3>Saved Invoices — Print Old Bills</h3>'+(saved||'<p>No saved invoices on this device.</p>')+'</section>')}}
const axOriginalSaveInvoice=saveInvoice;
saveInvoice=function(form){axOriginalSaveInvoice(form);axPrintInvoice(db.invoices.length-1)}
const axOpenModule=openModule;openModule=function(name){if(name==='Sales Invoice')return axInvoices();return axOpenModule(name)};

function axLogoSetup(){show('Aerovex Logo Setup','<p>Upload your original Aerovex logo once. It will appear in the ERP and on printed invoices on this device.</p><input type="file" accept="image/png,image/jpeg,image/webp" onchange="axSaveLogo(this)"><p id="axLogoMessage"></p>')}
function axSaveLogo(input){const file=input.files&&input.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(){try{localStorage.setItem('aerovex-logo-data',reader.result);axApplyLogo();document.querySelector('#axLogoMessage').textContent='Logo saved as watermark for ERP and invoice.'}catch(e){document.querySelector('#axLogoMessage').textContent='Image too large. Please upload a smaller logo file.'}};reader.readAsDataURL(file)}
function axApplyLogo(){const src=localStorage.getItem('aerovex-logo-data');if(!src)return;document.documentElement.style.setProperty('--ax-watermark-url','url("'+src+'")');document.body.classList.add('axHasWatermark')}
const axPrintWithLogo=axPrintInvoice;axPrintInvoice=function(i){axPrintWithLogo(i);axApplyLogo()};
window.addEventListener('load',axApplyLogo);

/* Invoice print v8: preserve old records, avoid invented missing fields */
function axAmountWords(value){let n=Math.floor(Math.abs(Number(value)||0));const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];const t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];function w(x){if(x<20)return a[x];if(x<100)return t[Math.floor(x/10)]+(x%10?' '+a[x%10]:'');if(x<1000)return a[Math.floor(x/100)]+' Hundred'+(x%100?' '+w(x%100):'');if(x<100000)return w(Math.floor(x/1000))+' Thousand '+w(x%1000);if(x<10000000)return w(Math.floor(x/100000))+' Lakh '+w(x%100000);return w(Math.floor(x/10000000))+' Crore '+w(x%10000000)}return 'Rupees '+(w(n)||'Zero')+' Only'}
function axPrintInvoice(i){
 const x=db.invoices[i];if(!x)return;const e=axEsc, num=v=>Number(v||0),fmt=v=>num(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const hasItem=Boolean(x.description&&x.qty!==undefined&&x.rate!==undefined&&Number(x.qty)>0);
 const taxable=hasItem?num(x.qty)*num(x.rate):num(x.taxable);
 const gst=num(x.gst), other=num(x.other),round=num(x.round);
 const total=num(x.total)||taxable+gst+other+round;
 const taxType=x.taxType||'';
 const gstRate=Number(x.gstPercent||0);
 const computedGST=hasItem&&taxType!=='Exempt'?taxable*gstRate/100:0;
 const mismatch=hasItem&&Math.abs(computedGST-gst)>0.02;
 const incomplete=!hasItem||!x.date||!x.gstin||!taxType;
 const warning=(incomplete||mismatch)?'<div class="axBillWarning"><b>CHECK BEFORE ISSUING:</b> '+(!hasItem?'This older invoice has no saved item description / quantity / rate. ':'')+(!x.date?'Invoice date missing. ':'')+(!x.gstin?'Customer GSTIN missing (if applicable). ':'')+(!taxType?'GST type missing. ':'')+(mismatch?'Saved GST differs from item-based calculation. ':'')+'Verify the original invoice; missing information cannot be reconstructed automatically.</div>':'';
 const logo=localStorage.getItem('aerovex-logo-data');
 const logomark='<div class="axPrintWordmark"><b>AEROVEX</b><span>FILTRATION</span><small>Smart Filtration Solutions</small></div>';
 const cg=taxType==='IGST'?0:gst/2,sg=cg,ig=taxType==='IGST'?gst:0;
 const itemRows=hasItem?'<tr><td>1</td><td>'+e(x.description)+'</td><td>'+e(x.hsn)+'</td><td>'+e(x.qty)+'</td><td>'+e(x.unit||'Nos')+'</td><td>'+fmt(x.rate)+'</td><td>'+fmt(taxable)+'</td></tr>':'<tr><td>1</td><td colspan="5"><em>Item details not saved in this older invoice — verify original bill</em></td><td>'+fmt(taxable)+'</td></tr>';
 const line=(name,v)=>'<div><span>'+name+'</span><b>₹ '+fmt(v)+'</b></div>';
 const html='<div class="axPrintPaper">'+(logo?'<img class="axInvoiceWatermark" alt="" aria-hidden="true" src="'+logo+'">':'')+'<div class="axPrintHeader"><div class="axPrintLogoWrap">'+logomark+'</div><div class="axPrintCompany"><h2>AEROVEX FILTRATION</h2><p>GIDC, Ankleshwar, Bharuch - 393002, Gujarat, India<br>Phone: 7405915266<br>Email: aerovexfiltration@gmail.com<br><strong>GSTIN: 24BPCPB7271L1ZW</strong></p></div></div><div class="axPrintTitle">TAX INVOICE <small>Original for Recipient</small></div><div class="axPrintMeta"><div><b>Bill To</b><h3>'+e(x.party)+'</h3><p>GSTIN: '+e(x.gstin||'Not recorded')+'<br>Place of Supply: '+e(x.place||'Not recorded')+'</p></div><div><p><b>Invoice No:</b> '+e(x.invoiceNo||'Not recorded')+'</p><p><b>Invoice Date:</b> '+e(x.date||'Not recorded')+'</p><p><b>PO / Reference:</b> '+e(x.ref||'Not recorded')+'</p><p><b>Tax Type:</b> '+e(taxType||'Not recorded')+'</p></div></div><table class="axPrintItems"><thead><tr><th>Sr.</th><th>Description of Goods</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody>'+itemRows+'</tbody></table><div class="axPrintTotals">'+line('Taxable Value',taxable)+(taxType==='IGST'?line('IGST',ig):line('CGST',cg)+line('SGST',sg))+line('Freight / Other',other)+line('Round Off',round)+'<div class="axPrintGrand"><span>Grand Total</span><b>₹ '+fmt(total)+'</b></div></div><div class="axPrintWords"><b>Amount in Words:</b><br>'+axAmountWords(total)+'</div>'+warning+'<div class="axPrintBottom"><div><h3>Bank Details</h3><p>Bank: Not configured<br>Account: Not configured<br>IFSC: Not configured</p></div><div><h3>Terms & Conditions</h3><p>As mutually agreed with the customer.<br>Subject to Ankleshwar jurisdiction.</p></div></div><div class="axPrintSign"><span>Thank you for your business!</span><span>For <b>AEROVEX FILTRATION</b><br><br><br>Authorized Signatory</span></div></div><div class="axPrintActions"><button class="primary" onclick="window.print()">🖨 Print / Save PDF</button><button onclick="axInvoices()">Back</button></div>';
 show('Invoice Preview',html);
}

setTimeout(function(){var splash=document.getElementById('axSplash');if(splash)splash.remove()},3200);
document.addEventListener('click',function(event){
 var tile=event.target.closest('.tile');
 if(!tile||!tile.closest('#production,#accounts,#masters'))return;
 event.stopPropagation();
 var name=tile.querySelector('b');
 if(name)openModule(name.textContent.trim());
},true);

/* Safe local backup: download only, never change saved ERP records */
function axDownloadBackup(){
 try{
  const raw=localStorage.getItem(KEY);
  if(!raw){alert('No ERP data saved on this device yet.');return}
  const payload={application:'Aerovex ERP',formatVersion:1,createdAt:new Date().toISOString(),storageKey:KEY,data:JSON.parse(raw)};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='Aerovex-ERP-Backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 }catch(error){alert('Backup could not be created: '+error.message)}
}
(function(){
 function addBackupButton(){
  const header=document.querySelector('body > header');
  if(!header||document.getElementById('axBackupBtn'))return;
  const btn=document.createElement('button');
  btn.id='axBackupBtn';btn.type='button';btn.textContent='⬇ Backup';
  btn.title='Download a copy of saved ERP data (does not change records)';
  btn.style.cssText='padding:9px;border:1px solid #b8d1d9;border-radius:9px;background:#eaf6f9;color:#084d60;font-weight:700;cursor:pointer;margin-left:auto;margin-right:8px';
  btn.addEventListener('click',axDownloadBackup);
  const menu=document.getElementById('menu');
  header.insertBefore(btn,menu||null);
  const importBtn=document.createElement('button');
  importBtn.id='axImportBtn';importBtn.type='button';importBtn.textContent='⬆ Restore';
  importBtn.title='Restore a previously downloaded Aerovex ERP backup';
  importBtn.style.cssText='padding:9px;border:1px solid #b8d1d9;border-radius:9px;background:#fff;color:#084d60;font-weight:700;cursor:pointer;margin-right:8px';
  const picker=document.createElement('input');
  picker.type='file';picker.accept='.json,application/json';picker.hidden=true;
  importBtn.addEventListener('click',()=>picker.click());
  picker.addEventListener('change',async function(){
    const file=picker.files&&picker.files[0];if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload.application!=='Aerovex ERP'||payload.storageKey!==KEY||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))throw Error('This is not a valid Aerovex ERP backup');
      const keys=Object.keys(blank());
      if(!keys.every(k=>Array.isArray(payload.data[k])))throw Error('Backup is missing ERP modules');
      const current=localStorage.getItem(KEY);
      if(!confirm('RESTORE BACKUP? This replaces all ERP records on THIS device with the selected backup. Continue?'))return;
      if(current){const safety=JSON.stringify({application:'Aerovex ERP',formatVersion:1,createdAt:new Date().toISOString(),storageKey:KEY,data:JSON.parse(current)});const blob=new Blob([safety],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Aerovex-Before-Restore-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
      localStorage.setItem(KEY,JSON.stringify(payload.data));
      alert('Backup restored. ERP will reload now.');
      location.reload();
    }catch(e){alert('Restore failed: '+e.message)}
    finally{picker.value=''}
  });
  header.insertBefore(importBtn,menu||null);
  header.appendChild(picker);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addBackupButton);
 else addBackupButton();
})();

/* CA-only monthly GST exports: reports, not return filing. */
(function(){
 const statusKey='aerovex-gst-ca-status-v1';
 const number=v=>Number(v)||0;
 const dateOf=x=>String(x.date||'').slice(0,7);
 const gst=x=>x.taxType==='Exempt'?0:number(x.gst);
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const invoiceRows=(month,kind)=>{const a=(kind==='sales'?db.invoices:db.purchases).filter(x=>dateOf(x)===month);return a.map(x=>{const tax=gst(x),igst=x.taxType==='IGST'?tax:0,cgst=x.taxType==='IGST'?0:tax/2,sgst=cgst;return [x.date||'',x.invoiceNo||x.supplierInvoice||'',x.party||'',x.gstin||'',x.place||'',x.hsn||'',x.description||'',number(x.taxable),cgst,sgst,igst,tax,number(x.total),x.taxType||'Unspecified']})};
 const headings=['Date','Invoice No','Party','GSTIN','Place of Supply','HSN','Description','Taxable Value','CGST','SGST','IGST','Total GST','Invoice Total','Tax Type'];
 function download(name,rows){const data=[headings,...rows].map(r=>r.map(csv).join(',')).join('\r\n');const blob=new Blob(['\uFEFF'+data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 function readStatus(){try{return JSON.parse(localStorage.getItem(statusKey)||'{}')}catch(e){return {}}}
 window.axGSTCA=function(){const m=new Date().toISOString().slice(0,7),opts=['Pending','Sent to CA','Filed'];const status=readStatus()[m]||'Pending';show('GST Reports • CA Export','<p>Monthly CA handover reports. Not official GSTR-1 or GSTR-3B filing files. Verify with GSTR-2B and GST portal before filing.</p><label>Month <input id="axGSTMonth" type="month" value="'+m+'" onchange="axGSTUpdate()"></label><div id="axGSTResults"></div><label>Filing Status <select id="axGSTStatus" onchange="axGSTSetStatus()">'+opts.map(x=>'<option'+(x===status?' selected':'')+'>'+x+'</option>').join('')+'</select></label><p><button type="button" onclick="axGSTDownload(\'sales\')">⬇ Sales CSV (Excel)</button> <button type="button" onclick="axGSTDownload(\'purchase\')">⬇ Purchase CSV (Excel)</button> <button type="button" onclick="axGSTPrint()">🖨 PDF / Print</button></p>');axGSTUpdate()};
 window.axGSTUpdate=function(){const month=document.getElementById('axGSTMonth').value,s=invoiceRows(month,'sales'),p=invoiceRows(month,'purchase'),total=(rows,i)=>rows.reduce((a,x)=>a+number(x[i]),0),el=document.getElementById('axGSTResults');if(!el)return;el.innerHTML='<div class="summaryCards"><div><small>Sales Invoices</small><b>'+s.length+'</b></div><div><small>Output GST</small><b>'+money(total(s,11))+'</b></div><div><small>Purchase Invoices</small><b>'+p.length+'</b></div><div><small>Purchase GST (unverified)</small><b>'+money(total(p,11))+'</b></div></div><p><small>Indicative difference: '+money(total(s,11)-total(p,11))+'. Purchase GST is NOT confirmed eligible ITC. Review missing dates, GSTINs, credit notes and tax classification with CA.</small></p>';document.getElementById('axGSTStatus').value=readStatus()[month]||'Pending'};
 window.axGSTSetStatus=function(){const month=document.getElementById('axGSTMonth').value,s=readStatus();s[month]=document.getElementById('axGSTStatus').value;localStorage.setItem(statusKey,JSON.stringify(s))};
 window.axGSTDownload=function(kind){const month=document.getElementById('axGSTMonth').value;download('Aerovex-CA-'+kind+'-'+month,invoiceRows(month,kind))};
 window.axGSTPrint=function(){const month=document.getElementById('axGSTMonth').value,s=invoiceRows(month,'sales'),p=invoiceRows(month,'purchase'),total=(rows,i)=>rows.reduce((a,x)=>a+number(x[i]),0),status=readStatus()[month]||'Pending';const rows=[['Sales invoices',s.length],['Taxable sales',total(s,7)],['Output CGST',total(s,8)],['Output SGST',total(s,9)],['Output IGST',total(s,10)],['Output GST',total(s,11)],['Purchase invoices',p.length],['Purchase GST (unverified)',total(p,11)],['Indicative difference, not payable tax',total(s,11)-total(p,11)],['Filing status',status]];const w=window.open('','_blank');if(!w){alert('Allow popups to print or save PDF');return}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Aerovex CA GST '+escape(month)+'</title><style>body{font:14px Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:9px;text-align:left}h1{font-size:22px}p{line-height:1.5}</style></head><body><h1>AEROVEX FILTRATION — CA GST Summary</h1><p>Month: '+escape(month)+' | Status: '+escape(status)+'</p><table>'+rows.map(x=>'<tr><th>'+escape(x[0])+'</th><td>'+escape(x[1])+'</td></tr>').join('')+'</table><p>Working report only. CA must reconcile GST portal GSTR-2B, credit/debit notes, classification, eligibility of ITC, and final return values. This report does not file GST returns.</p></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),350)};
 const oldOpen=openModule;openModule=function(name){if(name==='GST Reports / CA Export')return axGSTCA();return oldOpen(name)};
 const account=modules.accounts;if(!account.some(x=>x[0]==='GST Reports / CA Export'))account.push(['GST Reports / CA Export','Monthly sales, purchase & CA exports']);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();

/* Automatic document numbering, independent series; existing records untouched. */
(function(){
const prefixes={quotations:'AFX/QTN',salesOrders:'AFX/SO',challans:'AFX/DC',purchaseOrders:'AFX/PO'};
const field={quotations:'quotationNo',salesOrders:'orderNo',challans:'challanNo',purchaseOrders:'poNo'};
function next(key){const prefix=prefixes[key],list=db[key]||[];let max=0;for(const o of list){for(const v of [o[field[key]],o.no,o.ref]){const m=String(v||'').match(new RegExp('^'+prefix.replace('/','\\/')+'/(\\d+)$','i'));if(m)max=Math.max(max,Number(m[1]))}}return prefix+'/'+String(Math.max(max,list.length)+1).padStart(4,'0')}
function create(title,key){const no=next(key),fn=field[key];show(title,'<form class="form" data-key="'+key+'" onsubmit="event.preventDefault();axSaveNumberedDoc(this)"><label>Document No.<input name="'+fn+'" value="'+no+'" readonly></label><label>Party<input name="party" required></label><label>Date<input name="date" type="date" value="'+tday()+'" required></label><label>Customer / Supplier Reference<input name="ref"></label><label>Amount<input name="amount" type="number" min="0" step=".01"></label><label class="full">Description<textarea name="description"></textarea></label><div class="full"><button class="primary">Save '+title+'</button></div></form>')}
window.axSaveNumberedDoc=function(form){const key=form.dataset.key;if(!prefixes[key])return;const o=Object.fromEntries(new FormData(form)),fn=field[key];o[fn]=next(key);if((db[key]||[]).some(x=>x[fn]===o[fn])){alert('Document number already exists. Reopen and try again.');return}db[key].push(o);save();closeModal();render()};
const previous=openModule;
openModule=function(name){const mapping={'Quotation':['Quotation','quotations'],'New Quotation':['Quotation','quotations'],'Sales Order / PO':['Sales Order / PO','salesOrders'],'Delivery Challan':['Delivery Challan','challans'],'Purchase Order':['Purchase Order','purchaseOrders']};if(mapping[name])return create(...mapping[name]);return previous(name)};
const oldVno=vno;
vno=function(prefix,rows){let max=0;for(const o of rows){for(const v of [o.invoiceNo,o.no,o.workNo,o.ref]){const m=String(v||'').match(new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/(\\d+)$','i'));if(m)max=Math.max(max,Number(m[1]))}}return prefix+'/'+String(Math.max(max,rows.length)+1).padStart(4,'0')};
})();
