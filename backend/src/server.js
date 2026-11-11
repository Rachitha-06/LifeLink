const express = require('express');
const http = require('node:http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const pool = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { attachMessageSocket } = require('./sockets/messageSocket');

const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donors');
const recipientRoutes = require('./routes/recipients');
const matchRoutes = require('./routes/matches');
const hospitalRoutes = require('./routes/hospitals');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');
const eventsRoutes = require('./routes/events');
const { startScheduledJobs } = require('./jobs/scheduler');

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
});
app.use('/api/', generalLimiter);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/events', eventsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(notFoundHandler);
app.use(errorHandler);

// Only start listening (and touch the DB) when run directly — lets tests
// import `app` without opening a real port or requiring a live database.
if (require.main === module) {
  pool
    .query('SELECT 1')
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => console.error('DB connection error:', err.message));

  // Express alone can't host Socket.io — it needs the underlying raw
  // HTTP server so both can share the same port instead of running two
  // separate servers.
  const httpServer = http.createServer(app);
  attachMessageSocket(httpServer);

  httpServer.listen(env.port, () => console.log(`LifeLink API running on port ${env.port}`));
  startScheduledJobs();
}

module.exports = app;
