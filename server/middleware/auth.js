import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { AppError, route } from '../lib/errors.js';

export function authenticate(config) {
  return route(async (req, _res, next) => {
    const token = req.cookies?.session;
    if (!token) throw new AppError(401, 'Please sign in to continue.');
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'policydesk' }); }
    catch { throw new AppError(401, 'Your session has expired. Please sign in again.'); }
    const user = await User.findOne({ _id: payload.userId, active: true });
    if (!user || (user.sessionVersion || 0) !== payload.version) throw new AppError(401, 'Please sign in again.');
    if (!user.companyId) throw new AppError(403, 'This account has no company. Create a new admin account.');
    const company = await Company.findById(user.companyId);
    if (!company) throw new AppError(403, 'Your company workspace is unavailable.');
    req.user = user; req.company = company;
    next();
  });
}
export function adminOnly(req, _res, next) {
  if (req.user.role !== 'admin') return next(new AppError(403, 'Only company administrators can do this.'));
  next();
}
export function sessionResponse(res, user, company, config, status = 200) {
  const token = jwt.sign({ userId: user.id, version: user.sessionVersion || 0 }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '7d', issuer: 'policydesk' });
  res.cookie('session', token, { httpOnly: true, secure: config.production, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
  return res.status(status).json({ user, company });
}
