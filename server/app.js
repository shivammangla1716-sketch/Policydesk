import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './routes/auth.js';
import { policyRoutes } from './routes/policies.js';
import { publicRoutes } from './routes/public.js';
import { authenticate } from './middleware/auth.js';
import { AppError } from './lib/errors.js';

export function createApp({ config, ai, logger = console }) {
  const app = express();
  const allowedOrigins = new Set([config.clientOrigin]);
  if (!config.production) {
    const clientUrl = new URL(config.clientOrigin);
    if (clientUrl.hostname === 'localhost' || clientUrl.hostname === '127.0.0.1') {
      const alternate = new URL(clientUrl);
      alternate.hostname = clientUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      allowedOrigins.add(alternate.origin);
    }
  }
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } } }));
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    const requestId = randomUUID(); res.setHeader('X-Request-Id', requestId); res.setHeader('Cache-Control', 'no-store');
    const start = Date.now();
    res.on('finish', () => logger.info(JSON.stringify({ requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - start })));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowedOrigins.has(req.headers.origin)) return next(new AppError(403, 'This request came from an unrecognized website.'));
    next();
  });
  const limiter = (limit, windowMs) => config.rateLimits === false ? (_req, _res, next) => next() : rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please wait a moment and try again.' } });
  app.use('/api', limiter(240, 60000));
  app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' }));
  app.use('/api/auth', authRoutes(config, limiter(20, 15 * 60000)));
  app.use('/api/public', publicRoutes(ai, limiter(20, 60000)));
  app.use('/api/policies', authenticate(config), policyRoutes(limiter(15, 60000)));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'This endpoint does not exist.')));
  app.use((error, _req, res, _next) => {
    let status = error.status || 500;
    let message = status < 500 || error instanceof AppError ? error.message : 'Something went wrong. Please try again.';
    if (error.code === 11000) { status = 409; message = 'An account or workspace with these details already exists.'; }
    if (error.name === 'CastError') { status = 400; message = 'The requested ID is not valid.'; }
    if (error.name === 'ValidationError') { status = 400; message = 'Please check the information you entered.'; }
    if (error.name === 'MulterError') { status = 400; message = error.code === 'LIMIT_FILE_SIZE' ? 'Choose a file smaller than 10 MB.' : 'Upload one document at a time, under 10 MB.'; }
    if (error.type === 'entity.parse.failed') { status = 400; message = 'The request contains invalid JSON.'; }
    if (error.type === 'entity.too.large') { status = 413; message = 'This request is too large.'; }
    if (status >= 500) logger.error(JSON.stringify({ event: 'request_failed', status, type: error.name }));
    res.status(status).json({ error: message });
  });
  return app;
}
