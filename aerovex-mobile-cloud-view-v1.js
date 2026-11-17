/* Aerovex mobile Cloud Viewer — read-only operating mode.
 * For mobile UI only. Reads authenticated owner snapshot; never writes to
 * ERP localStorage, cloud or CFM. PC retains full ERP workflow.
 * Same owner token remains capable of edits outside this UI: permissions
 * must be separated at Supabase RLS for enforcement against dev tools.
 */
(function(){
'use strict';
if(!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))return;
const ROOT='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
const APIKEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
const OWNER='aerovexfiltration@gmail.com';
const STORE='ax-erp-owner-session-v1';
const DATA='aerovex-erp-data-v1';
const CATEGORIES=[
 ['salesOrders','Sales Orders'],
 ['invoices','Sales Invoices'],
 ['challans','Delivery Challans'],
 ['quotations','Quotations'],
 ['purchaseOrders','Purchase Orders'],
 ['purchases','Purchases'],
 ['parties','Customers'],
 ['products','Products']
];
const clean=x=>String(x??'').trim();
const docNo=(x,k)=>clean(x.documentNo||x.invoiceNo||x.quotationNo||x.poNo||x.orderNo||x.no||x.name||x.party||x.code||'');
let snap=null,category='salesOrders',root=null,summary=null,records=null,details=null,loadBusy=false;
function el(tag,cls,txt){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(txt!==undefined)e.textContent=txt;
 return e;
}
function p(text){return el('p','axMROText',text)}
function notice(message,kind='info'){if(summary){summary.textContent=message;summary.dataset.kind=kind}}
function backup(){
 try{
  const raw=localStorage.getItem(DATA);
  if(!raw){notice('This phone has no local ERP data to export. Cloud records remain separate.','warn');return}
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const a=el('a');a.href=url;a.download='Aerovex-PHONE-BACKUP-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  notice('Phone backup download requested. Confirm it exists in Downloads. No records were deleted.','ok');
 }catch(e){notice('Phone backup failed: '+clean(e?.message||e)+'. Do not clear app data.','warn')}
}
async function getSnapshot(){
 let session;
 try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch(e){}
 if(!session?.access_token)throw Error('Owner login is required. Reload and sign in.');
 const headers={apikey:APIKEY,Authorization:'Bearer '+session.access_token,Accept:'application/json'};
 const u=await fetch(ROOT+'/auth/v1/user',{headers,cache:'no-store'});
 if(!u.ok)throw Error('Owner session expired. Reload and sign in again.');
 const user=await u.json();
 if(clean(user?.email).toLowerCase()!==OWNER||!user?.id)throw Error('Incorrect Aerovex owner account.');
 const path='/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1';
 const r=await fetch(ROOT+path,{headers,cache:'no-store'});
 if(!r.ok)throw Error('Cloud read failed (HTTP '+r.status+'). No data changed.');
 const rows=await r.json();
 if(!Array.isArray(rows)||!rows.length||!rows[0]?.payload)throw Error('No Aerovex Cloud data found. Do NOT initialize or restore.');
 return rows[0];
}
function field(parent,label,value){
 if(!clean(value))return;
 const line=el('div','axMROField');line.append(el('strong','',label+': '),el('span','',clean(value)));parent.appendChild(line);
}
function showDetail(item,k){
 details.replaceChildren();
 const box=el('section','axMRODetail');
 box.append(el('h3','',docNo(item,k)||'Saved Record'));
 field(box,'Date',item.date);field(box,'Party',item.party||item.name);
 field(box,'GSTIN',item.gstin||item.billToGstin);
 field(box,'Bill To',item.billToName);
 field(box,'Billing Address',item.billToAddress||item.billingAddress||item.address);
 field(box,'Ship To',item.shipToName);
 field(box,'Delivery Address',item.shipToAddress||item.shippingAddress);
 field(box,'Reference',item.ref||item.poRef);
 const hideCommercial=k==='salesOrders'||k==='challans';
 const lines=Array.isArray(item.items)?item.items:[];
 if(lines.length){
  const heading=el('h4','','Items ('+lines.length+')');
  box.appendChild(heading);
  lines.forEach((x,i)=>{
   const line=el('div','axMROItem');
   line.append(el('strong','',(i+1)+'. '+clean(x.description||x.name||'Product')));
   field(line,'Size',x.size);field(line,'MOC',x.moc);field(line,'HSN',x.hsn);
   field(line,'Quantity',x.qty);field(line,'Unit',x.unit);
   if(!hideCommercial){field(line,'Rate',x.rate);field(line,'Discount',x.discount)}
   box.append(line);
  });
 }
 if(!hideCommercial){
  field(box,'Taxable',item.taxable);
  field(box,'GST',item.gst);
  field(box,'Total',item.total??item.amount);
 }
 box.appendChild(p('Cloud data — View Only. This screen does not edit or save anything.'));
 const back=el('button','axMROBtn','Back to List');back.type='button';back.onclick=()=>details.replaceChildren();
 box.append(back);details.append(box);
 details.scrollIntoView({behavior:'smooth',block:'start'});
}
function render(){
 if(!snap||!records)return;
 records.replaceChildren();details.replaceChildren();
 const items=Array.isArray(snap.payload?.[category])?snap.payload[category]:[];
 const label=CATEGORIES.find(x=>x[0]===category)?.[1]||category;
 records.append(el('h3','',label+' ('+items.length+')'));
 if(!items.length){records.append(p('No records saved in this Cloud category.'));return}
 const list=el('div','axMROList');
 [...items].reverse().forEach(item=>{
  const row=el('button','axMRORow');row.type='button';
  const title=docNo(item,category)||'Saved '+label;
  row.append(el('strong','',title));
  const subtitle=[item.party&&item.party!==title?item.party:'',item.date,Array.isArray(item.items)?item.items.length+' item(s)':''].filter(Boolean).join(' • ');
  if(subtitle)row.append(el('small','',subtitle));
  row.onclick=()=>showDetail(item,category);
  list.append(row);
 });
 records.append(list);
}
async function load(){
 if(loadBusy)return;loadBusy=true;
 notice('Reading saved Aerovex data from Cloud. No edits will be made…');
 try{
  snap=await getSnapshot();
  const counts=CATEGORIES.map(([key,label])=>label+': '+(Array.isArray(snap.payload[key])?snap.payload[key].length:0));
  notice('✓ Cloud Connected — View Only. Last Cloud update: '+clean(snap.updated_at)+'. '+counts.slice(0,3).join(' | '),'ok');
  render();
 }catch(e){
  notice('⚠ '+clean(e?.message||e)+'. Existing phone and Cloud data are untouched.','warn');
 }finally{loadBusy=false}
}
function show(){
 if(root){root.style.display='block';return}
 const css=el('style');css.id='axMobileReadOnlyCSS';css.textContent=
 '#axMobileReadonly{position:fixed;inset:0;z-index:2147483000;'+
 'background:#f4f8fa;color:#173d50;overflow:auto;font:14px/1.5 Arial,sans-serif;padding:0 0 28px}'+
 '#axMobileReadonly *{box-sizing:border-box}'+
 '#axMROTop{background:#0b4961;color:#fff;padding:16px;position:sticky;top:0;z-index:3}'+
 '#axMROTop strong{display:block;font-size:20px}#axMROTop small{color:#dcebf3}'+
 '#axMROPanel{padding:14px;max-width:760px;margin:auto}'+
 '#axMROControls{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}'+
 '.axMROBtn{padding:11px 12px;min-height:44px;border:1px solid #98b6c5;border-radius:8px;'+
 'background:white;color:#134a63;font-weight:700}'+
 '#axMROTabs{display:flex;overflow-x:auto;gap:8px;padding:7px 0}'+
 '#axMROTabs button{flex-shrink:0;padding:10px;border:1px solid #b4ceda;'+
 'background:#e8f2f6;color:#174b63;border-radius:9px;font-weight:650}'+
 '#axMROTabs button[aria-selected=true]{background:#0b6074;color:white}'+
 '#axMROStatus{padding:12px;border:1px solid #cadbe4;border-radius:9px;background:#eef6fa}'+
 '#axMROStatus[data-kind=warn]{color:#a03522;background:#fff5eb}'+
 '#axMROStatus[data-kind=ok]{color:#1c6148;background:#eff9f3}'+
 '.axMRORow{width:100%;display:block;text-align:left;border:1px solid #d0e1e9;border-radius:9px;'+
 'background:#fff;padding:12px;margin:7px 0;color:#163d53}'+
 '.axMRORow strong,.axMRORow small{display:block}.axMRORow small{color:#567483;margin-top:4px}'+
 '.axMRODetail{background:white;border:1px solid #b1cddc;border-radius:11px;'+
 'padding:15px;margin-top:16px;white-space:pre-wrap;overflow-wrap:anywhere}'+
 '.axMROField{padding:5px 0;border-bottom:1px solid #e5eff3}'+
 '.axMROItem{padding:12px;margin:9px 0;background:#f2f7f9;border-radius:8px}'+
 '@media print{#axMobileReadonly{display:none!important}}';
 document.head.appendChild(css);
 root=el('section');root.id='axMobileReadonly';root.setAttribute('role','main');
 const head=el('header');head.id='axMROTop';
 head.append(el('strong','','AEROVEX FILTRATION'),el('small','','Mobile Cloud Viewer • READ ONLY'));
 const content=el('div');content.id='axMROPanel';
 summary=el('div');summary.id='axMROStatus';summary.setAttribute('role','status');
 const controls=el('div');controls.id='axMROControls';
 const refresh=el('button','axMROBtn','↻ Refresh Cloud Data');refresh.type='button';refresh.onclick=load;
 const exportBtn=el('button','axMROBtn','↓ Download Phone Backup');exportBtn.type='button';exportBtn.onclick=backup;
 controls.append(refresh,exportBtn);
 const tabs=el('nav');tabs.id='axMROTabs';
 CATEGORIES.forEach(([id,title])=>{
  const b=el('button','',title);b.type='button';b.setAttribute('aria-selected',id===category?'true':'false');
  b.onclick=()=>{category=id;for(const t of tabs.children)t.setAttribute('aria-selected',t===b?'true':'false');render()};
  tabs.append(b);
 });
 records=el('section');details=el('section');
 content.append(summary,controls,p('PC is the main working device. Mobile can only view Cloud records in this interface. Local phone records are not modified.'),tabs,records,details);
 root.append(head,content);document.body.append(root);
 notice('Mobile is in view-only mode. Please sign in as Aerovex owner.');
 load();
}
function init(){
 // Do not silently hide a pre-login screen or overwrite phone data.
 window.addEventListener('ax-aerovex-owner-ready',show);
 try{
  const s=JSON.parse(sessionStorage.getItem(STORE)||'null');
  if(s?.access_token&&!document.body.classList.contains('axAuthLocked'))show();
 }catch(_){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
