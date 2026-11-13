/* Aerovex document theme studio v1: safe, read-only renderers.
 * Select a quotation or invoice, preview one of ten genuinely different A4 layouts and print/PDF.
 * Does not modify existing document records, numbers, GST or accounting.
 */
(function(){
'use strict';
if(typeof db==='undefined'||typeof show!=='function')return;
const K='aerovex-print-themes-v1';
const names={
corporate:'01 • Executive Corporate — Navy & Gold',
gst:'02 • GST Precision — Tax Invoice',
minimal:'03 • Minimal Monochrome — Clean',
modernbox:'04 • Modern Boxed — Structured',
mnc:'05 • Global MNC — Elegant',
industrial:'06 • Industrial B2B — Bold',
compact:'07 • Compact A4 — Space Saver',
ledger:'08 • Chartered Ledger — Formal',
editorial:'09 • Editorial Signature — Designer',
blueprint:'10 • Technical Blueprint — Engineering',
tally:'11 • Accounting Register — Tally-style',
sap:'12 • Enterprise Billing — SAP-style'
};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S=v=>String(v??'').trim();
const N=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const M=v=>v===undefined||v===null||v===''||N(v)===null?'Not recorded':'₹ '+N(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const current=()=>{try{const x=JSON.parse(localStorage.getItem(K)||'{}');return {quote:names[x.quote]?x.quote:'mnc',invoice:names[x.invoice]?x.invoice:'gst'}}catch(e){return {quote:'mnc',invoice:'gst'}}};
const root=()=>document.getElementById('axTSApp');
const kind=()=>document.getElementById('axTSKind')?.value==='invoice'?'invoice':'quote';
const records=k=>Array.isArray(db[k==='invoice'?'invoices':'quotations'])?db[k==='invoice'?'invoices':'quotations']:[];
const title=(x,k,i)=>S(x?.quotationNo||x?.invoiceNo||x?.documentNo||x?.no)||((k==='invoice'?'Invoice':'Quotation')+' #'+(i+1));
const rows=x=>Array.isArray(x.items)&&x.items.length?x.items:[x];
const price=z=>z?.taxable!==undefined&&z?.taxable!==null&&z?.taxable!==''&&N(z.taxable)!==null?M(z.taxable):N(z?.qty)!==null&&N(z?.rate)!==null?M(N(z.qty)*N(z.rate)*(1-(N(z.discount)||0)/100)):M(undefined);
function logo(){
 const data=localStorage.getItem('aerovex-logo-data')||'';
 return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)?'<img class="axLogo" src="'+E(data)+'" alt="Aerovex logo">':'';
}

function hasBrandLogo(){return !!logo()}
function css(theme){
 const palettes={
 corporate:['#102e4b','#c7a267','#f4f6f8'],
 gst:['#145884','#1c8bbd','#eef8fd'],
 minimal:['#1e2429','#8b9399','#fff'],
 modernbox:['#19475e','#17a3a3','#eef9fa'],
 mnc:['#17283b','#6993a8','#f6f8fa'],
 industrial:['#171f2b','#f29b38','#fff5e9'],
 compact:['#19415e','#4791b4','#f2f7fb'],
 ledger:['#282c30','#585858','#f7f7f7'],
 editorial:['#283447','#b58a5b','#faf7f2'],
 blueprint:['#102f52','#467ca6','#eef5fd']
 };
 const p=palettes[theme]||palettes.corporate;
 return [
 '.axTSPaper{--axAccent:'+p[0]+';--axLine:'+p[1]+';--axTint:'+p[2]+';font-family:Arial,Helvetica,sans-serif;color:#243240;background:white;padding:23px;max-width:800px;min-width:0;margin:auto;box-sizing:border-box;font-size:11px;line-height:1.46;box-shadow:0 2px 14px #172e4624}',
 '.axTSPaper *{box-sizing:border-box}.axTSPaper h1,.axTSPaper h2,.axTSPaper h3,.axTSPaper p{margin:0 0 7px}.axTSPaper h1{font-size:22px;color:var(--axAccent);line-height:1.2}.axTSPaper h2{font-size:14px;color:var(--axAccent);letter-spacing:.035em}.axTSPaper h3{font-size:12px}',
 '.axTSPaper .axLogo{max-width:90px;max-height:64px;object-fit:contain}.axTSPaper .axHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:4px 0 14px;border-bottom:3px solid var(--axLine)}',
 '.axTSPaper .axHeadLeft{display:flex;gap:12px;align-items:flex-start}.axTSPaper .axHeadLeft>div{min-width:0}.axTSPaper .axDocIdentity{text-align:right;min-width:130px}.axTSPaper .axDocIdentity strong{display:block;font-size:12px}',
 '.axTSPaper .axLabel{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:bold;color:#67757f;margin-bottom:5px}.axTSPaper .axMuted{font-size:10px;color:#667781}.axTSPaper .axValue{font-weight:bold}',
 '.axTSPaper .axInfo{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.axTSPaper .axInfo>div{min-width:0}.axTSPaper .axPaperCard{min-width:0;overflow-wrap:anywhere}',
 '.axTSPaper table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}.axTSPaper th,.axTSPaper td{vertical-align:top;overflow-wrap:anywhere;padding:7px 5px}.axTSPaper th{background:var(--axAccent);color:white;text-align:left;font-size:9px;letter-spacing:.03em}.axTSPaper td{border-bottom:1px solid #c8d3dc}.axTSPaper td:first-child,.axTSPaper th:first-child{width:6%}.axTSPaper td:nth-child(2),.axTSPaper th:nth-child(2){width:40%}.axTSPaper td:nth-child(3),.axTSPaper th:nth-child(3){width:13%}.axTSPaper td:nth-child(4),.axTSPaper th:nth-child(4){width:13%}.axTSPaper td:nth-child(5),.axTSPaper th:nth-child(5){width:13%}.axTSPaper td:last-child,.axTSPaper th:last-child{width:15%}.axTSPaper tr{break-inside:avoid;page-break-inside:avoid}',
 '.axTSPaper .axTotals{margin:15px 0 14px auto;max-width:330px}.axTSPaper .axTotals p{display:flex;justify-content:space-between;gap:15px;padding:3px 0;border-bottom:1px solid #e4e8eb}.axTSPaper .axGrand{background:var(--axTint);color:var(--axAccent);font-weight:800;font-size:16px;padding:10px;margin-top:7px;display:flex;gap:8px;justify-content:space-between;align-items:center}',
 '.axTSPaper .axTerms{background:var(--axTint);border-left:4px solid var(--axLine);padding:11px;margin-top:12px}.axTSPaper .axTerms div{margin:3px 0;overflow-wrap:anywhere}',
 '.axTSPaper .axBank{border:1px solid #d2dce3;border-radius:4px;padding:10px;margin-top:12px;font-size:10px}.axTSPaper .axSign{text-align:right;min-height:73px;margin:23px 0 7px;break-inside:avoid;font-size:10px}.axTSPaper .axSign b{font-size:11px}.axTSPaper .axFoot{border-top:1px solid #d9e0e5;padding-top:7px;margin-top:14px;color:#687785;font-size:9px}',
 '.axTSPaper .axTwo{display:grid;grid-template-columns:1fr 1fr;gap:17px}.axTSPaper .axDocBox{border:1px solid #d4dfe7;padding:12px}.axTSPaper .axKicker{font-size:9px;text-transform:uppercase;letter-spacing:.14em;font-weight:700;color:var(--axLine)}.axTSPaper .axBand{padding:9px 12px;background:var(--axAccent);color:white;text-transform:uppercase;letter-spacing:.14em;font-weight:bold}',
 /* #1 Executive: top-left letterhead and right-hand grand total. */
 '.axTS-corporate .axHeader{border-bottom:5px double var(--axLine)}.axTS-corporate .axInfo>div{border-top:1px solid var(--axLine);padding-top:9px}.axTS-corporate .axAmountsRow{display:grid;grid-template-columns:1fr 1fr;gap:16px}.axTS-corporate .axTotals{margin-top:12px;max-width:none}',
 /* #2 GST: official numbered document, boxed party sections, tax summary. */
 '.axTS-gst{border-top:8px solid var(--axAccent)}.axTS-gst .axHeader{border:none;border-bottom:1px solid #b3ccd9}.axTS-gst .axTaxStrip{padding:8px;background:var(--axTint);display:flex;justify-content:space-between;font-size:9px}.axTS-gst .axInfo>div{border:1px solid #a5c1d3;padding:12px}.axTS-gst td{border:1px solid #a5c1d3}.axTS-gst th{border:1px solid #216e98}.axTS-gst .axTotals{border:1px solid #c2d5e2;padding:10px;max-width:none}',
 /* #3 Minimal: whitespace, thin rules, sans backgrounds. */
 '.axTS-minimal{font-family:Arial,Helvetica,sans-serif;padding:35px;color:#1e2429}.axTS-minimal .axHeader{border:0;border-bottom:1px solid #444;padding-bottom:18px}.axTS-minimal .axHeader h1{font-weight:500;letter-spacing:.09em;font-size:19px}.axTS-minimal .axMinimalTop{display:flex;justify-content:space-between;align-items:end;gap:18px;margin:0 0 20px}.axTS-minimal .axMinimalTop h2{font-size:24px;font-weight:400}.axTS-minimal .axInfo{gap:40px;margin:24px 0 28px}.axTS-minimal table th{background:white;color:#222;border-top:1px solid #333;border-bottom:2px solid #333}.axTS-minimal td{border-bottom:1px solid #d7d7d7}.axTS-minimal .axTotals{border-top:2px solid #222}.axTS-minimal .axGrand{background:none;border-top:2px solid #222;padding-right:0}.axTS-minimal .axTerms{background:white;border-left:0;border-top:1px solid #bdbdbd;padding-left:0}',
 /* #4 Modern Box: strong full-width banner, distinct cards. */
 '.axTS-modernbox .axHero{background:var(--axAccent);color:white;padding:18px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;gap:18px}.axTS-modernbox .axHero h2,.axTS-modernbox .axHero h1{color:white}.axTS-modernbox .axMainCompany{border:1px solid #c6dadf;padding:14px;display:flex;gap:12px;align-items:flex-start}.axTS-modernbox .axInfo{margin:0 0 13px;gap:8px}.axTS-modernbox .axInfo>div{border:1px solid #c6dadf;background:#f8fcfd;padding:12px;border-radius:7px}.axTS-modernbox th{background:#246476}.axTS-modernbox td{border:1px solid #bad5da}.axTS-modernbox .axGrand{border-radius:8px}.axTS-modernbox .axAmountsRow{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
 /* #5 MNC: two-tier corporate grid, hairline data table. */
 '.axTS-mnc{font-family:Arial,Helvetica,sans-serif;padding:30px}.axTS-mnc .axTopGrid{display:grid;grid-template-columns:1.5fr .8fr;gap:30px;border-bottom:1px solid #899aa8;padding-bottom:18px}.axTS-mnc .axTopGrid h2{font-weight:400;font-size:21px;letter-spacing:.1em}.axTS-mnc .axInfo{margin:25px 0;gap:35px}.axTS-mnc .axInfo>div{border-left:2px solid var(--axLine);padding-left:12px}.axTS-mnc th{background:var(--axTint);color:var(--axAccent);border-top:2px solid var(--axAccent);border-bottom:1px solid #8fa5b5}.axTS-mnc td{border-bottom:1px solid #dce3e7;padding:12px 6px}.axTS-mnc .axAmountsRow{display:grid;grid-template-columns:1fr 1fr;gap:25px}.axTS-mnc .axTotals{max-width:none}.axTS-mnc .axGrand{background:var(--axAccent);color:white}',
 /* #6 Industrial B2B: factory-ready high-contrast engineering label. */
 '.axTS-industrial{border:2px solid #1a2531;padding:15px}.axTS-industrial .axFactoryTop{display:grid;grid-template-columns:1fr 1fr;gap:12px}.axTS-industrial .axFactoryTop .axDocIdentity{background:#1c2937;padding:12px;color:white}.axTS-industrial .axFactoryTop .axDocIdentity h2{color:#f6aa3b}.axTS-industrial .axDocBox{border:2px solid #273a4d}.axTS-industrial .axInfo{gap:0}.axTS-industrial .axInfo>div{border:1px solid #1c2a37;padding:11px}.axTS-industrial .axBand{background:#f29b38;color:#152432}.axTS-industrial th{background:#1c2937;border:1px solid #1c2937}.axTS-industrial td{border:1px solid #98a1ab}.axTS-industrial .axGrand{background:#1c2937;color:white}.axTS-industrial .axTerms{border-left:5px solid #f29b38}',
 /* #7 Compact: dense single-page utility design. */
 '.axTS-compact{padding:14px;font-size:10px;line-height:1.28}.axTS-compact .axLogo{max-width:58px;max-height:45px}.axTS-compact h1{font-size:16px}.axTS-compact h2{font-size:12px}.axTS-compact .axHeader{padding:4px 0 8px;border-bottom:2px solid var(--axAccent)}.axTS-compact .axInfo{margin:9px 0;gap:8px}.axTS-compact .axInfo>div{border:1px solid #d2e1e8;padding:7px}.axTS-compact th,.axTS-compact td{padding:4px 5px;font-size:9px}.axTS-compact .axTotals{margin:7px 0 6px auto;max-width:290px}.axTS-compact .axTotals p{margin:0;padding:2px}.axTS-compact .axGrand{padding:5px;font-size:13px}.axTS-compact .axTerms,.axTS-compact .axBank{margin:5px 0;padding:6px}.axTS-compact .axSign{margin-top:9px;min-height:45px}.axTS-compact .axFoot{margin-top:6px}',
 /* #8 Accounting ledger: classic ruled tables and centered document stamp. */
 '.axTS-ledger{font-family:Georgia,Times New Roman,serif;color:#161616;border:1px solid #323232;padding:16px}.axTS-ledger .axLedgerTitle{text-align:center;border-top:1px solid #333;border-bottom:3px double #333;margin:12px 0;padding:8px}.axTS-ledger .axLedgerTitle h2{font-size:18px;letter-spacing:.08em}.axTS-ledger .axInfo{margin:0}.axTS-ledger .axInfo>div{border:1px solid #555;padding:10px}.axTS-ledger th,.axTS-ledger td{border:1px solid #555}.axTS-ledger th{background:#e8e8e8;color:#222}.axTS-ledger .axTotals{border:1px solid #555;padding:8px}.axTS-ledger .axGrand{background:#ebebeb;border-top:2px solid #333}.axTS-ledger .axTerms{background:#fafafa;border:1px solid #777}.axTS-ledger .axFoot{border-top:1px solid #555}',
 /* #9 Editorial Signature: oversized typographic title and vertical accent. */
 '.axTS-editorial{padding:32px 27px}.axTS-editorial .axEditorialHero{display:grid;grid-template-columns:110px 1fr;gap:20px;margin:0 0 27px}.axTS-editorial .axEditorialSide{border-left:9px solid var(--axLine);padding:8px 0 8px 14px;color:var(--axAccent);font-size:36px;line-height:1;font-weight:800;overflow-wrap:anywhere}.axTS-editorial .axEditorialMain{border-bottom:2px solid var(--axLine);padding-bottom:14px}.axTS-editorial .axInfo{grid-template-columns:1.4fr 1fr;gap:25px}.axTS-editorial .axInfo>div:first-child{background:var(--axTint);padding:14px}.axTS-editorial th{background:white;color:var(--axAccent);border-bottom:3px solid var(--axLine)}.axTS-editorial td{border-bottom:1px solid #e8ded4;padding:12px 6px}.axTS-editorial .axEditorialBottom{display:grid;grid-template-columns:1.1fr 1fr;gap:20px}.axTS-editorial .axTotals{max-width:none}.axTS-editorial .axGrand{background:var(--axAccent);color:white;font-size:18px}.axTS-editorial .axTerms{border:0;background:#faf7f2}',
 /* #10 Technical Blueprint: drafting board grids and verification bar. */
 '.axTS-blueprint{border:3px solid #245b89;padding:14px;background:#fff}.axTS-blueprint .axBlueprintTop{border:1px solid var(--axLine);display:grid;grid-template-columns:1.3fr 1fr}.axTS-blueprint .axBlueprintTop>div{padding:12px}.axTS-blueprint .axBlueprintTop>div+div{border-left:1px solid var(--axLine);text-align:right}.axTS-blueprint .axBlueprintBar{background:var(--axTint);border:1px solid var(--axLine);padding:7px 11px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--axAccent)}.axTS-blueprint .axInfo{gap:0;margin:0 0 13px}.axTS-blueprint .axInfo>div{border:1px solid var(--axLine);border-top:0;padding:10px}.axTS-blueprint th{border:1px solid #467ca6}.axTS-blueprint td{border:1px solid #acc1d4}.axTS-blueprint .axGrand{border:2px solid var(--axLine)}.axTS-blueprint .axTerms{background:white;border:1px solid var(--axLine)}.axTS-blueprint .axFoot{border-top:3px double #467ca6}',
"\n/* Tally-style accounting register: ruled line columns and split tax panel */\n.axTS-tally{--axAccent:#191919;--axLine:#606060;--axTint:#f2f2f2;color:#151515;font:10px/1.45 Arial,Helvetica,sans-serif;padding:14px}.axTS-tally .axAccountingFrame{border:1.5px solid #333}\n.axTS-tally .axAccountingLabel{text-align:center;border-bottom:1px solid #333;font-size:14px;font-weight:bold;letter-spacing:.1em;padding:8px}\n.axTS-tally .axAccountingHeader{display:grid;grid-template-columns:1.35fr .65fr}.axTS-tally .axAccountingHeader>div{padding:12px;border-bottom:1px solid #333}.axTS-tally .axAccountingHeader>div+div{border-left:1px solid #333}\n.axTS-tally .axAccountingSeller{display:flex;align-items:flex-start;gap:10px}.axTS-tally .axAccountingSeller h1{font-size:19px;color:#111}.axTS-tally .axAccountingSeller .axLogo{max-width:90px}.axTS-tally .axAccountingNumber{text-align:right}.axTS-tally .axAccountingNumber>*{display:block}\n.axTS-tally .axAccountingParties{display:grid;grid-template-columns:1.2fr 1fr}.axTS-tally .axAccountingParties>section{padding:10px;border-bottom:1px solid #333}.axTS-tally .axAccountingParties>section+section{border-left:1px solid #333}.axTS-tally .axAccountingParties small,.axTS-tally .axAccountingParties section>b{display:block}\n.axTS-tally .axAccountingItems{width:100%;table-layout:fixed;border-collapse:collapse}.axTS-tally .axAccountingItems th,.axTS-tally .axAccountingItems td{padding:7px 4px;border:1px solid #555;vertical-align:top;overflow-wrap:anywhere}.axTS-tally .axAccountingItems th{background:#eee;color:#111;font-size:9px;text-align:left}\n.axTS-tally .axAccountingItems th:nth-child(1){width:5%}.axTS-tally .axAccountingItems th:nth-child(2){width:36%}.axTS-tally .axAccountingItems th:nth-child(3){width:12%}.axTS-tally .axAccountingItems th:nth-child(4){width:10%}.axTS-tally .axAccountingItems th:nth-child(5){width:13%}.axTS-tally .axAccountingItems th:nth-child(6){width:8%}.axTS-tally .axAccountingItems th:nth-child(7){width:16%}\n.axTS-tally .axAccountingBottom{display:grid;grid-template-columns:1.06fr .94fr}.axTS-tally .axAccountingBottom>section{padding:10px;border-bottom:1px solid #333}.axTS-tally .axAccountingBottom>section+section{border-left:1px solid #333}.axTS-tally .axAccountingBottom h3{font-size:10px}\n.axTS-tally .axTotals{max-width:none;margin:0}.axTS-tally .axGrand{background:#eee;color:#111;border:1px solid #777}.axTS-tally .axTerms{background:transparent;border:0;padding:5px}.axTS-tally .axBank{border:0;padding:5px}.axTS-tally .axAccountingSignature{display:flex;align-items:end;justify-content:space-between;gap:13px;padding:8px}.axTS-tally .axAccountingSignature>div:first-child{max-width:50%;font-size:9px}.axTS-tally .axAccountingSignature .axSign{margin:0;min-height:55px}\n/* SAP-style enterprise grid: metadata bands, line-item codes, quantity and net pricing */\n.axTS-sap{--axAccent:#165d85;--axLine:#288fbf;--axTint:#e6f2f8;color:#203544;font-size:10px;padding:15px}.axTS-sap .axEnterprise{border:1px solid #a9c3d0}\n.axTS-sap .axEnterpriseHead{display:flex;justify-content:space-between;gap:12px;padding:13px;border-top:6px solid #165d85;border-bottom:1px solid #9fbecb}.axTS-sap .axEnterpriseIssuer{display:flex;gap:11px;align-items:flex-start}.axTS-sap .axEnterpriseIssuer h1{font-size:18px;color:#165d85}.axTS-sap .axEnterpriseIssuer small{display:block}.axTS-sap .axEnterpriseDoc{text-align:right}.axTS-sap .axEnterpriseDoc h2{font-size:16px;color:#165d85}.axTS-sap .axEnterpriseDoc>b{display:block}\n.axTS-sap .axEnterpriseControl{display:grid;grid-template-columns:repeat(4,1fr);background:#e6f2f8;border-bottom:1px solid #9fbecb}.axTS-sap .axEnterpriseControl>div{padding:9px;border-right:1px solid #c6dce5}.axTS-sap .axEnterpriseControl small,.axTS-sap .axEnterpriseControl b{display:block}.axTS-sap .axEnterpriseControl small{font-size:8px;color:#36708a}\n.axTS-sap .axEnterpriseClients{display:grid;grid-template-columns:1fr 1fr}.axTS-sap .axEnterpriseClients>section{padding:12px;border-bottom:1px solid #9fbecb}.axTS-sap .axEnterpriseClients>section+section{border-left:1px solid #9fbecb}\n.axTS-sap .axEnterpriseClients h3,.axTS-sap .axEnterpriseLower h3{background:#e6f2f8;color:#165d85;padding:6px;margin:0 0 7px}.axTS-sap .axEnterpriseClients section>b{display:block}\n.axTS-sap .axEnterpriseBand{display:flex;justify-content:space-between;gap:12px;background:#165d85;color:white;padding:8px 10px;font-size:9px}\n.axTS-sap .axEnterpriseItems{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px}.axTS-sap .axEnterpriseItems th,.axTS-sap .axEnterpriseItems td{padding:8px 4px;vertical-align:top;border-bottom:1px solid #d0e0e8;border-right:1px solid #e1ecf0;overflow-wrap:anywhere}\n.axTS-sap .axEnterpriseItems th{background:#eaf4f8;color:#165d85;text-align:left;border-bottom:2px solid #165d85}.axTS-sap .axEnterpriseItems th:nth-child(1){width:7%}.axTS-sap .axEnterpriseItems th:nth-child(2){width:32%}.axTS-sap .axEnterpriseItems th:nth-child(3){width:10%}.axTS-sap .axEnterpriseItems th:nth-child(4){width:10%}.axTS-sap .axEnterpriseItems th:nth-child(5){width:9%}.axTS-sap .axEnterpriseItems th:nth-child(6){width:14%}.axTS-sap .axEnterpriseItems th:nth-child(7){width:18%}\n.axTS-sap .axEnterpriseLower{display:grid;grid-template-columns:1fr .9fr;border-top:1px solid #9fbecb}.axTS-sap .axEnterpriseLower>section{padding:10px}.axTS-sap .axEnterpriseLower>section+section{border-left:1px solid #9fbecb}\n.axTS-sap .axEnterpriseLower .axTerms{background:transparent;border:0;padding:6px}.axTS-sap .axEnterpriseLower .axTotals{max-width:none;margin:0}.axTS-sap .axEnterpriseLower .axGrand{background:#165d85;color:white}\n.axTS-sap .axEnterpriseFooter{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #9fbecb;padding:10px}.axTS-sap .axEnterpriseFooter .axSign{margin:0;min-height:57px}\n",
 '@page{size:A4;margin:12mm}@media print{html,body{margin:0!important;padding:0!important;background:white!important}.axTSPaper{width:100%!important;max-width:none!important;padding:0!important;box-shadow:none!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.axTSPaper .axGrand,.axTSPaper th,.axTSPaper .axBand,.axTSPaper .axHero{print-color-adjust:exact;-webkit-print-color-adjust:exact}}',
 '@media(max-width:620px){.axTSPaper{padding:10px!important;font-size:9px}.axTSPaper h1{font-size:15px}.axTSPaper h2{font-size:12px}.axTSPaper .axLogo{max-width:44px}.axTSPaper .axInfo,.axTSPaper .axTwo,.axTSPaper .axAmountsRow{gap:7px}.axTSPaper .axInfo>div,.axTSPaper .axDocBox{padding:6px}.axTSPaper table{font-size:8px}.axTSPaper td,.axTSPaper th{padding:4px 2px}.axTSPaper .axEditorialHero{grid-template-columns:65px 1fr;gap:7px}.axTSPaper .axEditorialSide{font-size:18px;padding-left:5px}.axTSPaper .axGrand{font-size:12px}.axTSPaper .axHeader{gap:5px}}'
 ].join('');
}
function companyHeader(x){
 const settings=db&&db.companySettings&&typeof db.companySettings==='object'?db.companySettings:{};
 const gstin=S(x.issuerGstin||x.companyGstin||settings.gstin||settings.companyGstin||'24BPCPB7271L1ZW');
 const msme=S(settings.msmeNo||settings.udyam),email=S(settings.email||settings.companyEmail),phone=S(settings.phone||settings.mobile||settings.contact);
 return '<div>GSTIN: '+E(gstin||'Not recorded — verify')+'</div>'+
 (msme?'<div>MSME: '+E(msme)+'</div>':'')+
 (phone||email?'<div>'+E([phone,email].filter(Boolean).join(' | '))+'</div>':'');
}
function bank(){
 const x=db?.companySettings||{};
 const fields=[['Bank',x.bankName],['Account Name',x.accountName],['Account No.',x.accountNo],['IFSC',x.ifsc],['Branch',x.branch]];
 const shown=fields.filter(z=>S(z[1]));
 return shown.length?'<div class="axBank axPaperCard"><div class="axLabel">Bank Details</div>'+shown.map(z=>'<div>'+E(z[0])+': <b>'+E(z[1])+'</b></div>').join('')+'</div>':'';
}

/* Accounting-register format: separate goods register, quantity / rate / per / amount columns. */
function tallyFormat(x,k,no,head,terms,total,bankBlock,sign,foot){
 const a=db?.companySettings||{},haveLogo=hasBrandLogo(),h=k==='quote'?'QUOTATION':'TAX INVOICE';
 const details=rows(x).map((z,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+E(z.description||'Description unavailable')+'</b><div class="axMuted">'+[S(z.moc)?'MOC '+S(z.moc):'',S(z.size)?'SIZE '+S(z.size):'',S(z.micron)?'MICRON '+S(z.micron):''].filter(Boolean).map(E).join(' / ')+'</div></td><td>'+E(z.hsn||x.hsn||'—')+'</td><td>'+E(z.qty??'—')+'</td><td>'+M(z.rate)+'</td><td>'+E(z.unit||x.unit||'—')+'</td><td>'+price(z)+'</td></tr>').join('');
 const left='<div class="axAccountingSeller">'+logo()+'<div>'+(haveLogo?'':'<h1>AEROVEX FILTRATION</h1>')+'<div>Smart Filtration Solutions</div>'+(a.address?'<div>'+E(a.address)+'</div>':'')+companyHeader(x)+'</div></div>';
 return '<div class="axAccountingFrame"><div class="axAccountingLabel">'+h+'</div><header class="axAccountingHeader">'+left+'<div class="axAccountingNumber"><strong>'+h+'</strong><span>No. '+E(no)+'</span><span>Dated: '+E(x.date||'—')+'</span></div></header>'+
 '<div class="axAccountingParties"><section><small>'+(k==='quote'?'Quotation to':'Buyer / Bill to')+'</small><b>'+E(x.party||'—')+'</b><div>'+E(x.address||'')+'</div><div>Customer GSTIN: '+E(x.gstin||'—')+'</div></section><section><div>Reference / PO: <b>'+E(x.ref||x.poRef||'—')+'</b></div><div>Place of supply: <b>'+E(x.place||'—')+'</b></div><div>Delivery location: <b>'+E(x.deliveryLocation||'—')+'</b></div>'+(k==='quote'?'<div>Validity: '+E(x.validity||'—')+' days</div>':'')+'</section></div>'+
 '<table class="axAccountingItems"><thead><tr><th>Sl.</th><th>DESCRIPTION OF GOODS</th><th>HSN/SAC</th><th>QTY</th><th>RATE</th><th>PER</th><th>AMOUNT</th></tr></thead><tbody>'+details+'</tbody></table>'+
 '<div class="axAccountingBottom"><section><h3>TERMS / BANK DETAILS</h3>'+terms+bankBlock+'</section><section><h3>ACCOUNT SUMMARY</h3>'+total+'</section></div>'+
 '<div class="axAccountingSignature"><div>Declaration: Please verify all recorded details before issuing.</div>'+sign+'</div></div>'+foot;
}
/* Enterprise print: sales-document control, sold-to / ship-to, line codes and pricing summary. */
function sapFormat(x,k,no,head,terms,total,bankBlock,sign,foot){
 const h=k==='quote'?'SALES QUOTATION':'BILLING DOCUMENT';
 const details=rows(x).map((z,i)=>'<tr><td>'+String((i+1)*10).padStart(4,'0')+'</td><td><b>'+E(z.description||'Description unavailable')+'</b><div class="axMuted">'+[S(z.moc)?'MOC '+S(z.moc):'',S(z.size)?'SIZE '+S(z.size):'',S(z.micron)?'MICRON '+S(z.micron):''].filter(Boolean).map(E).join(' / ')+'</div></td><td>'+E(z.hsn||x.hsn||'—')+'</td><td>'+E(z.qty??'—')+'</td><td>'+E(z.unit||x.unit||'—')+'</td><td>'+M(z.rate)+'</td><td>'+price(z)+'</td></tr>').join('');
 return '<div class="axEnterprise"><header class="axEnterpriseHead"><div class="axEnterpriseIssuer">'+logo()+'<div>'+(hasBrandLogo()?'':'<h1>AEROVEX FILTRATION</h1>')+'<small>Smart Filtration Solutions</small>'+companyHeader(x)+'</div></div><div class="axEnterpriseDoc"><small>COMMERCIAL DOCUMENT</small><h2>'+h+'</h2><b>'+E(no)+'</b></div></header>'+
 '<div class="axEnterpriseControl"><div><small>DOCUMENT NO.</small><b>'+E(no)+'</b></div><div><small>DATE</small><b>'+E(x.date||'—')+'</b></div><div><small>PO REFERENCE</small><b>'+E(x.ref||x.poRef||'—')+'</b></div><div><small>SUPPLY LOCATION</small><b>'+E(x.place||'—')+'</b></div></div>'+
 '<div class="axEnterpriseClients"><section><h3>'+(k==='quote'?'QUOTATION RECIPIENT':'SOLD-TO PARTY')+'</h3><b>'+E(x.party||'—')+'</b><div>'+E(x.address||'')+'</div><div>GSTIN '+E(x.gstin||'—')+'</div></section><section><h3>SHIP-TO / DELIVER TO</h3><div>'+E(x.deliveryLocation||'—')+'</div><div>Attention: '+E(x.attention||'—')+'</div></section></div>'+
 '<div class="axEnterpriseBand"><strong>10 / MATERIAL & SERVICE OVERVIEW</strong><span>'+rows(x).length+' LINE(S)</span></div><table class="axEnterpriseItems"><thead><tr><th>ITEM</th><th>MATERIAL / DESCRIPTION</th><th>HSN</th><th>QTY</th><th>UOM</th><th>NET RATE</th><th>NET VALUE</th></tr></thead><tbody>'+details+'</tbody></table>'+
 '<div class="axEnterpriseLower"><section><h3>20 / COMMERCIAL CONDITIONS</h3>'+terms+bankBlock+'</section><section><h3>30 / PRICING & TAX</h3>'+total+'</section></div><footer class="axEnterpriseFooter"><div>Smart Filtration Solutions • Document '+E(no)+'</div>'+sign+'</footer></div>'+foot;
}

function doc(x,k,t){
 const isQ=k==='quote',no=title(x,k,0),head=isQ?'TECHNO-COMMERCIAL QUOTATION':'TAX INVOICE';
 const items=rows(x).map((z,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+E(z.description||'Description unavailable')+'</b><div class="axMuted">'+[S(z.moc)?'MOC: '+S(z.moc):'',S(z.micron)?'Micron: '+S(z.micron):'',S(z.size)?'Size: '+S(z.size):''].filter(Boolean).map(E).join(' | ')+'</div></td><td>'+E(z.hsn||x.hsn||'—')+'</td><td>'+E(z.qty??'—')+' '+E(z.unit??x.unit??'')+'</td><td>'+M(z.rate)+'</td><td>'+price(z)+'</td></tr>').join('');
 const itemTable='<table class="axItems"><thead><tr><th>#</th><th>Product / Specification</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+items+'</tbody></table>';
 const gst=x.gst===undefined||x.gst===null||x.gst===''?null:N(x.gst);
 const tax=S(x.taxType).replace(/\s+/g,'').toUpperCase();
 let gstParts=tax==='EXEMPT'?'<p><span>GST</span><b>Exempt (as recorded)</b></p>':
 tax==='IGST'?'<p><span>IGST</span><b>'+M(x.igst??x.gst)+'</b></p>':
 tax==='CGST+SGST'&&gst!==null?'<p><span>CGST</span><b>'+M(x.cgst??gst/2)+'</b></p><p><span>SGST</span><b>'+M(x.sgst??gst/2)+'</b></p>':
 '<p><span>GST breakup</span><b>Verify saved document</b></p>';
 const total='<div class="axTotals"><p><span>Taxable Value</span><b>'+M(x.taxable)+'</b></p>'+gstParts+'<div class="axGrand"><span>GRAND TOTAL</span><span>'+M(x.total??x.amount)+'</span></div></div>';
 const terms='<div class="axTerms axPaperCard"><div class="axLabel">Terms & Conditions</div><div>Payment: '+E(x.payment||'—')+'</div><div>Delivery: '+E(x.delivery||'—')+'</div><div>Freight: '+E(x.freight||'—')+'</div>'+(x.packing?'<div>Packing: '+E(x.packing)+'</div>':'')+(x.warranty?'<div>Warranty: '+E(x.warranty)+'</div>':'')+(x.remarks?'<div>Remarks: '+E(x.remarks)+'</div>':'')+'</div>';
 const sign='<div class="axSign"><b>For AEROVEX FILTRATION</b><div style="margin-top:34px">Authorized Signatory</div></div>';
 const foot='<div class="axFoot">Smart Filtration Solutions • '+(hasBrandLogo()?'':'AEROVEX FILTRATION • ')+'Document reference, HSN, GST and bank details should be verified before issue.</div>';
 const issuer='<div class="axIssuer axPaperCard">'+(hasBrandLogo()?'':'<h1>AEROVEX FILTRATION</h1>')+'<div>Smart Filtration Solutions</div>'+companyHeader(x)+'</div>';
 const brand='<div class="axHeadLeft">'+logo()+issuer+'</div>';
 const docid='<div class="axDocIdentity axPaperCard"><h2>'+head+'</h2><strong>'+E(no)+'</strong><div>Date: '+E(x.date||'—')+'</div>'+(isQ?'<div>Revision: '+E(x.revision||'—')+'</div><div>Validity: '+E(x.validity||'—')+' days</div>':'')+'</div>';
 const buyer='<div class="axPaperCard"><div class="axLabel">'+(isQ?'Quotation To':'Bill To')+'</div><b>'+E(x.party||'—')+'</b><div>'+E(x.address||'')+'</div><div>Customer GSTIN: '+E(x.gstin||'—')+'</div></div>';
 const reference='<div class="axPaperCard"><div class="axLabel">Reference / Delivery</div><div>RFQ / PO: '+E(x.ref||x.poRef||'—')+'</div><div>Place of supply: '+E(x.place||'—')+'</div><div>Attention: '+E(x.attention||'—')+'</div>'+(x.deliveryLocation?'<div>Delivery location: '+E(x.deliveryLocation)+'</div>':'')+'</div>';
 const info='<div class="axInfo">'+buyer+reference+'</div>';
 const issuerMini='<div class="axPaperCard">'+(hasBrandLogo()?'':'<b>AEROVEX FILTRATION</b>')+'<div>Smart Filtration Solutions</div>'+companyHeader(x)+'</div>';
 const bankBlock=bank();
 let layout;
 switch(t){
  case 'tally':layout=tallyFormat(x,k,no,head,terms,total,bankBlock,sign,foot);break;
  case 'sap':layout=sapFormat(x,k,no,head,terms,total,bankBlock,sign,foot);break;
  case 'gst':
   layout='<div class="axTaxStrip"><span>GST-READY DOCUMENT • CLIENT COPY</span><span>Original / Client Copy</span></div><div class="axHeader">'+brand+docid+'</div>'+info+itemTable+'<div class="axTwo"><div>'+bankBlock+terms+'</div>'+total+'</div>'+sign+foot;break;
  case 'minimal':
   layout='<div class="axMinimalTop"><div>'+brand+'</div><div><h2>'+head+'</h2><b>'+E(no)+'</b><div>'+E(x.date||'—')+'</div></div></div>'+info+itemTable+total+'<div class="axTwo">'+terms+bankBlock+'</div>'+sign+foot;break;
  case 'modernbox':
   layout='<div class="axHero"><div><div class="axKicker" style="color:#d3eced">AEROVEX / DOCUMENTS</div><h2>'+head+'</h2><div>'+E(no)+'</div></div><div style="text-align:right"><div>'+E(x.date||'—')+'</div>'+(isQ?'<div>Rev. '+E(x.revision||'—')+'</div>':'')+'</div></div><div class="axMainCompany">'+logo()+issuer+'</div>'+info+itemTable+'<div class="axAmountsRow"><div>'+terms+bankBlock+'</div>'+total+'</div>'+sign+foot;break;
  case 'mnc':
   layout='<div class="axTopGrid">'+brand+'<div>'+docid+'</div></div>'+info+'<div class="axKicker" style="margin:6px 0">ITEMIZED SPECIFICATION & COMMERCIAL VALUES</div>'+itemTable+'<div class="axAmountsRow"><div>'+bankBlock+terms+'</div>'+total+'</div>'+sign+foot;break;
  case 'industrial':
   layout='<div class="axBand">INDUSTRIAL FILTRATION • TECHNICAL COMMERCIAL DOCUMENT</div><div class="axFactoryTop"><div class="axDocBox">'+brand+'</div>'+docid+'</div>'+info+'<div class="axBand">PRODUCT / DIMENSIONS / RATE SCHEDULE</div>'+itemTable+'<div class="axTwo"><div>'+terms+bankBlock+'</div>'+total+'</div>'+sign+foot;break;
  case 'compact':
   layout='<div class="axHeader">'+brand+docid+'</div>'+info+itemTable+'<div class="axTwo"><div>'+terms+bankBlock+'</div>'+total+'</div>'+sign+foot;break;
  case 'ledger':
   layout='<div style="display:flex;justify-content:space-between;align-items:start;gap:8px">'+brand+'<div style="text-align:right"><div class="axLabel">Issue Date</div>'+E(x.date||'—')+'</div></div><div class="axLedgerTitle"><h2>'+head+'</h2><b>'+E(no)+'</b> • '+E(x.date||'—')+'</div>'+info+itemTable+total+'<div class="axTwo">'+terms+bankBlock+'</div>'+sign+foot;break;
  case 'editorial':
   layout='<div class="axEditorialHero"><div class="axEditorialSide">'+(isQ?'QTN':'INV')+'</div><div class="axEditorialMain"><div class="axKicker">AEROVEX DOCUMENT STUDIO</div>'+brand+'<div style="margin-top:10px"><h2>'+head+'</h2><b>'+E(no)+'</b> · '+E(x.date||'—')+'</div></div></div>'+info+itemTable+'<div class="axEditorialBottom">'+total+'<div>'+terms+bankBlock+'</div></div>'+sign+foot;break;
  case 'blueprint':
   layout='<div class="axBlueprintBar">SMART FILTRATION SOLUTIONS • TECHNICAL DOCUMENT / CONTROLLED COPY</div><div class="axBlueprintTop"><div>'+brand+'</div>'+docid+'</div>'+info+'<div class="axBlueprintBar">SECTION A : ITEMIZED MATERIAL & SPECIFICATION</div>'+itemTable+'<div class="axBlueprintBar">SECTION B : TAX / TERMS / SIGN-OFF</div><div class="axTwo">'+total+'<div>'+terms+bankBlock+'</div></div>'+sign+foot;break;
  default:
   layout='<div class="axHeader">'+brand+docid+'</div>'+info+itemTable+'<div class="axAmountsRow">'+terms+total+'</div>'+bankBlock+sign+foot;
 }
 return '<article class="axTSPaper axTS-'+E(names[t]?t:'corporate')+'">'+layout+'</article>';
}
function redraw(){
 const app=root();if(!app)return;
 const k=kind(),list=records(k),select=document.getElementById('axTSDoc'),prefs=current();
 const old=select.value;select.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+E(title(x,k,i)+' — '+(x.party||'Unknown'))+'</option>').join('');
 if(old!==''&&list[Number(old)])select.value=old;else if(list.length)select.value=String(list.length-1);
 const them=document.getElementById('axTSTheme');them.value=prefs[k];
 renderPreview();
}
function renderPreview(){
 const app=root();if(!app)return;
 const k=kind(),idx=Number(document.getElementById('axTSDoc')?.value);
 const x=records(k)[idx],theme=document.getElementById('axTSTheme')?.value;
 document.getElementById('axTSPreview').innerHTML=x?'<style>'+css(theme)+'</style>'+doc(x,k,theme):'<p>No saved '+(k==='quote'?'quotation':'invoice')+' on this device. Existing records are not changed.</p>';
}
function saveTheme(){
 const t=document.getElementById('axTSTheme').value,k=kind();
 if(!names[t])return;
 try{localStorage.setItem(K,JSON.stringify({...current(),[k]:t}));document.getElementById('axTSNotice').textContent='Theme preference saved on this device only. Old bills unchanged.'}
 catch(e){alert('Could not save theme preference: '+e.message)}
}
function printDoc(){
 const k=kind(),idx=Number(document.getElementById('axTSDoc').value),x=records(k)[idx],t=document.getElementById('axTSTheme').value;
 if(!names[t])return alert('Choose a valid theme first.');
 if(!x)return alert('Select a saved document first.');
 const w=window.open('','_blank');
 if(!w)return alert('Please allow pop-ups to print or Save PDF.');
 w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+E(title(x,k,idx))+'</title><style>'+css(t)+'</style></head><body>'+doc(x,k,t)+'</body></html>');
 w.document.close();w.focus();setTimeout(()=>w.print(),350);
}
window.axDocumentThemeStudio=function(){
 show('Aerovex Document Theme Studio','<div id="axTSApp"><p>12 distinct A4 designs (not just colors). Suggested: Global MNC for Quotation and GST Precision for Bill. Preview/Print only; saved document values are never changed.</p><div style="display:flex;flex-wrap:wrap;gap:10px"><label>Document type<select id="axTSKind"><option value="quote">Quotation</option><option value="invoice">Tax Invoice</option></select></label><label>Saved document<select id="axTSDoc"></select></label><label>Print theme<select id="axTSTheme">'+Object.entries(names).map(([v,n])=>'<option value="'+v+'">'+E(n)+'</option>').join('')+'</select></label></div><p><button id="axTSSaveTheme" type="button">Save Theme Preference</button> <button id="axTSPrint" class="primary" type="button">Print / Save PDF</button></p><p id="axTSNotice" role="status"></p><div id="axTSPreview"></div></div>');
 document.getElementById('axTSKind').onchange=redraw;
 document.getElementById('axTSDoc').onchange=renderPreview;
 document.getElementById('axTSTheme').onchange=renderPreview;
 document.getElementById('axTSSaveTheme').onclick=saveTheme;
 document.getElementById('axTSPrint').onclick=printDoc;
 redraw();
};
function install(){
 if(document.getElementById('axThemePanel'))return;
 const spot=document.getElementById('accounts')?.closest('.panel')||document.querySelector('main');if(!spot)return;
 const panel=document.createElement('section');panel.className='panel';panel.id='axThemePanel';
 panel.innerHTML='<div class="panelHead"><h2>Document Theme Studio</h2><span>Aerovex Quotations & Invoices</span></div><div><button type="button" id="axThemeOpen" class="primary">🎨 Preview Premium Print Themes</button><p style="font-size:12px;color:#64748b">12 different A4 layouts • Includes Accounting Register and Enterprise Billing for Quotation & Tax Invoice.</p></div>';
 spot.insertAdjacentElement('afterend',panel);
 document.getElementById('axThemeOpen').onclick=window.axDocumentThemeStudio;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();