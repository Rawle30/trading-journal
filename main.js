import { fetchETFDividends } from './modules/api.js';
import { renderETFTable } from './modules/etf.js';
import { getAllTransactions, saveTransaction } from './modules/storage.js';
import { exportToCSV, importFromCSV } from './modules/csv.js';
import { renderGrowthChart } from './modules/reinvestment.js';
import { renderChart } from './modules/chart.js';

const etfTickers = ['VTI', 'VOO', 'SCHD'];

async function init() {
  const etfs = await fetchETFDividends(etfTickers);
  renderETFTable(etfs);
  renderChart(etfs);
  renderGrowthChart({
    initialInvestment: 15000,
    annualYield: 0.032,
    frequency: 4,
    years: 15,
    reinvest: true,
    growthRate: 0.055,
    dividendGrowth: 0.02
  });
}

init();

// Dark mode toggle
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

// Export CSV
document.getElementById('exportCSV').addEventListener('click', async () => {
  const data = await getAllTransactions();
  exportToCSV(data);
});

// Import CSV
document.getElementById('importCSV').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    importFromCSV(file, async data => {
      for (const tx of data) await saveTransaction(tx);
      alert('CSV imported successfully!');
    });
  }
});

