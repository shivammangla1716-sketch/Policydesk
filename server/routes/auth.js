import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { authenticate, sessionResponse } from '../middleware/auth.js';
import { AppError, parse, route } from '../lib/errors.js';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80), email: emailSchema,
  password: z.string().min(10, 'Use a password with at least 10 characters.').max(72, 'Use a password shorter than 73 characters.').refine(value => Buffer.byteLength(value) <= 72, 'Password must fit within 72 bytes.'),
  companyName: z.string().trim().min(2, 'Enter your company name.').max(100),
});

export function authRoutes(config, limiter) {
  const router = Router();
  router.post('/signup', limiter, route(async (req, res) => {
    const data = parse(signupSchema, req.body);
    const password = await bcrypt.hash(data.password, 12);
    let user, company;
    await mongoose.connection.transaction(async session => {
      if (await User.exists({ email: data.email }).session(session)) throw new AppError(409, 'An account with this email already exists. Please sign in.');
      [company] = await Company.create([{ name: data.companyName }], { session });
      [user] = await User.create([{ name: data.name, email: data.email, password, companyId: company.id, role: 'admin' }], { session });
      company.createdBy = user.id; await company.save({ session });
    });
    return sessionResponse(res, user, company, config, 201);
  }));
  router.post('/login', limiter, route(async (req, res) => {
    const data = parse(z.object({ email: emailSchema, password: z.string().min(1).max(1000) }), req.body);
    const user = await User.findOne({ email: data.email, active: true }).select('+password');
    const valid = await bcrypt.compare(data.password, user?.password || '$2b$12$QdfmVUJPzdTxnoN6KIvB4.pqyGBE7No7GVkLQohqbrNioWboBNUbi');
    if (!user || !valid) throw new AppError(401, 'Email or password is incorrect.');
    if (!user.companyId || user.role !== 'admin') throw new AppError(403, 'This account does not have administrator access.');
    const company = await Company.findById(user.companyId);
    if (!company) throw new AppError(403, 'Your company workspace is unavailable.');
    return sessionResponse(res, user, company, config);
  }));
  router.get('/me', authenticate(config), (req, res) => res.json({ user: req.user, company: req.company }));
  router.post('/logout', route(async (req, res) => {
    const token = req.cookies?.session;
    if (token) {
      let payload;
      try { payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'policydesk' }); }
      catch { /* An invalid or expired cookie is already unusable and can simply be cleared. */ }
      if (payload && mongoose.isValidObjectId(payload.userId) && Number.isInteger(payload.version)) {
        await User.updateOne({ _id: payload.userId, sessionVersion: payload.version }, { $inc: { sessionVersion: 1 } });
      }
    }
    res.clearCookie('session', { httpOnly: true, secure: config.production, sameSite: 'strict', path: '/' });
    res.json({ success: true });
  }));
  return router;
}
