// api.js - API fetching functions

async function fetchWithFallback(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function getApiKeys() {
    return {
        alpha: localStorage.getItem('alphaKey') || '',
        finnhub: localStorage.getItem('finnhubKey') || '',
        polygon: localStorage.getItem('polygonKey') || ''
    };
}

async function getCurrentPrice(symbol, type = 'stock') {
    const keys = await getApiKeys();
    let data;
    try {
        if (keys.polygon) {
            let url;
            if (type === 'crypto') {
                const from = symbol.split('/')[0];
                const to = symbol.split('/')[1] || 'USD';
                url = `https://api.polygon.io/v2/last/crypto/${from}/${to}?apiKey=${keys.polygon}`;
                data = await fetchWithFallback(url);
                if (!data.last || data.last.price === undefined) throw new Error('Invalid response structure');
                return data.last.price;
            } else {
                url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${keys.polygon}`;
                data = await fetchWithFallback(url);
                if (!data.last || data.last.p === undefined) throw new Error('Invalid response structure');
                return data.last.p;
            }
        }
    } catch {}
    try {
        if (keys.finnhub) {
            const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${keys.finnhub}`;
            data = await fetchWithFallback(url);
            if (data.c === undefined || data.c === 0) throw new Error('Invalid response structure');
            return data.c;
        }
    } catch {}
    try {
        if (keys.alpha) {
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${keys.alpha}`;
            data = await fetchWithFallback(url);
            if (!data['Global Quote'] || !data['Global Quote']['05. price']) throw new Error('Invalid response structure');
            return parseFloat(data['Global Quote']['05. price']);
        }
    } catch {}
    // Yahoo removed due to CORS issues in browser
    throw new Error('All APIs failed. Ensure API keys are entered and valid.');
}

async function getOptionGreeks(optionDetails) {
    const keys = await getApiKeys();
    const { symbol, expiration, strike, callPut } = optionDetails;
    const yyMMdd = expiration.replace(/-/g, '').slice(2);
    const typeChar = callPut[0].toUpperCase();
    const strikeStr = ((strike * 1000) | 0).toString().padStart(8, '0');
    const optionTicker = `O:${symbol}${yyMMdd}${typeChar}${strikeStr}`;
    try {
        if (keys.polygon) {
            const url = `https://api.polygon.io/v3/snapshot/options/${optionTicker}?apiKey=${keys.polygon}`;
            const data = await fetchWithFallback(url);
            if (!data.results || !data.results[0] || !data.results[0].greeks) throw new Error('Invalid response structure');
            return data.results[0].greeks;
        }
    } catch {}
    try {
        if (keys.finnhub) {
            const url = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&expiration=${expiration}&token=${keys.finnhub}`;
            const data = await fetchWithFallback(url);
            if (!data.data) throw new Error('Invalid response structure');
            const chain = data.data.flatMap(d => d.options[callPut.toUpperCase()] || []);
            const contract = chain.find(c => c.strike === strike);
            if (!contract) throw new Error('No matching contract');
            return { delta: contract.delta, gamma: contract.gamma, theta: contract.theta, vega: contract.vega };
        }
    } catch {}
    return calculateBlackScholesGreeks(optionDetails);
}

function calculateBlackScholesGreeks(details) {
    const S = details.currentPrice;
    const K = details.strike;
    const T = (new Date(details.expiration) - new Date()) / (365 * 24 * 3600 * 1000);
    const r = 0.05;
    const sigma = 0.2;
    const d1 = (Math.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const N = x => 0.5 * (1 + erf(x / Math.sqrt(2)));
    const erf = x => {
        const t = 1 / (1 + 0.3275911 * Math.abs(x));
        const res = 1 - (0.254829592 * t - 0.284496736 * t**2 + 1.421413741 * t**3 - 1.453152027 * t**4 + 1.061405429 * t**5) * Math.exp(-x**2);
        return x >= 0 ? res : -res;
    };
    const delta = details.callPut === 'Call' ? N(d1) : N(d1) - 1;
    const gamma = (Math.exp(-d1**2 / 2) / Math.sqrt(2 * Math.PI)) / (S * sigma * Math.sqrt(T));
    const theta = - (S * sigma * Math.exp(-d1**2 / 2) / (Math.sqrt(2 * Math.PI * T))) / 2 - r * K * Math.exp(-r * T) * N(d2);
    const vega = S * Math.sqrt(T) * Math.exp(-d1**2 / 2) / Math.sqrt(2 * Math.PI);
    return { delta, gamma, theta: theta / 365, vega: vega / 100 };
}

async function getEtfDividend(symbol) {
    const keys = await getApiKeys();
    const today = new Date().toISOString().slice(0,10);
    const yearAgo = new Date(Date.now() - 365*24*3600*1000).toISOString().slice(0,10);
    try {
        if (keys.finnhub) {
            const url = `https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=${yearAgo}&to=${today}&token=${keys.finnhub}`;
            const data = await fetchWithFallback(url);
            if (!data || data.length === 0) throw new Error('No dividend data');
            const latest = data[data.length - 1];
            return {
                dividend: latest.amount,
                payDate: latest.payDate,
                yield: latest.yield || 0 // If not present, calculate later
            };
        }
    } catch {}
    try {
        if (keys.alpha) {
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${keys.alpha}`;
            const data = await fetchWithFallback(url);
            const series = data['Time Series (Daily)'];
            if (!series) throw new Error('Invalid response structure');
            const dates = Object.keys(series).sort().reverse();
            for (let date of dates) {
                const divAmount = parseFloat(series[date]['7. dividend amount']);
                if (divAmount > 0) {
                    return {
                        dividend: divAmount,
                        payDate: date,
                        yield: 0
                    };
                }
            }
        }
    } catch {}
    return null;
}
