import mongoose from 'mongoose';
import { modelOptions } from './shared.js';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  active: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0 },
}, modelOptions);
export default mongoose.model('User', schema);
