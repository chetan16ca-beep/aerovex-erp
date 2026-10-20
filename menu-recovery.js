/* Aerovex menu navigation recovery.
   Handles menu clicks before older duplicated listeners, never touches ERP data. */
(function(){
'use strict';
const routing={
 'Work Orders':()=>(typeof window.axWOOverview==='function'?window.axWOOverview():window.openModule('Work Orders')),
 'New Work Order':()=>(typeof window.axWOEdit==='function'?window.axWOEdit():window.openModule('New Work Order')),
 'Pending Orders':()=>(typeof window.axWOOverview==='function'?window.axWOOverview():window.openModule('Pending Orders')),
 'Sales Billing Flow':()=>(typeof window.axOpenSalesBilling==='function'?window.axOpenSalesBilling():window.openModule('Sales Billing Flow')),
 'Sales Order to Work Orders':()=>(typeof window.axSOCreateWorkOrders==='function'?window.axSOCreateWorkOrders():window.openModule('Sales Order to Work Orders')),
 'Bank & Terms Settings':()=>(typeof window.axBankTermsSettings==='function'?window.axBankTermsSettings():window.openModule('Bank & Terms Settings')),
 'Quotation':()=>(typeof window.axCorporateQuotation==='function'?window.axCorporateQuotation():window.openModule('Quotation')),
 'New Quotation':()=>(typeof window.axCorporateQuotation==='function'?window.axCorporateQuotation():window.openModule('New Quotation')),
 'Sales Order / PO':()=>(typeof window.axDetailedDocument==='function'?window.axDetailedDocument('Sales Order / PO'):window.openModule('Sales Order / PO')),
 'Delivery Challan':()=>(typeof window.axDetailedDocument==='function'?window.axDetailedDocument('Delivery Challan'):window.openModule('Delivery Challan')),
 'Sales Invoice':()=>(typeof window.axDetailedDocument==='function'?window.axDetailedDocument('Sales Invoice'):window.openModule('Sales Invoice')),
 'Purchase Order':()=>(typeof window.axDetailedDocument==='function'?window.axDetailedDocument('Purchase Order'):window.openModule('Purchase Order')),
 'Purchase':()=>(typeof window.axDetailedDocument==='function'?window.axDetailedDocument('Purchase'):window.openModule('Purchase')),
 'Reports':()=>(typeof window.axPlantReports==='function'?window.axPlantReports():window.openModule('Reports')),
 'Plant Head Work List':()=>(typeof window.axPlantReports==='function'?window.axPlantReports():window.openModule('Plant Head Work List'))
};
const extra={};
function displayError(message){
 const text='ERP menu could not open: '+message+'\nExisting data has NOT been changed.';
 console.error(text);
 let node=document.getElementById('axMenuError');
 if(!node){
  node=document.createElement('div');node.id='axMenuError';node.setAttribute('role','alert');
  node.style.cssText='position:fixed;inset:auto 12px 74px;z-index:100010;background:#fff1e8;border:2px solid #b42318;color:#742014;border-radius:12px;padding:14px;font:13px Arial,sans-serif;box-shadow:0 5px 24px #0003;max-height:50vh;overflow:auto;overflow-wrap:anywhere';
  document.body.appendChild(node);
 }
 node.textContent=text;
}
window.axMenuRecoveryOpen=function(name){
 try{
  document.getElementById('axMenuError')?.remove();
  const fn=routing[name];
  if(fn){fn();return}
  if(typeof window.openModule!=='function')throw Error('ERP startup has not loaded (openModule missing)');
  window.openModule(name);
 }catch(error){
  displayError(name+': '+String(error?.message||error).slice(0,230));
 }
};
function resolve(event){
 let origin=event.target;
 if(!origin||typeof origin.closest!=='function')origin=origin?.parentElement;
 if(!origin||typeof origin.closest!=='function')return null;
 if(origin.closest('#axAuthGate'))return null;
 const tile=origin.closest('#production .tile,#accounts .tile,#masters .tile,#modal .tile');
 if(tile)return tile.querySelector('b')?.textContent?.trim()||null;
 const menu=origin.closest('#menu');
 if(menu){
  if(typeof menu.onclick==='function'){
   return {special:'main',action:()=>menu.onclick()};
  }
  return null;
 }
 const hero=origin.closest('.axHeroActions button');
 if(hero){const title=String(hero.textContent||'').replace(/^\+\s*/, '').trim();return title==='Pending Orders'||title==='New Work Order'||title==='New Quotation'?title:null;}
 const button=origin.closest('button[onclick], .axCFMNav button[onclick],#quick button[onclick]');
 if(!button)return null;
 const attr=button.getAttribute('onclick')||'';
 const match=attr.match(/\bopenModule\(\s*(['"])(.*?)\1\s*\)/);
 return match?match[2]:null;
}
document.addEventListener('click',function(event){
 if(document.body?.classList?.contains('axAuthLocked'))return;
 const name=resolve(event);
 if(!name)return;
 // Stop other competing delegated handlers from invoking openModule twice.
 event.preventDefault();
 event.stopImmediatePropagation();
 if(typeof name==='object'){try{name.action()}catch(error){displayError('Main Menu: '+String(error?.message||error))}}
 else window.axMenuRecoveryOpen(name);
},true);
})();
