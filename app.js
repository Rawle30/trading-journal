const typeOptions = ['Stock', 'Option', 'ETF'];
const actionOptions = ['Buy', 'Sell'];

function createDropdown(options, value = '') {
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

function createCell(value = '') {
  const td = document.createElement('td');
  td.contentEditable = true;
  td.innerText = value;
  return td;
}

function addRow() {
  const tr = document.createElement('tr');
  tr.appendChild(createDropdown(typeOptions));
  tr.appendChild(createCell('')); // Ticker
  tr.appendChild(createCell('')); // Shares
  tr.appendChild(createCell('')); // Purchase Price
  tr.appendChild(createCell('')); // Current Price
  tr.appendChild(createDropdown(actionOptions));
  tr.appendChild(createCell('')); // Date
  const gainCell = document.createElement('td');
  gainCell.innerText = '...';
  tr.appendChild(gainCell);
  document.querySelector('#portfolioTable tbody').appendChild(tr);
}

function recalculateGainLoss() {
  const rows = document.querySelectorAll('#portfolioTable tbody tr');
  rows.forEach(row => {
    const cells = row.cells;
    const shares = parseFloat(cells[2].innerText.trim());
    const purchase = parseFloat(cells[3].innerText.trim());
    const current = parseFloat(cells[4].innerText.trim());
    const gainCell = cells[7];

    if (!isNaN(shares) && !isNaN(purchase) && !isNaN(current)) {
      const gain = (current - purchase) * shares;
      gainCell.innerText = `$${gain.toFixed(2)}`;
      gainCell.className = gain >= 0 ? 'green' : 'red';
    } else {
      gainCell.innerText = '...';
      gainCell.className = '';
    }
  });
  drawCharts();
}

function savePortfolio() {
  const rows = [...document.querySelectorAll('#portfolioTable tbody tr')].map(row =>
    [...row.cells].slice(0, 7).map(cell => {
      const select = cell.querySelector('select');
      return select ? select.value : cell.innerText.trim();
    })
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
}

function loadPortfolio() {
  const data = JSON.parse(localStorage.getItem('portfolioData') || '[]');
  const tbody = document.querySelector('#portfolioTable tbody');
  tbody.innerHTML = '';
  data.forEach(([type, ticker, shares, price, current, action, date]) => {
    const tr = document.createElement('tr');
    tr.appendChild(createDropdown(typeOptions, type));
    tr.appendChild(createCell(ticker));
    tr.appendChild(createCell(shares));
    tr.appendChild(createCell(price));
    tr.appendChild(createCell(current));
    tr.appendChild(createDropdown(actionOptions, action));
    tr.appendChild(createCell(date));
    const gainCell = document.createElement('td');
    gainCell.innerText = '...';
    tr.appendChild(gainCell);
    tbody.appendChild(tr);
  });
  recalculateGainLoss();
}

function exportCSV() {
  const rows = [...document.querySelectorAll('#portfolioTable tbody tr')].map(row =>
    [...row.cells].slice(0, 7).map(cell => {
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
    const tbody = document.querySelector('#portfolioTable tbody');
    tbody.innerHTML = '';
    lines.forEach(line => {
      const [type, ticker, shares, price, current, action, date] = line.split(',').map(cell => cell.replace(/"/g, '').trim());
      const tr = document.createElement('tr');
      tr.appendChild(createDropdown(typeOptions, type));
      tr.appendChild(createCell(ticker));
      tr.appendChild(createCell(shares));
      tr.appendChild(createCell(price));
      tr.appendChild(createCell(current));
      tr.appendChild(createDropdown(actionOptions, action));
      tr.appendChild(createCell(date));
      const gainCell = document.createElement('td');
      gainCell.innerText = '...';
      tr.appendChild(gainCell);
      tbody.appendChild(tr);
    });
    recalculateGainLoss();
    savePortfolio();
  };
  reader.readAsText(file);
}

function drawCharts() {
  const rows = [...document.querySelectorAll('#portfolioTable tbody tr')];
  const typeData = {};
  const monthData = {};

  rows.forEach(row => {
    const type = row.cells[0].querySelector('select')?.value || '';
    const shares = parseFloat(row.cells[2].innerText.trim());
    const date = row.cells[6].innerText.trim();
    const month = new Date(date).toLocaleString('default', { month: 'short' });

    if (!isNaN(shares)) {
      typeData[type] = (typeData[type] || 0) + shares;
      monthData[month] = (monthData[month] || 0) + shares;
    }
  });

  new Chart(document.getElementById('allocationChart').getContext('2d'), {
    type: 'pie',
    data: {
      labels: Object.keys(typeData),
      datasets: [{
        label: 'Asset Allocation',
        data: Object.values(typeData),
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffc107'
      ],
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: true },
      tooltip: { mode: 'index', intersect: false }
    }
  }
});

new Chart(document.getElementById('monthlyChart').getContext('2d'), {
  type: 'bar',
  data: {
    labels: Object.keys(monthData),
    datasets: [{
      label: 'Monthly Activity',
      data: Object.values(monthData),
      backgroundColor: '#2196f3'
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
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
    }
  }
});
}

document.addEventListener('DOMContentLoaded', loadPortfolio);


