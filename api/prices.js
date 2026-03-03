export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  try {
    let timestamps = [], closes = [];

    // ── BTC: CoinGecko (free, no auth, works server-side) ──────
    if (symbol === 'BTC-USD') {
      const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max';
      const data = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.json());
      if (!data.prices) throw new Error('CoinGecko: no prices in response');
      timestamps = data.prices.map(p => Math.floor(p[0] / 1000));
      closes     = data.prices.map(p => p[1]);

    // ── Equities: Stooq (free CSV, works server-side) ──────────
    } else {
      const stooqMap = { '^NDX': '^ndx', '^GSPC': '^spx', '^VIX': '^vix' };
      const stooqSym = stooqMap[symbol] || symbol.toLowerCase();
      const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=w`;
      const csv = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.text());

      // CSV: Date,Open,High,Low,Close,Volume (reverse chronological)
      const rows = csv.trim().split('\n').slice(1).reverse();
      for (const row of rows) {
        const cols = row.split(',');
        const date  = cols[0];
        const close = cols[4];
        if (!date || !close || close === 'N/D' || close === 'null') continue;
        const ts = Math.floor(new Date(date).getTime() / 1000);
        if (!isNaN(ts) && !isNaN(parseFloat(close))) {
          timestamps.push(ts);
          closes.push(parseFloat(close));
        }
      }
      if (timestamps.length === 0) throw new Error(`Stooq: no data for ${symbol}`);
    }

    // Return in Yahoo Finance v8 shape so frontend parseYahoo() still works
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] }
    });

  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
