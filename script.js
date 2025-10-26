// script.js - Modular logic for Trading Journal

// Constants and Globals
let trades = JSON.parse(localStorage.getItem('trades')) || [];
let apiKeys = JSON.parse(localStorage.getItem('apiKeys')) || {
    alpha1: 'I3AR7KSM7UR0RYLA',
    alpha2: 'FTDRTP0955507PPC',
    finnhub: 'NwqcDCmG_VpyNGIpeiubgB3f26ztrPLB',
    polygon: 'd33kp6hr01qib1p1fe9gd33kp6hr01qib1p1fea0'
};
let currentPrices = {};
let volatilities = {};
let dividendYields = {};
let lastDivPayDates = {};
let dividendGains = {};
let greeks = {};
let accountSize = parseFloat(localStorage.getItem('accountSize')) || 100000;
let plChart;

// API Endpoints (modular)
const apiEndpoints = {
    price: {
        polygon: (symbol, key) => `https://api.polygon.io/v2/last/quote/${symbol}?apiKey=${key}`,
        finnhub: (symbol, key) => `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
        alpha: (symbol, key) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`,
        yahoo: (symbol) => `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d` // No key, unofficial
    },
    metric: (symbol, key) => `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`,
    dividends: (symbol, from, to, key) => `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&from=${from}&to=${to}&token=${key}`
};

// Utility Functions
function saveData() {
    localStorage.setItem('trades', JSON.stringify(trades));
}

function validateTrade(data) {
    if (!data.symbol || data.symbol.trim() === '') return 'Symbol is required';
    if (isNaN(data.quantity) || data.quantity <= 0) return 'Quantity must be positive';
    if (isNaN(data.entryPrice) || data.entryPrice <= 0) return 'Entry Price must be positive';
    if (!data.entryDate) return 'Entry Date is required';
    if (data.tradeType === 'option') {
        if (!['call', 'put'].includes(data.optionType)) return 'Invalid option type';
        if (isNaN(data.strike) || data.strike <= 0) return 'Strike must be positive';
        if (!data.expDate) return 'Expiration Date required';
        if (isNaN(data.multiplier) || data.multiplier <= 0) return 'Multiplier must be positive';
    }
    return null;
}

function getUniqueSymbols() {
    return [...new Set(trades.map(t => t.symbol.toUpperCase()))];
}

// Fetch Functions (robust with fallbacks and error handling)
async function fetchWithFallback(urlFn, providersOrder = ['polygon', 'finnhub', 'alpha1', 'alpha2', 'yahoo']) {
    for (let prov of providersOrder) {
        try {
            const key = apiKeys[prov] || '';
            const url = urlFn(prov === 'yahoo' ? '' : key);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`Provider ${prov} failed: ${err}`);
        }
    }
    throw new Error('All providers failed');
}

async function fetchPrice(symbol) {
    try {
        const data = await fetchWithFallback((prov) => {
            if (prov.startsWith('alpha')) return apiEndpoints.price.alpha(symbol, apiKeys[prov]);
            if (prov === 'finnhub') return apiEndpoints.price.finnhub(symbol, apiKeys.finnhub);
            if (prov === 'polygon') return apiEndpoints.price.polygon(symbol, apiKeys.polygon);
            if (prov === 'yahoo') return apiEndpoints.price.yahoo(symbol);
        });
        if (data.last) return data.last.price; // Polygon
        if (data.c) return data.c; // Finnhub
        if (data.chart?.result[0]?.meta?.regularMarketPrice) return data.chart.result[0].meta.regularMarketPrice; // Yahoo
        if (data['Global Quote']) return parseFloat(data['Global Quote']['05. price']);
        throw new Error('Invalid data');
    } catch (err) {
        console.error(`Failed to fetch price for ${symbol}: ${err}`);
        return null;
    }
}

async function fetchMetric(symbol) {
    try {
        const res = await fetch(apiEndpoints.metric(symbol, apiKeys.finnhub));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.metric || {};
    } catch (err) {
        console.error(err);
        return {};
    }
}

async function fetchDividends(symbol, from, to) {
    try {
        const res = await fetch(apiEndpoints.dividends(symbol, from, to, apiKeys.finnhub));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

// Greeks Calculation (Black-Scholes approximation)
function cumNorm(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
}

function blackScholes(callPut, S, K, T, r, sigma) {
    if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    if (sigma <= 0) sigma = 0.01; // Avoid division by zero
    const d1 = (Math.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const nd1 = cumNorm(d1);
    const nd2 = cumNorm(d2);
    const nNegD1 = cumNorm(-d1);
    const nNegD2 = cumNorm(-d2);

    let delta, gamma, theta, vega, rho;
    if (callPut === 'call') {
        delta = nd1;
        theta = - (S * sigma * Math.exp(- (d1 ** 2 / 2)) / Math.sqrt(2 * Math.PI)) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nd2;
        rho = K * T * Math.exp(-r * T) * nd2;
    } else {
        delta = -nNegD1;
        theta = - (S * sigma * Math.exp(- (d1 ** 2 / 2)) / Math.sqrt(2 * Math.PI)) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * nNegD2;
        rho = -K * T * Math.exp(-r * T) * nNegD2;
    }
    gamma = Math.exp(- (d1 ** 2 / 2)) / (S * sigma * Math.sqrt(2 * Math.PI * T));
    vega = S * Math.sqrt(T) * Math.exp(- (d1 ** 2 / 2)) / Math.sqrt(2 * Math.PI);
    return { delta: delta.toFixed(4), gamma: gamma.toFixed(4), theta: theta.toFixed(4), vega: vega.toFixed(4), rho: rho.toFixed(4) };
}

// Refresh Data
async function refreshPrices() {
    const symbols = getUniqueSymbols();
    let tickerText = '';
    let totalDiv = 0;
    for (let sym of symbols) {
        currentPrices[sym] = await fetchPrice(sym);
        const metric = await fetchMetric(sym);
        volatilities[sym] = (metric['52WeekHigh'] - metric['52WeekLow']) / ((metric['52WeekHigh'] + metric['52WeekLow']) / 2) || 0.2;
        dividendYields[sym] = metric.dividendYield || 0;
        tickerText += `${sym}: $${currentPrices[sym] || 'N/A'} Yield: ${dividendYields[sym].toFixed(2)}%   `;
    }
    document.getElementById('tickerMarquee').innerText = tickerText || 'No symbols';

    // Dividends and Greeks
    for (let trade of trades) {
        if (trade.tradeType === 'etf' && !trade.exitDate) {
            const today = new Date().toISOString().split('T')[0];
            const divs = await fetchDividends(trade.symbol, trade.entryDate, today);
            divs.sort((a, b) => new Date(b.exDate) - new Date(a.exDate)); // Latest first
            dividendGains[trade.id] = divs.reduce((sum, d) => sum + (d.amount || 0) * trade.quantity, 0);
            totalDiv += dividendGains[trade.id];
            if (divs.length > 0) {
                lastDivPayDates[trade.symbol] = divs[0].paymentDate || 'N/A';
            }
        }
        if (trade.tradeType === 'option' && !trade.exitDate) {
            const S = currentPrices[trade.symbol];
            if (S) {
                const now = new Date();
                const exp = new Date(trade.expDate);
                const T = (exp - now) / (1000 * 60 * 60 * 24 * 365);
                const sigma = volatilities[trade.symbol];
                const r = 0.05; // Assume 5%
                greeks[trade.id] = blackScholes(trade.optionType, S, trade.strike, T, r, sigma);
            }
        }
    }
    document.getElementById('totalDividends').innerHTML = totalDiv.toFixed(2);
    updateDisplay();
}

// Calculate P/L
function calculatePL(trade) {
    const multiplier = trade.tradeType === 'option' ? trade.multiplier : 1;
    const exitP = trade.exitPrice || currentPrices[trade.symbol] || trade.entryPrice;
    const pl = (exitP - trade.entryPrice) * trade.quantity * multiplier;
    const div = trade.tradeType === 'etf' ? (dividendGains[trade.id] || 0) : 0;
    return pl + div;
}

function calculateRiskReward(trade) {
    if (!trade.stopLoss || !trade.target) return 'N/A';
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.target - trade.entryPrice);
    return (reward / risk).toFixed(2);
}

// Update Display
function updateDisplay() {
    const tbody = document.querySelector('#tradesTable tbody');
    tbody.innerHTML = '';
    let totalPL = 0;
    let brokerPL = {};
    let chartData = { labels: [], data: [] };
    let cumPL = 0;

    trades.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

    for (let trade of trades) {
        const pl = calculatePL(trade);
        totalPL += pl;
        brokerPL[trade.broker] = (brokerPL[trade.broker] || 0) + pl;

        cumPL += pl;
        chartData.labels.push(trade.symbol);
        chartData.data.push(cumPL);

        const currentPrice = currentPrices[trade.symbol] != null ? currentPrices[trade.symbol].toFixed(4) : 'N/A';
        const entryPrice = trade.entryPrice.toFixed(4);
        const exitPrice = trade.exitPrice ? trade.exitPrice.toFixed(4) : '';
        const stopLoss = trade.stopLoss ? trade.stopLoss.toFixed(4) : '';
        const target = trade.target ? trade.target.toFixed(4) : '';
        const quantity = trade.quantity.toFixed(4);
        const divYield = trade.tradeType === 'etf' ? (dividendYields[trade.symbol] || 0).toFixed(2) + '%' : 'N/A';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trade.id}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="tradeType">${trade.tradeType}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="symbol">${trade.symbol}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="quantity">${quantity}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="entryPrice">${entryPrice}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="entryDate">${trade.entryDate}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="exitPrice">${exitPrice}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="exitDate">${trade.exitDate || ''}</td>
            <td>${currentPrice}</td>
            <td class="${pl >= 0 ? 'green' : 'red'}">${pl.toFixed(2)}</td>
            <td>${trade.tradeType === 'etf' ? (dividendGains[trade.id] || 0).toFixed(2) : 'N/A'}</td>
            <td>${divYield}</td>
            <td>${trade.tradeType === 'etf' ? (lastDivPayDates[trade.symbol] || 'N/A') : 'N/A'}</td>
            <td>${trade.tradeType === 'option' ? JSON.stringify(greeks[trade.id] || {}) : 'N/A'}</td>
            <td>${calculateRiskReward(trade)}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="notes">${trade.notes}</td>
            <td contenteditable="true" data-id="${trade.id}" data-field="broker">${trade.broker}</td>
            <td>
                <button onclick="editTrade(${trade.id})">Edit</button>
                <button onclick="deleteTrade(${trade.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    }

    document.getElementById('totalPL').innerHTML = `<span class="${totalPL >= 0 ? 'green' : 'red'}">${totalPL.toFixed(2)}</span>`;

    const brokerDiv = document.getElementById('brokerPL');
    brokerDiv.innerHTML = '';
    for (let b in brokerPL) {
        const span = document.createElement('p');
        span.innerHTML = `${b}: <span class="${brokerPL[b] >= 0 ? 'green' : 'red'}">${brokerPL[b].toFixed(2)}</span>`;
        brokerDiv.appendChild(span);
    }

    // Update Chart
    if (plChart) plChart.destroy();
    plChart = new Chart(document.getElementById('plChart'), {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{ label: 'Cumulative P/L', data: chartData.data, borderColor: 'blue' }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('accountSize').value = accountSize;
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
    await refreshPrices();
    updateDisplay();

    // Delegation for inline edit
    document.getElementById('tradesTable').addEventListener('blur', function(e) {
        if (e.target.contentEditable === 'true') {
            const id = parseInt(e.target.dataset.id);
            const field = e.target.dataset.field;
            let value = e.target.innerText.trim();
            const trade = trades.find(t => t.id === id);
            if (trade) {
                if (['quantity', 'entryPrice', 'exitPrice', 'stopLoss', 'target', 'strike', 'multiplier'].includes(field)) {
                    value = parseFloat(value) || trade[field] || 0;
                } else if (['entryDate', 'exitDate', 'expDate'].includes(field)) {
                    // Validate date if necessary
                } else if (field === 'optionType') {
                    if (!['call', 'put'].includes(value)) value = trade[field];
                } else if (field === 'strategy') {
                    // Handle strategy edit
                }
                trade[field] = value;
                saveData();
                refreshPrices(); // Refresh calculations and display
            }
        }
    }, true);
});

document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
});

document.getElementById('refreshPrices').addEventListener('click', refreshPrices);

document.getElementById('saveApiKey').addEventListener('click', () => {
    const prov = document.getElementById('apiProvider').value;
    const key = document.getElementById('apiKeyInput').value;
    apiKeys[prov] = key;
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    alert('API Key saved');
});

document.getElementById('saveAccountSize').addEventListener('click', () => {
    accountSize = parseFloat(document.getElementById('accountSize').value) || 100000;
    localStorage.setItem('accountSize', accountSize);
});

document.getElementById('tradeType').addEventListener('change', (e) => {
    document.getElementById('optionFields').style.display = e.target.value === 'option' ? 'block' : 'none';
});

document.getElementById('strategy').addEventListener('change', (e) => {
    document.getElementById('customStrategy').style.display = e.target.value === 'Custom' ? 'block' : 'none';
});

document.getElementById('tradeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        id: parseInt(document.getElementById('editId').value) || Date.now(),
        tradeType: document.getElementById('tradeType').value,
        symbol: document.getElementById('symbol').value.toUpperCase(),
        quantity: parseFloat(document.getElementById('quantity').value),
        entryPrice: parseFloat(document.getElementById('entryPrice').value),
        entryDate: document.getElementById('entryDate').value,
        exitPrice: parseFloat(document.getElementById('exitPrice').value) || null,
        exitDate: document.getElementById('exitDate').value || null,
        broker: document.getElementById('broker').value,
        stopLoss: parseFloat(document.getElementById('stopLoss').value) || null,
        target: parseFloat(document.getElementById('target').value) || null,
        notes: document.getElementById('notes').value
    };
    if (data.tradeType === 'option') {
        data.optionType = document.getElementById('optionType').value;
        data.strike = parseFloat(document.getElementById('strike').value);
        data.expDate = document.getElementById('expDate').value;
        data.multiplier = parseFloat(document.getElementById('multiplier').value);
        data.strategy = document.getElementById('strategy').value;
        if (data.strategy === 'Custom') {
            data.strategy = document.getElementById('customStrategy').value;
        }
    }

    const error = validateTrade(data);
    if (error) {
        alert(error);
        return;
    }

    const index = trades.findIndex(t => t.id === data.id);
    if (index > -1) {
        trades[index] = data;
    } else {
        trades.push(data);
    }
    saveData();
    e.target.reset();
    document.getElementById('editId').value = '';
    document.getElementById('optionFields').style.display = 'none';
    document.getElementById('customStrategy').style.display = 'none';
    updateDisplay();
    refreshPrices();
});

document.getElementById('exportCSV').addEventListener('click', () => {
    const csv = Papa.unparse(trades);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades.csv';
    a.click();
});

document.getElementById('importCSV').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                trades = trades.concat(results.data.map(d => ({
                    ...d,
                    id: parseInt(d.id) || Date.now(),
                    quantity: parseFloat(d.quantity),
                    entryPrice: parseFloat(d.entryPrice),
                    exitPrice: parseFloat(d.exitPrice) || null,
                    stopLoss: parseFloat(d.stopLoss) || null,
                    target: parseFloat(d.target) || null,
                    strike: parseFloat(d.strike) || null,
                    multiplier: parseFloat(d.multiplier) || null
                })));
                saveData();
                updateDisplay();
                refreshPrices();
            }
        });
    }
});

function editTrade(id) {
    const trade = trades.find(t => t.id === id);
    if (trade) {
        document.getElementById('editId').value = trade.id;
        document.getElementById('tradeType').value = trade.tradeType;
        document.getElementById('symbol').value = trade.symbol;
        document.getElementById('quantity').value = trade.quantity;
        document.getElementById('entryPrice').value = trade.entryPrice;
        document.getElementById('entryDate').value = trade.entryDate;
        document.getElementById('exitPrice').value = trade.exitPrice;
        document.getElementById('exitDate').value = trade.exitDate;
        document.getElementById('broker').value = trade.broker;
        document.getElementById('stopLoss').value = trade.stopLoss;
        document.getElementById('target').value = trade.target;
        document.getElementById('notes').value = trade.notes;
        if (trade.tradeType === 'option') {
            document.getElementById('optionFields').style.display = 'block';
            document.getElementById('optionType').value = trade.optionType;
            document.getElementById('strike').value = trade.strike;
            document.getElementById('expDate').value = trade.expDate;
            document.getElementById('multiplier').value = trade.multiplier;
            const strategySelect = document.getElementById('strategy');
            const isStandard = Array.from(strategySelect.options).some(opt => opt.value === trade.strategy);
            if (isStandard) {
                strategySelect.value = trade.strategy;
                document.getElementById('customStrategy').style.display = 'none';
            } else {
                strategySelect.value = 'Custom';
                document.getElementById('customStrategy').value = trade.strategy;
                document.getElementById('customStrategy').style.display = 'block';
            }
        } else {
            document.getElementById('optionFields').style.display = 'none';
        }
    }
}

function deleteTrade(id) {
    trades = trades.filter(t => t.id !== id);
    saveData();
    updateDisplay();
}
,,,
