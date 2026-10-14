(function(){
window.axRepeatQuotation=function(index){
const old=db.quotations[index];if(!old)return;
axCorporateQuotation();
const form=document.getElementById('axMncQuote');
if(!form)return;
const all=db.quotations.map(q=>q.quotationNo);
let seq=db.quotations.length+1;
let number='';
do{number='AFX/QTN/'+String(seq++).padStart(3,'0')}while(all.includes(number));
const keys=['party','attention','gstin','address','ref','rfqDate','poRef','place','taxType','gstRate','validity','payment','delivery','deliveryLocation','freight','packing','warranty','remarks'];
keys.forEach(k=>{const el=form.elements.namedItem(k);if(el&&old[k]!=null)el.value=old[k]});
form.elements.namedItem('quotationNo').value=number;
form.elements.namedItem('date').value=new Date().toLocaleDateString('en-CA');
form.elements.namedItem('revision').value='00';
const root=document.getElementById('axMncLines');
root.replaceChildren();
const items=Array.isArray(old.items)&&old.items.length?old.items:[old];
items.forEach(item=>{
axAddQuoteLine();
const line=root.lastElementChild;
['description','moc','micron','size','hsn','qty','unit','rate','discount'].forEach(k=>{
const el=line.querySelector('[data-field="'+k+'"]');
if(el&&item[k]!=null)el.value=item[k];
});
});
const note=document.createElement('p');
note.textContent='Copied from '+(old.quotationNo||'old quotation')+'. Remove unwanted items or add products, then save as new quotation.';
form.prepend(note);
};
const original=window.axCorporateQuotation;
window.axCorporateQuotation=function(){
const result=original.apply(this,arguments);
const box=document.getElementById('axMncSaved');
if(box)box.querySelectorAll('p').forEach((row,index)=>{
const b=document.createElement('button');
b.type='button';b.textContent='Copy / Repeat';
b.onclick=()=>axRepeatQuotation(index);
row.appendChild(b);
});
return result;
};
})();