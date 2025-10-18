// js/ui.js
import { addAlert } from './alerts.js';
import { normalizeTrade, validateTrade } from './data.js';
import { saveTrades, loadTrades } from './storage.js';

export let tradesData = [];

export function initUI() {
  tradesData = loadTrades();
  renderTradesTable();

  document.getElementById('trade-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const trade = normalizeTrade(Object.fromEntries(new FormData(form)));
    if (validateTrade(trade)) {
      tradesData.push(trade);
      saveTrades(tradesData);
      renderTradesTable();
      form.reset();
    } else {
      alert('Invalid trade data');
    }
  });

  document.getElementById('alert-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const symbol = form['alert-symbol'].value.toUpperCase();
    const threshold = parseFloat(form['threshold'].value);
    const condition = form['condition'].value;
    if (symbol && threshold > 0) {
      addAlert(symbol, threshold, condition);
      form.reset();
    }
  });
}

export function renderTradesTable() {
  const tbody = document.querySelector('#trades-table tbody');
  tbody.innerHTML = '';
  tradesData.forEach(trade => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${trade.broker}</td>
      <td>${trade.symbol}</td>
      <td>${trade.type}</td>
      <td>${trade.date}</td>
      <td>${trade.exitDate || ''}</td>
      <td>${trade.qty}</td>
      <td>${trade.entry}</td>
      <td>${trade.exit || ''}</td>
      <td>${trade.stopLoss || ''}</td>
      <td></td>
      <td>${trade.multiplier}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td>${trade.fees}</td>
      <td>${trade.notes}</td>
      <td>${trade.tags.join(', ')}</td>
      <td><button class="delete-btn">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}
