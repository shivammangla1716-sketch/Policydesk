import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import Policy from '../models/Policy.js';
import Chunk from '../models/Chunk.js';
import { adminOnly } from '../middleware/auth.js';
import { AppError, parse, route } from '../lib/errors.js';
import { extractDocument } from '../services/documents.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5, fieldSize: 110000 } });
const metadata = z.object({ title: z.string().trim().min(2, 'Give your policy a title.').max(150), category: z.enum(['People', 'Workplace', 'Benefits', 'Security', 'General']).default('General') });
const contentSchema = z.string().trim().min(1, 'Add policy text or choose a document.').max(100000, 'Keep policy text under 100,000 characters.');
export function policyRoutes(limiter) {
  const router = Router();
  router.use(adminOnly);
  const find = async req => {
    const policy = await Policy.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!policy) throw new AppError(404, 'Policy not found.');
    return policy;
  };
  const body = async (req, previous) => {
    const fields = parse(metadata, { title: req.body.title || previous?.title, category: req.body.category || previous?.category });
    const content = parse(contentSchema, req.file ? await extractDocument(req.file) : req.body.content);
    return { ...fields, content, sourceName: req.file?.originalname?.slice(0, 200) || 'Pasted text' };
  };
  router.get('/', route(async (req, res) => res.json({ policies: await Policy.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }) })));
  router.post('/', limiter, upload.single('file'), route(async (req, res) => {
    if (await Policy.countDocuments({ companyId: req.user.companyId }) >= 100) throw new AppError(409, 'This workspace has reached its 100-policy limit. Remove an unused policy first.');
    const policy = await Policy.create({ ...await body(req), companyId: req.user.companyId });
    const safe = policy.toJSON(); delete safe.content;
    res.status(202).json({ policy: safe });
  }));
  router.get('/:id', route(async (req, res) => {
    const policy = await Policy.findOne({ _id: req.params.id, companyId: req.user.companyId }).select('+content');
    if (!policy) throw new AppError(404, 'Policy not found.');
    res.json({ policy });
  }));
  router.post('/:id/replace', limiter, upload.single('file'), route(async (req, res) => {
    const previous = await find(req);
    if (['queued', 'processing'].includes(previous.status)) throw new AppError(409, 'Wait for this policy to finish processing before replacing it.');
    const values = await body(req, previous);
    const policy = await Policy.findOneAndUpdate({ _id: previous.id, companyId: req.user.companyId, version: previous.version, status: { $nin: ['queued', 'processing'] } }, { ...values, status: 'queued', chunkCount: 0, error: '', $inc: { version: 1 } }, { returnDocument: 'after' });
    if (!policy) throw new AppError(409, 'This policy was just changed. Refresh and try again.');
    res.status(202).json({ policy });
  }));
  router.post('/:id/retry', limiter, route(async (req, res) => {
    await find(req);
    const policy = await Policy.findOneAndUpdate({ _id: req.params.id, companyId: req.user.companyId, status: 'failed' }, { status: 'queued', error: '' }, { returnDocument: 'after' });
    if (!policy) throw new AppError(409, 'Only failed policies can be retried.');
    res.json({ policy });
  }));
  router.delete('/:id', route(async (req, res) => {
    await mongoose.connection.transaction(async session => {
      const removed = await Policy.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!removed) throw new AppError(404, 'Policy not found.');
      await Chunk.deleteMany({ policyId: req.params.id, companyId: req.user.companyId }).session(session);
    });
    res.json({ success: true });
  }));
  return router;
}
