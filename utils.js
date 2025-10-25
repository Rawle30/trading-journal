// utils.js - Helper functions

function validateTrade(trade) {
    if (!trade.symbol || trade.qty <= 0 || trade.entryPrice <= 0 || !trade.entryDate) {
        alert('Invalid trade data');
        return false;
    }
    // Position sizing risk: Alert if qty * entryPrice > 5% of total portfolio (approx)
    const total = getCombinedPl({});
    if (trade.qty * trade.entryPrice > 0.05 * total) {
        if (!confirm('Position size exceeds 5% risk. Proceed?')) return false;
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
