/* Aerovex mobile-safe Print / Save PDF. Read-only; never touches ERP records.
   A4 native browser Save as PDF, mobile inline print to avoid blocked popups. */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let onPrint=false,inlineRoot=null,oldTitle='';
 function clearInline(){
  if(!onPrint)return;
  onPrint=false;
  if(inlineRoot){inlineRoot.remove();inlineRoot=null}
  const style=document.getElementById('axSafeInlinePrintCSS');if(style)style.remove();
  if(oldTitle)document.title=oldTitle;
 }
 function inline(html,title,landscape){
  clearInline();
  const style=document.createElement('style');
  style.id='axSafeInlinePrintCSS';
  style.textContent='@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:11mm}'+
    '@media print{body > :not(#axSafeInlinePrintRoot){display:none!important}'+
    '#axSafeInlinePrintRoot{display:block!important;position:static!important;'+
    'width:100%!important;margin:0!important;padding:0!important;'+
    'background:white!important;color:#172b3a!important}'+
    '#axSafeInlinePrintRoot .axSAPDocument,#axSafeInlinePrintRoot .axSapRegister{'+
    'width:100%!important;max-width:none!important;min-width:0!important;'+
    'margin:0!important;padding:0!important;box-shadow:none!important}'+
    '#axSafeInlinePrintRoot .axSAPTableScroll{overflow:visible!important}'+
    'body{background:white!important;margin:0!important;padding:0!important}}'+
    '@media screen{#axSafeInlinePrintRoot{position:fixed!important;left:-20000px!important;top:0!important;'+
    'width:794px!important;visibility:hidden!important;pointer-events:none!important}}';
  document.head.appendChild(style);
  const root=document.createElement('div');
  root.id='axSafeInlinePrintRoot';
  root.innerHTML=html;
  document.body.appendChild(root);
  inlineRoot=root;
  oldTitle=document.title;document.title=title;
  onPrint=true;
  const finished=()=>{window.removeEventListener('afterprint',finished);setTimeout(clearInline,400)};
  window.addEventListener('afterprint',finished,{once:true});
  try{window.print()}catch(e){finished();alert('Print could not open. Try Chrome menu > Share > Print.')}
  // Some Android browsers do not emit afterprint: leave hidden root in place
  // until next attempt/reload rather than destroying it before the dialog.
  return true;
 }
 function popup(html,title,cssUrl,landscape){
  const w=window.open('','_blank');
  if(!w)return inline(html,title,landscape);
  const doc='<!doctype html><html><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width, initial-scale=1">'+
   '<title>'+esc(title)+'</title>'+
   '<link rel="stylesheet" href="'+esc(cssUrl)+'">'+
   '<style>@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:11mm}'+
   'body{background:#fff!important;color:#17344a;font-family:Arial,sans-serif}'+
   '.axPDFToolbar{position:sticky;top:0;z-index:100;padding:12px;'+
   'background:#e9f4fa;border-bottom:2px solid #237fa5;display:flex;'+
   'align-items:center;gap:12px;flex-wrap:wrap}'+
   '.axPDFToolbar button{background:#0b4961;color:white;border:0;'+
   'border-radius:8px;padding:13px 16px;font-size:15px;font-weight:700}'+
   '.axPDFToolbar small{color:#285e76}'+
   '@media print{.axPDFToolbar{display:none!important}body{margin:0!important;padding:0!important}}'+
   '</style></head><body><div class="axPDFToolbar">'+
   '<button type="button" id="axPDFPrint" onclick="window.print()">Print / Save as PDF</button>'+
   '<small>Android: tap Print / Save as PDF, then select Save as PDF as printer.</small>'+
   '</div>'+html+
   '<script>(function(){'+
   'var mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);'+
   'if(!mobile){window.addEventListener("load",function(){'+
   'setTimeout(function(){try{window.focus();window.print()}catch(e){}},650)},{once:true})}'+
   '})();<\/script></body></html>';
  try{
   w.document.open();w.document.write(doc);w.document.close();
   w.focus();
  }catch(e){
   try{w.close()}catch(ignore){}
   return inline(html,title,landscape);
  }
  return true;
 }
 window.axPrintSafe=function({html,title='Aerovex Document',cssUrl='',landscape=false,forceInline=false}={}){
  if(!html||typeof html!=='string')return false;
  // On mobile this direct gesture-bound print call avoids unreliable popups.
  if(forceInline||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))
    return inline(html,title,landscape);
  return popup(html,title,cssUrl,landscape);
 };
 window.axPrintSafeInline=inline;
})();
