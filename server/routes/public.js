import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Company from '../models/Company.js';
import Policy from '../models/Policy.js';
import Chunk from '../models/Chunk.js';
import { AppError, parse, route } from '../lib/errors.js';
import { buildRetrievalQuery, selectSources } from '../services/retrieval.js';
import { NO_EVIDENCE } from '../services/ai.js';

const objectId = z.string().refine(mongoose.isValidObjectId, 'Choose a valid company.');
const historyItem = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(2000),
});

export function publicRoutes(ai, askLimiter) {
  const router = Router();

  router.get('/companies', route(async (_req, res) => {
    const counts = await Policy.aggregate([
      { $match: { status: 'ready' } },
      { $group: { _id: '$companyId', policyCount: { $sum: 1 } } },
    ]);
    const countByCompany = new Map(counts.map(item => [String(item._id), item.policyCount]));
    const companies = await Company.find({ _id: { $in: counts.map(item => item._id) } }).select('name').sort({ name: 1 });
    res.json({ companies: companies.map(company => ({ id: company.id, name: company.name, policyCount: countByCompany.get(company.id) || 0 })) });
  }));

  router.get('/companies/:id', route(async (req, res) => {
    const id = parse(objectId, req.params.id);
    const company = await Company.findById(id).select('name');
    if (!company) throw new AppError(404, 'Company not found.');
    const policies = await Policy.find({ companyId: company.id, status: 'ready' }).select('title category').sort({ title: 1 });
    res.json({ company: { id: company.id, name: company.name, policies } });
  }));

  router.post('/ask', askLimiter, route(async (req, res) => {
    const { companyId, question, history } = parse(z.object({
      companyId: objectId,
      question: z.string().trim().min(1, 'Type a question first.').max(2000, 'Keep questions under 2,000 characters.'),
      history: z.array(historyItem).max(8).default([]),
    }), req.body);
    const company = await Company.findById(companyId).select('_id');
    if (!company) throw new AppError(404, 'Company not found.');

    try {
      const policies = await Policy.find({ companyId, status: 'ready' }).select('_id version');
      let selected = [], result = { text: NO_EVIDENCE, indices: [] };
      if (policies.length) {
        const vector = await ai.embed(buildRetrievalQuery(question, history), 'RETRIEVAL_QUERY');
        const chunks = await Chunk.find({ companyId, embeddingModel: ai.model, $or: policies.map(policy => ({ policyId: policy._id, version: policy.version })) }).select('+embedding').lean();
        selected = selectSources(vector, chunks, { threshold: ai.threshold, similarity: ai.similarity });
        result = await ai.answer(question, selected, history);
      }
      const cited = result.indices.map(index => selected[index - 1]);
      if (cited.some(source => !source)) throw new AppError(502, 'The answer contained an invalid source. Please retry.');
      for (const source of cited) {
        if (!await Policy.exists({ _id: source.policyId, companyId, version: source.version, status: 'ready' })) throw new AppError(409, 'A policy changed while this answer was being prepared. Please ask again.');
      }
      const text = result.text.replace(/\[(\d+)\]/g, (match, number) => {
        const position = result.indices.indexOf(Number(number));
        return position === -1 ? match : `[${position + 1}]`;
      });
      const sources = cited.map(source => ({ policyId: String(source.policyId), title: source.title, section: source.section, excerpt: source.text }));
      res.json({ message: { role: 'assistant', text, sources } });
    } catch (error) {
      if (error.status) throw error;
      throw new AppError(502, 'An answer could not be prepared right now. Please try again.');
    }
  }));

  return router;
}
