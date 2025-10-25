// api.js - API fetching functions

const API_ENDPOINTS = {
    polygon: {
        base: 'https://api.polygon.io',
        stockQuote: (symbol, key) => `${this.base}/v2/last/nbbo/${symbol}?apiKey=${key}`,
        cryptoQuote: (from, to, key) => `${this.base}/v2/last/crypto/${from}/${to}?apiKey=${key}`,
        optionSnapshot: (ticker, key) => `${this.base}/v3/snapshot/options/${ticker}?apiKey=${key}`,
        dividend: null // Polygon doesn't have direct dividend
    },
    finnhub: {
        base: 'https://finnhub.io/api/v1',
        quote: (symbol, key) => `${this.base}/quote?symbol=${symbol}&token=${key}`,
        optionChain: (symbol, exp, key) => `${this.base}/stock/option-chain?symbol=${symbol}&expiration=${exp}&token=${key}`,
        dividend: (symbol, from, to, key) => `${this.base}/stock/dividend?symbol=${symbol}&from=${from}&to=${to}&token=${key}`
    },
    alpha: {
        base: 'https://www.alphavantage.co',
        quote: (symbol, key) => `${this.base}/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`,
        dailyAdjusted: (symbol, key) => `${this.base}/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${key}`
    },
    yahoo: {
        base: 'https://query1.finance.yahoo.com',
        quote: (symbol) => `${this.base}/v8/finance/chart/${symbol}?range=1d&interval=1d`
    }
};

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
        // Try Polygon
        if (keys.polygon) {
            let url;
            if (type === 'crypto') {
                url = API_ENDPOINTS.polygon.cryptoQuote(symbol.split('/')[0], symbol.split('/')[1] || 'USD', keys.polygon);
            } else {
                url = API_ENDPOINTS.polygon.stockQuote(symbol, keys.polygon);
            }
            data = await fetchWithFallback(url);
            return type === 'crypto' ? data.last.price : data.P;
        }
    } catch {}
    try {
        // Finnhub
        if (keys.finnhub) {
            const url = API_ENDPOINTS.finnhub.quote(symbol, keys.finnhub);
            data = await fetchWithFallback(url);
            return data.c;
        }
    } catch {}
    try {
        // Alpha
        if (keys.alpha) {
            const url = API_ENDPOINTS.alpha.quote(symbol, keys.alpha);
            data = await fetchWithFallback(url);
            return parseFloat(data['Global Quote']['05. price']);
        }
    } catch {}
    try {
        // Yahoo unofficial
        const url = API_ENDPOINTS.yahoo.quote(symbol);
        data = await fetchWithFallback(url);
        return data.chart.result[0].meta.regularMarketPrice;
    } catch {}
    throw new Error('All APIs failed');
}

async function getOptionGreeks(optionDetails) {
    const keys = await getApiKeys();
    const { symbol, expiration, strike, callPut } = optionDetails;
    const optionTicker = `O:${symbol}${expiration.replace(/-/g,'').slice(2)}${callPut[0]}${strike.toString().padStart(8,'0')}`; // Approx format
    try {
        if (keys.polygon) {
            const url = API_ENDPOINTS.polygon.optionSnapshot(optionTicker, keys.polygon);
            const data = await fetchWithFallback(url);
            return data.results[0].greeks; // {delta, gamma, theta, vega}
        }
    } catch {}
    try {
        if (keys.finnhub) {
            const url = API_ENDPOINTS.finnhub.optionChain(symbol, expiration, keys.finnhub);
            const data = await fetchWithFallback(url);
            // Find matching strike and type
            const chain = data.data.flatMap(d => d.options[callPut.toUpperCase()]);
            const contract = chain.find(c => c.strike === strike);
            return { delta: contract.delta, gamma: contract.gamma, theta: contract.theta, vega: contract.vega };
        }
    } catch {}
    // Fallback to calculate Black-Scholes
    return calculateBlackScholesGreeks(optionDetails);
}

function calculateBlackScholesGreeks(details) {
    // Simple BS implementation (from search results, e.g., GitHub lib)
    // Assumptions: risk-free rate 0.05, vol 0.2, time from current to exp
    const S = details.currentPrice; // Need current underlying
    const K = details.strike;
    const T = (new Date(details.expiration) - new Date()) / (365 * 24 * 3600 * 1000); // years
    const r = 0.05;
    const sigma = 0.2; // placeholder
    const d1 = (Math.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const N = x => 0.5 * (1 + erf(x / Math.sqrt(2))); // Approx norm cdf
    const erf = x => { // Approx
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
            const url = API_ENDPOINTS.finnhub.dividend(symbol, yearAgo, today, keys.finnhub);
            const data = await fetchWithFallback(url);
            if (data.length) {
                const latest = data[data.length - 1];
                return {
                    dividend: latest.amount,
                    payDate: latest.payDate,
                    yield: latest.yield // if available, else calculate
                };
            }
        }
    } catch {}
    try {
        if (keys.alpha) {
            const url = API_ENDPOINTS.alpha.dailyAdjusted(symbol, keys.alpha);
            const data = await fetchWithFallback(url);
            const series = data['Time Series (Daily)'];
            const dates = Object.keys(series).sort().reverse();
            for (let date of dates) {
                if (series[date]['7. dividend amount'] > 0) {
                    return {
                        dividend: parseFloat(series[date]['7. dividend amount']),
                        payDate: date,
                        yield: 0 // TODO calculate
                    };
                }
            }
        }
    } catch {}
    return null;
}
