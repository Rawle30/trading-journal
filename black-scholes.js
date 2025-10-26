// black-scholes.js
// Simple Black-Scholes implementation for Greeks

function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) {
        prob = 1 - prob;
    }
    return prob;
}

function d1(S, K, T, r, sigma) {
    return (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
}

function d2(S, K, T, r, sigma) {
    return d1(S, K, T, r, sigma) - sigma * Math.sqrt(T);
}

function blackScholes(S, K, T, r, sigma, type) {
    const D1 = d1(S, K, T, r, sigma);
    const D2 = d2(S, K, T, r, sigma);
    if (type === 'call') {
        return S * normalCDF(D1) - K * Math.exp(-r * T) * normalCDF(D2);
    } else {
        return K * Math.exp(-r * T) * normalCDF(-D2) - S * normalCDF(-D1);
    }
}

function deltaBS(S, K, T, r, sigma, type) {
    const D1 = d1(S, K, T, r, sigma);
    return type === 'call' ? normalCDF(D1) : normalCDF(D1) - 1;
}

function gammaBS(S, K, T, r, sigma) {
    const D1 = d1(S, K, T, r, sigma);
    return Math.exp(-D1 * D1 / 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
}

function thetaBS(S, K, T, r, sigma, type) {
    const D1 = d1(S, K, T, r, sigma);
    const D2 = d2(S, K, T, r, sigma);
    const term1 = -S * Math.exp(-D1 * D1 / 2) * sigma / (2 * Math.sqrt(2 * Math.PI * T));
    const term2 = -r * K * Math.exp(-r * T) * normalCDF(-D2);
    return type === 'call' ? term1 - term2 : term1 + term2;
}

function vegaBS(S, K, T, r, sigma) {
    const D1 = d1(S, K, T, r, sigma);
    return S * Math.sqrt(T) * Math.exp(-D1 * D1 / 2) / Math.sqrt(2 * Math.PI);
}

function rhoBS(S, K, T, r, sigma, type) {
    const D2 = d2(S, K, T, r, sigma);
    return type === 'call' ? K * T * Math.exp(-r * T) * normalCDF(D2) : -K * T * Math.exp(-r * T) * normalCDF(-D2);
}
