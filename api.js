export async function fetchETFDividends(tickers) {
  const results = [];

  for (const ticker of tickers) {
    const res = await fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail`);
    const json = await res.json();
    const data = json.quoteSummary.result[0].summaryDetail;

    results.push({
      ticker,
      fundName: ticker,
      shares: 100,
      dividend: data.lastDividendValue?.raw || 0,
      yield: data.dividendYield?.raw || 0,
      frequency: 'Quarterly',
      exDate: new Date(data.exDividendDate?.raw * 1000).toISOString().split('T')[0],
      payDate: 'TBD',
      reinvested: 'No'
    });
  }

  return results;
}

