const API_KEY = 'FTDRTP0955507PPC'; // Replace with your real key

export async function fetchCurrentPrice(ticker) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return parseFloat(data['Global Quote']['05. price']);
  } catch (err) {
    console.error(`Error fetching price for ${ticker}:`, err);
    return null;
  }
}

export function renderGainLossCell(purchasePrice, currentPrice, shares) {
  const gain = (currentPrice - purchasePrice) * shares;
  const td = document.createElement('td');
  td.className = gain >= 0 ? 'green' : 'red';

  const icon = document.createElement('span');
  icon.innerText = gain >= 0 ? '📈' : '📉';
  icon.style.marginRight = '0.5rem';

  const bar = document.createElement('div');
  bar.style.height = '8px';
  bar.style.width = `${Math.min(Math.abs(gain), 100)}%`;
  bar.style.background = gain >= 0 ? 'green' : 'red';
  bar.style.marginTop = '4px';

  td.appendChild(icon);
  td.append(`$${gain.toFixed(2)}`);
  td.appendChild(bar);
  return td;
}
