// app.js - Main app logic

document.addEventListener('DOMContentLoaded', () => {
    renderTrades();
    renderCharts();
    renderAlerts();
    startTicker();

    // Navigation
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            const section = document.querySelector(link.href);
            section.classList.add('active');
            link.classList.add('active');
        });
    });

    // Dark mode
    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    // Add trade
    document.getElementById('add-trade').addEventListener('click', () => showModal());

    // Refresh prices
    document.getElementById('refresh-prices').addEventListener('click', async () => {
        const currentPrices = {};
        for (let trade of trades) {
            try {
                currentPrices[trade.symbol] = await getCurrentPrice(trade.symbol, trade.type === 'crypto' ? 'crypto' : 'stock');
                if (trade.type === 'option') {
                    trade.greeks = await getOptionGreeks({
                        symbol: trade.symbol,
                        expiration: trade.expiration,
                        strike: trade.strike,
                        callPut: trade.callPut,
                        currentPrice: currentPrices[trade.symbol]
                    });
                }
                if (trade.type === 'etf') {
                    const div = await getEtfDividend(trade.symbol);
                    if (div) {
                        trade.dividend = div.dividend;
                        trade.payDate = div.payDate;
                        trade.yield = div.yield || (div.dividend / currentPrices[trade.symbol] * 100);
                        trade.dividendGain = div.dividend * trade.qty;
                    }
                }
            } catch (error) {
                console.error(`Error refreshing ${trade.symbol}:`, error);
            }
        }
        saveTrades();
        renderTrades(currentPrices);
        renderTicker(currentPrices);
        renderCharts(); // Update with new prices if needed
    });

    // API keys form
    document.getElementById('api-keys-form').addEventListener('submit', e => {
        e.preventDefault();
        localStorage.setItem('alphaKey', document.getElementById('alpha-key').value);
        localStorage.setItem('finnhubKey', document.getElementById('finnhub-key').value);
        localStorage.setItem('polygonKey', document.getElementById('polygon-key').value);
        alert('Keys saved');
    });
    document.getElementById('alpha-key').value = localStorage.getItem('alphaKey') || '';
    document.getElementById('finnhubKey').value = localStorage.getItem('finnhubKey') || '';
    document.getElementById('polygon-key').value = localStorage.getItem('polygonKey') || '';

    // Import/Export
    document.getElementById('export-csv').addEventListener('click', exportToCsv);
    document.getElementById('import-csv').addEventListener('change', e => importFromCsv(e.target.files[0]));

    // Modal close
    document.querySelector('.close').addEventListener('click', () => document.getElementById('modal').style.display = 'none');
    window.addEventListener('click', e => {
        if (e.target === document.getElementById('modal')) document.getElementById('modal').style.display = 'none';
    });

    // Type change
    document.getElementById('asset-type').addEventListener('change', toggleFields);

    // Validation on save
    const form = document.getElementById('trade-form');
    const originalSubmit = form.onsubmit;
    form.onsubmit = e => {
        const trade = {}; // Build trade object
        // ... (extract from form)
        if (!validateTrade(trade)) {
            e.preventDefault();
            return;
        }
        originalSubmit(e);
    };
});

async function startTicker() {
    // Fetch prices for common symbols or from trades
    const symbols = ['AAPL', 'GOOG', 'MSFT', 'TSLA', 'BTC/USD']; // Example + crypto
    const prices = {};
    for (let sym of symbols) {
        try {
            prices[sym] = await getCurrentPrice(sym, sym.includes('/') ? 'crypto' : 'stock');
        } catch {}
    }
    renderTicker(prices);
    setInterval(startTicker, 60000); // Refresh every min
}
