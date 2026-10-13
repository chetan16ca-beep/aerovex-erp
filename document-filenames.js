/* Print-to-PDF filename helper. Does not alter saved ERP records. */
(function(){
function clean(s){return String(s||'').trim().replace(/[^a-zA-Z0-9 _.-]/g,' ').replace(/\s+/g,'_').replace(/_+/g,'_').slice(0,65).replace(/^[_ .-]+|[_ .-]+$/g,'')||'Unknown'}
function filename(x,type){let d=String(x?.date||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(d))d=d.slice(8)+'-'+d.slice(5,7)+'-'+d.slice(0,4);return [clean(x?.party||x?.company||x?.customer),clean(type),clean(d||'Undated'),clean(x?.documentNo||x?.invoiceNo||x?.quotationNo||x?.no||'')].filter(Boolean).join('_')}
window.axDocumentFilename=filename;
let active='';
function select(x,type){active=filename(x,type);document.title=active}
function wrap(name,collection,type){let fn=window[name];if(typeof fn!=='function')return;window[name]=function(i){const result=fn.apply(this,arguments);const x=window.db?.[collection]?.[i];if(x)select(x,type);return result}}
/* db is a global lexical binding in app.js, so access it from the same classic-script context. */
function record(key,i){try{return db[key]?.[i]}catch(e){return null}}
function wrapPreview(name,key,type){const fn=window[name];if(typeof fn!=='function')return;window[name]=function(i){const result=fn.apply(this,arguments);const x=record(key,i);if(x)select(x,type);return result}}
wrapPreview('axQuotationPreview','quotations','Quotation');
wrapPreview('axPrintInvoice','invoices','Invoice');
const doc=window.axDocPreview;
if(typeof doc==='function')window.axDocPreview=function(type,i){const result=doc.apply(this,arguments);const key=type==='Delivery Challan'?'challans':type==='Tax Invoice'?'invoices':type==='Sales Order / PO'?'salesOrders':null;const x=key&&record(key,i);if(x)select(x,type);return result};
function wrapPopup(name){const original=window[name];if(typeof original!=='function')return;window[name]=function(){const oldOpen=window.open;window.open=function(){const w=oldOpen.apply(window,arguments);if(!w||!active)return w;const originalWrite=w.document.write.bind(w.document);w.document.write=function(html){return originalWrite(String(html).replace(/<title>[^<]*<\/title>/i,'<title>'+active+'</title>'))};return w};try{return original.apply(this,arguments)}finally{window.open=oldOpen}}}
wrapPopup('axPrintQuotation');wrapPopup('axPrintDoc');
})();