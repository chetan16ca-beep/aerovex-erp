/* Aerovex secure cloud backup: never silently replace local business records. */
(function(){
const URL='https://gfdqzyhhpbhvubpwdxdi.supabase.co',KEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM',LOCAL='aerovex-erp-data-v1';
let token=null,user=null,refreshToken=null,autoTimer=null,baseline=null,cloudStamp=null,busy=false; const fingerprint=()=>JSON.stringify(JSON.parse(localStorage.getItem(LOCAL)||'{}'));
async function api(path,opts={}){const r=await fetch(URL+path,{...opts,headers:{'apikey':KEY,'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{}),...(opts.headers||{})}});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.msg||v.message||v.error_description||'Cloud request failed '+r.status);return v}
function backup(){const raw=localStorage.getItem(LOCAL)||'{}';const a=document.createElement('a');a.href=URLcreate(raw);a.download='aerovex-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>window.URL.revokeObjectURL(a.href),1000)}
function URLcreate(s){return window.URL.createObjectURL(new Blob([s],{type:'application/json'}))}
function show(){let panel=document.getElementById('axCloudPanel');if(panel){panel.remove();return}panel=document.createElement('section');panel.id='axCloudPanel';panel.style.cssText='position:fixed;z-index:9999;right:12px;bottom:70px;width:min(390px,calc(100vw - 24px));max-height:75vh;overflow:auto;background:white;color:#15354b;padding:18px;border:2px solid #167b9c;border-radius:14px;box-shadow:0 10px 35px #0004';panel.innerHTML='<button id="axCloudClose" style="float:right">✕</button><h3>Aerovex Cloud Sync</h3><p>PC and mobile: sign in with the SAME email. Always download a backup before importing.</p><input id="axCloudEmail" type="email" placeholder="Email" style="width:100%;padding:9px;margin:4px 0"><input id="axCloudPass" type="password" placeholder="Password (minimum 6 characters)" style="width:100%;padding:9px;margin:4px 0"><button id="axCloudSignup">Sign Up</button> <button id="axCloudLogin">Login</button><p id="axCloudStatus">Not logged in</p><button id="axCloudBackup">Download local backup</button><hr><button id="axCloudUpload">Upload local data to cloud</button><p><button id="axCloudDownload">Download cloud data to this device</button></p><button id="axCloudAuto">Enable Safe Auto Sync</button><p><small>Auto sync runs every 30 seconds after manual setup. If both devices changed, sync PAUSES instead of overwriting records. Do not enable until both devices have the same verified data.</small></p>';document.body.appendChild(panel);const $=id=>panel.querySelector('#'+id);$('axCloudClose').onclick=()=>panel.remove();const status=t=>$('axCloudStatus').textContent=t;$('axCloudBackup').onclick=backup;$('axCloudAuto').onclick=enableAuto;
async function auth(mode){try{const email=$('axCloudEmail').value.trim(),password=$('axCloudPass').value;if(!email||password.length<6)return status('Enter email and password (6+ characters)');const x=await api('/auth/v1/'+mode,{method:'POST',body:JSON.stringify({email,password})});if(x.access_token){token=x.access_token;refreshToken=x.refresh_token;user=x.user;status('Logged in: '+email+'. Set up both devices before enabling automatic sync.')}else status('Account created. Verify email if confirmation is required, then login.')}catch(e){status(e.message)}}
$('axCloudSignup').onclick=()=>auth('signup');$('axCloudLogin').onclick=()=>auth('token?grant_type=password');
$('axCloudUpload').onclick=async()=>{if(!token)return status('Login first');if(!confirm('Upload this device data? Existing cloud snapshot will be replaced. Make sure you have backups of BOTH devices.'))return;try{const raw=JSON.parse(localStorage.getItem(LOCAL)||'{}');await api('/rest/v1/erp_snapshots?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,payload:raw,updated_at:new Date().toISOString()})});status('Cloud upload complete. Other device must import manually.')}catch(e){status(e.message)}};
$('axCloudDownload').onclick=async()=>{if(!token)return status('Login first');try{const rows=await api('/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(user.id));if(!rows.length)return status('No cloud backup found');if(!confirm('WARNING: This will REPLACE local ERP records on this device. Download local backup first. Continue?'))return;backup();localStorage.setItem(LOCAL,JSON.stringify(rows[0].payload));status('Imported cloud data. Reloading...');location.reload()}catch(e){status(e.message)}}}
async function syncTick(){
 if(busy||!token||!user||baseline===null)return;
 busy=true;
 try{
  const rows=await api('/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(user.id));
  const remote=rows[0],local=fingerprint(),localChanged=local!==baseline,remoteChanged=remote&&remote.updated_at!==cloudStamp;
  if(localChanged&&remoteChanged){stopAuto('Conflict: local and cloud both changed. Auto sync paused; backup both devices before merging.');return}
  if(remoteChanged){
   if(localChanged){stopAuto('Conflict: changes on both devices.');return}
   if(!remote){stopAuto('Cloud snapshot missing. Auto sync paused.');return}
   backup();localStorage.setItem(LOCAL,JSON.stringify(remote.payload));baseline=fingerprint();cloudStamp=remote.updated_at;stopAuto('Cloud updates downloaded. Reload app to see changes; auto sync paused for safety.');location.reload();return
  }
  if(localChanged){
   const stamp=new Date().toISOString();
   await api('/rest/v1/erp_snapshots?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,payload:JSON.parse(local),updated_at:stamp})});
   baseline=local;cloudStamp=stamp;notice('Local changes uploaded to cloud.')
  }
 }catch(e){stopAuto('Sync paused: '+e.message)}finally{busy=false}
}
function notice(t){const el=document.getElementById('axCloudStatus');if(el)el.textContent=t}
function stopAuto(t){if(autoTimer)clearInterval(autoTimer);autoTimer=null;baseline=null;notice(t)}
async function enableAuto(){
 if(!token)return notice('Login first');
 if(!confirm('Enable automatic sync ONLY if both PC and mobile already contain the SAME verified data? If unsure, cancel and download backups first.'))return;
 try{
  const rows=await api('/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(user.id));
  if(!rows.length)return notice('Upload a verified cloud backup first.');
  if(JSON.stringify(rows[0].payload)!==fingerprint())return notice('Local and cloud data differ. Download backups and reconcile before enabling auto sync.');
  baseline=fingerprint();cloudStamp=rows[0].updated_at;
  if(autoTimer)clearInterval(autoTimer);autoTimer=setInterval(syncTick,30000);
  notice('Safe Auto Sync ON — checks every 30 seconds while app is open.')
 }catch(e){notice(e.message)}
}
function init(){const b=document.createElement('button');b.textContent='☁ Cloud Sync';b.style.cssText='position:fixed;bottom:12px;right:12px;z-index:9998;padding:12px;border-radius:20px;background:#0b4961;color:white';b.onclick=show;document.body.appendChild(b)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();