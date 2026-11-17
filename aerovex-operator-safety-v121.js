/* Aerovex V121 safety center. Read-only health checks and device-only UI options.
 * Never alters invoices, GST, Work Orders, customer masters or Cloud payload.
 */
(function(){
'use strict';
const KEY='aerovex-operator-ui-preferences-v1',errors=[];
const E=(tag,label)=>{const el=document.createElement(tag);if(label!==undefined)el.textContent=label;return el};
window.addEventListener('error',e=>{errors.push(String(e.message||'Runtime error').slice(0,120));if(errors.length>8)errors.shift()});
window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason||'Operation failed').slice(0,120));if(errors.length>8)errors.shift()});
function preferences(){
 try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');return {compact:p.compact!==false,reducedMotion:p.reducedMotion===true}}catch(e){return {compact:true,reducedMotion:false}}
}
function apply(p){
 document.body.classList.toggle('ax-operator-compact',p.compact);
 document.body.classList.toggle('ax-operator-reduced-motion',p.reducedMotion);
}
function audit(){
 try{
  const data=(typeof db!=='undefined'&&db&&typeof db==='object')?db:null;
  const bridge=window.axERPStorageBridge?.status?.();
  const count=key=>data&&Array.isArray(data[key])?data[key].length:'Not loaded';
  return 'ERP records (this device):\nWork Orders '+count('workOrders')+
   ' · Invoices '+count('invoices')+' · Challans '+count('challans')+
   '\nQuotations '+count('quotations')+' · Sales Orders '+count('salesOrders')+
   '\nPurchase entries '+count('purchases')+
   '\nIndexedDB bridge: '+(bridge?.ready?'Ready':bridge?.error?'Attention required':'Not verified')+
   (bridge?.error?'\nStorage warning: '+String(bridge.error).slice(0,140):'')+
   '\nCloud pairing: verify in existing Cloud Sync panel (never auto-overwrite).'+
   '\nRuntime warnings since page load: '+errors.length+
   (errors.length?'\nLatest: '+errors.at(-1):'')+
   '\nRead-only. No business records were changed.';
 }catch(e){return 'ERP system check unavailable: '+String(e.message||e)}
}
function mount(){
 if(document.getElementById('axOperatorSafety121'))return;
 const css=E('style');
 css.textContent="body.ax-operator-reduced-motion *,body.ax-operator-reduced-motion *::before,body.ax-operator-reduced-motion *::after{animation-duration:.001ms!important;transition-duration:.001ms!important}"+
 "body.ax-operator-compact main .panel,body.ax-operator-compact main .card{padding:10px!important}"+
 "body.ax-operator-compact main .tile{padding:9px!important;min-height:0!important}"+
 "#axOperatorSafety121{border:0;border-radius:13px;box-shadow:0 18px 50px #0004;padding:0;width:min(450px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto}"+
 "#axOperatorSafety121::backdrop{background:#092e49a9}"+
 "#axOperatorSafety121 header{display:flex;align-items:center;justify-content:space-between;padding:12px;background:linear-gradient(100deg,#073b5c,#0b7b8c);color:#fff;font:800 15px system-ui}"+
 "#axOperatorSafety121 .ax-inner{padding:13px;font:12px/1.5 system-ui;color:#224358}"+
 "#axOperatorSafety121 .ax-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:10px 0}"+
 "#axOperatorSafety121 .ax-row label{display:flex;gap:6px;align-items:center;font-weight:700}"+
 "#axOperatorSafety121 input[type=checkbox]{width:17px;height:17px}"+
 "#axOperatorSafety121 button{min-height:38px;border:1px solid #bcd4e2;border-radius:8px;background:#edf6fb;color:#154768;padding:7px 10px;font:700 12px system-ui;cursor:pointer}"+
 "#axOperatorSafety121 pre{font:12px/1.5 system-ui;background:#f6faff;padding:10px;border:1px solid #cce0eb;border-radius:9px;white-space:pre-wrap;overflow-wrap:anywhere}"+
 "#axOperatorSafety121 .ax-muted{font-size:11px;color:#526e80}";
 document.head.append(css);
 const modal=E('dialog');modal.id='axOperatorSafety121';
 const header=E('header');
 header.append(E('span','🛡 Aerovex ERP • Safety & Settings'));
 const close=E('button','✕');close.type='button';close.setAttribute('aria-label','Close ERP safety center');close.addEventListener('click',()=>modal.close());header.append(close);
 const inner=E('div');inner.className='ax-inner';
 const intro=E('p','Screen settings apply only to this device; company, GST, rates, masters and document numbers remain unchanged.');intro.className='ax-muted';
 const prefs=preferences();
 const row=E('div');row.className='ax-row';
 const note=E('span');note.className='ax-muted';
 for(const [label,key] of [['Compact spacing','compact'],['Reduce animations','reducedMotion']]){
  const input=E('input');input.type='checkbox';input.checked=prefs[key];
  const labelNode=E('label');labelNode.append(input,E('span',label));
  input.addEventListener('change',()=>{prefs[key]=input.checked;apply(prefs);try{localStorage.setItem(KEY,JSON.stringify(prefs));note.textContent='Saved on this device'}catch(e){note.textContent='Storage unavailable. Preference temporary.'}});
  row.append(labelNode);
 }
 const buttons=E('div');buttons.className='ax-row';
 const output=E('pre','Tap Check System for a current, read-only report.');output.setAttribute('role','status');
 const cmds=[
  ['Check System',()=>{output.textContent=audit()}],
  ['ERP Diagnostics',()=>{modal.close();if(typeof window.axERPHealth==='function')window.axERPHealth();else alert('ERP Diagnostics not loaded')}],
  ['Backup / Repair',()=>{modal.close();if(typeof window.axERPStorageRepair==='function')window.axERPStorageRepair();else alert('Open existing Backup menu')}]
 ];
 for(const [label,fn] of cmds){const btn=E('button',label);btn.type='button';btn.addEventListener('click',fn);buttons.append(btn)}
 inner.append(intro,row,note,buttons,output);modal.append(header,inner);document.body.append(modal);
 const opener=E('button','🛡 Safety & Settings');opener.id='axOperatorSafetyButton121';opener.type='button';
 opener.style.cssText='margin:5px;padding:8px 10px;border:1px solid #b4d2dd;border-radius:9px;background:#eaf6fa;color:#15506b;font:800 12px system-ui';
 opener.addEventListener('click',()=>{output.textContent=audit();modal.showModal()});
 const hero=document.querySelector('.hero');
 if(hero)hero.append(opener);else document.body.prepend(opener);
 apply(prefs);
}
window.axOperatorSafetyCheck=audit;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();