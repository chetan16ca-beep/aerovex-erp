/* Quotation number collision blocker.
 * AFX/QTN/003 was explicitly VOID / RESERVED in shared Aerovex records.
 * Block all forms from reusing reserved quotation numbers.
 * No deletions or automatic renumber of existing business documents.
 */
(function(){
'use strict';
function quoteNumber(form){
 if(!form||!form.querySelector)return '';
 const field=form.querySelector('[name="quotationNo"],[name="documentNo"]');
 const value=String(field?.value||'').trim().toUpperCase();
 return /^AFX\/QTN\/\d+$/.test(value)?value:'';
}
function nextAvailable(){
 const used=new Set((db.quotations||[]).map(q=>String(q.quotationNo||q.documentNo||'').trim().toUpperCase()));
 for(const x of db.reservedDocumentNumbers||[])used.add(String(x).trim().toUpperCase());
 let n=1;while(used.has('AFX/QTN/'+String(n).padStart(3,'0'))&&n<100000)n++;
 return 'AFX/QTN/'+String(n).padStart(3,'0');
}
function blocked(e){
 const form=e.target;
 const q=quoteNumber(form);
 if(!q)return;
 const reserved=(db.reservedDocumentNumbers||[]).some(x=>String(x||'').trim().toUpperCase()===q);
 if(!reserved)return;
 e.preventDefault();e.stopImmediatePropagation();
 const next=nextAvailable();
 alert('QUOTATION NOT SAVED. '+q+' is VOID / RESERVED for audit. Do not issue it. The next available number is '+next+'. Open a NEW quotation using that number; keep the original as an audit record.');
}
document.addEventListener('submit',blocked,true);
window.axAerovexQuotationNumberCheck={
 nextAvailable,
 isReserved:number=>(db.reservedDocumentNumbers||[]).some(x=>String(x||'').toUpperCase()===String(number||'').toUpperCase())
};
})();
