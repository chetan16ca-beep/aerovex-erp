/* Aerovex Connected Banking setup v1.
 * Bank authentication and consent ALWAYS occur on the provider's own site.
 * This module deliberately does not request/store OTPs, credentials, tokens,
 * or falsely label ERP figures as live bank balances.
 */
(function(){
  'use strict';
  if(typeof modules==='undefined'||typeof show!=='function')return;
  const URL='https://open.money/product/multi-bank-connectivity/banks/karnataka-bank';
  const note='A bank-approved integration / API subscription is required before real-time sync can start. This screen does not connect the bank or alter any existing ERP data.';
  function openSetup(){
    const credits=Array.isArray(db.receipts)?db.receipts.length:0;
    const debits=Array.isArray(db.payments)?db.payments.length:0;
    show('Karnataka Bank — Live Connection Setup',
      '<section style="padding:14px;border:1px solid #c6d7e4;border-radius:12px;background:#f8fbfd;color:#1c3446">'+
       '<div style="font-size:12px;letter-spacing:.04em">AEROVEX FILTRATION • CONNECTED BANKING</div>'+
       '<h3 style="margin:8px 0">Karnataka Bank</h3>'+
       '<p style="margin:0;color:#9b3d16;font-weight:700">Not connected — Bank approval / authorization required</p>'+
       '<p style="line-height:1.6">'+note+'</p>'+
       '<div style="display:flex;flex-wrap:wrap;gap:8px">'+
        '<button type="button" id="axBankStartOpen" class="primary">Open Secure Bank Onboarding</button>'+
        '<button type="button" id="axBankStatementsOpen">Match Bank Statement</button>'+
        '<button type="button" id="axBankDetailsOpen">Bank Details</button>'+
       '</div>'+
       '<p style="font-size:12px;line-height:1.6">Onboarding opens the external Open Money Karnataka Bank information page. Sign up / review terms there; the provider and bank may require KYC, commercial approval, and your consent. An OTP, if requested, must be entered only on their verified banking/consent screen — never here or in chat.</p>'+
       '<p style="font-size:12px"><b>Existing ERP records (not bank data):</b> '+credits+' receipts; '+debits+' payments. No live balance or transactions have been retrieved.</p>'+
       '<p style="font-size:12px"><b>Access:</b> Begin with read-only balances and statement fetch. Do not enable payments or transfers until separately reviewed. API credentials must be configured on a secure server after provider activation, never in the ERP browser.</p>'+
      '</section>');
    const byId=id=>document.getElementById(id);
    byId('axBankStartOpen').onclick=()=>{window.open(URL,'_blank','noopener,noreferrer')};
    byId('axBankStatementsOpen').onclick=()=>{
      if(window.axAerovexReconciliation?.openBank)window.axAerovexReconciliation.openBank();
      else alert('Statement Matching is not loaded. Refresh the ERP and retry.');
    };
    byId('axBankDetailsOpen').onclick=()=>{
      if(typeof window.axBankTermsSettings==='function')window.axBankTermsSettings();
      else alert('Bank Details is not loaded. Refresh the ERP and retry.');
    };
  }
  if(!modules.accounts.some(x=>x[0]==='Bank Live Connection'))modules.accounts.push(['Bank Live Connection','Karnataka Bank • Setup pending approval']);
  const previous=window.openModule;
  window.openModule=function(name){
    if(name==='Bank Live Connection')return openSetup();
    return previous.apply(this,arguments);
  };
  window.axBankLiveSetup=openSetup;
  try{render()}catch(err){console.warn('Connected Banking menu will appear after refresh',err)}
})();
