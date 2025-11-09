function createCell(value = '') {
  const td = document.createElement('td');
  td.contentEditable = true;
  td.innerText = value;
  return td;
}

window.addRow = function () {
  const tr = document.createElement('tr');
  ['','','','','...'].forEach((val, i) => {
    const td = i < 4 ? createCell(val) : document.createElement('td');
    if (i === 4) td.innerText = '...';
    tr.appendChild(td);
  });
  document.querySelector('#portfolioTable tbody').appendChild(tr);
};

window.savePortfolio = function () {
  const rows = [...document.querySelectorAll('#portfolioTable tbody tr')].map(row =>
    [...row.cells].map(cell => cell.innerText.trim())
  );
  localStorage.setItem('portfolioData', JSON.stringify(rows));
};

window.recalculateGainLoss = function () {
  [...document.querySelectorAll('#portfolioTable tbody tr')].forEach(row => {
    const [ticker, qty, price, current] = row.cells.map(c => parseFloat(c.innerText.trim()));
    const gain = (!isNaN(qty) && !isNaN(price) && !isNaN(current)) ? (current - price) * qty : '...';
    row.cells[4].innerText = typeof gain === 'number' ? `$${gain.toFixed(2)}` : '...';
  });
};


