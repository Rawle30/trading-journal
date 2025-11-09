/* Part 1: Constants, DOM refs, utilities */
const API_KEY = 'YOUR_API_KEY'; // replace
const ALPHA_VANTAGE_DELAY_MS = 13000;
const tableBody = document.querySelector('#portfolioTable tbody');
const CHART_IDS = ['dividends','holdings','sectors','monthlyChart','allocations'];

const typeOptions = ['Stock','Option','ETF','Dividend'];
const actionOptions = ['Buy','Sell','Dividend']; // added Dividend as action
const sectorOptions = ['Tech','Finance','Health','Energy','Consumer','Utilities','Other'];
const brokerOptions = ['Schwab','E*Trade','Fidelity','Webull','Robinhood']; // new
let charts = {};

function el(tag, props = {}) { const n = document.createElement(tag); Object.assign(n, props); return n; }
function toFloat(v){ const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?NaN:n; }
function isNumber(n){ return typeof n === 'number' && !isNaN(n); }
function formatMoney(n){ return isNumber(n)?`$${n.toFixed(2)}`:'-'; }
/* Part 2: Row creation helpers (includes new columns) */
function createSelectCell(options=[], value=''){
  const td = el('td');
  const sel = el('select');
  options.forEach(o => { const opt = el('option'); opt.value = o; opt.text = o; if(o===value) opt.selected=true; sel.appendChild(opt); });
  td.appendChild(sel);
  return td;
}

function createEditableCell(text=''){
  const td = el('td');
  td.contentEditable = true;
  td.innerText = text;
  td.classList.add('editable-cell');
  return td;
}

/* Columns order now:
  0 Type | 1 Ticker | 2 Quantity | 3 Purchase Price | 4 Current Price |
  5 Sector | 6 Dividend | 7 Action | 8 Date |
  9 Broker | 10 Options Multiplier | 11 Exit Price | 12 Exit Date
*/
function addRow(initial = {}){
  const tr = el('tr');
  tr.appendChild(createSelectCell(typeOptions, initial.type || ''));
  tr.appendChild(createEditableCell(initial.ticker || ''));
  tr.appendChild(createEditableCell(initial.quantity != null ? String(initial.quantity) : ''));
  tr.appendChild(createEditableCell(initial.purchasePrice != null ? String(initial.purchasePrice) : ''));
  tr.appendChild(createEditableCell(initial.currentPrice != null ? String(initial.currentPrice) : ''));
  tr.appendChild(createSelectCell(sectorOptions, initial.sector || ''));
  tr.appendChild(createEditableCell(initial.dividend != null ? String(initial.dividend) : ''));
  tr.appendChild(createSelectCell(actionOptions, initial.action || 'Buy'));
  tr.appendChild(createEditableCell(initial.date || ''));
  tr.appendChild(createSelectCell(brokerOptions, initial.broker || ''));
  tr.appendChild(createEditableCell(initial.optionsMultiplier != null ? String(initial.optionsMultiplier) : '1')); // multiplier
  tr.appendChild(createEditableCell(initial.exitPrice != null ? String(initial.exitPrice) : ''));
  tr.appendChild(createEditableCell(initial.exitDate || ''));
  tableBody.appendChild(tr);
  return tr;
}

function readRow(row){
  const c = row.cells;
  return {
    type: c[0].querySelector('select')?.value || '',
    ticker: c[1].innerText.trim(),
    quantity: toFloat(c[2].innerText.trim()),
    purchasePrice: toFloat(c[3].innerText.trim()),
    currentPrice: toFloat(c[4].innerText.trim()),
    sector: c[5].querySelector('select')?.value || '',
    dividend: toFloat(c[6].innerText.trim()),
    action: c[7].querySelector('select')?.value || '',
    date: c[8].innerText.trim(),
    broker: c[9].querySelector('select')?.value || '',
    optionsMultiplier: toFloat(c[10].innerText.trim()) || 1,
    exitPrice: toFloat(c[11].innerText.trim()),
    exitDate: c[12].innerText.trim()
  };
}
/* Part 3: Real-time price lookup (queued) */
async function fetchPriceAlphaVantage(ticker){
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${API_KEY}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const q = data['Global Quote'] || {};
  const p = toFloat(q['05. price']);
  if(!isNumber(p)) throw new Error('no price');
  return p;
}

async function updatePrices({onProgress} = {}){
  const rows = [...tableBody.rows].filter(r => r.cells[1].innerText.trim());
  const tickerMap = {};
  rows.forEach(r => {
    const t = r.cells[1].innerText.trim().toUpperCase();
    if(!t) return;
    tickerMap[t] = tickerMap[t] || [];
    tickerMap[t].push(r);
  });
  const tickers = Object.keys(tickerMap);
  for(let i=0;i<tickers.length;i++){
    const ticker = tickers[i];
    try{
      if(onProgress) onProgress({index:i,total:tickers.length,ticker});
      const price = await fetchPriceAlphaVantage(ticker);
      tickerMap[ticker].forEach(r => { r.cells[4].innerText = isNumber(price) ? price.toFixed(2) : r.cells[4].innerText; });
    }catch(err){
      console.warn('price fetch failed', ticker, err.message||err);
    }
    if(i < tickers.length - 1) await new Promise(res => setTimeout(res, ALPHA_VANTAGE_DELAY_MS));
  }
  recalculate();
}
/* Part 4: Recalculate metrics and include exit price/exit date and options multiplier */
function recalculate(){
  const rows = [...tableBody.rows];
  let invested = 0, value = 0, totalShares = 0, monthly = 0;
  const perf = [], dividends = {}, holdings = {}, sectors = {}, months = {}, types = {};

  const nowMonth = new Date().getMonth();

  rows.forEach(row => {
    const r = readRow(row);
    if(!r.ticker || !isNumber(r.quantity) || !isNumber(r.purchasePrice)) return;

    // use exitPrice if provided and exitDate indicates closed trade
    let effectivePrice = isNumber(r.exitPrice) && r.exitDate ? r.exitPrice : (isNumber(r.currentPrice) ? r.currentPrice : r.purchasePrice);

    // options multiplier applied only for option type
    let multiplier = r.type === 'Option' ? (isNumber(r.optionsMultiplier) ? r.optionsMultiplier : 1) : 1;

    // invested: only count buy purchase amount
    if(r.action === 'Buy') {
      invested += r.quantity * r.purchasePrice * multiplier;
      // monthly invested if date in current month
      const d = new Date(r.date);
      if(!isNaN(d) && d.getMonth() === nowMonth) monthly += r.quantity * r.purchasePrice * multiplier;
    }

    totalShares += r.quantity * multiplier;
    value += r.quantity * effectivePrice * multiplier;

    const gain = (effectivePrice - r.purchasePrice) * r.quantity * multiplier + (isNumber(r.dividend) ? r.dividend : 0);
    perf.push({ ticker: r.ticker, gain });

    dividends[r.ticker] = (dividends[r.ticker] || 0) + (isNumber(r.dividend) ? r.dividend : 0);
    holdings[r.ticker] = (holdings[r.ticker] || 0) + r.quantity * multiplier;
    sectors[r.sector || 'Unknown'] = (sectors[r.sector || 'Unknown'] || 0) + r.quantity * multiplier;
    types[r.type || 'Other'] = (types[r.type || 'Other'] || 0) + r.quantity * multiplier;

    // monthly buy/sell by truncated month label
    const dd = new Date(r.date);
    if(!isNaN(dd)) {
      const m = dd.toLocaleString('default',{month:'short'});
      months[m] = (months[m] || 0) + (r.action === 'Buy' ? r.quantity * multiplier : -r.quantity * multiplier);
    }
  });

  const gainTotal = value - invested;
  const best = perf.slice().sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.slice().sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  updateSummary({invested,value,gainTotal,monthly,totalShares,best,worst});
  drawCharts({dividends,holdings,sectors,months,types});
}
/* Part 5: Chart drawing with readable fonts */
function drawCharts(dataSets){
  const configs = [
    {id:'dividends', label:'Dividends', data:dataSets.dividends, type:'pie'},
    {id:'holdings', label:'Holdings', data:dataSets.holdings, type:'bar'},
    {id:'sectors', label:'Sectors', data:dataSets.sectors, type:'doughnut'},
    {id:'monthlyChart', label:'Monthly Buy/Sell', data:dataSets.months, type:'line'},
    {id:'allocations', label:'Allocations', data:dataSets.types, type:'bar'}
  ];

  configs.forEach(cfg => {
    const elCanvas = document.getElementById(cfg.id);
    if(!elCanvas) return;
    const labels = Object.keys(cfg.data);
    const data = Object.values(cfg.data);
    if(charts[cfg.id]) { try { charts[cfg.id].destroy(); } catch(e){} }
    charts[cfg.id] = new Chart(elCanvas.getContext('2d'), {
      type: cfg.type,
      data: { labels, datasets:[{ label: cfg.label, data, backgroundColor:[
        '#4caf50','#2196f3','#ff9800','#e91e63','#9c27b0','#00bcd4','#ffc107','#8bc34a','#3f51b5','#f44336'
      ], borderWidth:1 }]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 13 } } },
          tooltip: { bodyFont: { size: 13 }, titleFont: { size: 14 } }
        },
        scales: (cfg.type==='bar' || cfg.type==='line') ? {
          y: { beginAtZero:true, ticks: { font: { size: 12 } } },
          x: { ticks: { font: { size: 12 } } }
        } : {}
      }
    });
  });
}
/* Part 6: Persistence (localStorage) and CSV handling */
function save(){
  const rows = [...tableBody.rows].map(r => [...r.cells].map(c => {
    const s = c.querySelector?.('select');
    return s ? s.value : c.innerText.trim();
  }));
  localStorage.setItem('portfolioData', JSON.stringify(rows));
  // save dark mode preference too
  localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
}

function load(){
  const raw = localStorage.getItem('portfolioData');
  tableBody.innerHTML = '';
  if(!raw) { addRow(); return; }
  try{
    const rows = JSON.parse(raw);
    rows.forEach(row => {
      const tr = el('tr');
      // ensure length = 13 cells (fill missing)
      for(let i=0;i<13;i++){
        const val = row[i] ?? '';
        let td;
        if(i===0) td = createSelectCell(typeOptions, val);
        else if(i===5) td = createSelectCell(sectorOptions, val);
        else if(i===7) td = createSelectCell(actionOptions, val);
        else if(i===9) td = createSelectCell(brokerOptions, val);
        else td = createEditableCell(val);
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    });
  }catch(e){
    console.error('load error', e);
    addRow();
  }
  recalculate();
}

function exportCSV(){
  const rows = [...tableBody.rows].map(r => [...r.cells].map(c => {
    const s = c.querySelector?.('select');
    const v = s ? s.value : c.innerText.trim();
    return `"${String(v).replace(/"/g,'""')}"`;
  }).join(','));
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = el('a',{href:URL.createObjectURL(blob), download:'portfolio.csv'});
  document.body.appendChild(a); a.click(); a.remove();
}

function parseCSVLine(line){
  const out=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){ const ch=line[i];
    if(ch==='"'){ if(inQ && line[i+1]==='"'){ cur+='"'; i++; continue; } inQ=!inQ; continue; }
    if(ch===',' && !inQ){ out.push(cur); cur=''; continue; }
    cur+=ch;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

function importCSV(e){
  const f = e?.target?.files?.[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
    tableBody.innerHTML = '';
    lines.forEach(line => {
      const cols = parseCSVLine(line);
      const tr = el('tr');
      for(let i=0;i<13;i++){
        const v = cols[i] ?? '';
        let td;
        if(i===0) td = createSelectCell(typeOptions, v);
        else if(i===5) td = createSelectCell(sectorOptions, v);
        else if(i===7) td = createSelectCell(actionOptions, v);
        else if(i===9) td = createSelectCell(brokerOptions, v);
        else td = createEditableCell(v);
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    });
    recalculate(); save();
  };
  r.readAsText(f);
}
/* Part 7: Initialization, dark mode, UI wiring */
function toggleDarkMode(){
  document.body.classList.toggle('dark');
  // persist
  localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
}

document.addEventListener('DOMContentLoaded', () => {
  // wire HTML buttons (assumes buttons exist and have these ids)
  document.getElementById('addRowBtn')?.addEventListener('click', ()=>{ addRow(); save(); });
  document.getElementById('recalcBtn')?.addEventListener('click', recalculate);
  document.getElementById('updatePricesBtn')?.addEventListener('click', ()=> updatePrices({onProgress: p => console.log(p)}));
  document.getElementById('saveBtn')?.addEventListener('click', save);
  document.getElementById('exportBtn')?.addEventListener('click', exportCSV);
  const fileInput = document.getElementById('csvInput');
  if(fileInput) fileInput.addEventListener('change', importCSV);

  // attach inline fallback if buttons not present (some markup included inline in earlier HTML)
  // load saved data and dark mode preference
  const dm = localStorage.getItem('darkMode');
  if(dm === '1') document.body.classList.add('dark');

  load();
  // ensure reduced height/width: add a compact class on wrapper if not present
  const wrapper = document.querySelector('.table-wrapper');
  if(wrapper) wrapper.classList.add('compact-table-box'); // CSS must define smaller dimensions
  // table edits trigger recalc+save (debounced)
  let t;
  tableBody.addEventListener('input', ()=>{ clearTimeout(t); t = setTimeout(()=>{ recalculate(); save(); }, 400); });
});






