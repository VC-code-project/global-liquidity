export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  try {
    // BTC via Binance public API — no auth, works server-side, ~1000 weekly candles (~2017-present)
    if (symbol === 'BTC-USD') {
      const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=1000';
      const data = await fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => r.json());
      if (!Array.isArray(data)) throw new Error('Binance: unexpected response');

      const timestamps = data.map(k => Math.floor(k[0] / 1000));
      const closes     = data.map(k => parseFloat(k[4])); // index 4 = close price

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
