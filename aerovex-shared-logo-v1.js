/* Aerovex shared Logo PC -> Cloud -> Mobile.
   The official laptop original is never modified. User explicitly publishes
   a reduced-size display copy in shared ERP data. The phone saves its prior
   device logo before applying the shared one. No CFM data or code accessed. */
(function(){
'use strict';
const SHARED='sharedBrandLogo';
const LOGO_KEY='aerovex-logo-data';
const OLD_LOGO='aerovex-previous-mobile-logo-v1';
const MAX_LOGO_BYTES=650000;
const mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const $=id=>document.getElementById(id);
const valid=s=>/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(String(s||''));
const size=s=>Math.ceil(String(s||'').length*.75);
const status=msg=>{const el=$('axSharedLogoStatus');if(el)el.textContent=msg};
let applying=false,priorVersion=null,initialized=false;
function deviceLogo(){try{return localStorage.getItem(LOGO_KEY)||''}catch(_){return ''}}
function desired(){return typeof db==='object'&&db&&db[SHARED]||null}
function showPreview(){
 const pc=$('axSharedLogoPCPreview'),cloud=$('axSharedLogoCloudPreview');
 const raw=deviceLogo(),remote=desired();
 if(pc){pc.style.display=valid(raw)?'block':'none';if(valid(raw))pc.src=raw;else pc.removeAttribute('src');}
 if(cloud){cloud.style.display=remote&&valid(remote.src)?'block':'none';if(remote&&valid(remote.src))cloud.src=remote.src;else cloud.removeAttribute('src');}
 const text=$('axSharedLogoInfo');
 if(text)text.textContent=(valid(raw)?'Current device logo: '+Math.round(size(raw)/1024)+' KB. ':'Current device logo: NOT SAVED. ')+
 (remote&&valid(remote.src)?'Shared Cloud logo present ('+Math.round(size(remote.src)/1024)+' KB).':'Shared Cloud logo not published yet.');
}
function makeCompressed(original,maxSize=MAX_LOGO_BYTES){
 return new Promise((resolve,reject)=>{
  if(!valid(original))return reject(Error('No valid original Logo stored on this laptop. Open Sales Invoice → Set Invoice Logo first.'));
  if(original.length<=maxSize)return resolve(original);
  const img=new Image();
  img.onerror=()=>reject(Error('The original PC logo image could not be decoded. Nothing changed.'));
  img.onload=()=>{
   try{
    for(const limit of [1200,900,650]){
     const scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     const ctx=canvas.getContext('2d');
     if(!ctx)throw Error('Image compression is unavailable');
     ctx.drawImage(img,0,0,canvas.width,canvas.height);
     for(const quality of [.94,.86,.76]){
      const compressed=canvas.toDataURL('image/webp',quality);
      if(valid(compressed)&&compressed.length<=maxSize)return resolve(compressed);
     }
    }
    reject(Error('Original logo is too large to sync safely. Use a smaller high-quality PNG or WebP.'));
   }catch(e){reject(e)}
  };
  img.src=original;
 });
}
async function publish(){
 if(mobile)return status('Use the LAPTOP to publish its correct logo. Mobile will receive it.');
 if(typeof db!=='object'||!db)return status('ERP data is not ready. Retry after opening Aerovex.');
 const original=deviceLogo();
 if(!valid(original))return status('No saved logo on this laptop. Use Sales Invoices → Set Invoice Logo first.');
 if(!confirm('Publish this laptop’s ORIGINAL AEROVEX LOGO as the shared logo for PC and mobile? The original laptop image stays unchanged. This adds a small optimized display copy to the shared ERP data; no invoices will be edited.'))return;
 const btn=$('axLogoPublish');if(btn)btn.disabled=true;
 status('Preparing an unchanged or quality-optimized display copy for Cloud…');
 try{
  const shared=await makeCompressed(original);
  if(!window.axERPStorageBridge?.status()?.ready)
   throw Error('Verified IndexedDB is not ready. Nothing published.');
  const prior=db[SHARED];
  const next={src:shared,createdAt:new Date().toISOString(),source:'Laptop original',format:'data-url',version:1};
  db[SHARED]=next;
  try{
   localStorage.setItem('aerovex-erp-data-v1',JSON.stringify(db));
   await window.axERPStorageBridge.flush();
  }catch(e){
   if(prior===undefined)delete db[SHARED];else db[SHARED]=prior;
   throw e;
  }
  priorVersion=next.createdAt;
  showPreview();
  status('✓ Laptop shared logo SAVED to IndexedDB ('+Math.round(size(shared)/1024)+' KB). Keep ERP online; Cloud Sync uploads it in about 8 seconds. Open Cloud Sync and verify its saved status. Mobile will apply on next Cloud download.');
 }catch(e){status('⚠ Logo NOT published: '+String(e?.message||e)+'. Original laptop logo is untouched.');}
 finally{if(btn)btn.disabled=false}
}
async function applyShared(){
 if(applying)return;
 const shared=desired();
 if(!shared||!valid(shared.src)||shared.src.length>MAX_LOGO_BYTES)return;
 if(shared.source!=='Laptop original')return;
 if(!window.axERPStorageBridge?.status()?.ready)return;
 // NEVER overwrite the correct, original laptop logo with its optimized Cloud copy.
 if(!mobile&&valid(deviceLogo())){priorVersion=shared.createdAt;return;}
 if(deviceLogo()===shared.src){priorVersion=shared.createdAt;return;}
 applying=true;
 try{
  const original=deviceLogo();
  if(valid(original)){
   localStorage.setItem(OLD_LOGO,original);
   await window.axERPStorageBridge.flush();
  }
  localStorage.setItem(LOGO_KEY,shared.src);
  await window.axERPStorageBridge.flush();
  if(typeof axApplyLogo==='function')axApplyLogo();
  window.axSAPLogoFix?.apply?.(document);
  priorVersion=shared.createdAt;
  showPreview();
  status('✓ Correct laptop logo applied on '+(mobile?'mobile':'laptop')+'; previous device logo safely backed up. Reopen Print / PDF Preview to check.');
 }catch(e){status('⚠ Shared logo could not be saved on this device: '+String(e?.message||e));}
 finally{applying=false}
}
function open(){
 const text='<div style="padding:14px;border:1px solid #aac1cc;border-radius:10px;background:#f4fafd">'+
 '<h3>One Aerovex Logo — Laptop + Mobile</h3>'+
 '<p>Laptop original is the source. Both documents and demo previews use the same Cloud-published display copy. No invoice, challan or work order is created here.</p>'+
 '<div style="display:flex;gap:20px;flex-wrap:wrap"><div><b>This device</b><img id="axSharedLogoPCPreview" alt="This device logo" style="display:block;max-width:150px;max-height:100px;object-fit:contain"></div><div><b>Shared Cloud logo</b><img id="axSharedLogoCloudPreview" alt="Shared Aerovex logo" style="display:block;max-width:150px;max-height:100px;object-fit:contain"></div></div>'+
 '<p id="axSharedLogoInfo"></p>'+
 (!mobile?'<button type="button" id="axLogoPublish" style="padding:13px;background:#0b4961;color:white;border-radius:8px;border:0">Use Laptop Logo for Both Devices</button>':'<p><b>Phone:</b> open this after laptop has published and Cloud Sync reports an upload.</p>')+
 ' <button type="button" id="axLogoApply" style="padding:13px">Apply / Check Shared Logo</button>'+
 '<p id="axSharedLogoStatus" role="status" style="font-weight:700;overflow-wrap:anywhere">Checking saved artwork…</p></div>';
 if(typeof show!=='function')return alert('ERP interface not ready. Logo was not changed.');
 show('Aerovex Logo Sync',text);
 showPreview();
 if($('axLogoPublish'))$('axLogoPublish').onclick=publish;
 $('axLogoApply').onclick=async()=>{await applyShared();showPreview();if(!valid(desired()?.src))status('No shared Logo on this device yet. Publish it from laptop first and wait for Cloud Sync.');else if(deviceLogo()===desired()?.src)status('✓ This device is using the same Aerovex logo as the laptop.');};
}
window.axSharedLogoApply=applyShared;
window.axSharedLogoOpen=open;
if(typeof modules!=='undefined'&&Array.isArray(modules.masters)&&!modules.masters.some(x=>x[0]==='Logo Sync'))
 modules.masters.push(['Logo Sync','Same original logo • Laptop and Mobile']);
const prev=window.openModule||openModule;
window.openModule=function(name){if(name==='Logo Sync')return open();return prev.apply(this,arguments)};
try{render()}catch(_){}
setInterval(()=>{if(desired()?.createdAt!==priorVersion)applyShared().catch(()=>{})},4500);
window.addEventListener('ax-aerovex-modules-ready',()=>applyShared().catch(()=>{}));
applyShared().catch(()=>{});
})();
