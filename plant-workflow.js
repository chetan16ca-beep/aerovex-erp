(function(){
const esc=v=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
window.axPlantWork=function(){
 const no=nextWO();
 show('CFM Style Work Order • V12','<form id="plantWO" class="form"><label>Work No<input name="workNo" value="'+esc(no)+'" readonly></label><label>Party<input name="party" required></label><label>PO No<input name="po"></label><label>Priority<select name="priority"><option>Normal</option><option>Urgent</option></select></label><label class="full">Remarks<input name="remark"></label><div class="full"><h3>Order Items</h3><div id="plantLines"></div><button type="button" onclick="axPlantLine()">Add Product / Cloth</button></div><div class="full"><button class="primary">Save Work Order</button></div></form>');
 axPlantLine();
 document.getElementById('plantWO').onsubmit=function(ev){
 ev.preventDefault();const o=Object.fromEntries(new FormData(this));
 o.items=[...this.querySelectorAll('.plantLine')].map(el=>{const get=k=>el.querySelector('[data-field='+k+']').value;return {description:get('description'),size:get('size'),cloth:get('cloth'),width:get('width'),srl:get('srl'),qty:Number(get('qty')),cutQty:0}}).filter(x=>x.description&&x.qty>0);
 if(!o.items.length){alert('Add product and quantity');return}
 o.qty=o.items.reduce((n,x)=>n+x.qty,0);o.done=0;o.status='Open';o.description=o.items.map(x=>x.description).join(', ');
 db.workOrders.push(o);save();axPlantPending()
 };
};
window.axPlantLine=function(){
 const el=document.createElement('fieldset');el.className='plantLine';el.style.margin='10px 0';
 el.innerHTML=['description','size','cloth','width','srl','qty'].map(k=>'<label>'+k.toUpperCase()+'<input data-field='+k+' '+(k==='qty'?'type=number min=1 required':'')+'></label>').join('')+'<button type=button onclick="this.parentNode.remove()">Remove</button>';
 document.getElementById('plantLines').appendChild(el)
};
window.axPlantPending=function(){
 const rows=db.workOrders.map((w,i)=>({w,i})).filter(({w})=>w.status!=='Closed').map(({w,i})=>{
 const lines=w.items||[{description:w.description,cloth:w.cloth,width:w.width,qty:w.qty,cutQty:0}];
 return '<section class=panel><h3>'+esc(w.workNo)+' — '+esc(w.party)+'</h3><table><thead><tr><th>Product</th><th>Cloth</th><th>Width</th><th>Order</th><th>Cut</th><th>Pending</th><th>Entry</th></tr></thead><tbody>'+lines.map((x,j)=>'<tr><td>'+esc(x.description)+'</td><td>'+esc(x.cloth)+'</td><td>'+esc(x.width)+'</td><td>'+Number(x.qty||0)+'</td><td>'+Number(x.cutQty||0)+'</td><td>'+Math.max(0,Number(x.qty||0)-Number(x.cutQty||0))+'</td><td><button onclick="axPlantCut('+i+','+j+')">Cut</button></td></tr>').join('')+'</tbody></table></section>'
 }).join('');
 show('Pending Order — CFM Format • V12','<button class=primary onclick="axPlantWork()">New Work Order</button> <button onclick="axPlantPrint()">Print Pending</button>'+rows)
};
window.axPlantCut=function(i,j){
 const w=db.workOrders[i],item=w?.items?.[j];if(!item){alert('Old work order requires manual cutting entry');return}
 const pending=Math.max(0,Number(item.qty)-Number(item.cutQty||0));if(!pending)return alert('Already cut');
 const amount=prompt('Cut Qty, pending '+pending,pending);if(amount===null)return;const q=Number(amount);if(!(q>0&&q<=pending))return alert('Invalid quantity');
 const serial=prompt('Actual SRL',item.srl||'');if(serial===null)return;
 const meter=prompt('Meter consumed','0');if(meter===null)return;const m=Number(meter);if(!Number.isFinite(m)||m<0)return alert('Invalid meter');
 item.cutQty=Number(item.cutQty||0)+q;db.cutting.push({workNo:w.workNo,description:item.description,srl:serial,cloth:item.cloth,width:item.width,qty:q,meter:m,date:new Date().toISOString().slice(0,10)});save();axPlantPending()
};
window.axPlantPrint=function(){const sections=[...document.querySelectorAll('#modalBody section.panel')].map(x=>x.outerHTML).join('');if(!sections)return alert('No pending orders');const w=window.open('','_blank');if(!w)return alert('Allow popups');w.document.write('<!doctype html><html><head><title>Pending Cutting Plan</title><style>@page{size:A4 landscape;margin:10mm}body{font:12px Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px}button{display:none}section{break-inside:avoid}</style></head><body><h2>AEROVEX FILTRATION — PENDING CUTTING PLAN</h2>'+sections+'</body></html>');w.document.close();setTimeout(()=>w.print(),300)};
const prev=openModule;openModule=function(name){if(name==='New Work Order'||name==='Work Orders')return axPlantWork();if(name==='Pending Orders')return axPlantPending();return prev(name)};
})();