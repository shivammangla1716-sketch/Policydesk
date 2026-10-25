import mongoose from 'mongoose';
import { modelOptions } from './shared.js';
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  version: Number,
  title: String,
  category: String,
  section: String,
  text: String,
  embedding: { type: [Number], select: false },
  embeddingModel: String,
}, modelOptions);
schema.index({ companyId: 1, policyId: 1, version: 1 });
export default mongoose.model('Chunk', schema);
