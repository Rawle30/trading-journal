import Chart from 'chart.js/auto';

export function renderGrowthChart({ initialInvestment, annualYield, frequency, years, reinvest, growthRate, dividendGrowth }) {
  const periods = years * frequency;
  const reinvested = [];
  const nonReinvested = [];
  let valueRe = initialInvestment;
  let valueNo = initialInvestment;
  let dividend = annualYield / frequency;

  for (let i = 0; i < periods; i++) {
    const growth = Math.pow(1 + growthRate /
