/* CFM-aligned Aerovex work-order workflow, preserving all existing records. */
(function(){
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const num=v=>Math.max(0,Number(v)||0);
const items=w=>Array.isArray(w.items)&&w.items.length?w.items:[{description:w.description||w.product||'',size:w.size||'',cloth:w.cloth||'',width:w.width||'',srl:w.srl||'',qty:num(w.qty),cutQty:num(w.done)}];
const pending=x=>Math.max(0,num(x.qty)-num(x.cutQty));
const isDeleted=w=>!!(w&&(w.isDeleted===true||w.deleted===true||String(w.status||'').toLowerCase()==='deleted'));
const ACTIVE_MODULES=['cutting','departmentWork','packing','dispatch','dispatches','qc','qualityChecks','invoices','challans'];
function woLinks(w){
 const id=String(w.workNo||'').trim().toUpperCase();
 const fields=['workNo','workOrder','workOrderNo','sourceWorkOrder','sourceWorkNo','refWorkOrder','linkedWorkOrder'];
 const found=[];
 for(const key of ACTIVE_MODULES){
  const list=Array.isArray(db[key])?db[key]:[];
  const count=list.filter(row=>row&&fields.some(f=>String(row[f]||'').trim().toUpperCase()===id)).length;
  if(count)found.push(key+': '+count+' linked entries');
 }
 return found;
}
function woDeletionBlockers(w){
 const reasons=woLinks(w);
 if(items(w).some(x=>num(x.cutQty)>0||num(x.doneQty)>0))reasons.push('Cutting/production quantity recorded');
 if(num(w.done)>0)reasons.push('Work Order Done quantity recorded');
 if(Object.values(w.workflowChecks||{}).some(Boolean))reasons.push('Production-stage completion already ticked');
 if(Object.values(w.workflowStageDates||{}).some(Boolean))reasons.push('Production-stage dates recorded');
 return reasons;
}
async function persistWOChange(index,previous,message){
 try{
  save();
  if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  render();listing();
  alert(message+' Saved on THIS DEVICE. Keep the ERP online until Cloud Sync confirms the update.');
 }catch(error){
  db.workOrders[index]=previous;
  try{save();if(window.axERPStorageBridge)await window.axERPStorageBridge.flush()}catch(ignore){}
  render();listing();
  alert('Work Order change NOT VERIFIED: '+String(error?.message||error)+'. Previous record restored on this device; verify Cloud Sync before retrying.');
 }
}
window.axWODelete=async function(index){
 const w=db.workOrders?.[index];
 if(!w||isDeleted(w))return alert('Work Order unavailable or already deleted.');
 const blockers=woDeletionBlockers(w);
 if(blockers.length)return alert('DELETE BLOCKED: '+w.workNo+' has linked activity. '+blockers.join('; ')+'. No records changed. Correct these entries through the appropriate department; do not delete a started Work Order.');
 if(!confirm('DELETE '+w.workNo+' — '+String(w.party||'')+'?\\nIt will disappear from Active Work Orders, but remain in Deleted Work Orders for Restore and audit. No stock, Sales Order, Invoice or other records will be deleted.'))return;
 const reason=prompt('Reason for deleting '+w.workNo+' (required):','Created by mistake');
 if(reason===null)return;
 if(!String(reason).trim())return alert('Deletion cancelled: reason is required.');
 const prior=JSON.parse(JSON.stringify(w));
 db.workOrders[index]={...w,isDeleted:true,status:'Deleted',deletedAt:new Date().toISOString(),deleteReason:String(reason).trim(),statusBeforeDelete:w.status||'Open'};
 await persistWOChange(index,prior,'✓ '+w.workNo+' moved to Deleted Work Orders. Number reserved.');
};
window.axWORestore=async function(index){
 const w=db.workOrders?.[index];
 if(!w||!isDeleted(w))return alert('Deleted Work Order not found.');
 const dup=(db.workOrders||[]).some((x,i)=>i!==index&&!isDeleted(x)&&String(x.workNo||'').trim().toUpperCase()===String(w.workNo||'').trim().toUpperCase());
 if(dup)return alert('Restore blocked: an active Work Order already uses '+w.workNo+'.');
 if(!confirm('RESTORE '+w.workNo+' into Active Work Orders? No stock or department entries will be created.'))return;
 const previous=JSON.parse(JSON.stringify(w));
 const restored={...w,isDeleted:false,status:w.statusBeforeDelete||'Open',restoredAt:new Date().toISOString()};
 delete restored.deletedAt;delete restored.deleteReason;delete restored.statusBeforeDelete;
 db.workOrders[index]=restored;
 await persistWOChange(index,previous,'✓ '+w.workNo+' restored.');
};
const stages=[['cuttingDone','Cutting Done'],['stitchDone','Stitch Done'],['packingDone','Packing Done'],['deliveryDone','Delivery Done']];
const cutRows=w=>{
 const no=String(w?.workNo||w?.orderNo||'').trim().toUpperCase();
 return no&&Array.isArray(db.cutting)?db.cutting.filter(x=>String(x.workNo||'').trim().toUpperCase()===no):[];
};
const actualCutting=w=>{
 const rows=cutRows(w);
 if(!rows.length)return '<section class="axWOActual"><h4>Actual Cloth / SRL Used</h4><p>No cutting entry recorded for this Work No. Preferred SRL is not actual used SRL.</p></section>';
 const total=rows.reduce((sum,x)=>sum+num(x.qty),0);
 const body=rows.map(x=>'<tr><td>'+E(x.date||'—')+'</td><td>'+E(x.description||'—')+'</td><td>'+E(x.cloth||'Not recorded')+'</td><td>'+E(x.width||'—')+'</td><td><b>'+E(x.srl||'Not recorded')+'</b></td><td>'+num(x.qty)+'</td><td>'+E(x.meter==null?'—':x.meter)+'</td><td>'+E(x.clothSource||'Older entry: verify cloth')+'</td></tr>').join('');
 return '<section class="axWOActual"><h4>Actual Cloth / SRL Used — '+rows.length+' entries, Cut Qty '+total+'</h4><div class="axWOTableWrap"><table class="axWOTable"><thead><tr><th>Cut Date</th><th>Product</th><th>Actual Cloth</th><th>Width</th><th>Actual SRL</th><th>Cut Qty</th><th>Meter</th><th>Cloth Source</th></tr></thead><tbody>'+body+'</tbody></table></div><small>Read from Cutting Register. Old records may contain planned cloth; check actual roll for older entries.</small></section>';
};
const stageBoxes=(index,w)=>{
 const flags=w.workflowChecks||{},dates=w.workflowStageDates||{};
 return '<section class="axWOStages"><h4>Work Order Progress — tick after actual work is done</h4><div class="axWOStageGrid">'+stages.map(([key,title])=>'<label class="axWOStage"><input type="checkbox" '+(flags[key]?'checked ':'')+'onchange="axWOStageChanged('+index+',\''+key+'\',this)"> <span>'+title+'</span>'+(flags[key]&&dates[key]?'<small>'+E(String(dates[key]).slice(0,10))+'</small>':'')+'</label>').join('')+'</div><small>Tick marks record stage completion only; they do not create cutting entries, change stock or dispatch goods.</small></section>';
};
window.axWOStageChanged=(index,key,input)=>{
 if(!stages.some(x=>x[0]===key))return;
 const w=db.workOrders?.[index];if(!w||isDeleted(w)){input.checked=false;return alert('Deleted Work Order cannot record stage progress.')} 
 const checked=!!input.checked,prior={...(w.workflowChecks||{})},dates={...(w.workflowStageDates||{})};
 if(checked&&key==='cuttingDone'){
  const due=items(w).reduce((sum,x)=>sum+pending(x),0);
  if((due>0||!cutRows(w).length)&&!confirm('Cutting register shows '+due+' pending Qty / '+cutRows(w).length+' cutting entries. Mark Cutting Done anyway? This will NOT add cutting or deduct stock.')){
   input.checked=false;return;
  }
 }
 w.workflowChecks={...prior,[key]:checked};
 w.workflowStageDates={...dates,[key]:checked?new Date().toISOString():''};
 try{save()}catch(error){
  w.workflowChecks=prior;w.workflowStageDates=dates;input.checked=!checked;
  alert('Status could not be saved: '+error.message);return;
 }
 const label=input.closest('.axWOStage');
 if(label)label.classList.toggle('isDone',checked);
};

const openSerials=(cloth,width)=>db.store.filter(s=>{const sc=String(s.cloth||s.material||'').trim().toLowerCase(),sw=String(s.width||'').replace(/[^0-9.]/g,'');return num(s.balance||s.closing||s.meter||s.mtr)>0&&(!cloth||sc===cloth.trim().toLowerCase())&&(!width||sw===String(width).replace(/[^0-9.]/g,''))}).map(s=>({serial:s.srl||s.serial||s.serialNo||s.srlNo||'',balance:num(s.balance||s.closing||s.meter||s.mtr)}));
const css=document.createElement('style');css.textContent=`.axWOGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.axWOGrid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700}.axWOGrid input,.axWOGrid select{width:100%;min-width:0}.axWOLine{background:#f8fbfd;border:1px solid #dbe7ed;border-radius:12px;padding:12px;margin:10px 0}.axWOActions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.axWOTable{width:100%;border-collapse:collapse;font-size:12px}.axWOTable th,.axWOTable td{padding:9px;border-bottom:1px solid #dce7ee;text-align:left}.axWOCard{padding:16px;margin:12px 0;border:1px solid #dce7ee;border-radius:13px;background:white}.axWOCard h3{margin:0 0 8px}.axWOPending{color:#a35a05;font-weight:800}.axWOTableWrap{overflow:auto}.axWOSrl{font-size:11px;color:#276d7d;margin-top:4px}@media(max-width:700px){.axWOGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.axWOCard{padding:10px}.axWOTable{min-width:700px}}`;css.textContent+=`.axWOActual,.axWOStages{border:1px solid #d6e6ef;border-radius:12px;background:#f6fafc;padding:12px;margin-top:14px}.axWOActual h4,.axWOStages h4{margin:0 0 10px;color:#164a61}.axWOActual small,.axWOStages small{font-size:11px;color:#526878}.axWOActual .axWOTable{min-width:570px}.axWOStageGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.axWOStage{display:flex;gap:7px;align-items:center;flex-wrap:wrap;background:white;border:1px solid #d2e1e9;border-radius:9px;padding:12px 8px;cursor:pointer;font-size:13px;font-weight:700}.axWOStage input{width:19px;height:19px;accent-color:#116a80;flex-shrink:0}.axWOStage.isDone{border-color:#71b59e;background:#eef8f4}.axWOStage small{width:100%;padding-left:25px}@media(max-width:700px){.axWOStageGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.axWOStage{font-size:12px}.axWOActual{padding:9px}}`;
document.head.appendChild(css);
function line(x={}){
 const box=document.createElement('div');box.className='axWOLine';
 box.innerHTML='<div class="axWOGrid">'+[['description','Product / Description'],['size','Size / Measurement'],['cloth','Cloth'],['width','Actual Width'],['srl','Preferred SRL'],['qty','Order Qty'],['remark','Item Remark']].map(([k,t])=>'<label>'+t+'<input data-k="'+k+'" '+(k==='qty'?'type="number" min="1" step="1" required':'')+' value="'+E(x[k]||'')+'"></label>').join('')+'</div><div class="axWOSrl"></div><button type="button" class="axRemoveLine">Remove Item</button>';
 box.querySelector('.axRemoveLine').onclick=()=>box.remove();
 const refresh=()=>{const c=box.querySelector('[data-k=cloth]').value,w=box.querySelector('[data-k=width]').value,arr=openSerials(c,w);const hint=box.querySelector('.axWOSrl');hint.textContent=arr.length?'Active Store SRL: '+arr.map(a=>a.serial+' ('+a.balance+' m)').join(' • '):'No matching active SRL in Store';const input=box.querySelector('[data-k=srl]');input.setAttribute('list','axSRL'+Array.from(document.querySelectorAll('.axWOLine')).length);let list=box.querySelector('datalist');if(!list){list=document.createElement('datalist');box.appendChild(list)}list.id=input.getAttribute('list');list.innerHTML=arr.map(a=>'<option value="'+E(a.serial)+'"></option>').join('')};
 ['cloth','width'].forEach(k=>box.querySelector('[data-k='+k+']').addEventListener('input',refresh));document.getElementById('axWOLines').appendChild(box);refresh();
}
function editor(index){
 const existing=index==null?null:db.workOrders[index];if(existing&&isDeleted(existing))return alert('This Work Order is deleted. Restore it before editing.');const w=existing||{};
 show(existing?'Edit Work Order':'New Work Order — CFM Layout','<form id="axWOForm"><div class="axWOGrid"><label>Work No<input name="workNo" required '+(existing?'readonly':'')+' value="'+E(w.workNo||nextWO())+'"></label><label>Party<input name="party" required value="'+E(w.party||'')+'"></label><label>PO / Reference<input name="po" value="'+E(w.po||'')+'"></label><label>Date<input name="date" type="date" value="'+E(w.date||new Date().toISOString().slice(0,10))+'"></label><label>Priority<select name="priority"><option '+(w.priority==='Normal'?'selected':'')+'>Normal</option><option '+(w.priority==='Urgent'?'selected':'')+'>Urgent</option></select></label><label>Remarks<input name="remark" value="'+E(w.remark||'')+'"></label></div><h3>Items / Cloth / SRL</h3><div id="axWOLines"></div><div class="axWOActions"><button type="button" id="axWOAdd">+ Add Item</button><button class="primary">Save Work Order</button><button type="button" id="axWOBack">Pending Orders</button></div></form>');
 const existingLines=existing?items(existing):[{}];existingLines.forEach(line);
 if(existing){
  const form=document.getElementById('axWOForm');
  const actions=form.querySelector('.axWOActions');
  if(actions)actions.insertAdjacentHTML('beforebegin',actualCutting(existing)+stageBoxes(index,existing));
 }
 document.getElementById('axWOAdd').onclick=()=>line();document.getElementById('axWOBack').onclick=listing;
 document.getElementById('axWOForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;const d=Object.fromEntries(new FormData(form));const rows=[...form.querySelectorAll('.axWOLine')].map((el,i)=>{const obj={};el.querySelectorAll('[data-k]').forEach(input=>obj[input.dataset.k]=input.value.trim());obj.qty=num(obj.qty);obj.cutQty=existing?num(existingLines[i]?.cutQty):0;return obj}).filter(x=>x.description&&x.qty>0);
 if(!rows.length)return alert('At least one product and quantity required');
 if(rows.some(x=>x.cutQty>x.qty))return alert('Order Qty cannot be less than already cut quantity');
 if(!existing&&db.workOrders.some(x=>x.workNo===d.workNo))return alert('Work No already exists');
 const record={...w,...d,items:rows,qty:rows.reduce((a,x)=>a+x.qty,0),done:rows.reduce((a,x)=>a+x.cutQty,0),description:rows.map(x=>x.description).join(', '),status:rows.every(x=>pending(x)===0)?'Cut Complete':'Open'};
 if(existing)db.workOrders[index]=record;else db.workOrders.push(record);save();render();listing();
 };
}
function listing(){
 const allEntries=db.workOrders.map((w,i)=>({w,i})),entries=allEntries.filter(({w})=>!isDeleted(w));const total=entries.reduce((n,{w})=>n+items(w).reduce((a,x)=>a+pending(x),0),0);
 show('Work Orders • Actual Cloth / SRL • Progress','<div class="axWOActions"><button class="primary" id="axNewWO">+ New Work Order</button><button id="axPrintPending">Print Pending Only</button><button id="axShowAll">Show Pending Cutting Only</button><button id="axWOShowDeleted">Deleted Work Orders / Restore</button></div><p><b>'+entries.length+'</b> Work Orders • <b class="axWOPending">'+total+'</b> Pending Qty</p><label style="display:block;margin:10px 0 14px">Search Work No., Party, Cloth or SRL<input id="axWOFind" type="search" placeholder="e.g. AFX-WO-0001 / E-251" style="width:100%;margin-top:6px"></label><div id="axWOResults"></div>');
 document.getElementById('axNewWO').onclick=()=>editor();let all=true,shown=30;document.getElementById('axShowAll').onclick=()=>{all=!all;shown=30;document.getElementById('axShowAll').textContent=all?'Show Pending Cutting Only':'Show All Work Orders';draw()};document.getElementById('axPrintPending').onclick=printPending;document.getElementById('axWOFind').oninput=()=>{shown=30;draw()};document.getElementById('axWOShowDeleted').onclick=()=>{
 const deleted=allEntries.filter(({w})=>isDeleted(w));
 show('Deleted Work Orders — Restore / Audit','<p>These Work Orders were manually removed from active production. They are retained for audit and can be restored. No stock or connected records were erased.</p><button type="button" id="axWOActiveBack">Back to Active Work Orders</button><div id="axWODeletedRows">'+
 (deleted.map(({w,i})=>'<section class="axWOCard"><strong>'+E(w.workNo)+' — '+E(w.party)+'</strong><p>Deleted: '+E(w.deletedAt||'—')+'<br>Reason: '+E(w.deleteReason||'—')+'</p><button type="button" onclick="axWORestore('+i+')">Restore Work Order</button></section>').join('')||'<p>No deleted Work Orders.</p>')+'</div>');
 document.getElementById('axWOActiveBack').onclick=listing;
};
 function draw(){
 const q=String(document.getElementById('axWOFind')?.value||'').trim().toLowerCase();
 const filtered=entries.filter(({w})=>(all||items(w).some(x=>pending(x)>0))&&
 (!q||[w.workNo,w.orderNo,w.party,w.description,...items(w).flatMap(x=>[x.description,x.productCode,x.cloth,x.srl,x.size]),...cutRows(w).flatMap(x=>[x.srl,x.cloth])].join(' ').toLowerCase().includes(q)));
 document.getElementById('axWOResults').innerHTML=filtered.slice(0,shown).map(({w,i})=>'<section class="axWOCard"><h3>'+E(w.workNo||w.orderNo||'#'+(i+1))+' — '+E(w.party)+'</h3><div class="axWOActions"><button onclick="axWOEdit('+i+')">Edit</button><button type="button" style="color:#ad2637" onclick="axWODelete('+i+')">Delete</button><span>'+E(w.priority||'Normal')+'</span></div><div class="axWOTableWrap"><table class="axWOTable"><thead><tr><th>Product / Size</th><th>Cloth</th><th>Width</th><th>SRL</th><th>Order</th><th>Cut</th><th>Pending</th><th>Action</th></tr></thead><tbody>'+items(w).map((x,j)=>'<tr><td>'+E(window.axAFXCodeMaster?.resolve?.(x)?.code||x.productCode||'')+'<br>'+E(x.description)+'<br><small>'+E(x.size)+'</small></td><td>'+E(x.cloth)+'</td><td>'+E(x.width)+'</td><td>'+E(x.srl)+'</td><td>'+num(x.qty)+'</td><td>'+num(x.cutQty)+'</td><td class="axWOPending">'+pending(x)+'</td><td>'+(pending(x)?'<button onclick="axWOCut('+i+','+j+')">Cut Entry</button>':'Done')+'</td></tr>').join('')+'</tbody></table></div>'+actualCutting(w)+stageBoxes(i,w)+'</section>').join('')||'<p>No work orders matching this filter.</p>';
 if(filtered.length>shown){
  const result=document.getElementById('axWOResults');
  result.insertAdjacentHTML('beforeend','<button type="button" id="axWOMore">Show Next 30 Work Orders ('+(filtered.length-shown)+' more)</button>');
  document.getElementById('axWOMore').onclick=()=>{shown+=30;draw()};
 }
}
 draw();
}
window.axWOOverview=listing;
window.axWOEdit=editor;
window.axWOCut=(i,j)=>{const w=db.workOrders[i];if(!w||isDeleted(w))return alert('Cannot cut a deleted Work Order. Restore first.');const x=items(w)[j];if(!x)return;const left=pending(x);if(!left)return alert('Cutting complete');
 const q=prompt('Cut Qty (Pending '+left+')',String(left));if(q===null)return;const qty=Number(q);if(!Number.isInteger(qty)||qty<1||qty>left)return alert('Invalid cutting quantity');
 const serials=openSerials(x.cloth,x.width);const srl=prompt('Actual SRL'+(serials.length?' — Active: '+serials.map(a=>a.serial).join(', '):''),x.srl||'');if(srl===null)return;
 if(!String(srl).trim())return alert('Enter actual SRL for traceability.');
 const matching=(Array.isArray(db.store)?db.store:[]).filter(row=>
  String(row.srl||row.serial||row.serialNo||row.srlNo||'').trim().toUpperCase()===String(srl).trim().toUpperCase());
 let actualCloth=String(x.cloth||''),actualWidth=String(x.width||''),clothSource='Confirmed when Cutting';
 const roll=matching.length===1?matching[0]:null;
 if(roll&&String(roll.cloth||roll.material||'').trim()){
  actualCloth=String(roll.cloth||roll.material).trim();
  actualWidth=String(roll.width||actualWidth);
  clothSource='Store SRL master';
  if(String(x.cloth||'').trim()&&String(x.cloth).trim().toLowerCase()!==actualCloth.toLowerCase()&&!confirm(
   'Actual SRL '+srl+' has Cloth '+actualCloth+' in Store, but Work Order planned '+x.cloth+'. Use Store Cloth for cutting?'
  ))return;
 }else{
  const entered=prompt('Actual Cloth used from SRL '+srl+' (verify)',actualCloth);
  if(entered===null)return;
  if(!String(entered).trim())return alert('Enter actual Cloth for this SRL.');
  actualCloth=String(entered).trim();
 }
 const met=prompt('Meter consumed','0');if(met===null)return;const meter=Number(met);if(!Number.isFinite(meter)||meter<0)return alert('Invalid meter');
 if(!Array.isArray(w.items))w.items=items(w);w.items[j].cutQty=num(w.items[j].cutQty)+qty;w.done=w.items.reduce((n,a)=>n+num(a.cutQty),0);w.status=w.items.every(a=>pending(a)===0)?'Cut Complete':'Open';
 db.cutting.push({workNo:w.workNo,productCode:window.axAFXCodeMaster?.resolve?.(x)?.code||x.productCode||'',itemNo:x.itemNo||window.axAFXCodeMaster?.resolve?.(x)?.itemNo||'',description:x.description,size:x.size,cloth:actualCloth,width:actualWidth,srl:String(srl).trim(),qty,meter,date:new Date().toISOString().slice(0,10),clothSource});
 save();render();listing();
};
function printPending(){const rows=db.workOrders.filter(w=>!isDeleted(w)).flatMap(w=>items(w).filter(x=>pending(x)>0).map(x=>'<tr><td>'+E(w.workNo)+'</td><td>'+E(w.party)+'</td><td>'+E(window.axAFXCodeMaster?.resolve?.(x)?.code||x.productCode||'')+'<br>'+E(x.description)+'</td><td>'+E(x.size)+'</td><td>'+E(x.cloth)+'</td><td>'+E(x.width)+'</td><td>'+num(x.qty)+'</td><td>'+num(x.cutQty)+'</td><td>'+pending(x)+'</td><td></td></tr>')).join('');if(!rows)return alert('No pending items');const win=window.open('','_blank');if(!win)return alert('Allow popups');win.document.write('<!doctype html><html><head><title>Pending Cutting</title><style>@page{size:A4 landscape;margin:10mm}body{font:12px Arial}table{width:100%;border-collapse:collapse}td,th{border:1px solid #777;padding:7px;text-align:left}</style></head><body><h2>AEROVEX FILTRATION — DAILY PENDING CUTTING</h2><table><tr><th>Work No</th><th>Party</th><th>Product</th><th>Size</th><th>Cloth</th><th>Width</th><th>Order</th><th>Cut</th><th>Pending</th><th>Actual SRL</th></tr>'+rows+'</table></body></html>');win.document.close();win.print()}
const old=openModule;openModule=function(name){if(name==='New Work Order')return editor();if(name==='Work Orders'||name==='Pending Orders')return listing();return old(name)};
})();