// charts.js
// No imports needed; Chart, zoomPlugin, and annotationPlugin are global
Chart.register(window['chartjs-plugin-zoom']); // Register zoom plugin
// Assuming annotationPlugin is registered globally if needed

/**
 * @type {Chart | null}
 */
export let equityCurveChart = null;

/**
 * @type {Chart | null}
 */
export let symbolPieChart = null;

/**
 * Generates a random color in hex format.
 * @returns {string} Hex color code.
 */
function generateRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/**
 * Initializes the equity curve line chart.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 */
export function initEquityCurveChart(ctx) {
  ctx.canvas.setAttribute('aria-label', 'Equity Curve Chart');
  equityCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Equity Curve',
        data: [],
        borderColor: '#5DE2E7',
        backgroundColor: 'rgba(93, 226, 231, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        },
        tooltip: {
          enabled: true // Ensures tooltips for accessibility
        }
      },
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Value' } }
      }
    }
  });
}

/**
 * Updates the equity curve chart with new data.
 * @param {Array<{date: string, value: number}>} data - Array of data points.
 */
export function updateEquityCurve(data) {
  if (!equityCurveChart) return;
  if (!Array.isArray(data)) {
    console.error('Invalid data: Must be an array.');
    return;
  }
  const validData = data.filter(d => typeof d.date === 'string' && typeof d.value === 'number');
  if (validData.length !== data.length) {
    console.warn('Some data points were invalid and skipped.');
  }
  equityCurveChart.data.labels = validData.map(d => d.date);
  equityCurveChart.data.datasets[0].data = validData.map(d => d.value);
  equityCurveChart.update();
}

/**
 * Resets the zoom on the specified chart.
 * @param {string} chartId - The ID of the chart ('equity-curve-chart' or 'symbol-pie-chart').
 */
export function resetZoom(chartId) {
  let chart;
  if (chartId === 'equity-curve-chart') {
    chart = equityCurveChart;
  } else if (chartId === 'symbol-pie-chart') {
    chart = symbolPieChart;
  } else {
    console.error('Invalid chartId.');
    return;
  }
  if (chart) {
    try {
      if (chart.options.plugins.zoom) {
        chart.resetZoom();
      } else {
        console.warn('Zoom not enabled on this chart.');
      }
    } catch (e) {
      console.error('Failed to reset zoom:', e.message);
    }
  }
}

/**
 * Initializes the symbol pie chart.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 */
export function initSymbolPieChart(ctx) {
  ctx.canvas.setAttribute('aria-label', 'Symbol Allocation Pie Chart');
  symbolPieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ['#E4080A', '#7DDA58', '#FFDE59', '#5DE2E7', '#FE9900', '#DFC57B']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          enabled: true // Ensures tooltips for accessibility
        }
      }
    }
  });
}

/**
 * Updates the symbol pie chart with new data.
 * @param {Array<{symbol: string, value: number}>} data - Array of data points.
 */
export function updateSymbolPieChart(data) {
  if (!symbolPieChart) return;
  if (!Array.isArray(data)) {
    console.error('Invalid data: Must be an array.');
    return;
  }
  const validData = data.filter(d => typeof d.symbol === 'string' && typeof d.value === 'number' && d.value >= 0);
  if (validData.length !== data.length) {
    console.warn('Some data points were invalid (e.g., negative values or missing fields) and skipped.');
  }
  symbolPieChart.data.labels = validData.map(d => d.symbol);
  symbolPieChart.data.datasets[0].data = validData.map(d => d.value);

  // Dynamically generate additional colors if needed
  const defaultColors = ['#E4080A', '#7DDA58', '#FFDE59', '#5DE2E7', '#FE9900', '#DFC57B'];
  let colors = [...defaultColors];
  while (colors.length < validData.length) {
    colors.push(generateRandomColor());
  }
  symbolPieChart.data.datasets[0].backgroundColor = colors.slice(0, validData.length);

  symbolPieChart.update();
}

/**
 * Destroys the equity curve chart to free resources.
 */
export function destroyEquityCurveChart() {
  if (equityCurveChart) {
    equityCurveChart.destroy();
    equityCurveChart = null;
  }
}

/**
 * Destroys the symbol pie chart to free resources.
 */
export function destroySymbolPieChart() {
  if (symbolPieChart) {
    symbolPieChart.destroy();
    symbolPieChart = null;
  }
}

/**
 * Destroys all charts to free resources.
 */
export function destroyAllCharts() {
  destroyEquityCurveChart();
  destroySymbolPieChart();
}
