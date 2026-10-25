import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Policy from '../models/Policy.js';
import Chunk from '../models/Chunk.js';
import { chunkDocument } from './retrieval.js';

// The MongoDB record is the queue. A lease lets interrupted jobs be recovered.
export async function processNextPolicy(ai) {
  const jobToken = randomUUID();
  const policy = await Policy.findOneAndUpdate({ $or: [{ status: 'queued' }, { status: 'processing', leaseUntil: { $lt: new Date() } }] },
    { status: 'processing', jobToken, leaseUntil: new Date(Date.now() + 120000), error: '' }, { returnDocument: 'after', sort: { createdAt: 1 } }).select('+content');
  if (!policy) return false;
  const filter = { _id: policy.id, version: policy.version, jobToken, status: 'processing' };
  const heartbeat = setInterval(() => { void Policy.updateOne(filter, { leaseUntil: new Date(Date.now() + 120000) }).catch(() => {}); }, 30000);
  try {
    const sections = chunkDocument(policy.content);
    if (!sections.length || sections.length > 500) throw new Error('Use a document with between 1 and 500 text sections.');
    const chunks = [];
    for (let i = 0; i < sections.length; i += 4) {
      const batch = await Promise.all(sections.slice(i, i + 4).map(async section => ({
        companyId: policy.companyId, policyId: policy.id, version: policy.version, title: policy.title, category: policy.category,
        ...section, embedding: await ai.embed(`${policy.category}\n${policy.title}\n${section.section}\n${section.text}`, 'RETRIEVAL_DOCUMENT'), embeddingModel: ai.model,
      })));
      chunks.push(...batch);
    }
    await mongoose.connection.transaction(async session => {
      const current = await Policy.findOne(filter).session(session);
      if (!current) return;
      await Chunk.deleteMany({ policyId: policy.id, companyId: policy.companyId }).session(session);
      await Chunk.insertMany(chunks, { session });
      await Policy.updateOne(filter, { status: 'ready', chunkCount: chunks.length, error: '', $unset: { leaseUntil: 1, jobToken: 1 } }).session(session);
    });
  } catch (error) {
    const message = error.status ? error.message : 'This policy could not be indexed. Check the AI configuration and retry.';
    await Policy.updateOne(filter, { status: 'failed', error: message, $unset: { leaseUntil: 1, jobToken: 1 } });
  } finally { clearInterval(heartbeat); }
  return true;
}

export function startWorker(ai, logger = console) {
  let stopped = false, timer, running = Promise.resolve();
  const tick = () => {
    if (stopped) return;
    running = processNextPolicy(ai).catch(() => logger.error('Policy worker failed; it will retry.')).finally(() => {
      if (!stopped) timer = setTimeout(tick, 1000);
    });
  };
  tick();
  return { async stop() { stopped = true; clearTimeout(timer); await running; } };
}
