/* Aerovex Bank & Terms Settings; additive, old business records untouched. */
(function(){
'use strict';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults={bankName:'Karnataka Bank',accountName:'AEROVEX FILTRATION',accountNo:'0046202600002901',ifsc:'KARB0000046',branch:'ANKLESHVAR',micr:'393052051',msmeNo:'UDYAM-GJ-06-0079128',accountType:'',terms:''};
const settings=()=>({...defaults,...((db.companySettings&&typeof db.companySettings==='object')?db.companySettings:{})});
const line=(label,v)=>String(v||'').trim()?'<div><b>'+e(label)+':</b> '+e(v)+'</div>':'';
function bank(s){
 // Do not publish incomplete bank remittance instructions on customer PDFs.
 // Keep verified branch defaults in Settings but suppress bank section until account no. exists.
 if(!String(s.accountNo||'').trim())return '';
 let result=line('Bank',s.bankName)+line('Account Holder',s.accountName)+line('Account No.',s.accountNo)+line('IFSC',s.ifsc)+line('Branch',s.branch)+line('MICR',s.micr)+line('Account Type',s.accountType);
 return result?'<section class="axBankInfo"><h3>Bank Details</h3>'+result+'</section>':'';
}
function terms(s,name='Additional Terms & Conditions'){
 return String(s.terms||'').trim()?'<section class="axTermsInfo"><h3>'+e(name)+'</h3><p class="axTermsText">'+e(s.terms)+'</p></section>':'';
}

function migrateConfirmedMaster(){
 const stamp='aerovex-bank-msme-confirmed-20261020-v1';
 try{if(localStorage.getItem(stamp)==='applied')return;}catch(error){}
 const existing=(db.companySettings&&typeof db.companySettings==='object'&&!Array.isArray(db.companySettings))?db.companySettings:{};
 const oldAccount=String(existing.accountNo||'').replace(/\D/g,'');
 const confirmedAccount='0046202600002901';
 if(oldAccount&&oldAccount!==confirmedAccount){
  // Never silently replace another real bank account saved on a device.
  if(!confirm('Another bank account is already saved in this ERP. Replace only the bank details with the Karnataka Bank details you supplied? Existing Orders/Invoices/Terms will remain unchanged.'))return;
 }
 const updated={...existing,bankName:'Karnataka Bank',accountName:'AEROVEX FILTRATION',
  accountNo:confirmedAccount,ifsc:'KARB0000046',branch:'ANKLESHVAR',micr:'393052051',
  msmeNo:'UDYAM-GJ-06-0079128'};
 const before=db.companySettings;
 try{db.companySettings=updated;save();localStorage.setItem(stamp,'applied')}
 catch(error){db.companySettings=before;console.warn('Bank master update deferred:',error)}
}
function showMSME(paper,s){
 const number=String(s.msmeNo||'').trim();
 paper.querySelector('.axMSMEMaster')?.remove();
 if(!number||String(paper.textContent||'').includes(number))return;
 const header=paper.querySelector('.axPrintCompany')||paper.querySelector('header')||paper.querySelector('.axPrintHeader')||paper.firstElementChild||paper;
 const badge=document.createElement('div');
 badge.className='axMSMEMaster';
 badge.innerHTML='<b>MSME / Udyam:</b> '+e(number);
 header.append(badge);
}
function enhance(){
 const root=document.querySelector('#modalBody');if(!root)return;
 const s=settings();
 const quote=root.querySelector('.axQuotePrint'),doc=root.querySelector('.axDocPaper');
 if(quote||doc){
  const paper=quote||doc;
  showMSME(paper,s);
  paper.querySelector('.axExtraBankTerms')?.remove();
  const block=document.createElement('div');block.className='axExtraBankTerms';block.innerHTML=bank(s)+terms(s);
  if(!block.innerHTML)return;
  let anchor=doc?paper.querySelector('.signature'):null;
  if(!anchor)for(const child of [...paper.children].reverse())if(/Authorized Signatory/i.test(child.textContent||'')){anchor=child;break}
  if(anchor)anchor.before(block);else paper.append(block);
  return;
 }
 const paper=root.querySelector('.axPrintPaper,.axBill');if(!paper)return;
 showMSME(paper,s);
 const bottom=paper.querySelector('.axPrintBottom');
 if(bottom){
  bottom.innerHTML=bank(s)+terms(s,'Terms & Conditions');
  bottom.style.display=bottom.innerHTML?'':'none';
  return;
 }
 const foot=paper.querySelector('.axBillFoot');
 if(foot){
  if(foot.firstElementChild)foot.firstElementChild.innerHTML=bank(s);
  paper.querySelector('.axExtraBankTerms')?.remove();
  if(String(s.terms||'').trim()){
   const extra=document.createElement('div');extra.className='axExtraBankTerms';
   extra.innerHTML=terms(s,'Terms & Conditions');foot.before(extra);
  }
 }
}
const style=document.createElement('style');
style.textContent='.axExtraBankTerms{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;padding:12px 0;margin:14px 0;border-top:1px solid #c9d8e4;break-inside:avoid}.axBankInfo,.axTermsInfo{min-width:0;overflow-wrap:anywhere;font-size:12px}.axBankInfo h3,.axTermsInfo h3{font-size:13px;margin:0 0 8px}.axBankInfo div{line-height:1.65}.axTermsText{white-space:pre-line;line-height:1.5;margin:0}@media print{.axExtraBankTerms{break-inside:avoid!important}.axTermsText{white-space:pre-line!important}}';
document.head.append(style);
window.axBankTermsSettings=function(){
 const s=settings();
 const input=(key,label,attrs='')=>'<label>'+label+'<input name="'+key+'" value="'+e(s[key])+'" '+attrs+'></label>';
 show('Bank Details & Terms Settings',
 '<form id="axBankTermsForm" class="form">'+
 '<div class="full"><h3>Bank Details</h3><p>Your confirmed Karnataka Bank details have been prefilled. Verify them against the bank-issued statement before sending customer payment instructions. MSME number is based on your available Udyam certificate.</p></div>'+
 input('bankName','Bank Name','required maxlength="90"')+
 input('accountName','Account Holder Name','maxlength="100"')+
 input('accountNo','Account Number','inputmode="numeric" maxlength="28" autocomplete="off"')+
 input('ifsc','IFSC Code','maxlength="11" autocomplete="off"')+
 input('branch','Branch','maxlength="100"')+
 input('micr','MICR Code','inputmode="numeric" maxlength="9"')+
 input('msmeNo','MSME / Udyam Registration Number','maxlength="24"')+
 input('accountType','Account Type (optional)','maxlength="50"')+
 '<div class="full"><h3>Terms & Conditions</h3><p>Write your approved terms, one per line. They will appear in Quotation, Challan and Invoice print/PDF along with existing commercial terms.</p>'+
 '<textarea name="terms" rows="8" maxlength="3000" style="width:100%" placeholder="Type company-approved terms here">'+e(s.terms)+'</textarea></div>'+
 '<div class="full"><button type="submit" class="primary">Save Bank & Terms</button><p>Saved with ERP data (included in normal backup and enabled cloud sync). Changing these settings also affects future reprints of old documents; saved amounts are not changed.</p></div></form>');
 const form=document.getElementById('axBankTermsForm');
 form.onsubmit=event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(form)),next={};
  for(const key of Object.keys(defaults))next[key]=String(values[key]??'').trim();
  next.ifsc=next.ifsc.toUpperCase().replace(/\s/g,'');
  next.accountNo=next.accountNo.replace(/\s/g,'');
  if(!next.bankName)return alert('Enter a bank name.');
  if(next.accountNo&&!/^[0-9-]{6,28}$/.test(next.accountNo))return alert('Verify account number: 6–28 digits / hyphens.');
  if(next.ifsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(next.ifsc))return alert('Verify the 11-character IFSC code.');
  next.micr=next.micr.replace(/\s/g,'');
  if(next.micr&&!/^\d{9}$/.test(next.micr))return alert('MICR must be 9 digits.');
  if(next.msmeNo&&!/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(next.msmeNo.toUpperCase()))return alert('Check Udyam / MSME number against the certificate.');
  next.msmeNo=next.msmeNo.toUpperCase();
  const old=db.companySettings;db.companySettings=next;
  try{save()}catch(error){db.companySettings=old;return alert('Could not save: '+error.message)}
  alert('Bank Details and Terms saved. Open any Quotation, Challan or Invoice preview to see them.');
  window.axBankTermsSettings();
 };
};
function shortcut(){
 if(document.getElementById('axBankTermsShortcut'))return;
 const area=document.querySelector('.hero')||document.getElementById('quick');if(!area)return;
 const b=document.createElement('button');b.type='button';b.id='axBankTermsShortcut';b.className='primary';
 b.textContent='🏦 Bank & Terms';b.style.cssText='margin:8px 5px;min-height:44px;font-weight:700';
 b.onclick=window.axBankTermsSettings;area.append(b);
}
if(Array.isArray(modules.accounts)&&!modules.accounts.some(x=>x[0]==='Bank & Terms Settings'))modules.accounts.push(['Bank & Terms Settings','Karnataka Bank • Terms']);
const prevOpen=window.openModule;
window.openModule=function(name){if(name==='Bank & Terms Settings')return window.axBankTermsSettings();return prevOpen.apply(this,arguments)};
for(const name of ['axQuotationPreview','axDocPreview','axPrintInvoice']){
 const original=window[name];if(typeof original!=='function')continue;
 window[name]=function(){const result=original.apply(this,arguments);enhance();return result};
}
migrateConfirmedMaster();
try{render()}catch(err){console.warn('Bank & Terms menu render',err)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shortcut);else shortcut();
})();
