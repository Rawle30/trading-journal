const table = document.querySelector('#portfolioTable tbody');
const typeOptions = ['Stock', 'Option', 'ETF', 'Dividend'];
const actionOptions = ['Buy', 'Sell'];
const sectorOptions = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Utilities', 'Other'];

function toggleDarkMode() {
  document.body.classList.toggle('dark');
}

function createDropdownCell(value, options) {
  const td = document.createElement('td');
  const select = document.createElement('select');
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.text = opt;
    if (opt === value) option.selected = true;
    select.appendChild(option);
  });
  td.appendChild(select);
  return td;
}

function createTextCell(value) {
  const td = document.createElement('td');
  td.innerText = value;
  td.contentEditable = true;
  return td;
}
function addRow() {
  const tr = document.createElement('tr');
  const cells = [
    createDropdownCell('', typeOptions),
    createTextCell(''), // Ticker
    createTextCell(''), // Shares
    createTextCell(''), // Purchase Price
    createTextCell(''), // Current Price
    createDropdownCell('', actionOptions),
    createDropdownCell('', sectorOptions),
    createTextCell(''), // Dividend
    createTextCell(''), // Date
    createTextCell('...') // Gain/Loss
  ];
  cells.forEach(td => tr.appendChild(td));
  table.appendChild(tr);
}

function recalculateGainLoss() {
  [...table.rows].forEach(row => {
    const cells = row.cells;
    const qty = parseFloat(cells[2].innerText.trim());
    const purchase = parseFloat(cells[3].innerText.trim());
    const current = parseFloat(cells[4].innerText.trim());
    const gainCell = cells[9];

    if (!isNaN(qty) && !isNaN(purchase) && !isNaN(current)) {
      const gain = (current - purchase) * qty;
      gainCell.innerText = `$${gain.toFixed(2)}`;
      gainCell.className = gain >= 0 ? 'green' : 'red';
    } else {
      gainCell.innerText = '...';
      gainCell.className = '';
    }
  });
  updateMetrics();
  drawCharts();
}
function savePortfolio() {
  const rows = [...table.rows].map(row =>
    [...row.cells].slice(0, 9).map(cell => {
      const select = cell.querySelector('select');
      return select ? select.value : cell.innerText.trim();
    })
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
}

function loadPortfolio() {
  const data = JSON.parse(localStorage.getItem('portfolioData') || '[]');
  table.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      let td;
      if (i === 0) td = createDropdownCell(cell, typeOptions);
      else if (i === 5) td = createDropdownCell(cell, actionOptions);
      else if (i === 6) td = createDropdownCell(cell, sectorOptions);
      else td = createTextCell(cell);
      tr.appendChild(td);
    });
    tr.appendChild(createTextCell('...')); // Gain/Loss
    table.appendChild(tr);
  });
  recalculateGainLoss();
}

function exportCSV() {
  const rows = [...table.rows].map(row =>
    [...row.cells].slice(0, 9).map(cell => {
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
        if (i === 0) td = createDropdownCell(cell, typeOptions);
        else if (i === 5) td = createDropdownCell(cell, actionOptions);
        else if (i === 6) td = createDropdownCell(cell, sectorOptions);
        else td = createTextCell(cell);
        tr.appendChild(td);
      });
      tr.appendChild(createTextCell('...'));
      table.appendChild(tr);
    });
    recalculateGainLoss();
    savePortfolio();
  };
  reader.readAsText(file);
}
function updateMetrics() {
  let invested = 0, value = 0, shares = 0, monthly = 0;
  let perf = [], now = new Date().getMonth();

  [...table.rows].forEach(row => {
    const cells = row.cells;
    const qty = parseFloat(cells[2].innerText.trim());
    const price = parseFloat(cells[3].innerText.trim());
    const current = parseFloat(cells[4].innerText.trim());
    const dividend = parseFloat(cells[7].innerText.trim());
    const action = cells[5].querySelector('select')?.value || '';
    const ticker = cells[1].innerText.trim();
    const date = new Date(cells[8].innerText.trim());

    if (!isNaN(qty) && !isNaN(price)) {
      if (action === 'Buy') {
        invested += qty * price;
        if (date.getMonth() === now) monthly += qty * price;
      }
      shares += qty;
      value += qty * current;
      perf.push({ ticker, gain: (current - price) * qty + dividend });
    }
  });

  const gain = value - invested;
  const best = perf.sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  document.getElementById('investedCapital').innerText = `Invested Capital: $${invested.toFixed(2)}`;
  document.getElementById('portfolioValue').innerText = `Portfolio Value: $${value.toFixed(2)}`;
  document.getElementById('gainLoss').innerText = `Gain/Loss: $${gain.toFixed(2)}`;
  document.getElementById('gainLoss').className = `box ${gain >= 0 ? 'green' : 'red'}`;
  document.getElementById('monthlyInvestment').innerText = `Monthly Investment: $${monthly.toFixed(2)}`;
  document.getElementById('totalShares').innerText = `Total Shares Held: ${shares}`;
  document.getElementById('bestPerformer').innerText = `Best Performing: ${best}`;
  document.getElementById('worstPerformer').innerText = `Worst Performing: ${worst}`;
}

function drawCharts() {
  const dividendData = {}, sharesData = {}, sectorData = {}, monthData = {}, typeData = {};

  [...table.rows].forEach(row => {
    const cells = row.cells;
    const ticker = cells[1].innerText.trim();
    const qty = parseFloat(cells[2].innerText.trim());
    const dividend = parseFloat(cells[7].innerText.trim());
    const sector = cells[6].querySelector('select')?.value || '';
    const type = cells[0].querySelector('select')?.value || '';
    const action = cells[5].querySelector('select')?.value || '';
    const date = new Date(cells[8].innerText.trim());
    const month = date.toLocaleString('default', { month: 'short' });

    if (!isNaN(dividend)) dividendData[ticker] = (dividendData[ticker] || 0) + dividend;
    if (!isNaN(qty)) {
      sharesData[ticker] = (sharesData[ticker] || 0) + qty;
      sectorData[sector] = (sectorData[sector] || 0) + qty;
      typeData[type] = (typeData[type] || 0) + qty;
      monthData[month] = (monthData[month] || 0) + (action === 'Buy' ? qty : -qty);
    }
  });

  const chartConfigs = [
    { id: 'dividendChart', label: 'Dividends', data: dividendData, type: 'pie' },
    { id: 'sharesChart', label: 'Shares Held', data: sharesData, type: 'bar' },
    { id: 'sectorChart', label: 'Sectors', data: sectorData, type: 'doughnut' },
    { id: 'monthlyChart', label: 'Monthly Buy/Sell', data: monthData, type: 'line' },
    { id: 'allocationChart', label: 'Allocations', data: typeData, type: 'bar' }
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
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.body).getPropertyValue('--text')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.body).getPropertyValue('--text')
            }
          }
        } : {}
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', loadPortfolio);



