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
const BASELINE_KEY='aerovex-sync-baseline-v1',PAIRED_KEY='aerovex-sync-paired-role-v1';
const IS_MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
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
    status('Owner verified. Connect / Join this device with existing Cloud (backup first).');
    await loadState();
  }catch(e){sessionClear();status('Login failed: '+e.message)}
}
async function cloud(){
  if(!session?.user?.id)throw Error('Please sign in.');
  const r=await send('/rest/v1/erp_snapshots?select=payload,updated_at&user_id=eq.'+encodeURIComponent(session.user.id)+'&limit=1');
  return Array.isArray(r)?r[0]||null:null;
}
function role(value){if(value==='mobile'||value==='pc')sessionStorage.setItem(DEVICE,value)}
async function markSynced(data,cloudStamp){
 // Preserve a verified common ancestor in IndexedDB for safe cross-device
 // three-way merges, even after browser/ERP restart.
 const prior={payload:data,stamp:cloudStamp};
 localStorage.setItem(BASELINE_KEY,JSON.stringify(prior));
 localStorage.setItem(PAIRED_KEY,IS_MOBILE?'mobile':'pc');
 if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
 baseline=stable(data);
 stamp=cloudStamp;
}
function savedBaseline(){
 try{
  const v=JSON.parse(localStorage.getItem(BASELINE_KEY)||'null');
  if(v&&v.payload&&typeof v.payload==='object'&&!Array.isArray(v.payload)&&v.stamp)return v;
 }catch(_){}
 return null;
}
/* Before first device pairing, combine only genuinely non-conflicting records.
 * No missing customer, invoice, challan, PO or stock record is discarded.
 * Ambiguous entries / conflicting edits require manual review.
 */
function invoiceIdentityMismatch(a,b){
 const seen=new Map();
 for(const x of [...(Array.isArray(b)?b:[]),...(Array.isArray(a)?a:[])]){
  const source=String(x?.sourceChallan||'').trim().toUpperCase();
  const party=String(x?.party||'').trim().toUpperCase();
  if(!source||!party)continue;
  const identity=party+'|'+source,number=String(x.documentNo||x.invoiceNo||'').trim().toUpperCase();
  const previous=seen.get(identity);
  if(previous&&previous!==number)throw Error('Same delivery challan '+source+' for '+party+' has different invoice numbers '+previous+' and '+number+'. Resolve Invoice numbering before Join.');
  seen.set(identity,number);
 }
}
function firstJoinMerge(mine,remote){
 const out={},keys=new Set([...Object.keys(remote),...Object.keys(mine)]);
 const ambiguous=new Set(['cutting','departmentWork','packing','receipts','payments','expenses','ledger']);
 for(const k of keys){
  const a=mine[k],b=remote[k];
  if(a===undefined){out[k]=b;continue}
  if(b===undefined){out[k]=a;continue}
  if(stable(a)===stable(b)){out[k]=b;continue}
  if(Array.isArray(a)&&Array.isArray(b)){
   if(k==='invoices')invoiceIdentityMismatch(a,b);
   if(ambiguous.has(k)){
    const prefix=(left,right)=>left.length<=right.length&&left.every((x,i)=>stable(x)===stable(right[i]));
    if(prefix(a,b)){out[k]=b;continue}
    if(prefix(b,a)){out[k]=a;continue}
    throw Error(k+' contains unsynced entries without unique IDs. Data is safe; manual reconciliation required.');
   }
   const merged=b.slice(),known=new Map();
   for(const x of b){const key=id(k,x);if(known.has(key)&&stable(known.get(key))!==stable(x))
      throw Error(k+' has conflicting duplicate identifiers in Cloud');
     known.set(key,x);
   }
   for(const x of a){
    const key=id(k,x),prior=known.get(key);
    if(prior){
     if(stable(prior)!==stable(x))
      throw Error(k+': same document or master ID contains different data on each device. Not overwritten.');
    }else{merged.push(x);known.set(key,x)}
   }
   out[k]=merged;
   continue;
  }
  // Company/tax/banking settings cannot silently choose one side.
  throw Error(k+' settings differ between this device and Cloud. Back up both and reconcile.');
 }
 return out;
}
function stop(reason){paused=true;online=false;clearInterval(timer);timer=null;status('⚠ '+reason+' No data was replaced. Back up both devices before resolving.')}
function modalIsOpen(){const m=$('modal');return m&&!m.classList.contains('hidden')}
function isLocked(){return document.body?.classList.contains('axAuthLocked')}
async function setCurrent(payload){
  // The previous value remains intact if a localStorage setItem exceeds quota.
  // Avoid keeping a SECOND full-sized ERP JSON in the small localStorage quota.
  // User-initiated full backups and verified IndexedDB archives remain available.
  const serialized=JSON.stringify(payload);
  try{
    localStorage.setItem(LOCAL,serialized);
    if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  }catch(e){throw Error('Device storage failed; previous ERP records intact: '+(e?.message||e))}
  if(typeof db!=='undefined'&&db&&typeof db==='object'){
    const safe=typeof blank==='function'?Object.assign(blank(),payload):payload;
    for(const k of Object.keys(db))delete db[k];
    Object.assign(db,safe);
    if(typeof render==='function')render();
  }
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


/* Owner-initiated recovery for an older cloud snapshot.
   Never runs automatically. Archives BOTH copies locally before conditional
   update and refuses if the cloud has any records missing on this mobile.
   The source/mobile copy remains unchanged. */
function archiveCloud(row){
  const when=new Date().toISOString().replace(/[:.]/g,'-');
  const documentBackup=JSON.stringify({application:'Aerovex ERP',kind:'PreviousCloudSnapshot',updated_at:row.updated_at,payload:row.payload},null,2);
  localStorage.setItem('aerovex-previous-cloud-'+when,documentBackup);
  const url=URL.createObjectURL(new Blob([documentBackup],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;a.download='Aerovex-CLOUD-PRE-RECOVERY-'+when+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function conflictsById(cloudData,sourceData){
  const changed=[];
  for(const [k,arr]of Object.entries(cloudData)){
    if(!Array.isArray(arr))continue;
    const ours=Array.isArray(sourceData[k])?sourceData[k]:[];
    const ix=new Map(ours.map(x=>[id(k,x),x]));
    for(const x of arr)if(ix.has(id(k,x))&&stable(ix.get(id(k,x)))!==stable(x))
      changed.push(k+': '+String(x.documentNo||x.quotationNo||x.workNo||x.invoiceNo||x.name||x.party||id(k,x)).slice(0,90));
  }
  return changed;
}
function duplicatedIds(data){
  const duplicate=[];
  for(const [k,arr]of Object.entries(data)){
    if(!Array.isArray(arr))continue;
    const ids=new Set();
    for(const x of arr){const key=id(k,x);if(ids.has(key))duplicate.push(k+': '+key.slice(0,60));ids.add(key)}
  }
  return duplicate;
}
async function repairOldCloud(){
  if(!session)return status('Sign in first.');
  if(busy)return status('A sync request is running. Try again in a few seconds.');
  busy=true;
  try{
    const prior=await cloud();
    if(!prior)return status('No existing cloud snapshot. Use Mobile Initialize instead.');
    const source=local();
    const remoteOnly=localOnly(prior.payload,source);
    if(remoteOnly.length)return status('⛔ Recovery blocked: cloud has '+remoteOnly.length+' entries missing on mobile. Examples: '+remoteOnly.slice(0,3).join('; ')+'. Save both backups and reconcile.');
    const unmapped=Object.keys(prior.payload).filter(k=>!Object.prototype.hasOwnProperty.call(source,k)&&!Array.isArray(prior.payload[k]));
    if(unmapped.length)return status('⛔ Recovery blocked: mobile lacks cloud settings '+unmapped.slice(0,5).join(', ')+'. Review before continuing.');
    const duplicates=duplicatedIds(source);
    if(duplicates.length)return status('⛔ Recovery blocked: mobile has duplicate identifiers: '+duplicates.slice(0,3).join('; '));
    if(stable(prior.payload)===stable(source))return status('Both copies already match. Choose Resume / Verify Auto Sync.');
    const changed=conflictsById(prior.payload,source);
    const details='Older cloud dated '+prior.updated_at+'. '+changed.length+' overlapping entries have different content. Mobile values will be used for these. Cloud records missing on mobile: 0.';
    if(!confirm('MOBILE ONLY — do NOT do this from PC.\n'+details+'\nDownload mobile and old cloud safety backups before proposing an update?'))return status('Cancelled. Cloud and this device unchanged.');
    backup();
    archiveCloud(prior);
    if(!confirm('Both safety backups requested. Confirm this MOBILE has the most complete verified Aerovex data. Replace ONLY the OLD cloud copy with this MOBILE data? All other PC-only entries must be reviewed separately.'))return status('Cancelled. Both backups were prepared; cloud unchanged.');
    const where='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&updated_at=eq.'+encodeURIComponent(prior.updated_at)+'&select=updated_at';
    const result=await send(where,'PATCH',{payload:source,updated_at:new Date().toISOString()},{Prefer:'return=representation'});
    if(!Array.isArray(result)||result.length!==1)return stop('Cloud changed while preparing recovery. Nothing overwritten. Save latest backups before retrying.');
    role('mobile');baseline=stable(source);stamp=result[0].updated_at;paused=false;online=true;start();
    status('✓ Old cloud replaced with the verified Mobile copy. No mobile records deleted. On PC choose Join after taking its Backup.');
  }catch(e){status('Recovery did not complete: '+e.message+'. Do NOT restore anything until backups checked.')}
  finally{busy=false}
}

/* Conservative three-way merge for concurrent use of Mobile and PC.
   Unchanged records retain their exact values. Concurrent edits to the same
   existing record never merge silently. New records must have unique IDs.
   Changes to distinct top-level modules can merge without conflict. */
function mergeData(before,ours,theirs){
  const result={},keys=new Set([...Object.keys(before),...Object.keys(ours),...Object.keys(theirs)]);
  for(const k of keys){
    const original=before[k],mine=ours[k],cloudVal=theirs[k];
    const mineChanged=stable(mine)!==stable(original);
    const cloudChanged=stable(cloudVal)!==stable(original);
    let value;
    if(!mineChanged)value=cloudVal;
    else if(!cloudChanged)value=mine;
    else if(stable(mine)===stable(cloudVal))value=mine;
    else if((original===undefined||Array.isArray(original))&&Array.isArray(mine)&&Array.isArray(cloudVal)){
      // Safe auto merge of append-only records only. Modified/deleted historic
      // records need human review; merging them risks incorrect GST/stock.
      const originalEntries=Array.isArray(original)?original:[];
      const length=originalEntries.length;
      const prefixOkay=a=>a.length>=length&&originalEntries.every((v,i)=>stable(v)===stable(a[i]));
      if(!prefixOkay(mine)||!prefixOkay(cloudVal))throw Error(k+': both devices changed existing entries');
      const addedMine=mine.slice(length),addedCloud=cloudVal.slice(length);
      // Customer/Supplier cloud import can add the EXACT same record on both
      // devices. Deduplicate only those identical new master entries;
      // differing records and all other duplicate document IDs still stop sync.
      const ids=new Map(originalEntries.map(x=>[id(k,x),{record:x,original:true}]));
      const additions=[];
      for(const x of [...addedCloud,...addedMine]){
        const identity=id(k,x),prior=ids.get(identity);
        if(prior){
          if((k==='parties'||k==='suppliers'||k==='salesOrders')&&!prior.original&&stable(prior.record)===stable(x))continue;
          throw Error(k+': duplicate or conflicting entry ID on both devices');
        }
        ids.set(identity,{record:x,original:false});
        additions.push(x);
      }
      value=originalEntries.concat(additions);
    }
    else throw Error(k+': both devices edited the same setting or record');
    if(value!==undefined)result[k]=value;
  }
  return result;
}
async function mergeConcurrent(cloudRow,ourSnapshot){
  if(modalIsOpen())return status('Both devices have updates. Save and close the open form before safe merge.');
  let combined;
  try{combined=mergeData(JSON.parse(baseline),JSON.parse(ourSnapshot),cloudRow.payload)}
  catch(e){return stop('Conflict needs review — '+e.message+'.')}
  // Don't accidentally remove any locally saved record.
  const missing=localOnly(JSON.parse(ourSnapshot),combined);
  if(missing.length)return stop('Safety check: merged data misses '+missing.length+' local entries.');
  const newData=stable(combined);
  if(newData!==stable(cloudRow.payload)){
    const at=new Date().toISOString();
    const where='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&updated_at=eq.'+encodeURIComponent(cloudRow.updated_at)+'&select=updated_at';
    const updated=await send(where,'PATCH',{payload:combined,updated_at:at},{Prefer:'return=representation'});
    if(!Array.isArray(updated)||updated.length!==1)return status('Cloud changed during merge. Retrying safely on next sync.');
    await setCurrent(combined);await markSynced(combined,updated[0].updated_at);
  }else{
    await setCurrent(cloudRow.payload);await markSynced(cloudRow.payload,cloudRow.updated_at);
  }
  status('✓ Both devices updated — different entries merged safely at '+date());
}

async function initial(){
  if(!session)return status('Sign in first.');
  if(!confirm('Initialize Cloud using THIS device as starting data? This will not delete any existing cloud data. First download a backup.'))return;
  try{
    backup();
    const c=await cloud();
    if(c)return status('Cloud already has records. Initialization refused to prevent overwriting. Use Join on PC only after checking.');
    const data=local();
    const r=await send('/rest/v1/erp_snapshots?on_conflict=user_id','POST',{user_id:session.user.id,payload:data,updated_at:new Date().toISOString()},{Prefer:'resolution=ignore-duplicates,return=representation'});
    if(!Array.isArray(r)||r.length!==1)throw Error('Cloud already initialized elsewhere. Data not changed.');
    role(IS_MOBILE?'mobile':'pc');await markSynced(data,r[0].updated_at);paused=false;online=true;start();
    status('✓ Mobile source uploaded safely. PC can now join. Auto Sync checks every 8 seconds while open.');
  }catch(e){stop('Mobile initialization failed: '+e.message)}
}

/* NAKSH AFX/INV/003 vs existing PRAGNA voucher 003:
 * A user-confirmed, two-phase reconciliation. All local and cloud records
 * are included in ONE safety bundle before any change; no generic overwrite.
 */
let pendingNakshRepair=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const partyNaksh=v=>String(v?.party||'').trim().toUpperCase()==='NAKSH ENTERPRISE';
const docNumber=v=>String(v?.documentNo||v?.invoiceNo||'').trim();
function unique(rows,predicate,label){
 const matches=(Array.isArray(rows)?rows:[]).filter(predicate);
 if(matches.length!==1)throw Error(label+': expected exactly one record; found '+matches.length);
 return matches[0];
}
function orderForComparison(order){
 const x=clone(order);
 delete x.delivery;delete x.shipToAddress;
 if(!Array.isArray(x.items)||x.items.length!==1)throw Error('NAKSH order line count changed. Manual review required.');
 delete x.items[0].moc;delete x.items[0].size;
 return x;
}
function buildNakshRepair(localBefore,cloudBefore){
 const mine=clone(localBefore),theirs=clone(cloudBefore);
 const OLD='AFX/INV/003',NEW='AFX/INV/004';
 const inv=unique(mine.invoices,x=>docNumber(x)===OLD&&partyNaksh(x),'Local NAKSH Invoice 003');
 if(inv.sourceChallan!=='AFX/DC/004'||Number(inv.total)!==13765.5||
    String(inv.gstin||'')!=='24AAUFN6527B1Z7')
  throw Error('NAKSH Invoice details changed. Safe repair requires manual review.');
 unique(mine.challans,x=>x.documentNo==='AFX/DC/004'&&partyNaksh(x),'Local NAKSH Challan 004');
 unique(mine.workOrders,x=>x.workNo==='AFX-WO-0008'&&partyNaksh(x),'Local NAKSH Work Order 0008');
 const voucher=unique(mine.vouchers,x=>x.no===OLD&&x.type==='Sales'&&partyNaksh(x),'Local NAKSH Sales Voucher 003');
 if(Number(voucher.debit)!==13765.5)throw Error('NAKSH Voucher amount mismatch. No data changed.');
 const pragna=unique(theirs.vouchers,x=>x.no===OLD&&x.type==='Sales'&&
   String(x.party||'').toLowerCase().includes('pragna'),'Existing Cloud Pragna Sales Voucher 003');
 if(Number(pragna.debit)!==4720)throw Error('Cloud Pragna Voucher differs. Manual review required.');
 if([mine,theirs].some(o=>(o.invoices||[]).some(x=>docNumber(x)===NEW)||
    (o.vouchers||[]).some(x=>x.no===NEW&&x.type==='Sales')))
  throw Error('Invoice 004 already exists. No automatic renumber is permitted.');
 if((theirs.invoices||[]).some(x=>partyNaksh(x)))
  throw Error('NAKSH Invoice already present in Cloud. No duplicate upload allowed.');
 if((theirs.challans||[]).some(x=>x.documentNo==='AFX/DC/004')||
    (theirs.workOrders||[]).some(x=>x.workNo==='AFX-WO-0008'))
  throw Error('Cloud already includes NAKSH production or challan records. Verify before merging.');
 const localSO=unique(mine.salesOrders,x=>x.documentNo==='AFX/SO/004'&&partyNaksh(x),'Laptop NAKSH SO 004');
 const cloudSO=unique(theirs.salesOrders,x=>x.documentNo==='AFX/SO/004'&&partyNaksh(x),'Cloud NAKSH SO 004');
 if(stable(orderForComparison(localSO))!==stable(orderForComparison(cloudSO)))
  throw Error('NAKSH SO has unexpected differences beyond approved Delivery, Ship To, MOC, and Size. Manual review required.');
 if(Number(localSO.total)!==13765.5||Number(cloudSO.total)!==13765.5)
  throw Error('Sales Order totals differ. Nothing changed.');
 // Only confirmed spelling/specification fields differ. PC values have
 // complete MOC, size, ship-to and delivery details; preserve those exact values.
 theirs.salesOrders[theirs.salesOrders.findIndex(x=>x.documentNo==='AFX/SO/004')]=clone(localSO);
 inv.documentNo=NEW;inv.invoiceNo=NEW;
 voucher.no=NEW; // Do NOT change the old Pragna 003 voucher.
 const merged=firstJoinMerge(mine,theirs);
 const invoices=(merged.invoices||[]).filter(x=>docNumber(x)===NEW&&partyNaksh(x));
 const preservedPragna=(merged.vouchers||[]).filter(x=>x.no===OLD&&x.type==='Sales'&&
   String(x.party||'').toLowerCase().includes('pragna'));
 if(invoices.length!==1||preservedPragna.length!==1||
    !(merged.vouchers||[]).some(x=>x.no===NEW&&partyNaksh(x))||
    !(merged.challans||[]).some(x=>x.documentNo==='AFX/DC/004'&&partyNaksh(x))||
    !(merged.workOrders||[]).some(x=>x.workNo==='AFX-WO-0008'&&partyNaksh(x)))
  throw Error('Post-merge checks failed. No data changed.');
 // No original unique record from either side may disappear.
 const oldLocalInvIds=new Set((localBefore.invoices||[]).filter(x=>!partyNaksh(x)).map(docNumber));
 const mergedInvIds=new Set((merged.invoices||[]).map(docNumber));
 for(const no of oldLocalInvIds)if(!mergedInvIds.has(no))throw Error('A local invoice is missing: '+no);
 for(const x of (cloudBefore.invoices||[]))
  if(!mergedInvIds.has(docNumber(x)))throw Error('A Cloud invoice is missing: '+docNumber(x));
 return merged;
}
function downloadNakshSafetyBundle(info){
 const raw=JSON.stringify({
  application:'Aerovex ERP',type:'Pre-Reconciliation Safety Backup',
  generatedAt:new Date().toISOString(),
  instructions:'Contains BOTH snapshots before any change, plus a proposed merge. Keep this file safe.',
  proposedCorrection:'NAKSH Invoice/Voucher AFX/INV/003 to AFX/INV/004; preserve Pragna 003',
  deviceBefore:info.localBefore,
  cloudBefore:{updated_at:info.cloudBefore.updated_at,payload:info.cloudBefore.payload},
  proposedMergedData:info.merged
 });
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;
 a.download='Aerovex-NAKSH-Reconciliation-SAFETY-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
async function prepareNakshRepair(){
 if(!session)return status('Sign in as Owner first.');
 if(busy)return status('Wait for the running sync operation.');
 if(window.axERPStorageBridge)try{await window.axERPStorageBridge.flush()}catch(e){return status('Device storage error: '+e.message+'. Repair blocked.')}
 busy=true;pendingNakshRepair=null;
 const applyButton=$('axNakshApply');
 if(applyButton)applyButton.disabled=true;
 try{
  const row=await cloud();
  if(!row)return status('Cloud snapshot not found. Nothing changed.');
  const device=local();
  const merged=buildNakshRepair(device,row.payload);
  pendingNakshRepair={localBefore:device,cloudBefore:row,merged};
  downloadNakshSafetyBundle(pendingNakshRepair);
  if(applyButton)applyButton.disabled=false;
  status('✓ SAFE MERGE PREPARED (NOT APPLIED). NAKSH Invoice 003 → 004; Pragna 003 kept. Download the SAFETY JSON and verify it exists in Downloads. Then click Apply Verified Repair.');
 }catch(e){status('Repair preview blocked safely: '+e.message+'. No Cloud/device data changed.')}
 finally{busy=false}
}
async function applyNakshRepair(){
 if(!session)return status('Sign in as Owner first.');
 if(busy||!pendingNakshRepair)return status('Prepare the safety merge and download backup first.');
 if(!confirm('CONFIRM: SAFETY JSON exists in Downloads. Renumber ONLY NAKSH Invoice and its Sales Voucher from AFX/INV/003 to AFX/INV/004, keep the existing Pragna 003 voucher, and merge missing NAKSH Work Order/Challan/Invoice into the shared Cloud. Proceed?'))
  return status('Cancelled. No data changed.');
 busy=true;paused=true;online=false;clearInterval(timer);timer=null;
 const info=pendingNakshRepair;
 try{
  if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  if(stable(local())!==stable(info.localBefore))
   throw Error('Laptop/mobile ERP data changed after backup. Prepare a NEW safety merge.');
  const latest=await cloud();
  if(!latest||latest.updated_at!==info.cloudBefore.updated_at||
    stable(latest.payload)!==stable(info.cloudBefore.payload))
   throw Error('Cloud changed after preview. Prepare a NEW safety merge.');
  // Re-evaluate the exact amendment under the verified snapshots.
  const checked=buildNakshRepair(local(),latest.payload);
  if(stable(checked)!==stable(info.merged))throw Error('Reconciliation verification failed. Nothing changed.');
  const where='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+
    '&updated_at=eq.'+encodeURIComponent(latest.updated_at)+'&select=updated_at';
  const result=await send(where,'PATCH',{payload:checked,updated_at:new Date().toISOString()},
    {Prefer:'return=representation'});
  if(!Array.isArray(result)||result.length!==1)
   throw Error('Cloud changed during repair. Recheck before retry.');
  const verified=await cloud();
  if(!verified||stable(verified.payload)!==stable(checked))
   throw Error('Cloud read-back did not match. Do not repeat; review Cloud status.');
  await setCurrent(checked);
  role(IS_MOBILE?'mobile':'pc');
  await markSynced(checked,verified.updated_at);
  paused=false;online=true;start();pendingNakshRepair=null;
  const applyButton=$('axNakshApply');if(applyButton)applyButton.disabled=true;
  status('✓ VERIFIED: NAKSH Invoice AFX/INV/004, original Pragna Voucher 003 retained. Missing Work Order + Challan + Invoice merged. Cloud and '+(IS_MOBILE?'Mobile':'Laptop')+' now match; two-way Sync ON.');
 }catch(e){
  status('⚠ Repair stopped: '+e.message+'. Keep your SAFETY JSON. Check both copies before repeating.');
  pendingNakshRepair=null;const applyButton=$('axNakshApply');if(applyButton)applyButton.disabled=true;
 }finally{busy=false}
}
/* Resolve only an already-verified mobile NAKSH 003 against the existing
 * correct Cloud NAKSH 004. No Cloud write, no original invoice deletion.
 * Both versions are exported before a separate explicit Apply action. */
let preparedMobileNaksh=null;
function verifiedMobileNakshAlignment(device,cloudSnapshot){
 const mine=clone(device),remote=cloudSnapshot;
 const old=unique(mine.invoices,x=>docNumber(x)==='AFX/INV/003'&&partyNaksh(x),'Mobile NAKSH Invoice 003');
 const authoritative=unique(remote.invoices,x=>docNumber(x)==='AFX/INV/004'&&partyNaksh(x),'Cloud NAKSH Invoice 004');
 if((mine.invoices||[]).some(x=>docNumber(x)==='AFX/INV/004'))
  throw Error('Mobile already has Invoice 004; please recheck before importing.');
 if(String(old.sourceChallan||'')!=='AFX/DC/004'||String(authoritative.sourceChallan||'')!=='AFX/DC/004')
  throw Error('NAKSH source Challan differs; cannot align automatically.');
 old.documentNo='AFX/INV/004';old.invoiceNo='AFX/INV/004';
 if(stable(old)!==stable(authoritative))
  throw Error('Mobile and Cloud NAKSH Invoice details differ beyond number. Do NOT overwrite; send current backup for comparison.');
 const oldVoucher=unique(mine.vouchers,x=>x.type==='Sales'&&x.no==='AFX/INV/003'&&partyNaksh(x),'Mobile NAKSH Voucher 003');
 const newVoucher=unique(remote.vouchers,x=>x.type==='Sales'&&x.no==='AFX/INV/004'&&partyNaksh(x),'Cloud NAKSH Voucher 004');
 if((mine.vouchers||[]).some(x=>x.type==='Sales'&&x.no==='AFX/INV/004'))
  throw Error('Mobile has another Invoice Voucher 004; manual review required.');
 oldVoucher.no='AFX/INV/004';
 if(stable(oldVoucher)!==stable(newVoucher))
  throw Error('NAKSH voucher details differ beyond invoice number. No data changed.');
 const pragna=(remote.vouchers||[]).filter(x=>x.type==='Sales'&&x.no==='AFX/INV/003'&&
  /pragna/i.test(String(x.party||'')));
 if(pragna.length!==1)throw Error('Pragna original Invoice Voucher 003 missing in Cloud. No update allowed.');
 const reconciled=firstJoinMerge(mine,remote);
 if(stable(reconciled)!==stable(remote))
  throw Error('Other mobile-only records or differences remain. No mobile data was replaced; send a current phone backup for detailed reconciliation.');
 return {aligned:mine,cloudCopy:clone(remote)};
}
function exportMobileNakshSafety(info){
 const pack={
  application:'Aerovex ERP',kind:'MOBILE NAKSH 003 to CLOUD 004 — SAFETY BACKUP',
  createdAt:new Date().toISOString(),
  notice:'Mobile and Cloud copies BEFORE any changes; no Cloud data will be modified by this operation.',
  phoneOriginal:info.before,
  cloudOriginal:{updated_at:info.cloud.updated_at,payload:info.cloud.payload}
 };
 const url=URL.createObjectURL(new Blob([JSON.stringify(pack)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;
 a.download='Aerovex-MOBILE-NAKSH-003-TO-004-SAFETY-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
async function prepareMobileNaksh(){
 if(!session)return status('Sign in as Owner first.');
 if(busy)return status('Sync is busy. Wait, then retry.');
 busy=true;preparedMobileNaksh=null;
 const apply=$('axMobileNakshApply');if(apply)apply.disabled=true;
 try{
  if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  const current=local(),row=await cloud();
  if(!row)throw Error('Cloud unavailable; no action taken.');
  verifiedMobileNakshAlignment(current,row.payload);
  preparedMobileNaksh={before:current,cloud:row};
  exportMobileNakshSafety(preparedMobileNaksh);
  if(apply)apply.disabled=false;
  status('✓ MOBILE SAFE PREVIEW: NAKSH 003 is same Invoice as Cloud 004. Phone + Cloud safety JSON download requested. CONFIRM saved in Downloads, then click 4B Apply Mobile Alignment. Nothing changed yet.');
 }catch(e){status('Mobile preview blocked: '+e.message+'. Device and Cloud unchanged.')}
 finally{busy=false}
}
async function applyMobileNaksh(){
 if(!session||!preparedMobileNaksh)return status('First prepare and download mobile safety backup using 4A.');
 if(busy)return status('Sync is busy; wait and retry.');
 if(!confirm('Do you have the new MOBILE SAFETY JSON file in Downloads? This will align Mobile NAKSH invoice/voucher 003 to existing verified Cloud 004, keeping all other records. Cloud will NOT be changed. Continue?'))
  return status('Mobile alignment cancelled. Data untouched.');
 busy=true;paused=true;online=false;clearInterval(timer);timer=null;
 try{
  if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
  const now=local(),row=await cloud();
  if(stable(now)!==stable(preparedMobileNaksh.before))throw Error('Phone changed since preview. Run 4A again.');
  if(!row||row.updated_at!==preparedMobileNaksh.cloud.updated_at||
     stable(row.payload)!==stable(preparedMobileNaksh.cloud.payload))
    throw Error('Cloud changed since preview. Run 4A again.');
  verifiedMobileNakshAlignment(now,row.payload);
  // No Cloud write, and no locally new records can be lost: compare verified.
  await setCurrent(row.payload);
  const checked=local();
  if(stable(checked)!==stable(row.payload))
    throw Error('Mobile saved data did not match Cloud. Stop using ERP and check backup.');
  role('mobile');
  await markSynced(row.payload,row.updated_at);
  paused=false;online=true;start();
  preparedMobileNaksh=null;
  const apply=$('axMobileNakshApply');if(apply)apply.disabled=true;
  status('✓ VERIFIED: Mobile NAKSH Invoice 004 matches Cloud. Pragna 003 protected. Mobile + Laptop two-way Sync ON; no Cloud overwrite.');
 }catch(e){
  preparedMobileNaksh=null;
  const apply=$('axMobileNakshApply');if(apply)apply.disabled=true;
  status('⚠ Mobile alignment stopped: '+e.message+'. Keep both backups; no Cloud write was attempted.');
 }finally{busy=false}
}
async function join(){
 if(!session)return status('Sign in first.');
 if(busy)return status('Another sync operation is in progress. Wait a moment.');
 busy=true;
 try{
  const c=await cloud();
  if(!c)return status('Cloud is empty. Backup the most complete device, then initialize only once.');
  const mine=local();
  let merged;
  try{merged=firstJoinMerge(mine,c.payload)}
  catch(e){return stop('Join requires reconciliation: '+e.message)}
  const sameCloud=stable(merged)===stable(c.payload);
  const sameDevice=stable(merged)===stable(mine);
  if(!sameCloud||!sameDevice){
   const localOnlyList=localOnly(mine,c.payload),cloudOnlyList=localOnly(c.payload,mine);
   if(!confirm('CONNECT '+(IS_MOBILE?'MOBILE':'LAPTOP')+' TO AEROVEX CLOUD?\n'+
    'Local-only records: '+localOnlyList.length+', Cloud-only records: '+cloudOnlyList.length+
    '. This safe merge keeps both sets, with NO conflicting ID changes.\n'+
    'First download this device backup, and keep a Cloud backup. Continue?'))return status('Join cancelled. Neither data copy was changed.');
   backup();
   if(modalIsOpen())return status('Close the open form before connecting.');
  }
  let joinedStamp=c.updated_at;
  if(!sameCloud){
   const path='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+
      '&updated_at=eq.'+encodeURIComponent(c.updated_at)+'&select=updated_at';
   const response=await send(path,'PATCH',{payload:merged,updated_at:new Date().toISOString()},
      {Prefer:'return=representation'});
   if(!Array.isArray(response)||response.length!==1)
      return stop('Cloud changed while merging. No existing records overwritten. Please retry Connect / Join.');
   joinedStamp=response[0].updated_at;
   const verify=await cloud();
   if(!verify||stable(verify.payload)!==stable(merged))
      return stop('Cloud merge was not verified; do not create new entries until rechecked.');
  }
  if(!sameDevice)await setCurrent(merged);
  role(IS_MOBILE?'mobile':'pc');
  await markSynced(merged,joinedStamp);
  paused=false;online=true;start();
  status('✓ '+(IS_MOBILE?'Mobile':'Laptop')+' connected. Cloud and device records reconciled, verified; two-way sync ON.');
 }catch(e){stop('Device Connect / Join failed: '+e.message)}
 finally{busy=false}
}
async function resume(){
 if(!session)return status('Sign in first.');
 const saved=savedBaseline();
 const roleName=localStorage.getItem(PAIRED_KEY)||sessionStorage.getItem(DEVICE);
 if(!saved||!roleName)return status('This device is not yet paired. Download backup, then Connect / Join.');
 try{
  const c=await cloud();if(!c)return status('Cloud data missing. Existing local records preserved.');
  role(roleName);
  baseline=stable(saved.payload);stamp=saved.stamp;
  paused=false;online=true;start();
  // Check the live Cloud against the common ancestor. Never overwrite local edits.
  await tick();
  if(online&&!paused)status('✓ Two-way sync connected for '+(IS_MOBILE?'Mobile':'Laptop')+'; checks every 8 seconds.');
 }catch(e){stop('Resume failed: '+e.message)}
}
async function tick(){
 // Both devices sync after authenticated pairing; wait for durable writes.
 if(window.axERPStorageBridge){
   const state=window.axERPStorageBridge.status();
   if(state.error)return stop('Device IndexedDB failed: '+state.error);
   if(state.pending>0)return;
 }
 if(busy||!online||paused||!session||!stamp||document.hidden||isLocked())return;
 busy=true;
 try{
  const c=await cloud();
  if(!c)return stop('Cloud source missing.');
  const here=stable(local()),localChanged=here!==baseline,remoteChanged=c.updated_at!==stamp;
  if(localChanged&&remoteChanged)return await mergeConcurrent(c,here);
  if(remoteChanged){
   if(modalIsOpen())return status('New cloud data waiting. Close the form to refresh safely.');
   const missing=localOnly(JSON.parse(here),c.payload);
   if(missing.length)return stop('Cloud update lacks '+missing.length+' local entries — review needed.');
   await setCurrent(c.payload);await markSynced(c.payload,c.updated_at);status('✓ Downloaded latest Aerovex update at '+date());return;
  }
  if(localChanged){
   // Conditional PATCH is atomic: a competing device cannot overwrite unseen changes.
   if(window.axERPStorageBridge)await window.axERPStorageBridge.flush();
   const at=new Date().toISOString();
   const where='/rest/v1/erp_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&updated_at=eq.'+encodeURIComponent(stamp)+'&select=updated_at';
   const updated=await send(where,'PATCH',{payload:local(),updated_at:at},{Prefer:'return=representation'});
   if(!Array.isArray(updated)||updated.length!==1)return stop('Cloud changed during upload. Conflict prevented.');
   await markSynced(local(),updated[0].updated_at);status('✓ Saved this device changes to cloud at '+date());return;
  }
 }catch(e){
  // Network failures leave both copies untouched; next poll retries.
  status('Offline / waiting to reconnect: '+e.message);
 }finally{busy=false}
}
function start(){
 clearInterval(timer);timer=setInterval(tick,INTERVAL);
}
async function loadState(){
 if(!session)return;
 try{
  const c=await cloud();status(c?'Cloud exists. Pair exactly Mobile and PC.':'Cloud is empty. Initialize from Mobile.');
  if((sessionStorage.getItem(DEVICE)||localStorage.getItem(PAIRED_KEY))&&c)await resume();
 }catch(e){status('Cloud check failed: '+e.message)}
}
async function boot(){
 try{
  const data=JSON.parse(sessionStorage.getItem(SESSION)||'null')||JSON.parse(sessionStorage.getItem('ax-erp-owner-session-v1')||'null');if(!data?.access_token)return;
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
 p.innerHTML='<button type="button" id="ax2Close" style="float:right">✕</button><h3>Aerovex Cloud Sync — Mobile + PC Only</h3><p id="ax2Badge" style="font-weight:bold">○ Sync Not Ready</p><p id="ax2Status" role="status">Not connected</p><p>One shared Aerovex data set with editing on BOTH mobile and laptop. Sync checks every 8 seconds when online and paired.</p><input type="password" id="ax2Password" autocomplete="current-password" placeholder="Existing Aerovex admin password" style="padding:10px;width:95%;box-sizing:border-box"><button type="button" id="ax2Login">1. Sign in as Owner</button><hr><p><button type="button" id="ax2Backup">Download This Device Backup</button></p><p><b>First time (only after both device backups):</b></p><button type="button" id="ax2Init">2A. Initialize Cloud (ONLY IF EMPTY)</button><p><button type="button" id="ax2Join">2B. Connect / Join Device (Mobile + Laptop)</button></p><button type="button" id="ax2Resume">Resume / Verify Auto Sync</button><p><button type="button" id="ax2Repair">MOBILE ONLY: Review / Repair Old Cloud Backup</button><hr><p><b>Specific NAKSH Invoice 003 Conflict Repair</b></p><button type="button" id="axNakshPrepare" style="display:none">3A. Download Safe Merge Backup + Preview</button><p><button type="button" id="axNakshApply" style="display:none" disabled>3B. Apply Verified NAKSH Repair</button></p><p style="font-size:12px"><b>Cloud already has NAKSH 004.</b> On mobile only, use the new 4A/4B steps below. Laptop Invoice 004 stays unchanged.</p><hr><p><b>Mobile 003 → Verified Cloud 004</b></p><button type="button" id="axMobileNakshPreview">4A. Backup + Preview Mobile 003 to 004</button><p><button type="button" id="axMobileNakshApply" disabled>4B. Apply Verified Mobile Alignment</button></p></p><p style="font-size:12px;color:#a14320"><b>Safety:</b> Never restores/overwrites cloud automatically. Different new entries merge; same-record edits or duplicate numbers pause sync. No silent record deletion. Keep both backups. Do not use the setup buttons on a third device.</p>';
 document.body.appendChild(p);
 $('ax2Close').onclick=()=>p.remove();
 $('ax2Login').onclick=auth;
 $('ax2Backup').onclick=()=>{try{backup();status('Backup downloaded.')}catch(e){status(e.message)}};
 $('ax2Init').onclick=initial;
 $('ax2Join').onclick=join;
 $('ax2Resume').onclick=resume;
 $('ax2Repair').onclick=repairOldCloud;
 $('axNakshPrepare').onclick=prepareNakshRepair;
 $('axNakshApply').onclick=applyNakshRepair;
 $('axMobileNakshPreview').onclick=prepareMobileNaksh;
 $('axMobileNakshApply').onclick=applyMobileNaksh;
 status(lastMessage);
}
function init(){
 // Mobile and laptop both run the editable ERP and sync securely.
 if($('axCloudButton'))return;
 const b=document.createElement('button');b.id='axCloudButton';b.textContent='☁ Cloud Sync';b.style.cssText='position:fixed;bottom:12px;right:12px;z-index:9998;padding:12px;border-radius:20px;background:#0b4961;color:white';
 b.onclick=panel;document.body.appendChild(b);
 boot();
 window.addEventListener('ax-aerovex-owner-ready',boot);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
