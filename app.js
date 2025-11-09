import { fetchCurrentPrice, renderGainLossCell } from './price.js';

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
    createTextCell('Fetching...'), // Current Price (auto-filled)
    createDropdownCell('', sectorOptions),
    createTextCell(''), // Dividend
    createDropdownCell('', actionOptions),
    createTextCell(''), // Date
    createTextCell('...') // Gain/Loss (auto-filled)
  ];
  cells.forEach(td => tr.appendChild(td));
  table.appendChild(tr);
}

function savePortfolio() {
  const rows = [...table.rows].map(row =>
    [...row.cells].slice(0, 9).map(cell => {
      const select = cell.querySelector('select');
      return select ? select.value : cell.innerText.trim();
    })
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
  updateMetrics(rows);
  drawCharts(rows);
}

function loadPortfolio() {
  const data = JSON.parse(localStorage.getItem('portfolioData') || '[]');
  table.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      let td;
      if (i === 0) td = createDropdownCell(cell, typeOptions);
      else if (i === 7) td = createDropdownCell(cell, actionOptions);
      else if (i === 5) td = createDropdownCell(cell, sectorOptions);
      else td = createTextCell(cell);
      tr.appendChild(td);
    });

    const currentPriceTd = createTextCell('Fetching...');
    tr.insertBefore(currentPriceTd, tr.children[4]);

    const gainTd = document.createElement('td');
    gainTd.innerText = '...';
    tr.appendChild(gainTd);
    table.appendChild(tr);

    const [type, ticker, qty, price, , sector, div, action, date] = row;
    const q = parseFloat(qty), p = parseFloat(price);

    fetchCurrentPrice(ticker).then(current => {
      if (!isNaN(current)) {
        currentPriceTd.innerText = current.toFixed(2);
        const gainCell = renderGainLossCell(p, current, q);
        tr.replaceChild(gainCell, gainTd);
      } else {
        currentPriceTd.innerText = 'N/A';
        gainTd.innerText = 'N/A';
      }
    });
  });
  updateMetrics(data);
  drawCharts(data);
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
      const tr = document.createElement('tr');
      line.split(',').forEach((cell, i) => {
        let td;
        const value = cell.replace(/"/g, '');
        if (i === 0) td = createDropdownCell(value, typeOptions);
        else if (i === 7) td = createDropdownCell(value, actionOptions);
        else if (i === 5) td = createDropdownCell(value, sectorOptions);
        else td = createTextCell(value);
        tr.appendChild(td);
      });

      const currentPriceTd = createTextCell('Fetching...');
      tr.insertBefore(currentPriceTd, tr.children[4]);

      const gainTd = document.createElement('td');
      gainTd.innerText = '...';
      tr.appendChild(gainTd);
      table.appendChild(tr);

      const [type, ticker, qty, price, , sector, div, action, date] = line.split(',').map(c => c.replace(/"/g, ''));
      const q = parseFloat(qty), p = parseFloat(price);

      fetchCurrentPrice(ticker).then(current => {
        if (!isNaN(current)) {
          currentPriceTd.innerText = current.toFixed(2);
          const gainCell = renderGainLossCell(p, current, q);
          tr.replaceChild(gainCell, gainTd);
        } else {
          currentPriceTd.innerText = 'N/A';
          gainTd.innerText = 'N/A';
        }
      });
    });
    savePortfolio();
  };
  reader.readAsText(file);
}

function updateMetrics(data) {
  let invested = 0, value = 0, shares = 0, monthly = 0;
  let perf = [], now = new Date().getMonth();

  data.forEach(([type, ticker, qty, price, , sector, div, action, date]) => {
    const q = parseFloat(qty), p = parseFloat(price), d = parseFloat(div || 0);
    if (action.toLowerCase() === 'buy') {
      invested += q * p;
      shares += q;
      if (new Date(date).getMonth() === now) monthly += q * p;
    }
    value += q * p;
    perf.push({ ticker, gain: d + (q * p) });
  });

  const gain = value - invested;
  const best = perf.sort((a,b) => b.gain - a.gain)[0]?.ticker || '-';
  const worst = perf.sort((a,b) => a.gain - b.gain)[0]?.ticker || '-';

  document.getElementById('investedCapital').innerText = `Invested Capital: $${invested.toFixed(2)}`;
  document.getElementById('portfolioValue').innerText = `Portfolio Value: $${value.toFixed(2)}`;
  document.getElementById('gainLoss').innerText = `Gain/Loss: $${gain.toFixed(2)}`;
  document.getElementById('gainLoss').className = `summary-box ${gain >= 0 ? 'green' : 'red'}`;
  document.getElementById('monthlyInvestment').innerText = `Monthly Investment: $${monthly.toFixed(2)}`;
  document.getElementById('totalShares').innerText = `Total Shares Held: ${shares}`;
  document.getElementById('bestPerformer').innerText = `Best Performing: ${best}`;
  document.getElementById('worstPerformer').innerText = `Worst Performing: ${worst}`;
}

function drawCharts(data) {
  const ctxs = ['dividendChart','sharesChart','sectorChart','monthlyChart','allocationChart'].map(id => {
    const canvas = document.getElementById(id);
    return canvas.getContext('2d');
  });

  const tickers = {}, sectors = {}, months = {}, dividends = {}, types = {};

  data.forEach(([type, ticker, qty, price, , sector, div, action, date]) => {
    const q = parseFloat(qty), d = parseFloat(div || 0);
    tickers[ticker] = (tickers[ticker] || 0) + q;
    sectors[sector] = (sectors[sector] || 0) + q;
    dividends[ticker] = (dividends[ticker] || 0) + d;
    types[type] = (types[type] || 0) + q;
    const m = new Date(date).toLocaleString('default', { month: 'short' });
    months[m] = (months[m] || 0) + (action.toLowerCase() === 'buy' ? 1 : -1);
  });

  const chartData = [
    { ctx: ctxs[0], label: 'Dividends', data: dividends },
    { ctx: ctxs[1], label: 'Shares Held', data: tickers },
    { ctx: ctxs[2], label: 'Sectors', data: sectors },
    { ctx: ctxs[3], label: 'Monthly Buy/Sell', data: months },
    { ctx: ctxs[4], label: 'Allocations', data: types }
  ];

  chartData.forEach(({ctx, label, data}) => {
    new Chart(ctx, {
      type: label === 'Monthly Buy/Sell' ? 'line' : (label === 'Sectors' ? 'doughnut' : (label === 'Allocations' ? 'bar' : 'pie')),
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
        scales: label === 'Monthly Buy/Sell' || label === 'Allocations' ? {
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

loadPortfolio();

 

