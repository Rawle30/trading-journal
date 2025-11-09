/* Part 1: Setup, constants, DOM refs, small utilities */
const API_KEY = 'FTDRTP0955507PPC'; // <-- REPLACE
const ALPHA_VANTAGE_DELAY_MS = 13000; // 13s between requests to be safe (free tier)
const tableBody = document.querySelector('#portfolioTable tbody');
const CHART_IDS = ['dividends', 'holdings', 'sectors', 'monthlyChart', 'allocations'];

const typeOptions = ['Stock', 'Option', 'ETF', 'Dividend'];
const actionOptions = ['Buy', 'Sell'];
const sectorOptions = ['Tech', 'Finance', 'Health', 'Energy', 'Consumer', 'Utilities', 'Other'];

let charts = {}; // keep Chart instances so we can update/destroy
function el(tag, props = {}) { const n = document.createElement(tag); Object.assign(n, props); return n; }
function isNumber(v) { return typeof v === 'number' && !isNaN(v); }
function toFloat(v) { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? NaN : n; }
function formatMoney(n) { if (!isFinite(n)) return '-'; return `$${n.toFixed(2)}`; }
/* Part 2: Row creation and small helpers */
function createSelectCell(options = [], selected = '') {
  const td = el('td');
  const select = el('select');
  options.forEach(opt => {
    const o = el('option');
    o.value = opt;
    o.text = opt;
    if (opt === selected) o.selected = true;
    select.appendChild(o);
  });
  td.appendChild(select);
  return td;
}

function createEditableCell(text = '', placeholder = '') {
  const td = el('td');
  td.contentEditable = true;
  td.innerText = text || '';
  if (placeholder && !text) td.dataset.placeholder = placeholder;
  td.classList.add('editable-cell');
  return td;
}

function addRow(initial = {}) {
  const tr = el('tr');
  tr.appendChild(createSelectCell(typeOptions, initial.type || ''));
  tr.appendChild(createEditableCell(initial.ticker || '', 'AAPL'));
  tr.appendChild(createEditableCell(initial.quantity != null ? String(initial.quantity) : '', '0'));
  tr.appendChild(createEditableCell(initial.purchasePrice != null ? String(initial.purchasePrice) : '', '0.00'));
  tr.appendChild(createEditableCell(initial.currentPrice != null ? String(initial.currentPrice) : '', '0.00'));
  tr.appendChild(createSelectCell(sectorOptions, initial.sector || ''));
  tr.appendChild(createEditableCell(initial.dividend != null ? String(initial.dividend) : '', '0.00'));
  tr.appendChild(createSelectCell(actionOptions, initial.action || 'Buy'));
  tr.appendChild(createEditableCell(initial.date || '', 'YYYY-MM-DD'));
  tableBody.appendChild(tr);
  return tr;
}

/* quick helper to read a row into an object */
function readRow(row) {
  const cells = row.cells;
  return {
    type: cells[0].querySelector('select')?.value || '',
    ticker: cells[1].innerText.trim(),
    quantity: toFloat(cells[2].innerText.trim()),
    purchasePrice: toFloat(cells[3].innerText.trim()),
    currentPrice: toFloat(cells[4].innerText.trim()),
    sector: cells[5].querySelector('select')?.value || '',
    dividend: toFloat(cells[6].innerText.trim()),
    action: cells[7].querySelector('select')?.value || '',
    date: cells[8].innerText.trim()
  };
}
/* Part 3: Real-time price lookup (queued, spaced to respect API limits) */
async function fetchPriceAlphaVantage(ticker) {
  // GLOBAL_QUOTE response path: data['Global Quote']['05. price']
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const quote = data['Global Quote'] || {};
  const p = toFloat(quote['05. price']);
  if (!isNumber(p)) throw new Error('Price not available');
  return p;
}

/* queue-based updater to avoid bursting API */
async function updatePrices({ onProgress } = {}) {
  const rows = [...tableBody.rows].filter(r => r.cells[1].innerText.trim());
  if (!rows.length) return;
  // gather unique tickers to avoid duplicate requests
  const tickerToRows = {};
  rows.forEach(r => {
    const t = r.cells[1].innerText.trim().toUpperCase();
    if (!t) return;
    tickerToRows[t] = tickerToRows[t] || [];
    tickerToRows[t].push(r);
  });
  const tickers = Object.keys(tickerToRows);
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      if (onProgress) onProgress({ index: i, total: tickers.length, ticker });
      // attempt fetch
      const price = await fetchPriceAlphaVantage(ticker);
      tickerToRows[ticker].forEach(r => r.cells[4].innerText = isNumber(price) ? price.toFixed(2) : r.cells[4].innerText);
    } catch (err) {
      console.warn(`Price fetch failed for ${ticker}:`, err.message || err);
      // leave current price unchanged; optionally annotate cell
      tickerToRows[ticker].forEach(r => {
        // mark cell with "—" if empty
        if (!r.cells[4].innerText.trim()) r.cells[4].innerText = '';
      });
    }
    // spacing between requests to avoid rate-limit
    if (i < tickers.length - 1) await new Promise(res => setTimeout(res, ALPHA_VANTAGE_DELAY_MS));
  }
  recalculate(); // refresh after all prices updated
}
/* Part 4: Recalculate metrics and draw/update charts using Chart.js */
function recalculate() {
  const rows = [...tableBody.rows];
  let invested = 0, value = 0, sharesTotal = 0, monthly = 0;
  const perf = [];
  const dividends = {}, holdings = {}, sectors = {}, months = {}, types = {};

  const nowMonth = new Date().getMonth();

  rows.forEach(row => {
    const r = readRow(row);
    if (!r.ticker || !isNumber(r.quantity) || !isNumber(r.purchasePrice)) return;

    if (r.action === 'Buy') invested += r.quantity * r.purchasePrice;
    sharesTotal += r.quantity;
    const cp = isNumber(r.currentPrice) ? r.currentPrice : r.purchasePrice;
    value += r.quantity * cp;
    const gain = (cp - r.purchasePrice) * r.quantity + (isNumber(r.dividend) ? r.dividend : 0);
    perf.push({ ticker: r.ticker, gain });

    dividends[r.ticker] = (dividends[r.ticker] || 0) + (isNumber(r.dividend) ? r.dividend : 0);
    holdings[r.ticker] = (holdings[r.ticker] || 0) + r.quantity;
    sectors[r.sector || 'Unknown'] = (sectors[r.sector || 'Unknown'] || 0) + r.quantity;
    types[r.type || 'Other'] = (types[r.type || 'Other'] || 0) + r.quantity;

    // monthly buy amount
    const d = new Date(r.date);
    if (!isNaN(d)) {
      const mon = d.toLocaleString('default', { month: 'short' });
      months[mon] = (months[mon] || 0) + (r.action === 'Buy' ? r.quantity : -r.quantity);
      if (d.getMonth() === nowMonth && r.action === 'Buy') monthly += r.quantity * r.purchasePrice;
    }
  });

  const gainTotal = value - invested;
  const best = perf.slice().sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.slice().sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  updateSummary({ invested, value, gainTotal, monthly, sharesTotal, best, worst });
  drawCharts({ dividends, holdings, sectors, months, types });
}

function updateSummary({ invested, value, gainTotal, monthly, sharesTotal, best, worst }) {
  document.getElementById('invested').innerText = `Invested: ${formatMoney(invested)}`;
  document.getElementById('value').innerText = `Value: ${formatMoney(value)}`;
  const gainEl = document.getElementById('gain');
  gainEl.innerText = `Gain/Loss: ${formatMoney(gainTotal)}`;
  gainEl.className = gainTotal > 0 ? 'green' : gainTotal < 0 ? 'red' : 'neutral';
  document.getElementById('monthly').innerText = `Monthly: ${formatMoney(monthly)}`;
  document.getElementById('shares').innerText = `Shares: ${sharesTotal}`;
  document.getElementById('best').innerText = `Best: ${best}`;
  document.getElementById('worst').innerText = `Worst: ${worst}`;
}

function drawCharts(dataSets) {
  const configs = [
    { id: 'dividends', label: 'Dividends', data: dataSets.dividends, type: 'pie' },
    { id: 'holdings', label: 'Holdings', data: dataSets.holdings, type: 'bar' },
    { id: 'sectors', label: 'Sectors', data: dataSets.sectors, type: 'doughnut' },
    { id: 'monthlyChart', label: 'Monthly Buy/Sell', data: dataSets.months, type: 'line' },
    { id: 'allocations', label: 'Allocations', data: dataSets.types, type: 'bar' }
  ];

  configs.forEach(cfg => {
    const ctxEl = document.getElementById(cfg.id);
    if (!ctxEl) return;
    const labels = Object.keys(cfg.data);
    const data = Object.values(cfg.data);
    // destroy existing chart
    if (charts[cfg.id]) {
      try { charts[cfg.id].destroy(); } catch(e) {}
      delete charts[cfg.id];
    }
    charts[cfg.id] = new Chart(ctxEl.getContext('2d'), {
      type: cfg.type,
      data: {
        labels,
        datasets: [{
          label: cfg.label,
          data,
          backgroundColor: [
            '#4caf50','#2196f3','#ff9800','#e91e63','#9c27b0',
            '#00bcd4','#ffc107','#8bc34a','#3f51b5','#f44336'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: (cfg.type === 'bar' || cfg.type === 'line') ? { y: { beginAtZero: true } } : {}
      }
    });
  });
}
/* Part 5: Persistence, CSV, initialization and UX helpers */
function save() {
  const rows = [...tableBody.rows].map(r => [...r.cells].map(c => {
    const s = c.querySelector?.('select');
    return s ? s.value : c.innerText.trim();
  }));
  localStorage.setItem('portfolioData', JSON.stringify(rows));
}

function load() {
  const raw = localStorage.getItem('portfolioData');
  tableBody.innerHTML = '';
  if (!raw) return;
  try {
    const rows = JSON.parse(raw);
    rows.forEach(row => {
      const tr = el('tr');
      row.forEach((cell, i) => {
        let td;
        if (i === 0) td = createSelectCell(typeOptions, cell);
        else if (i === 5) td = createSelectCell(sectorOptions, cell);
        else if (i === 7) td = createSelectCell(actionOptions, cell);
        else td = createEditableCell(cell);
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load saved portfolio', e);
  }
  recalculate();
}

function exportCSV() {
  const rows = [...tableBody.rows].map(r => [...r.cells].map(c => {
    const s = c.querySelector?.('select');
    const v = s ? s.value : c.innerText.trim();
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = el('a', { href: URL.createObjectURL(blob) });
  a.download = 'portfolio.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function importCSV(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const raw = e.target.result;
    const lines = raw.split(/\r?\n/).filter(Boolean);
    tableBody.innerHTML = '';
    lines.forEach(line => {
      // very simple CSV parse: split on commas outside quotes
      const row = parseCSVLine(line);
      const tr = el('tr');
      row.forEach((cell, i) => {
        let td;
        if (i === 0) td = createSelectCell(typeOptions, cell);
        else if (i === 5) td = createSelectCell(sectorOptions, cell);
        else if (i === 7) td = createSelectCell(actionOptions, cell);
        else td = createEditableCell(cell);
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
    recalculate();
    save();
  };
  reader.readAsText(file);
}

/* simple CSV line parser that supports quoted cells */
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' ) {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/* minimal UI hooks */
document.addEventListener('DOMContentLoaded', () => {
  // wire controls if present
  document.querySelectorAll('button').forEach(btn => {
    // preserve any inline onclick handlers in HTML; we don't override
    // additional handlers can be bound here if needed
  });

  // load saved rows, or insert one empty row
  load();
  if (tableBody.rows.length === 0) addRow();
  // auto recalc when user edits a cell (debounced)
  let debounceTimer = 0;
  tableBody.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { recalculate(); save(); }, 400);
  });
});





