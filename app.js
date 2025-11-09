const API_KEY = 'FTDRTP0955507PPC'; // Replace with your Alpha Vantage key
const table = document.querySelector('#portfolioTable tbody');
const typeOptions = ['Stock', 'Option', 'ETF', 'Dividend'];
const actionOptions = ['Buy', 'Sell', 'Dividend'];
const sectorOptions = ['Tech', 'Finance', 'Health', 'Energy', 'Consumer', 'Utilities', 'Other'];
const brokerOptions = ['Schwab', 'E*Trade', 'Fidelity', 'Webull', 'Robinhood'];
let charts = {};

function createDropdown(options, value = '') {
  const td = document.createElement('td');
  const select = document.createElement('select');
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.text = opt;
    if (opt === value) o.selected = true;
    select.appendChild(o);
  });
  td.appendChild(select);
  return td;
}

function createCell(value = '') {
  const td = document.createElement('td');
  td.contentEditable = true;
  td.innerText = value;
  td.classList.add('editable-cell');
  return td;
}

function toFloat(val) {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}
function addRow() {
  const tr = document.createElement('tr');
  tr.appendChild(createDropdown(typeOptions));
  tr.appendChild(createCell('')); // Ticker
  tr.appendChild(createCell('')); // Quantity
  tr.appendChild(createCell('')); // Purchase Price
  tr.appendChild(createCell('')); // Current Price
  tr.appendChild(createDropdown(sectorOptions));
  tr.appendChild(createCell('')); // Dividend
  tr.appendChild(createDropdown(actionOptions));
  tr.appendChild(createCell('')); // Date
  tr.appendChild(createDropdown(brokerOptions));
  tr.appendChild(createCell('1')); // Options Multiplier
  tr.appendChild(createCell('')); // Exit Price
  tr.appendChild(createCell('')); // Exit Date
  table.appendChild(tr);
}

function drawCharts(dataSets) {
  const configs = [
    { id: 'dividends', label: 'Dividends', data: dataSets.dividends, type: 'pie' },
    { id: 'holdings', label: 'Holdings', data: dataSets.holdings, type: 'bar' },
    { id: 'sectors', label: 'Sectors', data: dataSets.sectors, type: 'doughnut' },
    { id: 'monthlyChart', label: 'Monthly Buy/Sell', data: dataSets.months, type: 'line' },
    { id: 'allocations', label: 'Allocations', data: dataSets.types, type: 'bar' }
  ];

  configs.forEach(({ id, label, data, type }) => {
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type,
      data: {
        labels: Object.keys(data),
        datasets: [{
          label,
          data: Object.values(data),
          backgroundColor: [
            '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0',
            '#00bcd4', '#ffc107', '#8bc34a', '#3f51b5', '#f44336'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { font: { size: 13 } } },
          tooltip: { bodyFont: { size: 13 }, titleFont: { size: 14 } }
        },
        scales: (type === 'bar' || type === 'line') ? {
          y: { beginAtZero: true, ticks: { font: { size: 12 } } },
          x: { ticks: { font: { size: 12 } } }
        } : {}
      }
    });
  });
}


function readRow(row) {
  const c = row.cells;
  return {
    type: c[0].querySelector('select').value,
    ticker: c[1].innerText.trim(),
    quantity: toFloat(c[2].innerText),
    purchase: toFloat(c[3].innerText),
    current: toFloat(c[4].innerText),
    sector: c[5].querySelector('select').value,
    dividend: toFloat(c[6].innerText),
    action: c[7].querySelector('select').value,
    date: new Date(c[8].innerText.trim()),
    broker: c[9].querySelector('select').value,
    multiplier: toFloat(c[10].innerText) || 1,
    exit: toFloat(c[11].innerText),
    exitDate: new Date(c[12].innerText.trim())
  };
}
async function fetchPrice(ticker) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const price = parseFloat(data['Global Quote']?.['05. price']);
  return isNaN(price) ? null : price;
}

async function updatePrices() {
  for (const row of table.rows) {
    const ticker = row.cells[1].innerText.trim();
    if (!ticker) continue;
    try {
      const price = await fetchPrice(ticker);
      if (price !== null) row.cells[4].innerText = price.toFixed(2);
    } catch (err) {
      console.warn(`Failed to fetch price for ${ticker}`);
    }
    await new Promise(r => setTimeout(r, 15000)); // 15s delay for rate limit
  }
  recalculate();
}
function recalculate() {
  let invested = 0, value = 0, shares = 0, monthly = 0;
  const perf = [], now = new Date().getMonth();
  const dividends = {}, holdings = {}, sectors = {}, months = {}, types = {};

  [...table.rows].forEach(row => {
    const r = readRow(row);
    if (!r.ticker || isNaN(r.quantity) || isNaN(r.purchase)) return;

    const price = isNaN(r.exit) || !r.exitDate ? r.current : r.exit;
    const multiplier = r.type === 'Option' ? r.multiplier : 1;

    if (r.action === 'Buy') {
      invested += r.quantity * r.purchase * multiplier;
      if (r.date.getMonth() === now) monthly += r.quantity * r.purchase * multiplier;
    }

    shares += r.quantity * multiplier;
    value += r.quantity * price * multiplier;
    perf.push({ ticker: r.ticker, gain: (price - r.purchase) * r.quantity * multiplier + r.dividend });

    dividends[r.ticker] = (dividends[r.ticker] || 0) + r.dividend;
    holdings[r.ticker] = (holdings[r.ticker] || 0) + r.quantity * multiplier;
    sectors[r.sector] = (sectors[r.sector] || 0) + r.quantity * multiplier;
    types[r.type] = (types[r.type] || 0) + r.quantity * multiplier;

    const month = r.date.toLocaleString('default', { month: 'short' });
    months[month] = (months[month] || 0) + (r.action === 'Buy' ? r.quantity * multiplier : -r.quantity * multiplier);
  });

  const gain = value - invested;
  const best = perf.sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  updateSummary(invested, value, gain, monthly, shares, best, worst);
  drawCharts({ dividends, holdings, sectors, months, types });
}
function save() {
  const rows = [...table.rows].map(row =>
    [...row.cells].map(cell => {
      const select = cell.querySelector('select');
      return select ? select.value : cell.innerText.trim();
    })
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
  localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
}

function load() {
  const data = JSON.parse(localStorage.getItem('portfolioData') || '[]');
  table.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      let td;
      if (i === 0) td = createDropdown(typeOptions, cell);
      else if (i === 5) td = createDropdown(sectorOptions, cell);
      else if (i === 7) td = createDropdown(actionOptions, cell);
      else if (i === 9) td = createDropdown(brokerOptions, cell);
      else td = createCell(cell);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  recalculate();
}

function exportCSV() {
  const rows = [...table.rows].map(row =>
    [...row.cells].map(cell => {
      const select = cell.querySelector('select');
      const value = select ? select.value : cell.innerText.trim();
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',')
  );
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'portfolio.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(Boolean);
    table.innerHTML = '';
    lines.forEach(line => {
      const cells = parseCSVLine(line);
      const tr = document.createElement('tr');
      cells.forEach((cell, i) => {
        let td;
        if (i === 0) td = createDropdown(typeOptions, cell);
        else if (i === 5) td = createDropdown(sectorOptions, cell);
        else if (i === 7) td = createDropdown(actionOptions, cell);
        else if (i === 9) td = createDropdown(brokerOptions, cell);
        else td = createCell(cell);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    recalculate();
    save();
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(cell => cell.trim());
}
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addRowBtn')?.addEventListener('click', () => {
    addRow();
    save();
  });

  document.getElementById('recalcBtn')?.addEventListener('click', recalculate);
  document.getElementById('updatePricesBtn')?.addEventListener('click', updatePrices);
  document.getElementById('saveBtn')?.addEventListener('click', save);
  document.getElementById('exportBtn')?.addEventListener('click', exportCSV);
  document.getElementById('csvInput')?.addEventListener('change', importCSV);
  document.querySelector('header button')?.addEventListener('click', toggleDarkMode);

  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
  }

  load();
  if (table.rows.length === 0) addRow();

  let debounce;
  table.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      recalculate();
      save();
    }, 400);
  });
});







