/* Aerovex Karnataka Bank direct-API onboarding v2.
 * No bank credentials, OTP, or API secrets are collected here.
 * This page cannot activate live bank feeds without a bank-issued entitlement.
 * Existing receipts/payments/invoices are never edited.
 */
(function(){
'use strict';
if(typeof modules==='undefined'||typeof show!=='function')return;
const BANK='https://karnatakabank.com/';
const MESSAGE=[
  'Subject: Request for Free / Low-Cost Read-Only Corporate Banking API for Aerovex ERP',
  '',
  'Dear Karnataka Bank Corporate Banking / API Banking Team,',
  '',
  'We operate Aerovex Filtration, a proprietorship with a Karnataka Bank current account at Ankleshwar.',
  'We want to connect our own ERP securely to our own account, for read-only transaction and balance synchronization.',
  'Please confirm:',
  '1. Is direct read-only Account Statement / Transaction and Balance API access available to a small current-account customer?',
  '2. Is there a free tier or fee waiver? Please provide setup, monthly, and per-request charges in writing.',
  '3. Can you share official API documentation, sandbox access, authentication requirements (OAuth/mTLS/IP allowlisting), and onboarding steps?',
  '4. What transaction sync frequency, backfill limits, and webhook/polling options are supported?',
  '5. If direct API is unavailable, do you offer authorized automatic statement delivery (SFTP or secure email) for ERP reconciliation?',
  '',
  'We do NOT require fund transfer or payment-initiation permission.',
  'Please route this enquiry to your Corporate/API Banking integration team.',
  '',
  'Regards,',
  'Aerovex Filtration'
].join('\n');
function openSetup(){
 const receipts=Array.isArray(db.receipts)?db.receipts.length:0;
 const payments=Array.isArray(db.payments)?db.payments.length:0;
 show('Karnataka Bank — Direct API Setup',
  '<section style="border:1px solid #c9d9e4;border-radius:12px;padding:14px;background:#f8fbfd;line-height:1.6;color:#19374d">'+
   '<div style="font-size:12px;letter-spacing:.06em">AEROVEX FILTRATION · BANK INTEGRATION</div>'+
   '<h3 style="margin:8px 0">Karnataka Bank Direct API</h3>'+
   '<p style="margin:4px 0;color:#984719;font-weight:700">Not connected — waiting for direct bank API approval</p>'+
   '<p>Open Money is not required for this route. Karnataka Bank has an API platform, but public free account-statement API access has not been confirmed. Do not enter your banking login, password, OTP or API key in this ERP screen.</p>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px">'+
     '<button type="button" class="primary" id="axDirectBankEnquiry">Copy Direct API Request</button>'+
     '<button type="button" id="axDirectBankOfficial">Karnataka Bank Official Site</button>'+
     '<button type="button" id="axDirectBankCSV">Bank CSV Match</button>'+
   '</div>'+
   '<div id="axDirectBankStatus" role="status" style="font-size:12px;margin-top:8px">Ask your bank branch / Corporate Banking team to confirm eligibility and pricing in writing. Only bank-approved read-only APIs will be connected through a protected server.</div>'+
   '<p style="font-size:12px"><b>Existing ERP records:</b> '+receipts+' receipts, '+payments+' payments (these are ERP entries, NOT live bank transactions).</p>'+
   '<p style="font-size:12px"><b>Safe plan:</b> Bank approval → API specification → server-side secrets → test balance and statement fetch → deduplication → review-only matching → explicit approval before accounting updates. No automatic transfers.</p>'+
  '</section>');
 const get=id=>document.getElementById(id);
 get('axDirectBankEnquiry').onclick=async()=>{
   const status=get('axDirectBankStatus');
   try{await navigator.clipboard.writeText(MESSAGE);status.textContent='Request copied. Share it with your Karnataka Bank branch or the bank\'s verified corporate banking contact.'}
   catch(err){
     status.textContent='Clipboard not available. Ask your branch for direct Account Statement and Balance API access, sandbox docs, and written pricing.';
   }
 };
 get('axDirectBankOfficial').onclick=()=>window.open(BANK,'_blank','noopener,noreferrer');
 get('axDirectBankCSV').onclick=()=>{
   if(window.axAerovexReconciliation&&typeof window.axAerovexReconciliation.openBank==='function')window.axAerovexReconciliation.openBank();
   else alert('Bank CSV matching is not loaded. Refresh and try again.');
 };
}
const idx=modules.accounts.findIndex(x=>x[0]==='Bank Live Connection');
if(idx>=0)modules.accounts[idx]=['Bank Live Connection','Karnataka Bank Direct API · Awaiting approval'];
else modules.accounts.push(['Bank Live Connection','Karnataka Bank Direct API · Awaiting approval']);
const oldOpen=window.openModule;
window.openModule=function(name){if(name==='Bank Live Connection')return openSetup();return oldOpen.apply(this,arguments)};
window.axBankLiveSetup=openSetup;
try{render()}catch(err){console.warn('Direct bank setup menu refresh deferred',err)}
})();
