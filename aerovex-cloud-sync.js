/* Aerovex two-device cloud sync v3: Mobile + PC.
 * Cloud is canonical after deliberate setup; no silent last-write-wins.
 * Atomic compare-and-swap (updated_at conditional PATCH) prevents overwrites.
 * An empty cloud must be explicitly initialized on the source mobile.
 * Existing data remains local until explicit consent; CFM is never accessed.
 */
(function(){
'use strict';
const ROOT='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
const KEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
const OWNER='aerovexfiltration@gmail.com';
const LOCAL='aerovex-erp-data-v1',SESSION='aerovex-2device-session-v3',DEVICE='aerovex-2device-role-v3';
const INTERVAL=8000;
let session=null, baseline=null, stamp=null, timer=null, busy=false, paused=false, online=false, lastMessage='Not connected';
const $=id=>document.getElementById(id);
const stable=v=>JSON.stringify(normalize(v));
function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v}
function local(){let o=JSON.parse(localStorage.getItem(LOCAL)||'{}');if(!o||typeof o!=='object'||Array.isArray(o))throw Error('Local ERP data is invalid.');return o}
function status(message){lastMessage=message;const x=$('ax2Status');if(x)x.textContent=message;const badge=$('ax2Badge');if(badge)badge.textContent=paused?'⏸ Sync Paused':online&&baseline!==null?'● Auto Sync ON':'○ Sync Not Ready'}
function backup(){const raw=localStorage.getItem(LOCAL);if(!raw)throw Error('No local data to back up');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Aerovex-ERP-Safety-Backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function date(){return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
function sessionSave(s){session=s;sessionStorage.setItem(SESSION,JSON.stringify(s))}
function sessionClear(){session=null;sessionStorage.removeItem(SESSION)}
async function send(path,method='GET',body=null,extra={}){
  const headers={'apikey':KEY,Accept:'application/json',...(body!==null?{'Content-Type':'application/json'}:{}),...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),...extra};
  let res=await fetch(ROOT+path,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{}),cache:'no-store'});
  if(res.status===401&&session?.refresh_token&&path!=='/auth/v1/token?grant_type=refresh_token'){
    const rr=await fetch(ROOT+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(rr.ok){const s=await rr.json();sessionSave(s);headers.Authorization='Bearer '+s.access_token;res=await fetch(ROOT+path,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{}),cache:'no-store'})}
  }
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw Error((data&&typeof data==='object'&&(data.message||data.msg||data.error_description))||'Network/API error '+res.status);
  return data;
}
async function auth(){
  const password=$('ax2Password')?.value||'';
  if(password.length<6)return status('Enter your existing Aerovex admin password.');
  try{
    status('Signing in to Aerovex cloud...');
    const s=await send('/auth/v1/token?grant_type=password','POST',{email:OWNER,password});
    if(!s?.access_token)throw Error('Login did not return a session.');
    sessionSave(s);
    const u=await send('/auth/v1/user');
    if(String(u?.email||'').toLowerCase()!==OWNER){sessionClear();throw Error('Only Aerovex owner account is accepted.')}
    if($('ax2Password'))$('ax2Password').value='';
    status('Owner verified. Mobile: initialize cloud; PC: join the cloud.');
    await loadState();
  }catch(e){sessionClear();status('Login failed: '+e.message)}
}
async function cloud(){
  if(!session?.user?.id)throw Error('Please sign in.');
  const r=await send('/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(session.user.id)+'&limit=1');
  return Array.isArray(r)?r[0]||null:null;
}
function role(value){if(value==='mobile'||value==='pc')sessionStorage.setItem(DEVICE,value)}
function stop(reason){paused=true;online=false;clearInterval(timer);timer=null;status('⚠ '+reason+' No data was replaced. Back up both devices before resolving.')}
function modalIsOpen(){const m=$('modal');return m&&!m.classList.contains('hidden')}
function isLocked(){return document.body?.classList.contains('axAuthLocked')}
function setCurrent(payload){
  const previous=localStorage.getItem(LOCAL)||'{}';
  // Retain a same-device rollback. If out of space, don't apply the remote snapshot.
  localStorage.setItem('aerovex-sync-prechange-v3',previous);
  try{
    localStorage.setItem(LOCAL,JSON.stringify(payload));
    if(typeof db!=='undefined'&&db&&typeof db==='object'){
      const safe=typeof blank==='function'?Object.assign(blank(),payload):payload;
      for(const k of Object.keys(db))delete db[k];
      Object.assign(db,safe);
      if(typeof render==='function')render();
    }
  }catch(e){localStorage.setItem(LOCAL,previous);throw e}
}
function id(k,x){
  if(!x||typeof x!=='object')return stable(x);
  let s=k==='parties'||k==='suppliers'?x.gstin||x.name||x.party||x.f0
      :k==='workOrders'?x.workNo
      :k==='quotations'?x.quotationNo||x.documentNo
      :k==='salesOrders'||k==='challans'||k==='invoices'?x.documentNo||x.invoiceNo
      :k==='purchases'?x.documentNo||x.invoiceNo||(String(x.gstin||'')+'|'+String(x.supplierInvoice||''))
      :k==='vouchers'?String(x.type||'')+'|'+String(x.no||'')+'|'+String(x.date||'')
      :k==='store'?x.srl||x.serial||x.srlNo
      :k==='products'?x.code||x.productCode||x.name
      :k==='departmentWork'||k==='cutting'||k==='receipts'||k==='payments'||k==='expenses'?null
      :x.id||x.no;
  return s?String(s).trim().toLowerCase():stable(x);
}
function localOnly(oldData,newData){
 const missing=[];
 for(const [k,a]of Object.entries(oldData)){
  if(!Array.isArray(a)||!a.length)continue;
  const b=Array.isArray(newData[k])?newData[k]:[];
  const existing=new Set(b.map(x=>id(k,x)));
  for(const x of a)if(!existing.has(id(k,x)))missing.push(k+': '+(x?.documentNo||x?.workNo||x?.invoiceNo||x?.name||x?.party||id(k,x)).toString().slice(0,90));
 }
 return missing;
}
async function initial(){
  if(!session)return status('Sign in first.');
  if(!confirm('MOBILE ONLY: Set this mobile as the starting Aerovex cloud data? This will not delete any existing cloud data. First download a backup.'))return;
  try{
    backup();
    const c=await cloud();
    if(c)return status('Cloud already has records. Initialization refused to prevent overwriting. Use Join on PC only after checking.');
    const data=local();
    const r=await send('/rest/v1/erp_snapshots?on_conflict=user_id','POST',{user_id:session.user.id,payload:data,updated_at:new Date().toISOString()},{Prefer:'resolution=ignore-duplicates,return=representation'});
    if(!Array.isArray(r)||r.length!==1)throw Error('Cloud already initialized elsewhere. Data not changed.');
    role('mobile');baseline=stable(data);stamp=r[0].updated_at;paused=false;online=true;start();
    status('✓ Mobile source uploaded safely. PC can now join. Auto Sync checks every 8 seconds while open.');
  }catch(e){stop('Mobile initialization failed: '+e.message)}
}
async function join(){
 if(!session)return status('Sign in first.');
 try{
  const c=await cloud();
  if(!c)return status('Cloud has no data. First initialize from your MOBILE.');
  const previous=local(),missing=localOnly(previous,c.payload);
  if(missing.length){stop('This device has '+missing.length+' records missing in cloud: '+missing.slice(0,3).join('; ')+'. Join blocked.');return}
  if(stable(previous)!==stable(c.payload)){
   if(!confirm('This device has older or different values. Save a safety backup, then load the cloud copy here? This changes only this device; cloud data is not overwritten.'))return;
   backup();
   if(modalIsOpen())return status('Close the open form before joining.');
   setCurrent(c.payload);
  }
  role('pc');baseline=stable(local());stamp=c.updated_at;paused=false;online=true;start();
  status('✓ PC connected to shared Aerovex data. Auto Sync checks every 8 seconds while app is open.');
 }catch(e){stop('PC join failed: '+e.message)}
}
async function resume(){
 if(!session)return status('Sign in first.');
 if(!sessionStorage.getItem(DEVICE))return status('Choose Mobile Initialize or PC Join first.');
 try{
   const c=await cloud();if(!c)return status('No cloud data yet. Initialize from Mobile first.');
   if(stable(local())!==stable(c.payload))return status('Local and cloud differ. No overwrite. PC: use Join after reviewing/backup.');
   baseline=stable(local());stamp=c.updated_at;paused=false;online=true;start();status('✓ Shared data verified. Auto Sync ON; every 8 seconds while open.');
 }catch(e){status('Cloud is unreachable: '+e.message)}
}
async function tick(){
 if(busy||!online||paused||!session||!stamp||document.hidden||isLocked())return;
 busy=true;
 try{
  const c=await cloud();
  if(!c)return stop('Cloud source missing.');
  const here=stable(local()),localChanged=here!==baseline,remoteChanged=c.updated_at!==stamp;
  if(localChanged&&remoteChanged)return stop('Conflict: both mobile and PC changed. No overwrite.');
  if(remoteChanged){
   if(modalIsOpen())return status('New cloud data waiting. Close the form to refresh safely.');
   if(localChanged)return stop('Conflict: changes on both devices.');
   setCurrent(c.payload);baseline=stable(local());stamp=c.updated_at;status('✓ Downloaded latest Aerovex update at '+date());return;
  }
  if(localChanged){
   // Conditional PATCH is atomic: a competing device cannot overwrite unseen changes.
   const at=new Date().toISOString();
   const where='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&updated_at=eq.'+encodeURIComponent(stamp)+'&select=updated_at';
   const updated=await send(where,'PATCH',{payload:local(),updated_at:at},{Prefer:'return=representation'});
   if(!Array.isArray(updated)||updated.length!==1)return stop('Cloud changed during upload. Conflict prevented.');
   baseline=here;stamp=updated[0].updated_at;status('✓ Saved this device changes to cloud at '+date());return;
  }
 }catch(e){
  // Network failures leave both copies untouched; next poll retries.
  status('Offline / waiting to reconnect: '+e.message);
 }finally{busy=false}
}
function start(){
 clearInterval(timer);timer=setInterval(tick,INTERVAL);tick();
}
async function loadState(){
 if(!session)return;
 try{
  const c=await cloud();status(c?'Cloud exists. Pair exactly Mobile and PC.':'Cloud is empty. Initialize from Mobile.');
  if(sessionStorage.getItem(DEVICE)&&c)await resume();
 }catch(e){status('Cloud check failed: '+e.message)}
}
async function boot(){
 try{
  const data=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(!data?.access_token)return;
  session=data;
  const u=await send('/auth/v1/user');
  if(String(u?.email||'').toLowerCase()!==OWNER)throw Error('Different user');
  session.user=u;sessionSave(session);
  await loadState();
 }catch(e){sessionClear();status('Session expired. Sign in again.')}
}
function panel(){
 let p=$('axCloudPanel');if(p){p.remove();return}
 p=document.createElement('section');p.id='axCloudPanel';p.style.cssText='position:fixed;z-index:9999;bottom:70px;right:12px;width:min(390px,calc(100vw - 24px));max-height:75vh;overflow:auto;background:white;color:#133d50;padding:16px;border-radius:12px;border:2px solid #1780a6;box-shadow:0 10px 35px #0004;font:14px Arial';
 p.innerHTML='<button type="button" id="ax2Close" style="float:right">✕</button><h3>Aerovex Cloud Sync — Mobile + PC Only</h3><p id="ax2Badge" style="font-weight:bold">○ Sync Not Ready</p><p id="ax2Status" role="status">Not connected</p><p>One shared Aerovex data set on your mobile and PC. Changes appear automatically about every 8 seconds while the ERP is open and online.</p><input type="password" id="ax2Password" autocomplete="current-password" placeholder="Existing Aerovex admin password" style="padding:10px;width:95%;box-sizing:border-box"><button type="button" id="ax2Login">1. Sign in as Owner</button><hr><p><button type="button" id="ax2Backup">Download This Device Backup</button></p><p><b>First time (only after both device backups):</b></p><button type="button" id="ax2Init">2A. Mobile: Initialize Shared Data</button><p><button type="button" id="ax2Join">2B. PC: Join Existing Shared Data</button></p><button type="button" id="ax2Resume">Resume / Verify Auto Sync</button><p style="font-size:12px;color:#a14320"><b>Safety:</b> Never restores/overwrites cloud automatically. Concurrent edits pause sync; no silent record deletion. Keep both backups. Do not use the setup buttons on a third device.</p>';
 document.body.appendChild(p);
 $('ax2Close').onclick=()=>p.remove();
 $('ax2Login').onclick=auth;
 $('ax2Backup').onclick=()=>{try{backup();status('Backup downloaded.')}catch(e){status(e.message)}};
 $('ax2Init').onclick=initial;
 $('ax2Join').onclick=join;
 $('ax2Resume').onclick=resume;
 status(lastMessage);
}
function init(){
 if($('axCloudButton'))return;
 const b=document.createElement('button');b.id='axCloudButton';b.textContent='☁ Cloud Sync';b.style.cssText='position:fixed;bottom:12px;right:12px;z-index:9998;padding:12px;border-radius:20px;background:#0b4961;color:white';
 b.onclick=panel;document.body.appendChild(b);
 boot();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
