export let alerts = [];

export function addAlert(symbol, threshold, condition) {
  alerts.push({ symbol, threshold, condition });
  renderAlerts();
}

export function checkAlerts(currentPrices) {
  alerts.forEach(alert => {
    const price = currentPrices[alert.symbol];
    if (!price) return;
    const triggered = alert.condition === 'above'
      ? price > alert.threshold
      : price < alert.threshold;
    if (triggered) {
      alertUser(alert.symbol, price, alert.condition, alert.threshold);
    }
  });
}

function alertUser(symbol, price, condition, threshold) {
  alert(`Alert triggered for ${symbol}: ${price} is ${condition} ${threshold}`);
}

export function renderAlerts() {
  const container = document.getElementById('alert-list');
  container.innerHTML = '';
  alerts.forEach((a, i) => {
    const div = document.createElement('div');
    div.className = 'alert-item';
    div.textContent = `${a.symbol} ${a.condition} ${a.threshold}`;
    container.appendChild(div);
  });
}

