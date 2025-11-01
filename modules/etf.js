import { saveTransaction } from './storage.js';

export function renderETFTable(data) {
  const tbody = document.getElementById('etfTable');
  tbody.innerHTML = '';

  data.forEach((etf, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td contenteditable="true" data-field="ticker">${etf.ticker}</td>
      <td contenteditable="true" data-field="fundName">${etf.fundName}</td>
      <td contenteditable="true" data-field="shares">${etf.shares}</td>
      <td contenteditable="true" data-field="dividend">${etf.dividend}</td>
      <td contenteditable="true" data-field="yield">${etf.yield}</td>
      <td contenteditable="true" data-field="frequency">${etf.frequency}</td>
      <td contenteditable="true" data-field="exDate">${etf.exDate}</td>
      <td contenteditable="true" data-field="payDate">${etf.payDate}</td>
      <td contenteditable="true" data-field="reinvested">${etf.reinvested}</td>
      <td><button onclick="saveETFRow(${index})">💾 Save</button></td>
    `;
    tbody.appendChild(row);
  });
}

window.saveETFRow = function(index) {
  const row = document.querySelectorAll('#etfTable tr')[index];
  const cells = row.querySelectorAll('[contenteditable]');
  const updated = {};
  cells.forEach(cell => {
    updated[cell.dataset.field] = cell.textContent.trim();
  });
  saveTransaction(updated);
  alert('ETF row saved!');
}
