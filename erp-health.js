(function(){
const required=['axPlantReports','axPlantDailySheet','axWOEdit','axWOCut'];
const faults=[];window.addEventListener('error',e=>{if(e.message)faults.push(String(e.message).slice(0,150))});
window.addEventListener('unhandledrejection',e=>faults.push(String(e.reason).slice(0,150)));
function check(){return {version:'V18',modules:required.map(k=>({name:k,ok:typeof window[k]==='function'})),storage:(()=>{try{return localStorage.getItem('aerovex-erp-data-v1')!==null?'Available':'Empty / new'}catch(e){return 'Unavailable'}})(),errors:faults.slice(-5)}}
window.axERPHealth=()=>{const d=check();const rows=d.modules.map(m=>'<tr><td>'+m.name+'</td><td>'+(m.ok?'OK':'NOT LOADED')+'</td></tr>').join('');show('ERP Diagnostics — V18','<p>Current loaded app version: <b>'+d.version+'</b></p><p>Data storage: '+d.storage+'</p><table><tr><th>Module</th><th>Status</th></tr>'+rows+'</table><p>Browser errors: '+(d.errors.length?d.errors.join(' | '):'None captured since diagnostics loaded')+'</p><button type="button" onclick="location.reload()">Reload Latest Version</button>')};
const tag=document.querySelector('.hero h1 small');if(tag)tag.textContent='V18';
const hero=document.querySelector('.hero');if(hero){const btn=document.createElement('button');btn.textContent='ERP Check / Version';btn.type='button';btn.style.margin='8px';btn.onclick=window.axERPHealth;hero.appendChild(btn)}
if(!required.every(k=>typeof window[k]==='function')){const note=document.createElement('div');note.style.cssText='padding:12px;background:#fff1d8;color:#754900;text-align:center;font-weight:700';note.textContent='Some ERP modules did not load. Click ERP Check / Version for details.';document.body.prepend(note)}
})();