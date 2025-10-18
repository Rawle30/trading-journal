// js/main.js
import { initUI, tradesData } from './ui.js';
import { fetchFromAlphaVantage, fetchFromCoinbase, fetchFromYahoo, isCrypto } from './api.js';
import { readCachedPrice } from './storage.js';
import { checkAlerts } from './alerts.js';
import { updateEquityCurve, updateSymbolPieChart, initEquityCurveChart, initSymbolPieChart } from './charts.js';

let currentPrices = {};

async function fetchPrice(symbol) {
  const cached = readCachedPrice(symbol);
  if (cached) return cached.price;

  try {
    const price = isCrypto(symbol)
      ? await fetchFromCoinbase(symbol)
      : await fetchFromAlphaVantage(symbol);
    currentPrices[symbol] = price;
    return price;
  } catch {
    try {
      const fallback = await fetchFromYahoo(symbol);
      currentPrices[symbol] = fallback;
      return fallback;
    } catch (e) {
      console.error(`Failed to fetch price for ${symbol}`, e);
      return null;
    }
  }
}

async function updatePrices() {
  const symbols = [...new Set(tradesData.map(t => t.symbol))];
  for (const symbol of symbols) {
    await fetchPrice(symbol);
  }
  checkAlerts(currentPrices);
}

function updateCharts() {
  const equityData = tradesData.map(t => ({
    date: t.date,
    value: (t.exit || t.entry) * t.qty * t.multiplier
  }));
  updateEquityCurve(equityData);

  const pieData = [];
  const symbolMap = {};
  tradesData.forEach(t => {
    const val = (t.exit || t.entry) * t.qty * t.multiplier;
    symbolMap[t.symbol] = (symbolMap[t.symbol] || 0) + val;
  });
  for (const [symbol, value] of Object.entries(symbolMap)) {
    pieData.push({ symbol, value });
  }
  updateSymbolPieChart(pieData);
}

function initCharts() {
  initEquityCurveChart(document.getElementById('equity-curve-chart'));
  initSymbolPieChart(document.getElementById('symbol-pie-chart'));
}

window.addEventListener('DOMContentLoaded', async () => {
  initUI();
  initCharts();
  await updatePrices();
  updateCharts();
});

