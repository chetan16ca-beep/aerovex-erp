/* Aerovex Finance Dashboard v1 — read-only financial overview.
 * No changes to saved documents, vouchers, cloud, bank or accounting records.
 * Reported profit is an estimate, NOT stock-adjusted / audited P&L.
 */
(function () {
  'use strict';
  if (typeof db === 'undefined' || typeof render !== 'function' || typeof show !== 'function') return;
  const ID = 'axFinanceOverviewV1';
  const state = { period: 'all', month: currentMonth(), filter: 'all' };
  const names = { invoices: 'Sale', purchases: 'Purchase', receipts: 'Receipt', payments: 'Payment', expenses: 'Expense' };
  const classes = { invoices: 'sale', purchases: 'purchase', receipts: 'receipt', payments: 'payment', expenses: 'expense' };
  function currentMonth() {
    const d = new Date();
    return String(d.getFullYear()) + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function previousMonth() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return String(d.getFullYear()) + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const clean = v => String(v == null ? '' : v).trim();
  const esc = v => clean(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function number(v) {
    const x = typeof v === 'string' ? v.replace(/,/g, '').trim() : v;
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  const round = v => Math.round((number(v) + Number.EPSILON) * 100) / 100;
  const money = v => '₹' + round(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const list = k => Array.isArray(db[k]) ? db[k] : [];
  function valid(x) {
    const s = clean(x && x.status).toLowerCase();
    return !!x && x.cancelled !== true && x.isDeleted !== true &&
      !['cancelled', 'canceled', 'void', 'deleted', 'reversed'].includes(s);
  }
  function dateOf(x) {
    const v = clean(x.date || x.invoiceDate || x.billDate || x.paymentDate || x.createdAt || x.created_at);
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const a = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    return a ? a[3] + '-' + a[2].padStart(2, '0') + '-' + a[1].padStart(2, '0') : '';
  }
  function filterMonth() {
    if (state.period === 'this') return currentMonth();
    if (state.period === 'last') return previousMonth();
    if (state.period === 'custom') return state.month;
    return '';
  }
  function inPeriod(x) {
    const m = filterMonth();
    return !m || dateOf(x).slice(0, 7) === m;
  }
  function taxable(x) {
    if (x.taxable !== undefined && x.taxable !== '' && Number.isFinite(Number(x.taxable))) return round(x.taxable);
    if (Array.isArray(x.items) && x.items.length) return round(x.items.reduce((s, a) => s + (
      a.taxable !== undefined && a.taxable !== '' ? number(a.taxable) :
      number(a.qty || a.quantity) * number(a.rate || a.price) * (1 - number(a.discount) / 100)), 0));
    if (x.qty !== undefined && x.rate !== undefined) return round(number(x.qty) * number(x.rate));
    return round(number(x.total == null ? x.amount : x.total) - number(x.gst) - number(x.other) - number(x.round));
  }
  function gross(x) {
    if (x.total !== undefined && x.total !== '') return round(x.total);
    if (x.amount !== undefined && x.amount !== '') return round(x.amount);
    return round(taxable(x) + number(x.gst));
  }
  const sum = (arr, f) => round(arr.reduce((s, x) => s + f(x), 0));
  function allActive(k) { return list(k).filter(valid); }
  function periodRows(k) { return allActive(k).filter(inPeriod); }
  function commissionFor(invoices) {
    const ledger = db.invoiceCommissionLedger && !Array.isArray(db.invoiceCommissionLedger) && typeof db.invoiceCommissionLedger === 'object'
      ? db.invoiceCommissionLedger : {};
    const ids = new Map();
    allActive('invoices').forEach(x => {
      const id = clean(x.invoiceNo || x.documentNo || x.no).toUpperCase();
      if (id) ids.set(id, (ids.get(id) || 0) + 1);
    });
    return sum(invoices, x => {
      const id = clean(x.invoiceNo || x.documentNo || x.no).toUpperCase();
      const rec = id && ids.get(id) === 1 ? ledger[id] : null;
      return rec && rec.agentId ? Math.max(0, taxable(x)) * number(rec.rate) / 100 : 0;
    });
  }
  function calculate() {
    const sales = periodRows('invoices'), purchases = periodRows('purchases');
    const receipts = periodRows('receipts'), payments = periodRows('payments'), expenses = periodRows('expenses');
    const sale = sum(sales, taxable), purchase = sum(purchases, taxable);
    const expense = sum(expenses, x => number(x.amount)), received = sum(receipts, x => number(x.amount));
    const paid = sum(payments, x => number(x.amount)), commission = commissionFor(sales);
    const allSalesGross = sum(allActive('invoices'), gross);
    const allPurchasesGross = sum(allActive('purchases'), gross);
    const allReceipts = sum(allActive('receipts'), x => number(x.amount));
    const allPayments = sum(allActive('payments'), x => number(x.amount));
    return {
      sale, purchase, expense, received, paid, commission,
      profit: round(sale - purchase - expense - commission),
      receivable: round(allSalesGross - allReceipts),
      payable: round(allPurchasesGross - allPayments),
      sales, purchases, receipts, payments, expenses,
      undated: filterMonth() ? Object.keys(names).reduce((s, k) => s + allActive(k).filter(x => !dateOf(x)).length, 0) : 0
    };
  }
  function titlePeriod() {
    const m = filterMonth();
    return m ? ('Period: ' + m) : 'All recorded dates';
  }
  function card(label, val, note, style, filter) {
    return '<button type="button" class="axFinCard axFin-' + style + '" data-fin="' + filter + '">' +
      '<span>' + esc(label) + '</span><strong>' + money(val) + '</strong><small>' + esc(note) + '</small></button>';
  }
  function install() {
    if (document.getElementById(ID)) return;
    const anchor = document.getElementById('kpis');
    if (!anchor) return;
    const panel = document.createElement('section');
    panel.id = ID;
    panel.className = 'panel axFinPanel';
    panel.setAttribute('aria-label', 'Finance and profit loss dashboard');
    panel.innerHTML =
      '<div class="axFinTop"><div><small class="axFinEyebrow">AEROVEX • FINANCIAL CONTROL</small><h2>Finance &amp; Profit/Loss</h2>' +
      '<p>Sales, purchases, expenses and payments — one view</p></div>' +
      '<div class="axFinActions"><label>Period <select id="axFinPeriod"><option value="all">All time</option><option value="this">This month</option><option value="last">Last month</option><option value="custom">Choose month</option></select></label>' +
      '<input id="axFinMonth" aria-label="Select month" type="month" hidden>' +
      '<button id="axFinDetails" type="button" class="primary">Full report</button></div></div>' +
      '<div class="axFinGrid" id="axFinGrid"></div>' +
      '<p id="axFinCaption" class="axFinCaption"></p>';
    anchor.insertAdjacentElement('afterend', panel);
    const select = document.getElementById('axFinPeriod');
    const month = document.getElementById('axFinMonth');
    select.value = state.period;
    month.value = state.month;
    select.addEventListener('change', function () {
      state.period = this.value;
      month.hidden = state.period !== 'custom';
      update();
    });
    month.addEventListener('change', function () {
      if (this.value) state.month = this.value;
      update();
    });
    document.getElementById('axFinDetails').addEventListener('click', function () { openReport('all'); });
    panel.addEventListener('click', function (event) {
      const button = event.target.closest('[data-fin]');
      if (button) openReport(button.getAttribute('data-fin'));
    });
  }
  function update() {
    const grid = document.getElementById('axFinGrid');
    if (!grid) return;
    const a = calculate();
    grid.innerHTML =
      card('Net Sales', a.sale, 'Excluding GST', 'sale', 'invoices') +
      card('Net Purchases', a.purchase, 'Excluding GST', 'purchase', 'purchases') +
      card('Business Expenses', a.expense, 'Expense register', 'expense', 'expenses') +
      card('Estimated Profit / Loss', a.profit, 'After ' + money(a.commission) + ' commission', a.profit < 0 ? 'loss' : 'profit', 'all') +
      card('Payments Received', a.received, 'Receipt entries', 'receipt', 'receipts') +
      card('Payments Paid', a.paid, 'Payment entries', 'payment', 'payments') +
      card('Receivable • Overall', a.receivable, 'All dates, estimated', 'receivable', 'invoices') +
      card('Payable • Overall', a.payable, 'All dates, estimated', 'payable', 'purchases');
    document.getElementById('axFinCaption').textContent =
      titlePeriod() + ' • ERP entries only, not live bank transactions. ' +
      'Profit is indicative (purchases are treated as costs; unsold stock is not adjusted). ' +
      'Receipt/payment vouchers are not added again to sales/purchases. Expenses also entered as payments need reconciliation.' +
      (a.undated ? ' ' + a.undated + ' undated entries excluded from this period.' : '');
  }
  function entryRows() {
    const result = [];
    Object.keys(names).forEach(k => periodRows(k).forEach(x => {
      const amt = k === 'invoices' || k === 'purchases' ? gross(x) : number(x.amount);
      result.push({
        type: k, name: names[k], date: dateOf(x),
        party: clean(x.party || x.customerName || x.supplierName || x.ledgerName || x.head),
        ref: clean(x.invoiceNo || x.supplierInvoice || x.documentNo || x.no || x.ref || x.voucherNo),
        amount: round(amt), net: k === 'invoices' || k === 'purchases' ? taxable(x) : null
      });
    }));
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }
  function reportRows() {
    return entryRows().filter(x => state.filter === 'all' || x.type === state.filter);
  }
  function csv() {
    const data = [['Date', 'Type', 'Document No', 'Party / Head', 'Gross / Paid Amount', 'Taxable Amount']];
    reportRows().forEach(x => data.push([x.date, x.name, x.ref, x.party, x.amount, x.net === null ? '' : x.net]));
    const quoted = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const file = new Blob(['\uFEFF' + data.map(a => a.map(quoted).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url;
    link.download = 'Aerovex-Finance-' + (filterMonth() || 'All-Time') + '-' + state.filter + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function openReport(filter) {
    state.filter = names[filter] ? filter : 'all';
    const a = calculate(), rows = reportRows(), limit = 150;
    const options = [['all', 'All entries']].concat(Object.keys(names).map(k => [k, names[k]]));
    const filters = options.map(x => '<option value="' + x[0] + '"' + (x[0] === state.filter ? ' selected' : '') + '>' + x[1] + '</option>').join('');
    const body = rows.slice(0, limit).map(x =>
      '<tr><td>' + esc(x.date || 'Undated') + '</td><td><b>' + esc(x.name) + '</b></td><td>' +
      esc(x.ref || '—') + '</td><td>' + esc(x.party || '—') + '</td><td class="axFinRight">' +
      money(x.amount) + '</td></tr>').join('');
    show('Finance Dashboard • ' + esc(titlePeriod()),
      '<div class="axFinDetail"><p class="axFinNote">Read-only ERP accounting overview. No bank integration or auto-posting. GST is excluded from estimated profit.</p>' +
      '<div class="axFinDetailGrid">' +
      '<div><small>Net Sales</small><b>' + money(a.sale) + '</b></div>' +
      '<div><small>Purchases</small><b>' + money(a.purchase) + '</b></div>' +
      '<div><small>Expenses</small><b>' + money(a.expense) + '</b></div>' +
      '<div><small>Commission accrued</small><b>' + money(a.commission) + '</b></div>' +
      '<div><small>Estimated Profit/Loss</small><b>' + money(a.profit) + '</b></div>' +
      '<div><small>Received / Paid</small><b>' + money(a.received) + ' / ' + money(a.paid) + '</b></div>' +
      '<div><small>Overall receivable</small><b>' + money(a.receivable) + '</b></div>' +
      '<div><small>Overall payable</small><b>' + money(a.payable) + '</b></div></div>' +
      '<div class="axFinTools"><label>Transactions <select id="axFinFilter">' + filters + '</select></label>' +
      '<button type="button" id="axFinCSV">Export CSV</button><button type="button" id="axFinRefresh">Refresh</button></div>' +
      '<div class="reportWrap"><table class="report axFinTable"><thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Party / Head</th><th>Amount</th></tr></thead>' +
      '<tbody>' + (body || '<tr><td colspan="5">No saved transactions for this period.</td></tr>') +
      '</tbody></table></div><p class="axFinNote">Showing ' + Math.min(limit, rows.length) + ' of ' + rows.length +
      ' entries. CSV includes all filtered entries. Sales/purchase amounts in the table include GST where recorded. ' +
      'Outstanding is overall, not period-specific. Unsold stock, unpaid costs, commission duplicates and payment/expense overlap require reconciliation before final P&amp;L.</p></div>');
    document.getElementById('axFinFilter').onchange = function () { openReport(this.value); };
    document.getElementById('axFinCSV').onclick = csv;
    document.getElementById('axFinRefresh').onclick = function () { update(); openReport(state.filter); };
  }
  const styles = document.createElement('style');
  styles.id = 'axFinanceStylesV1';
  styles.textContent = [
    '.axFinPanel{border:1px solid #d8e6ed;background:linear-gradient(160deg,#f8fcfe,#fff);margin-top:14px}',
    '.axFinTop{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}',
    '.axFinTop h2{margin:4px 0 3px;font-size:20px;color:#15394c}',
    '.axFinTop p{color:#667b87;font-size:12px;margin:0}',
    '.axFinEyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#197392}',
    '.axFinActions{display:flex;align-items:end;gap:8px;flex-wrap:wrap}',
    '.axFinActions label,.axFinTools label{font-size:11px;color:#546f7e;font-weight:700;display:flex;flex-direction:column;gap:3px}',
    '.axFinActions select,.axFinActions input,.axFinTools select{border:1px solid #cadce5;border-radius:9px;background:white;color:#234553;padding:9px;min-height:38px;max-width:160px}',
    '.axFinActions input[hidden]{display:none}',
    '.axFinGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
    '.axFinCard{font:inherit;appearance:none;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:5px;min-width:0;padding:13px 12px;border:1px solid #d9e6ec;border-left:3px solid #7697a9;background:#fff;border-radius:11px;cursor:pointer;box-shadow:0 2px 7px rgba(15,64,86,.04)}',
    '.axFinCard:hover,.axFinCard:focus-visible{border-color:#3a93ae;background:#f7fcff;outline:2px solid transparent}',
    '.axFinCard span{font-size:11px;color:#526c7b;font-weight:650}',
    '.axFinCard strong{font-size:clamp(15px,1.7vw,23px);color:#18384b;overflow-wrap:anywhere}',
    '.axFinCard small{font-size:10px;color:#738795}',
    '.axFin-sale,.axFin-receipt{border-left-color:#178f7b}',
    '.axFin-profit{border-left-color:#2e8c63;background:#f5fcf8}',
    '.axFin-loss{border-left-color:#c64e4e;background:#fff9f8}',
    '.axFin-expense,.axFin-payment{border-left-color:#c18a39}',
    '.axFinCaption,.axFinNote{color:#627887;font-size:11px;line-height:1.55;margin:11px 0 0}',
    '.axFinDetailGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}',
    '.axFinDetailGrid>div{padding:10px;border:1px solid #d7e5ec;border-radius:9px;min-width:0}',
    '.axFinDetailGrid small{display:block;font-size:11px;color:#627887}',
    '.axFinDetailGrid b{display:block;font-size:15px;overflow-wrap:anywhere;margin-top:4px}',
    '.axFinTools{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap;margin:10px 0}',
    '.axFinTools button{min-height:38px}',
    '.axFinTable{width:100%}.axFinTable td,.axFinTable th{white-space:normal;overflow-wrap:anywhere;font-size:12px;padding:9px 6px}',
    '.axFinRight{text-align:right;font-variant-numeric:tabular-nums}',
    '@media(max-width:800px){.axFinGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.axFinCard{padding:11px 9px}.axFinCard strong{font-size:16px}.axFinTop h2{font-size:19px}}',
    '@media(min-width:980px){.axFinDetailGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}'
  ].join('');
  document.head.appendChild(styles);
  if (Array.isArray(modules.accounts) && !modules.accounts.some(x => x[0] === 'Finance Dashboard')) {
    modules.accounts.unshift(['Finance Dashboard', 'Sales • Purchase • Expense • Profit/Loss']);
  }
  const prevOpen = window.openModule;
  if (typeof prevOpen === 'function') window.openModule = function (name) {
    if (name === 'Finance Dashboard') return openReport('all');
    return prevOpen.apply(this, arguments);
  };
  const prevRender = window.render;
  if (typeof prevRender === 'function') window.render = function () {
    const output = prevRender.apply(this, arguments);
    install();
    update();
    return output;
  };
  window.axFinanceDashboard = function () { return openReport('all'); };
  window.axFinanceRefresh = update;
  window.addEventListener('focus', update);
  window.addEventListener('storage', function (e) { if (e.key === 'aerovex-erp-data-v1') update(); });
  try { render(); install(); update(); } catch (e) { console.warn('Finance dashboard display:', e); }
})();
