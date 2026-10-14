/* Aerovex ERP owner sign-in. Existing local records are never deleted or overwritten. */
(function(){
'use strict';
const BASE='https://gfdqzyhhpbhvubpwdxdi.supabase.co';
const KEY='sb_publishable_EXF3rH1gM0bMF6yhGWiUig_XsCa3MrM';
const OWNER='aerovexfiltration@gmail.com';
const STORE='ax-erp-owner-session-v1';
const dataKey='aerovex-erp-data-v1';
const style=document.createElement('style');
style.textContent='#axAuthGate{position:fixed;inset:0;z-index:2147483646;background:#073c52;color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Arial,sans-serif}#axAuthGate .axCard{background:#fff;color:#15354b;border-radius:16px;padding:25px;max-width:390px;width:100%;box-shadow:0 12px 50px #0006}#axAuthGate input{display:block;width:100%;box-sizing:border-box;padding:13px;margin:10px 0;border:1px solid #aab9c3;border-radius:8px;font-size:16px}#axAuthGate button{padding:12px;border:0;border-radius:8px;background:#0b4961;color:white;margin:5px 3px 5px 0}#axAuthGate p{font-size:13px;line-height:1.5}body.axAuthLocked>header,body.axAuthLocked>nav,body.axAuthLocked>main,body.axAuthLocked>#modal{visibility:hidden!important}';
document.head.appendChild(style);
document.documentElement.style.visibility='hidden';
let session=null;
function saveBackup(){
 const data=localStorage.getItem(dataKey)||'{}';
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='aerovex-local-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function request(path,body){
 const r=await fetch(BASE+'/auth/v1/'+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(j.msg||j.error_description||j.message||'Authentication failed');
 return j;
}
async function valid(access){
 const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+access}});
 if(!r.ok)return false;
 const u=await r.json();return (u.email||'').toLowerCase()===OWNER;
}
function unlock(s){
 session=s;sessionStorage.setItem(STORE,JSON.stringify(s));
 document.body.classList.remove('axAuthLocked');
 document.getElementById('axAuthGate')?.remove();
 document.documentElement.style.visibility='';
 addLogout();
}
function addLogout(){
 if(document.getElementById('axLogout'))return;
 const b=document.createElement('button');b.id='axLogout';b.textContent='🔒 Logout';
 b.style.cssText='position:fixed;bottom:12px;left:12px;z-index:9998;padding:12px;border-radius:20px;background:#0b4961;color:white;border:1px solid white';
 b.onclick=()=>{sessionStorage.removeItem(STORE);location.reload()};
 document.body.appendChild(b);
}
function gate(){
 document.body.classList.add('axAuthLocked');
 const el=document.createElement('div');el.id='axAuthGate';
 el.innerHTML='<div class="axCard"><h2>AEROVEX FILTRATION</h2><strong>Secure Admin Login</strong><p>Only the authorized admin email can sign in. Existing device records are not erased.</p><input id="axAuthEmail" type="email" autocomplete="username" value="'+OWNER+'" readonly><input id="axAuthPass" type="password" autocomplete="current-password" placeholder="Password (minimum 6 characters)"><button id="axAuthLogin">Login</button><button id="axAuthSignup">Create Admin Account</button><button id="axAuthBackup" type="button">Download Data Backup</button><p id="axAuthStatus" role="status">Sign in to open ERP.</p></div>';
 document.body.appendChild(el);
 const status=el.querySelector('#axAuthStatus');
 async function go(kind){
  const password=el.querySelector('#axAuthPass').value;
  if(password.length<6){status.textContent='Enter password of at least 6 characters.';return}
  status.textContent='Checking secure login...';
  try{
   const s=await request(kind==='login'?'token?grant_type=password':'signup',{email:OWNER,password});
   if(s.access_token&&await valid(s.access_token))unlock(s);
   else status.textContent='Account request submitted. If email confirmation is enabled, confirm the email, then Login. No data changed.';
  }catch(e){status.textContent=e.message}
 }
 el.querySelector('#axAuthLogin').onclick=()=>go('login');
 el.querySelector('#axAuthSignup').onclick=()=>go('signup');
 el.querySelector('#axAuthBackup').onclick=saveBackup;
 document.documentElement.style.visibility='';
}
async function init(){
 let s;try{s=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch(e){}
 if(s&&s.access_token&&await valid(s.access_token)){unlock(s);return}
 sessionStorage.removeItem(STORE);gate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();