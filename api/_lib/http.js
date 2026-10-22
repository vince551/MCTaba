export function allowMethods(req, res, methods) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    res.status(405).json({ error: 'Method not allowed.' });
    return false;
  }
  return true;
}

export function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('A valid JSON request body is required.');
    error.status = 400;
    throw error;
  }
  return body;
}
