import Chart from 'chart.js/auto';

export function renderChart(etfs) {
  const ctx = document.getElementById('allocationChart').getContext('2d');
  const labels = etfs.map(e => e.ticker);
  const data = etfs.map(e => e.shares);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        label: 'ETF Allocation',
        data,
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'],
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}
