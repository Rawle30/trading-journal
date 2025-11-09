const table = document.querySelector('#portfolio tbody');
const typeOptions = ['Stock', 'Option', 'ETF', 'Dividend'];
const actionOptions = ['Buy', 'Sell'];
const sectorOptions = ['Tech', 'Finance', 'Health', 'Energy', 'Consumer', 'Utilities', 'Other'];

function toggleDarkMode() {
  document.body.classList.toggle('dark');
}

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
  return td;
}

function parseQtyPrice(cell) {
  const [qty, price] = cell.split('@').map(s => parseFloat(s.trim()));
  return [qty || 0, price || 0];
}
function addRow() {
  const tr = document.createElement('tr');
  tr.appendChild(createDropdownCell('', typeOptions));     // Type
  tr.appendChild(createTextCell(''));                      // Ticker
  tr.appendChild(createTextCell(''));                      // Quantity
  tr.appendChild(createTextCell(''));                      // Purchase Price
  tr.appendChild(createTextCell(''));                      // Current Price
  tr.appendChild(createDropdownCell('', sectorOptions));   // Sector
  tr.appendChild(createTextCell(''));                      // Dividend
  tr.appendChild(createDropdownCell('', actionOptions));   // Action
  tr.appendChild(createTextCell(''));                      // Date
  table.appendChild(tr);
}


function recalculate() {
  let invested = 0, value = 0, shares = 0, monthly = 0;
  const perf = [], now = new Date().getMonth();
  const dividends = {}, holdings = {}, sectors = {}, months = {}, types = {};

  [...table.rows].forEach(row => {
    const [typeSel, tickerCell, qtyPriceCell, currentCell, sectorSel, actionSel, dateCell] = row.cells;
    const type = typeSel.querySelector('select').value;
    const sector = sectorSel.querySelector('select').value;
    const action = actionSel.querySelector('select').value;
    const ticker = tickerCell.innerText.trim();
    const [qty, price] = parseQtyPrice(qtyPriceCell.innerText);
    const current = parseFloat(currentCell.innerText.trim());
    const date = new Date(dateCell.innerText.trim());
    const month = date.toLocaleString('default', { month: 'short' });

    if (!isNaN(qty) && !isNaN(price)) {
      if (action === 'Buy') {
        invested += qty * price;
        if (date.getMonth() === now) monthly += qty * price;
      }
      shares += qty;
      value += qty * current;
      perf.push({ ticker, gain: (current - price) * qty });
      holdings[ticker] = (holdings[ticker] || 0) + qty;
      sectors[sector] = (sectors[sector] || 0) + qty;
      types[type] = (types[type] || 0) + qty;
      months[month] = (months[month] || 0) + (action === 'Buy' ? qty : -qty);
    }
  });

  const gain = value - invested;
  const best = perf.sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  updateSummary(invested, value, gain, monthly, shares, best, worst);
  drawCharts({ dividends, holdings, sectors, months, types });
}
function updateSummary(invested, value, gain, monthly, shares, best, worst) {
  document.getElementById('invested').innerText = `Invested: $${invested.toFixed(2)}`;
  document.getElementById('value').innerText = `Value: $${value.toFixed(2)}`;
  const gainBox = document.getElementById('gain');
  gainBox.innerText = `Gain/Loss: $${gain.toFixed(2)}`;
  gainBox.className = gain > 0 ? 'green' : gain < 0 ? 'red' : 'neutral';
  document.getElementById('monthly').innerText = `Monthly: $${monthly.toFixed(2)}`;
  document.getElementById('shares').innerText = `Shares: ${shares}`;
  document.getElementById('best').innerText = `Best: ${best}`;
  document.getElementById('worst').innerText = `Worst: ${worst}`;
}

function drawCharts(dataSets) {
  const chartConfigs = [
    { id: 'dividends', label: 'Dividends', data: dataSets.dividends, type: 'pie' },
    { id: 'holdings', label: 'Holdings', data: dataSets.holdings, type: 'bar' },
    { id: 'sectors', label: 'Sectors', data: dataSets.sectors, type: 'doughnut' },
    { id: 'monthlyChart', label: 'Monthly Buy/Sell', data: dataSets.months, type: 'line' },
    { id: 'allocations', label: 'Allocations', data: dataSets.types, type: 'bar' }
  ];

  chartConfigs.forEach(({ id, label, data, type }) => {
    const ctx = document.getElementById(id).getContext('2d');
    new Chart(ctx, {
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
          legend: { display: true },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: type === 'bar' || type === 'line' ? {
          y: { beginAtZero: true },
          x: {}
        } : {}
      }
    });
  });
}
function save() {
  const rows = [...table.rows].map(row =>
    [...row.cells].map(cell => {
      const select = cell.querySelector('select');
      return select ? select.value : cell.innerText.trim();
    })
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
}

function load() {
  const data = JSON.parse(localStorage.getItem('portfolioData') || '[]');
  table.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      let td;
      if (i === 0) td = createDropdown(typeOptions, cell);
      else if (i === 4) td = createDropdown(sectorOptions, cell);
      else if (i === 5) td = createDropdown(actionOptions, cell);
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
      return `"${select ? select.value : cell.innerText.trim()}"`;
    }).join(',')
  );
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'portfolio.csv';
  a.click();
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n');
    table.innerHTML = '';
    lines.forEach(line => {
      const row = line.split(',').map(cell => cell.replace(/"/g, '').trim());
      const tr = document.createElement('tr');
      row.forEach((cell, i) => {
        let td;
        if (i === 0) td = createDropdown(typeOptions, cell);
        else if (i === 4) td = createDropdown(sectorOptions, cell);
        else if (i === 5) td = createDropdown(actionOptions, cell);
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

document.addEventListener('DOMContentLoaded', load);




