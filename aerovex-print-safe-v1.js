/* Aerovex print / Save as PDF v2.
 * Mobile: VISIBLE A4 document preview first, explicit second-tap Print.
 * No hidden/offscreen print container or immediate Android window.print().
 * Read-only; never writes, deletes or changes ERP records or localStorage.
 */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,previousTitle=null,previousOverflow=null;
function close(){
 if(!current)return;
 current.remove();current=null;
 document.getElementById('axSafePrintStyle')?.remove();
 if(previousTitle!==null)document.title=previousTitle;
 if(previousOverflow!==null)document.body.style.overflow=previousOverflow;
 previousTitle=null;previousOverflow=null;
}
function preview(html,title,landscape){
 close();
 if(!html||!html.trim())return alert('Print content is empty. Open a saved document first.');
 const style=document.createElement('style');
 style.id='axSafePrintStyle';
 style.textContent=
 '@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:11mm}'+
 '#axSafePrintRoot{position:fixed;inset:0;z-index:2147483600;'+
 'background:#dae5ed;color:#18394c;overflow:auto;'+
 'box-sizing:border-box;padding:0 0 32px;font:14px/1.45 Arial,sans-serif}'+
 '#axSafePrintToolbar{position:sticky;top:0;z-index:3;display:flex;'+
 'flex-wrap:wrap;align-items:center;gap:8px;padding:12px;'+
 'background:#eaf5fa;border-bottom:1px solid #94bacb;box-shadow:0 2px 8px #0002}'+
 '#axSafePrintToolbar button{border:0;border-radius:8px;background:#0b4961;'+
 'color:#fff;padding:12px 15px;font:700 15px Arial,sans-serif;min-height:44px}'+
 '#axSafePrintToolbar button.axClose{background:#536976}'+
 '#axSafePrintHelp{width:100%;font-size:12px;color:#315e73}'+
 '#axSafePrintPaper{box-sizing:border-box;width:min(calc(100% - 20px),'+(landscape?'1000px':'794px')+');'+
 'min-height:300px;min-width:0;overflow:visible;background:#fff;'+
 'margin:15px auto;padding:12px;box-shadow:0 4px 20px #15344730}'+
 '#axSafePrintPaper .axSAPDocument,#axSafePrintPaper .axSapRegister{'+
 'width:100%;min-width:0;max-width:none;background:white}'+
 '#axSafePrintPaper .axSAPDocTable{width:100%}'+
 '@media print{'+
 'html,body{margin:0!important;padding:0!important;background:#fff!important;'+
 'width:auto!important;height:auto!important;min-height:0!important;'+
 'overflow:visible!important}'+
 'body > :not(#axSafePrintRoot){display:none!important}'+
 '#axSafePrintRoot{position:static!important;inset:auto!important;'+
 'display:block!important;width:auto!important;height:auto!important;'+
 'min-height:0!important;max-height:none!important;z-index:auto!important;'+
 'padding:0!important;margin:0!important;overflow:visible!important;'+
 'background:white!important;box-shadow:none!important}'+
 '#axSafePrintToolbar{display:none!important}'+
 '#axSafePrintPaper{position:static!important;display:block!important;'+
 'box-sizing:border-box!important;width:100%!important;max-width:none!important;'+
 'min-width:0!important;height:auto!important;max-height:none!important;'+
 'margin:0!important;padding:0!important;border:0!important;'+
 'overflow:visible!important;box-shadow:none!important;background:white!important}'+
 '#axSafePrintPaper .axSAPDocument,#axSafePrintPaper .axSapRegister{'+
 'width:100%!important;max-width:none!important;min-width:0!important;'+
 'margin:0!important;padding:0!important;box-shadow:none!important}'+
 '#axSafePrintPaper .axSAPTableScroll{overflow:visible!important;max-width:none!important}'+
 '#axSafePrintPaper .axSAPDocTable tr,#axSafePrintPaper .axSapRegTable tr{break-inside:avoid}'+
 '}';
 document.head.appendChild(style);
 const root=document.createElement('section');
 root.id='axSafePrintRoot';
 root.setAttribute('role','dialog');root.setAttribute('aria-label','Aerovex PDF Print Preview');
 const toolbar=document.createElement('div');toolbar.id='axSafePrintToolbar';
 const print=document.createElement('button');print.type='button';
 print.id='axSafePrintNow';print.textContent='Print / Save as PDF';
 const back=document.createElement('button');back.type='button';
 back.className='axClose';back.textContent='Back to ERP';
 const help=document.createElement('small');help.id='axSafePrintHelp';
 help.textContent='Check that the document appears below. Then tap Print / Save as PDF and select Save as PDF under Printer.';
 const paper=document.createElement('article');paper.id='axSafePrintPaper';
 paper.innerHTML=html;
 toolbar.append(print,back,help);root.append(toolbar,paper);
 document.body.appendChild(root);
 current=root;previousTitle=document.title;previousOverflow=document.body.style.overflow;
 document.title=title;document.body.style.overflow='hidden';
 back.onclick=close;
 print.onclick=()=>{
  if(!current||!paper.textContent.trim()){
   alert('Preview is empty; printing was cancelled.');
   return;
  }
  // The document has been visibly rendered since the first tap; the second
  // gesture opens the native print dialog without print-layout race conditions.
  try{window.print()}
  catch(e){alert('Could not open Print. Try Chrome > Share > Print.')}
 };
 // The preview remains available after print or cancellation for retries.
 if(typeof root.scrollTo==='function')root.scrollTo(0,0);
 return true;
}
function desktop(html,title,cssUrl,landscape){
 const w=window.open('','_blank');
 if(!w)return preview(html,title,landscape);
 const doc='<!doctype html><html><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(title)+'</title>'+
 (cssUrl?'<link rel="stylesheet" href="'+esc(cssUrl)+'">':'')+
 '<style>@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:11mm}'+
 'body{background:#fff;color:#172b3a;font-family:Arial,sans-serif}'+
 '#axPrintBar{position:sticky;top:0;background:#e9f4fa;padding:12px;z-index:4}'+
 '#axPrintBar button{background:#0b4961;color:white;border:0;border-radius:8px;'+
 'padding:12px;font-weight:700;font-size:15px}'+
 '@media print{#axPrintBar{display:none!important}body{margin:0!important;padding:0!important}}'+
 '</style></head><body>'+
 '<div id="axPrintBar"><button onclick="window.print()">Print / Save as PDF</button>'+
 ' &nbsp; Verify the document below before printing.</div>'+html+'</body></html>';
 try{w.document.open();w.document.write(doc);w.document.close();w.focus();}
 catch(e){try{w.close()}catch(_){}return preview(html,title,landscape)}
 return true;
}
window.axPrintSafe=function({html,title='Aerovex Document',cssUrl='',landscape=false,forceInline=false}={}){
 if(!html||typeof html!=='string')return false;
 return forceInline||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  ?preview(html,title,landscape):desktop(html,title,cssUrl,landscape);
};
window.axPrintSafeInline=preview;
window.axPrintSafeClose=close;
})();
