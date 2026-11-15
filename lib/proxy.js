const BACKEND_URL = process.env.BACKEND_URL;

module.exports = async function proxy(req, res, prefix) {
  if (!BACKEND_URL) {
    res.status(503).json({ error: 'Backend is not configured. Set BACKEND_URL in Vercel environment variables.' });
    return;
  }

  const routeParts = Array.isArray(req.query.path)
    ? req.query.path
    : req.query.path
      ? [req.query.path]
      : [];
  const route = routeParts.map((part) => encodeURIComponent(part)).join('/');
  const queryIndex = req.url.indexOf('?');
  const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const target = new URL(`${prefix}/${route}${queryString}`, BACKEND_URL);

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  const chunks = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    for await (const chunk of req) chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual'
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.end(payload);
  } catch (error) {
    res.status(502).json({ error: 'Could not reach the backend service.', detail: error.message });
  }
};
