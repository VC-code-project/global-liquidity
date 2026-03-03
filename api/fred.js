export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series, start } = req.query;
  if (!series) return res.status(400).json({ error: 'Missing series parameter' });

  const since = start || '2000-01-01';

  const apiKey = '9c6cdd3f61f7894981fe013088b3e8a6';
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${apiKey}&file_type=json&observation_start=${since}&sort_order=asc`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
