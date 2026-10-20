/* Sales Order items -> separate Aerovex production Work Orders. Old data untouched. */
(function(){
'use strict';
const KEY='aerovex-erp-data-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const orders=()=>Array.isArray(db.salesOrders)?db.salesOrders:[];
const works=()=>Array.isArray(db.workOrders)?db.workOrders:[];
const id=o=>String(o?.documentNo||o?.orderNo||'').trim();
const lines=o=>Array.isArray(o?.items)?o.items:[];
let chosen=null;
function allocations(order,index){
 const used=lines(order).map(()=>0),errors=[];
 if(!id(order))errors.push('Sales Order number is missing.');
 if(!used.length)errors.push('No product lines saved in this Sales Order.');
 works().forEach(w=>{
  if(w.sourceSalesOrder? w.sourceSalesOrder!==id(order):w.sourceSalesOrderIndex!==index)return;
  const n=w.sourceLine??w.sourceSalesOrderLine;
  if(!Number.isInteger(n)||n<0||n>=used.length){errors.push('Existing linked Work Order '+w.workNo+' has no reliable product line.');return}
  const qty=Number(w.qty??w.items?.[0]?.qty);
  if(!Number.isFinite(qty)||qty<=0){errors.push('Invalid quantity in '+w.workNo);return}
  used[n]+=qty;
 });
 const rows=lines(order).map((item,i)=>({item,i,total:Number(item.qty),left:Number(item.qty)-used[i],used:used[i]}));
 if(rows.some(x=>!Number.isFinite(x.total)||x.total<=0||x.left<-.000001))errors.push('Work Order quantities are invalid or exceed Sales Order quantities.');
 return {rows,errors};
}
function nextNumbers(count){
 const taken=new Set(works().map(w=>String(w.workNo||'').toUpperCase()));
 let seq=works().reduce((n,w)=>{const m=String(w.workNo||'').match(/^AFX-WO-(\d+)$/i);return m?Math.max(n,+m[1]):n},0),ids=[];
 while(ids.length<count){
  const candidate='AFX-WO-'+String(++seq).padStart(4,'0');
  if(!taken.has(candidate.toUpperCase())){ids.push(candidate);taken.add(candidate.toUpperCase())}
 }
 return ids;
}
window.axSOCreateWorkOrders=function(index){
 if(Number.isInteger(index))chosen=index;
 const opts=orders().map((o,i)=>'<option value="'+i+'" '+(i===chosen?'selected':'')+'>'+esc(id(o)||'No number')+' — '+esc(o.party||'')+'</option>').join('');
 show('Sales Order → Separate Work Orders','<p>Every selected Sales Order product creates its own Work No. Stock and existing orders remain unchanged.</p><label>Choose Sales Order<select id="axSOWOSelect"><option value="">Select Sales Order</option>'+opts+'</select></label><div id="axSOWORows"></div>');
 document.getElementById('axSOWOSelect').onchange=function(){chosen=this.value===''?null:Number(this.value);draw()};
 draw();
};
function draw(){
 const root=document.getElementById('axSOWORows');if(!root)return;
 const order=chosen==null?null:orders()[chosen];
 if(!order){root.innerHTML='<p>Select Sales Order first.</p>';return}
 const data=allocations(order,chosen);
 root.innerHTML=data.errors.map(x=>'<p style="color:#b42318">'+esc(x)+'</p>').join('')+
 data.rows.map(r=>'<section style="margin:10px 0;padding:12px;border:1px solid #cddde7;border-radius:10px"><label><input type="checkbox" class="axSOSelectItem" data-line="'+r.i+'" '+(r.left>0&&!data.errors.length?'checked':'disabled')+'> <b>'+esc(r.item.description||'Product '+(r.i+1))+'</b></label><p>Size '+esc(r.item.size||'')+' | SO Qty '+r.total+' | WO Qty '+r.used+' | Pending '+Math.max(0,r.left)+'</p>'+(r.left>0&&!data.errors.length?'<label>WO Qty<input type="number" class="axSOQty" data-line="'+r.i+'" min="0.001" max="'+r.left+'" step="any" value="'+r.left+'"></label>':'')+'</section>').join('')+
 (data.rows.some(r=>r.left>0)&&!data.errors.length?'<label>Priority<select id="axSOWOPriority"><option>Normal</option><option>Urgent</option></select></label><p><button class="primary" id="axSOWOSave" type="button">Create Individual Work Orders</button></p>':'')+
 '<p>Linked Works: '+works().filter(w=>w.sourceSalesOrder===id(order)).map(w=>esc(w.workNo)).join(' • ')+'</p>';
 document.getElementById('axSOWOSave')?.addEventListener('click',create);
}
function create(){
 const order=orders()[chosen],state=allocations(order,chosen);
 if(state.errors.length)return alert(state.errors.join('; '));
 const root=document.getElementById('axSOWORows');
 const selected=[...root.querySelectorAll('.axSOSelectItem:checked')].map(c=>{
  const i=Number(c.dataset.line),qty=Number(root.querySelector('.axSOQty[data-line="'+i+'"]')?.value);
  return {i,qty};
 });
 if(!selected.length)return alert('Select at least one item.');
 if(selected.some(x=>!Number.isInteger(x.i)||!Number.isFinite(x.qty)||x.qty<=0||x.qty>state.rows[x.i].left+0.000001))return alert('Verify quantity against pending quantity.');
 if(!confirm('Create '+selected.length+' separate Work Orders for '+id(order)+'?'))return;
 const fresh=allocations(order,chosen);
 if(fresh.errors.length||selected.some(x=>x.qty>fresh.rows[x.i].left+0.000001))return alert('Order changed. Reopen and review.');
 const numbers=nextNumbers(selected.length),today=new Date().toLocaleDateString('en-CA');
 const newWorks=selected.map((entry,j)=>{
  const x=lines(order)[entry.i];
  const item={description:String(x.description||''),size:String(x.size||''),cloth:String(x.cloth||''),width:String(x.width||''),srl:String(x.srl||''),qty:entry.qty,cutQty:0,moc:String(x.moc||''),micron:String(x.micron||''),hsn:String(x.hsn||''),unit:String(x.unit||'Nos')};
  return {workNo:numbers[j],party:order.party||'',po:order.poRef||order.ref||id(order),date:today,priority:document.getElementById('axSOWOPriority')?.value||'Normal',remark:'From '+id(order),description:item.description,items:[item],qty:entry.qty,done:0,status:'Open',sourceSalesOrder:id(order),sourceSalesOrderIndex:chosen,sourceLine:entry.i,sourceSalesOrderLine:entry.i};
 });
 if(newWorks.some(w=>!w.description.trim()))return alert('Sales Order product description is required.');
 const next=JSON.parse(JSON.stringify(db));
 if(!Array.isArray(next.workOrders))next.workOrders=[];
 next.workOrders.push(...newWorks);
 if(new Set(next.workOrders.map(w=>String(w.workNo||'').toUpperCase())).size!==next.workOrders.length)return alert('Duplicate Work No detected; nothing saved.');
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(error){return alert('Not saved: '+error.message)}
 if(!Array.isArray(db.workOrders))db.workOrders=[];
 db.workOrders.push(...newWorks);
 try{render()}catch(error){}
 alert('Created '+newWorks.length+' Work Orders: '+numbers.join(', '));
 draw();
}
const oldOpen=window.openModule;
window.openModule=function(name){if(name==='Sales Order to Work Orders')return window.axSOCreateWorkOrders();return oldOpen.apply(this,arguments)};
modules.production.unshift(['Sales Order to Work Orders','Separate Work Order for each Sales Order item']);
const oldPreview=window.axDocPreview;
window.axDocPreview=function(type,index){
 const response=oldPreview.apply(this,arguments);
 if(type==='Sales Order / PO'){
  const actions=document.querySelector('#modalBody .axDocActions');
  if(actions&&!actions.querySelector('.axSOCreateButton')){
   const b=document.createElement('button');b.type='button';b.className='primary axSOCreateButton';b.textContent='Create Separate Work Orders';b.onclick=()=>window.axSOCreateWorkOrders(index);actions.prepend(b);
  }
 }
 return response;
};
try{render()}catch(error){}
})();
