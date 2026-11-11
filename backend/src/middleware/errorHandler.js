/**
 * Centralized error handler. Routes should call next(err) on failure
 * instead of each writing its own res.status(500).json({...}) block.
 * Keeps error responses consistent and stops stack traces leaking in prod.
 */
function errorHandler(err, req, res, _next) {
  console.error(err);

  // Multer (file upload) errors — bad file type from fileFilter, or size
  // limit exceeded — are client mistakes, not server failures.
  if (err.name === 'MulterError' || /Only PDF, JPEG/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }

  // Postgres unique-violation -> friendly 409 instead of a raw 500
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists.' });
  }
  // Postgres foreign-key violation -> 400, e.g. referencing a deleted hospital
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  const status = err.status || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong on our end.'
      : err.message || 'Internal server error.';

  res.status(status).json({ error: message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
