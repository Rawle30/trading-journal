// utils.js - Helper functions

function validateTrade(trade) {
    if (!trade.symbol || trade.qty <= 0 || trade.entryPrice <= 0 || !trade.entryDate) {
        alert('Invalid trade data: Symbol, quantity, entry price, and date are required.');
        return false;
    }
    const total = getCombinedPl({});
    if (trade.qty * trade.entryPrice > 0.05 * total) {
        if (!confirm('Position size exceeds 5% of portfolio value. Proceed?')) return false;
    }
    return true;
}

function editTrade(index) {
    const trade = trades[index];
    showModal(trade, index);
}

// Add strategies to dropdown
document.addEventListener('DOMContentLoaded', () => {
    const strategySelect = document.getElementById('strategy');
    optionStrategies.forEach(str => {
        const opt = document.createElement('option');
        opt.value = str;
        opt.textContent = str;
        strategySelect.appendChild(opt);
    });
});
