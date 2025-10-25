// data.js - Data management

let trades = JSON.parse(localStorage.getItem('trades')) || [];

function saveTrades() {
    localStorage.setItem('trades', JSON.stringify(trades));
}

function addTrade(trade) {
    trades.push(trade);
    saveTrades();
}

function updateTrade(index, trade) {
    trades[index] = trade;
    saveTrades();
}

function deleteTrade(index) {
    trades.splice(index, 1);
    saveTrades();
}

function calculatePl(trade, currentPrice) {
    const multiplier = trade.type === 'option' ? trade.multiplier : 1;
    const exitPrice = trade.exitPrice || currentPrice;
    if (!exitPrice) return 0;
    let pl = (exitPrice - trade.entryPrice) * trade.qty * multiplier;
    if (trade.type === 'etf' && trade.dividendGain && isDividendApplicable(trade)) {
        pl += trade.dividendGain;
    }
    return pl;
}

function isDividendApplicable(trade) {
    const entry = new Date(trade.entryDate);
    const exit = trade.exitDate ? new Date(trade.exitDate) : new Date();
    const pay = new Date(trade.payDate);
    return entry <= pay && pay <= exit;
}

function getCombinedPl(currentPrices) {
    return trades.reduce((sum, trade) => sum + calculatePl(trade, currentPrices[trade.symbol] || trade.entryPrice), 0);
}

function getPlPerBroker(currentPrices) {
    const brokers = {};
    trades.forEach(trade => {
        const broker = trade.broker || 'Default';
        brokers[broker] = (brokers[broker] || 0) + calculatePl(trade, currentPrices[trade.symbol] || trade.entryPrice);
    });
    return brokers;
}

function calculateEquityCurve(currentPrices) {
    const sorted = [...trades].sort((a,b) => new Date(a.entryDate) - new Date(b.entryDate));
    let curve = [];
    let cumulative = 0;
    sorted.forEach(trade => {
        cumulative += calculatePl(trade, currentPrices[trade.symbol] || trade.exitPrice || trade.entryPrice);
        curve.push({date: trade.entryDate, value: cumulative});
    });
    return curve;
}

function calculateSymbolDistribution(currentPrices) {
    const dist = {};
    trades.forEach(trade => {
        const multiplier = trade.type === 'option' ? trade.multiplier : 1;
        const value = trade.qty * multiplier * (currentPrices[trade.symbol] || trade.entryPrice);
        dist[trade.symbol] = (dist[trade.symbol] || 0) + value;
    });
    return dist;
}

function calculateMaxDrawdown(equityCurve) {
    let maxDd = 0;
    let peak = -Infinity;
    equityCurve.forEach(point => {
        if (point.value > peak) peak = point.value;
        const dd = (peak - point.value) / peak * 100;
        if (dd > maxDd) maxDd = dd;
    });
    return maxDd;
}

function calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
    const std = Math.sqrt(returns.map(r => (r - mean)**2).reduce((a,b)=>a+b) / returns.length);
    return (mean - 0.03 / 252) / (std / Math.sqrt(252));
}

function getReturns(equityCurve) {
    const returns = [];
    for (let i=1; i<equityCurve.length; i++) {
        returns.push((equityCurve[i].value - equityCurve[i-1].value) / equityCurve[i-1].value);
    }
    return returns;
}

function exportToCsv() {
    const headers = ['type','symbol','qty','entryPrice','entryDate','exitPrice','exitDate','broker','notes','multiplier','strategy','strike','expiration','callPut','dividend','payDate','yield','dividendGain'];
    const csv = [headers.join(',')];
    trades.forEach(trade => csv.push(Object.values(trade).join(',')));
    const blob = new Blob([csv.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades.csv';
    a.click();
}

async function importFromCsv(file) {
    const text = await file.text();
    const lines = text.split('\n').slice(1);
    trades = lines.map(line => {
        const vals = line.split(',');
        return {
            type: vals[0],
            symbol: vals[1],
            qty: parseFloat(vals[2]),
            entryPrice: parseFloat(vals[3]),
            entryDate: vals[4],
            exitPrice: parseFloat(vals[5]),
            exitDate: vals[6],
            broker: vals[7],
            notes: vals[8],
            multiplier: parseFloat(vals[9]),
            strategy: vals[10],
            strike: parseFloat(vals[11]),
            expiration: vals[12],
            callPut: vals[13],
            dividend: parseFloat(vals[14]),
            payDate: vals[15],
            yield: parseFloat(vals[16]),
            dividendGain: parseFloat(vals[17])
        };
    }).filter(t => t.symbol);
    saveTrades();
    renderTrades();
}
