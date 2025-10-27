// app.js
// Inspired by features from Tradervue, TraderSync, TradesViz, Trademetria, and Edgewonk: automated analytics, options support, risk management, charts.

let trades = [];
let apiKeys = {
    alpha_vantage: ['I3AR7KSM7UR0RYLA', 'FTDRTP0955507PPC'],
    finnhub: 'NwqcDCmG_VpyNGIpeiubgB3f26ztrPLB',
    polygon: 'd33kp6hr01qib1p1fe9gd33kp6hr01qib1p1fea0',
    yahoo: null // No key needed
};
let selectedApi = 'alpha_vantage';
const apiOrder = ['alpha_vantage', 'finnhub', 'polygon', 'yahoo']; // For fallback
let editingIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
    loadTrades();
    updateTicker();
    updateTable();
    updateSummary();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
    document.getElementById('refresh-prices').addEventListener('click', refreshPrices);
    document.getElementById('save-api-key').addEventListener('click', saveApiKey);
    document.getElementById('trade-form').addEventListener('submit', handleTradeSubmit);
    document.getElementById('import-csv').addEventListener('click', () => document.getElementById('csv-file').click());
    document.getElementById('csv-file').addEventListener('change', importCSV);
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('asset-type').addEventListener('change', toggleOptionsFields);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

async function refreshPrices() {
    for (let trade of trades) {
        try {
            trade.currentPrice = await getCurrentPriceWithFallback(trade.symbol, trade.assetType);
            if (trade.assetType === 'etf') {
                trade.dividends = await getDividends(trade.symbol);
                trade.dividendGain = (trade.dividends?.dividend || 0) * trade.quantity;
            }
        } catch (error) {
            console.error('Error refreshing price:', error);
        }
    }
    saveTrades();
    updateTable();
    updateSummary();
}

function saveApiKey() {
    const key = document.getElementById('api-key-input').value;
    selectedApi = document.getElementById('api-provider').value;
    if (selectedApi !== 'yahoo') {
        apiKeys[selectedApi] = key;
    }
    alert('API Key saved');
}

function handleTradeSubmit(e) {
    e.preventDefault();
    const symbol = document.getElementById('symbol').value.toUpperCase();
    const assetType = document.getElementById('asset-type').value;
    const quantity = parseFloat(document.getElementById('quantity').value);
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;
    const entryPrice = parseFloat(document.getElementById('entry-price').value);
    const entryDate = document.getElementById('entry-date').value;
    const exitPrice = parseFloat(document.getElementById('exit-price').value || 0);
    const exitDate = document.getElementById('exit-date').value;
    const broker = document.getElementById('broker').value;
    const notes = document.getElementById('notes').value;
    const stopLoss = parseFloat(document.getElementById('stop-loss').value || 0);
    const takeProfit = parseFloat(document.getElementById('take-profit').value || 0);

    if (!validateInputs({symbol, quantity, entryPrice, entryDate})) return;

    let trade = { symbol, assetType, quantity, multiplier, entryPrice, entryDate, exitPrice, exitDate, broker, notes, stopLoss, takeProfit, dividendGain: 0 };

    if (assetType === 'options') {
        trade.strike = parseFloat(document.getElementById('strike').value);
        trade.expiration = document.getElementById('expiration').value;
        trade.optionType = document.getElementById('option-type').value;
        trade.volatility = parseFloat(document.getElementById('volatility').value);
        trade.riskFreeRate = parseFloat(document.getElementById('risk-free-rate').value);
        trade.greeks = calculateGreeks(trade);
        trade.multiplier = multiplier || 100; // Default for options
    }

    // Risk management example: Alert if potential loss > 2% assuming account size 100k
    const accountSize = 100000; // Placeholder
    const risk = (entryPrice - stopLoss) * quantity * trade.multiplier / accountSize;
    if (risk > 0.02) alert('Warning: Risk exceeds 2% of account');

    if (editingIndex !== -1) {
        trades[editingIndex] = trade;
        editingIndex = -1;
        document.getElementById('submit-button').textContent = 'Add Trade';
    } else {
        trades.push(trade);
    }
    saveTrades();
    updateTable();
    updateSummary();
    resetForm();
}

function resetForm() {
    document.getElementById('trade-form').reset();
    toggleOptionsFields();
}

function validateInputs(inputs) {
    if (isNaN(inputs.quantity) || inputs.quantity <= 0) {
        alert('Invalid quantity');
        return false;
    }
    if (isNaN(inputs.entryPrice) || inputs.entryPrice <= 0) {
        alert('Invalid entry price');
        return false;
    }
    // Add more validations as needed
    return true;
}

function toggleOptionsFields() {
    const type = document.getElementById('asset-type').value;
    document.getElementById('options-fields').style.display = type === 'options' ? 'block' : 'none';
    document.getElementById('multiplier').value = type === 'options' ? 100 : 1;
}

function updateTable() {
    const tbody = document.querySelector('#trades-table tbody');
    tbody.innerHTML = '';
    trades.forEach((trade, index) => {
        const pl = calculatePL(trade);
        const combined = pl + (trade.dividendGain || 0);
        const colorClass = combined > 0 ? 'green' : combined < 0 ? 'red' : '';
        let greeksHtml = '';
        if (trade.assetType === 'options') {
            const greeks = calculateGreeks(trade);
            greeksHtml = `Delta: ${greeks.delta.toFixed(2)}, Gamma: ${greeks.gamma.toFixed(2)}, Theta: ${greeks.theta.toFixed(2)}, Vega: ${greeks.vega.toFixed(2)}, Rho: ${greeks.rho.toFixed(2)}`;
        }
        let dividendsHtml = '';
        if (trade.assetType === 'etf' && trade.dividends) {
            const gain = trade.dividendGain;
            dividendsHtml = `Symbol: ${trade.dividends.symbol}, Dividend: ${trade.dividends.dividend}, Pay Date: ${trade.dividends.payDate}, Yield: ${trade.dividends.yield}%, Gain: <span class="${gain > 0 ? 'green' : 'red'}">${gain.toFixed(2)}</span>`;
        }
        const row = `
            <tr>
                <td>${trade.symbol}</td>
                <td>${trade.assetType}</td>
                <td>${trade.quantity}</td>
                <td>${trade.multiplier}</td>
                <td>${trade.entryPrice}</td>
                <td>${trade.entryDate}</td>
                <td>${trade.exitPrice || ''}</td>
                <td>${trade.exitDate || ''}</td>
                <td>${trade.currentPrice || 'N/A'}</td>
                <td class="${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}">${pl.toFixed(2)}</td>
                <td class="${trade.dividendGain > 0 ? 'green' : 'red'}">${(trade.dividendGain || 0).toFixed(2)}</td>
                <td class="${colorClass}">${combined.toFixed(2)}</td>
                <td>${trade.broker || ''}</td>
                <td>${trade.notes || ''}</td>
                <td><button onclick="editTradeForm(${index})">Edit</button><button onclick="deleteTrade(${index})">Delete</button></td>
                <td>${greeksHtml}</td>
                <td>${dividendsHtml}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function editTradeForm(index) {
    const trade = trades[index];
    document.getElementById('symbol').value = trade.symbol;
    document.getElementById('asset-type').value = trade.assetType;
    document.getElementById('quantity').value = trade.quantity;
    document.getElementById('multiplier').value = trade.multiplier;
    document.getElementById('entry-price').value = trade.entryPrice;
    document.getElementById('entry-date').value = trade.entryDate;
    document.getElementById('exit-price').value = trade.exitPrice || '';
    document.getElementById('exit-date').value = trade.exitDate || '';
    document.getElementById('broker').value = trade.broker || '';
    document.getElementById('notes').value = trade.notes || '';
    document.getElementById('stop-loss').value = trade.stopLoss || '';
    document.getElementById('take-profit').value = trade.takeProfit || '';

    if (trade.assetType === 'options') {
        document.getElementById('strike').value = trade.strike || '';
        document.getElementById('expiration').value = trade.expiration || '';
        document.getElementById('option-type').value = trade.optionType || 'call';
        document.getElementById('volatility').value = trade.volatility || '';
        document.getElementById('risk-free-rate').value = trade.riskFreeRate || '';
    }

    toggleOptionsFields();
    editingIndex = index;
    document.getElementById('submit-button').textContent = 'Update Trade';
}

function deleteTrade(index) {
    trades.splice(index, 1);
    saveTrades();
    updateTable();
    updateSummary();
}

function calculatePL(trade) {
    const price = trade.exitPrice || trade.currentPrice || trade.entryPrice;
    return (price - trade.entryPrice) * trade.quantity * trade.multiplier;
}

async function getCurrentPriceWithFallback(symbol, type) {
    for (let api of apiOrder) {
        try {
            selectedApi = api;
            return await getCurrentPrice(symbol, type);
        } catch (error) {
            console.warn(`API ${api} failed, trying next...`);
        }
    }
    throw new Error('All APIs failed');
}

async function getCurrentPrice(symbol, type) {
    let url;
    switch (selectedApi) {
        case 'alpha_vantage':
            const key = apiKeys.alpha_vantage[Math.floor(Math.random() * apiKeys.alpha_vantage.length)];
            url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;
            const data = await fetch(url).then(res => res.json());
            return parseFloat(data['Global Quote']['05. price']);
        case 'finnhub':
            url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKeys.finnhub}`;
            const fhData = await fetch(url).then(res => res.json());
            return fhData.c;
        case 'polygon':
            url = `https://api.polygon.io/v2/last/nbbo/${symbol}?apiKey=${apiKeys.polygon}`;
            const polyData = await fetch(url).then(res => res.json());
            return polyData.results[0].P;
        case 'yahoo':
            url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
            const yData = await fetch(url).then(res => res.json());
            return yData.chart.result[0].meta.regularMarketPrice;
    }
}

async function getDividends(symbol) {
    // Using Alpha Vantage for dividends
    const key = apiKeys.alpha_vantage[0];
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${key}`;
    const data = await fetch(url).then(res => res.json());
    return {
        symbol,
        dividend: parseFloat(data.DividendPerShare) || 0,
        payDate: data.ExDividendDate || 'N/A',
        yield: (parseFloat(data.DividendYield) * 100) || 0
    };
}

function calculateGreeks(option) {
    // Using black-scholes.js implementation
    const S = option.currentPrice || option.entryPrice;
    const K = option.strike;
    const T = (new Date(option.expiration) - new Date()) / (1000 * 60 * 60 * 24 * 365); // years
    const r = option.riskFreeRate / 100;
    const sigma = option.volatility / 100;
    const type = option.optionType;

    if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };

    const price = blackScholes(S, K, T, r, sigma, type);
    const delta = deltaBS(S, K, T, r, sigma, type);
    const gamma = gammaBS(S, K, T, r, sigma);
    const theta = thetaBS(S, K, T, r, sigma, type);
    const vega = vegaBS(S, K, T, r, sigma);
    const rho = rhoBS(S, K, T, r, sigma, type);

    return { price, delta, gamma, theta, vega, rho };
}

function updateSummary() {
    let totalPL = 0;
    let brokerPL = {};
    let assetTypes = {};
    trades.forEach(trade => {
        const pl = calculatePL(trade);
        const combined = pl + (trade.dividendGain || 0);
        totalPL += combined;
        if (trade.broker) {
            brokerPL[trade.broker] = (brokerPL[trade.broker] || 0) + combined;
        }
        assetTypes[trade.assetType] = (assetTypes[trade.assetType] || 0) + combined;
    });

    document.getElementById('total-pl').innerHTML = `<span class="${totalPL > 0 ? 'green' : totalPL < 0 ? 'red' : ''}">${totalPL.toFixed(2)}</span>`;

    const brokerList = document.getElementById('broker-pl');
    brokerList.innerHTML = '';
    for (let broker in brokerPL) {
        const pl = brokerPL[broker];
        brokerList.innerHTML += `<li>${broker}: <span class="${pl > 0 ? 'green' : pl < 0 ? 'red' : ''}">${pl.toFixed(2)}</span></li>`;
    }

    // Charts
    const plCtx = document.getElementById('pl-chart').getContext('2d');
    new Chart(plCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(brokerPL),
            datasets: [{ label: 'Combined P/L by Broker', data: Object.values(brokerPL), backgroundColor: 'rgba(75,192,192,0.2)', borderColor: 'rgba(75,192,192,1)' }]
        }
    });

    const assetCtx = document.getElementById('asset-chart').getContext('2d');
    new Chart(assetCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(assetTypes),
            datasets: [{ data: Object.values(assetTypes), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'] }]
        }
    });
}

function saveTrades() {
    localStorage.setItem('trades', JSON.stringify(trades));
}

function loadTrades() {
    const saved = localStorage.getItem('trades');
    if (saved) trades = JSON.parse(saved);
}

function importCSV(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
        header: true,
        complete: (results) => {
            trades = results.data.map(row => ({
                symbol: row.symbol,
                assetType: row.assetType,
                quantity: parseFloat(row.quantity),
                multiplier: parseFloat(row.multiplier) || 1,
                entryPrice: parseFloat(row.entryPrice),
                entryDate: row.entryDate,
                exitPrice: parseFloat(row.exitPrice),
                exitDate: row.exitDate,
                broker: row.broker,
                notes: row.notes,
                stopLoss: parseFloat(row.stopLoss),
                takeProfit: parseFloat(row.takeProfit),
                dividendGain: parseFloat(row.dividendGain) || 0,
                // Add options fields if present
            }));
            saveTrades();
            updateTable();
            updateSummary();
        }
    });
}

function exportCSV() {
    const csv = Papa.unparse(trades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trades.csv';
    link.click();
}

async function updateTicker() {
    const ticker = document.getElementById('ticker');
    ticker.innerHTML = ''; // Clear
    for (let trade of trades) {
        try {
            const price = trade.currentPrice || await getCurrentPriceWithFallback(trade.symbol);
            const pl = calculatePL(trade) + (trade.dividendGain || 0);
            const color = pl > 0 ? 'green' : pl < 0 ? 'red' : 'black';
            ticker.innerHTML += `<span style="color: ${color}; margin-right: 20px;">${trade.symbol}: $${price.toFixed(2)}</span>`;
        } catch {}
    }
}
