import mongoose from 'mongoose';
import { modelOptions } from './shared.js';
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true, maxlength: 150 },
  category: { type: String, enum: ['People', 'Workplace', 'Benefits', 'Security', 'General'], default: 'General' },
  content: { type: String, required: true, select: false },
  sourceName: { type: String, default: 'Pasted text' },
  status: { type: String, enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued', index: true },
  version: { type: Number, default: 1 },
  chunkCount: { type: Number, default: 0 },
  error: { type: String, default: '' },
  leaseUntil: Date,
  jobToken: { type: String, select: false },
}, modelOptions);
export default mongoose.model('Policy', schema);
