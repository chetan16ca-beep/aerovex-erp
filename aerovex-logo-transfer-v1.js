/* Aerovex original logo transfer, safely between PC and Mobile.
 * The logo remains local to the browser: export on PC, import on Mobile.
 * No ERP business record, database or Cloud snapshot is modified.
 */
(function(){
'use strict';
const KEY='aerovex-logo-data';
const valid=s=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s||'');
const byId=id=>document.getElementById(id);
let pending=null,oldLogoExported=false;
function saved(){
 try{const s=localStorage.getItem(KEY)||'';return valid(s)?s:''}catch(_){return ''}
}
function ident(s){
 if(!s)return 'NOT SET';
 let hash=2166136261;
 for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return ((hash>>>0).toString(16).toUpperCase().padStart(8,'0'))+' / '+Math.ceil(s.length*.75/1024)+' KB';
}
function message(s,bad){
 const out=byId('axLogoTransferStatus');
 if(out){out.textContent=s;out.style.color=bad?'#a02417':'#176643'}
}
function refresh(){
 const data=saved(),img=byId('axLogoTransferCurrent');
 if(img){img.hidden=!data;if(data)img.src=data;else img.removeAttribute('src')}
 const note=byId('axLogoTransferCurrentInfo');
 if(note)note.textContent=data?'Current logo: '+ident(data):'No saved original logo on this device';
}
async function downloadCurrent(){
 const data=saved();
 if(!data)return message('There is no saved original logo on this device. Open ERP Set Invoice Logo on the device that has the correct picture.',true);
 try{
  const blob=await fetch(data).then(x=>x.blob());
  const suffix=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
  const a=document.createElement('a'),url=URL.createObjectURL(blob);
  a.href=url;a.download='Aerovex-ORIGINAL-Logo-from-This-Device.'+suffix;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),20000);
  oldLogoExported=true;
  message('Original logo download requested ('+ident(data)+'). Confirm the image file in Downloads. Copy this file from PC to Mobile without editing.');
 }catch(e){message('Logo export failed: '+(e?.message||e),true)}
}
function choose(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))return message('Please choose the original PNG, JPG or WebP logo.',true);
 if(file.size>7*1024*1024)return message('This logo is larger than 7 MB. Please supply a smaller ORIGINAL file; no data changed.',true);
 const reader=new FileReader();
 reader.onerror=()=>message('Could not read the selected logo; no data changed.',true);
 reader.onload=()=>{
  if(!valid(reader.result))return message('Unsupported image format. No data changed.',true);
  pending=String(reader.result);
  const img=byId('axLogoTransferCandidate');
  if(img){img.src=pending;img.hidden=false}
  const box=byId('axLogoTransferCandidateInfo');
  if(box)box.textContent='New logo: '+ident(pending);
  message('Logo file loaded for PREVIEW. Nothing has been replaced yet. Confirm it matches the correct PC logo.');
 };
 reader.readAsDataURL(file);
}
async function apply(){
 if(!pending)return message('First select the correct logo file copied from PC.',true);
 const original=saved();
 if(original===pending)return message('The selected logo is already identical to this device logo. No change required.');
 if(original){
  if(!oldLogoExported)return message('Back up the OLD mobile logo first using Export Current Logo; then Import and Apply.',true);
  if(!confirm('Confirm the OLD logo backup file exists in Downloads and the selected preview is the CORRECT PC logo. Replace ONLY this device logo? No ERP, bill or Cloud record changes.'))return;
 }else if(!confirm('Apply the selected Original Aerovex Logo on this device? No business records will change.'))return;
 try{
  localStorage.setItem(KEY,pending);
  if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  if(localStorage.getItem(KEY)!==pending)throw Error('Logo readback did not match');
  if(typeof axApplyLogo==='function')axApplyLogo();
  pending=null;oldLogoExported=false;
  const candidate=byId('axLogoTransferCandidate');if(candidate){candidate.hidden=true;candidate.removeAttribute('src')}
  refresh();
  message('✓ Original Logo VERIFIED saved on this device. Close, reopen Invoice/Quotation SAP Preview, and check its header. Other ERP records unchanged.');
 }catch(e){message('Logo was NOT verified saved: '+(e?.message||e)+'. Keep both image backups.',true)}
}
window.axLogoTransfer=function(){
 const html='<div style="border:1px solid #9bbdce;border-radius:12px;padding:14px;background:#f4fafc;color:#173f54">'+
 '<h3>Make PC + Mobile Logo Identical</h3><p>Export the CORRECT original logo on PC. Send the image file to Mobile. Import it on Mobile. This does not change customer, invoice, work order, stock, or Cloud data.</p>'+
 '<div style="display:flex;gap:12px;align-items:center;background:white;padding:10px"><img id="axLogoTransferCurrent" hidden alt="Logo saved on this device" style="width:110px;max-height:80px;object-fit:contain"><span id="axLogoTransferCurrentInfo"></span></div>'+
 '<p><button type="button" id="axLogoTransferExport">1. Export This Device Logo (PC + Backup)</button></p>'+
 '<label>2. Select Correct PC Logo File on Mobile<input type="file" id="axLogoTransferInput" accept="image/png,image/jpeg,image/webp" style="width:100%;padding:9px"></label>'+
 '<div style="display:flex;gap:12px;align-items:center;background:white;padding:10px;margin:10px 0"><img id="axLogoTransferCandidate" hidden alt="New original logo preview" style="width:110px;max-height:80px;object-fit:contain"><span id="axLogoTransferCandidateInfo">No new logo selected</span></div>'+
 '<button type="button" id="axLogoTransferApply" style="background:#0b6b86;color:white;border:0;border-radius:8px;padding:13px;font-weight:700">3. Apply Original Logo on This Device</button>'+
 '<p id="axLogoTransferStatus" role="status" aria-live="polite" style="overflow-wrap:anywhere"></p></div>';
 if(typeof show!=='function')return alert('ERP Logo tool is not ready. No changes.');
 show('Aerovex Original Logo — PC & Mobile',html);
 const exportBtn=byId('axLogoTransferExport'),importFile=byId('axLogoTransferInput'),applyBtn=byId('axLogoTransferApply');
 if(exportBtn)exportBtn.onclick=downloadCurrent;
 if(importFile)importFile.onchange=()=>choose(importFile.files?.[0]);
 if(applyBtn)applyBtn.onclick=apply;
 pending=null;oldLogoExported=false;refresh();
};
if(typeof modules!=='undefined'&&Array.isArray(modules.masters)&&!modules.masters.some(x=>x[0]==='Logo — PC / Mobile')){
 modules.masters.push(['Logo — PC / Mobile','Export PC original • Import on Mobile']);
}
const oldOpen=window.openModule||openModule;
window.openModule=function(name){if(name==='Logo — PC / Mobile')return window.axLogoTransfer();return oldOpen.apply(this,arguments)};
try{render()}catch(e){console.warn('Logo transfer tile unavailable',e)}
})();
