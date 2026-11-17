/* Read-only CI regression preflight. No network, data mutations or credentials. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const file=path=>new URL('../'+path,import.meta.url);
let checked=0;
function ok(condition,message){assert.ok(condition,message);checked++;console.log('✓ '+message);}
function has(path,needle){ok(text(path).includes(needle),path+' includes '+needle);}
const html=text('index.html');
const jsFiles=[...new Set([...html.matchAll(/"([a-z0-9/-]+\.js)(?:\?v=\d+)?"/gi)].map(x=>x[1]))];
jsFiles.push('app.js');
for(const p of new Set(jsFiles)){
  ok(existsSync(file(p)),'Required ERP script exists: '+p);
  try{new Script(text(p),{filename:p})}catch(e){throw new Error('ERP script syntax failure: '+p+'\n'+e.message)}
  checked++;
}
ok(jsFiles.length>=35,'Aerovex core module loader remains complete');
has('app.js','function nextWO');
has('app.js','function saveInvoice');
has('app.js','db.workOrders.push');
has('app.js','db.invoices.push');
has('aerovex-cloud-sync.js','updated_at=eq.');
has('aerovex-cloud-sync.js','BASELINE_KEY');
has('aerovex-cloud-sync.js','function stop(');
has('aerovex-storage-recovery-v1.js','IndexedDB');
has('safe-restore.js','Safe merge');
has('aerovex-quotation-reservation-v1.js','nextAvailable');
has('erp-health.js','axERPHealth');
has('aerovex-demo-test-v1.js','Read-only');
has('aerovex-afx-product-master-v1.js','AFX');
ok(html.includes('aerovex-cloud-sync.js'),'Cloud sync loader has not been removed');
ok(html.includes('aerovex-storage-recovery-v1.js'),'Recovery loader has not been removed');
console.log('Aerovex read-only safety checks passed: '+checked);
