// ui.js - UI rendering

const optionStrategies = [
    'Covered Call', 'Married Put', 'Bull Call Spread', 'Bear Put Spread', 'Protective Collar',
    'Long Straddle', 'Long Strangle', 'Long Call Butterfly', 'Iron Condor', 'Iron Butterfly',
    'Jade Lizard', 'Long Call', 'Long Put', 'Short Call', 'Short Put', 'Bull Put Spread',
    'Bear Call Spread', 'Calendar Spread', 'Diagonal Spread', 'Ratio Spread'
];

function renderTrades(currentPrices = {}) {
    const tbody = document.querySelector('#trades-table tbody');
    tbody.innerHTML = '';
    trades.forEach((trade, index) => {
        const pl = calculatePl(trade, currentPrices[trade.symbol]);
        let additional = '';
        if (trade.type === 'etf') {
            additional = `Div: $${trade.dividend?.toFixed(2) || ''}, Pay: ${trade.payDate || ''}, Yield: ${trade.yield?.toFixed(2) || ''}%, Gain: $${trade.dividendGain?.toFixed(2) || ''}`;
        } else if (trade.type === 'option') {
            additional = `Delta: ${trade.greeks?.delta?.toFixed(2) || ''}`;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trade.type}</td>
            <td>${trade.symbol}</td>
            <td>${trade.qty}</td>
            <td>${trade.entryPrice}</td>
            <td>${trade.entryDate}</td>
            <td>${trade.exitPrice || ''}</td>
            <td>${trade.exitDate || ''}</td>
            <td class="${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}">${pl.toFixed(2)}</td>
            <td>${trade.broker || ''}</td>
            <td>${trade.notes || ''}</td>
            <td>${additional}</td>
            <td>
                <button onclick="editTrade(${index})">Edit</button>
                <button onclick="deleteTrade(${index}); renderTrades();">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    const totalPl = getCombinedPl(currentPrices);
    document.getElementById('total-pl').innerHTML = `<span class="${totalPl > 0 ? 'green' : totalPl < 0 ? 'red' : ''}">${totalPl.toFixed(2)}</span>`;
    renderPlPerBroker(currentPrices);
    renderRiskAnalytics();
}

function renderPlPerBroker(currentPrices) {
    const div = document.getElementById('pl-per-broker');
    div.innerHTML = '<h3>P/L per Broker</h3>';
    const brokers = getPlPerBroker(currentPrices);
    for (let broker in brokers) {
        const pl = brokers[broker];
        div.innerHTML += `<p>${broker}: <span class="${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}">${pl.toFixed(2)}</span></p>`;
    }
}

function renderCharts(currentPrices = {}) {
    // Equity Curve
    const equityCtx = document.getElementById('equityChart').getContext('2d');
    const equityData = calculateEquityCurve(currentPrices);
    new Chart(equityCtx, {
        type: 'line',
        data: {
            labels: equityData.map(d => d.date),
            datasets: [{ label: 'Equity', data: equityData.map(d => d.value), borderColor: 'teal' }]
        },
        options: { scales: { y: { beginAtZero: false } } }
    });

    // Pie Chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    const dist = calculateSymbolDistribution(currentPrices);
    const labels = Object.keys(dist);
    const values = Object.values(dist);
    const colors = ['#f00', '#0f0', '#00f', '#ff0']; // Extend as needed
    new Chart(pieCtx, {
        type: 'pie',
        data: { labels, datasets: [{ data: values, backgroundColor: colors }] }
    });
    const legend = document.getElementById('pieLegend');
    legend.innerHTML = labels.map((l, i) => `<li style="color: ${colors[i % colors.length]};">${l}: $${values[i].toFixed(2)}</li>`).join('');
}

function renderTicker(prices) {
    const ticker = document.getElementById('ticker');
    ticker.innerHTML = Object.entries(prices).map(([sym, price]) => `${sym}: $${price?.toFixed(2) || 'N/A'}`).join(' | ');
}

function renderAlerts() {
    const tbody = document.querySelector('#alerts-table tbody');
    tbody.innerHTML = trades.map(trade => `
        <tr>
            <td>${trade.symbol}</td>
            <td>${trade.entryPrice}</td>
            <td>Above/Below</td>
        </tr>
    `).join('');
}

function renderRiskAnalytics() {
    const curve = calculateEquityCurve({});
    const maxDd = calculateMaxDrawdown(curve);
    const sharpe = calculateSharpeRatio(getReturns(curve));
    document.getElementById('max-drawdown').textContent = `${maxDd.toFixed(2)}%`;
    document.getElementById('sharpe-ratio').textContent = sharpe.toFixed(2);
}

function showModal(trade = {}, index = null) {
    const modal = document.getElementById('modal');
    modal.style.display = 'block';
    document.getElementById('asset-type').value = trade.type || 'stock';
    document.getElementById('symbol').value = trade.symbol || '';
    document.getElementById('qty').value = trade.qty || '';
    document.getElementById('entry-price').value = trade.entryPrice || '';
    document.getElementById('entry-date').value = trade.entryDate || '';
    document.getElementById('exit-price').value = trade.exitPrice || '';
    document.getElementById('exit-date').value = trade.exitDate || '';
    document.getElementById('broker').value = trade.broker || '';
    document.getElementById('notes').value = trade.notes || '';
    document.getElementById('multiplier').value = trade.multiplier || 100;
    document.getElementById('strategy').value = trade.strategy || '';
    document.getElementById('strike').value = trade.strike || '';
    document.getElementById('expiration').value = trade.expiration || '';
    document.getElementById('call-put').value = trade.callPut || 'Call';
    toggleFields();
    const form = document.getElementById('trade-form');
    form.onsubmit = e => {
        e.preventDefault();
        const newTrade = {
            type: document.getElementById('asset-type').value,
            symbol: document.getElementById('symbol').value.toUpperCase(),
            qty: parseFloat(document.getElementById('qty').value),
            entryPrice: parseFloat(document.getElementById('entry-price').value),
            entryDate: document.getElementById('entry-date').value,
            exitPrice: parseFloat(document.getElementById('exit-price').value) || null,
            exitDate: document.getElementById('exit-date').value || null,
            broker: document.getElementById('broker').value,
            notes: document.getElementById('notes').value
        };
        if (newTrade.type === 'option') {
            newTrade.multiplier = parseFloat(document.getElementById('multiplier').value);
            newTrade.strategy = document.getElementById('strategy').value;
            newTrade.strike = parseFloat(document.getElementById('strike').value);
            newTrade.expiration = document.getElementById('expiration').value;
            newTrade.callPut = document.getElementById('call-put').value;
        }
        if (!validateTrade(newTrade)) {
            return;
        }
        if (index !== null) {
            updateTrade(index, newTrade);
        } else {
            addTrade(newTrade);
        }
        modal.style.display = 'none';
        renderTrades();
    };
}

function toggleFields() {
    const type = document.getElementById('asset-type').value;
    document.getElementById('option-fields').style.display = type === 'option' ? 'block' : 'none';
    document.getElementById('etf-fields').style.display = type === 'etf' ? 'block' : 'none';
}
