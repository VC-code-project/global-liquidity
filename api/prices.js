export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  try {
    if (symbol === 'BTC-USD') {
      // CoinGecko range endpoint — explicit from/to avoids the "days=max" tier limits
      // BTC market data starts ~2013-04-28 (unix 1367107200)
      const to   = Math.floor(Date.now() / 1000);
      const from = 1367107200;
      const url  = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;

      const data = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GlobalLiquidityDashboard/1.0)',
        }
      }).then(r => r.json());

      if (!data.prices || !Array.isArray(data.prices)) {
        throw new Error(`CoinGecko error: ${JSON.stringify(data)}`);
      }

      // CoinGecko returns daily (or hourly for recent) — downsample to weekly
      // Keep one data point per 7-day window
      const weekly = [];
      let lastTs = 0;
      for (const [tsMs, price] of data.prices) {
        if (tsMs - lastTs >= 6 * 24 * 3600 * 1000) { // at least 6 days apart
          weekly.push([tsMs, price]);
          lastTs = tsMs;
        }
      }

      const timestamps = weekly.map(p => Math.floor(p[0] / 1000));
      const closes     = weekly.map(p => p[1]);

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] }
      });
    }

    return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });

  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
