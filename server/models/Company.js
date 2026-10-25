import mongoose from 'mongoose';
import { modelOptions } from './shared.js';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, modelOptions);
export default mongoose.model('Company', schema);
