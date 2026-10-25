import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true });
export function loadConfig() {
  const production = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || (production && jwtSecret.length < 32)) throw new Error('Set JWT_SECRET in server/.env to a random value of at least 32 characters.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env.');
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const url = new URL(clientOrigin);
  if (url.origin !== clientOrigin || (production && url.protocol !== 'https:')) throw new Error('CLIENT_ORIGIN must be an origin without a trailing slash (HTTPS in production).');
  const generationModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const embeddingModel = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
  if (![generationModel, embeddingModel].every(value => /^[a-zA-Z0-9._-]+$/.test(value))) throw new Error('Use valid Gemini model IDs.');
  return { production, jwtSecret, clientOrigin, generationModel, embeddingModel, geminiKey: process.env.GEMINI_API_KEY, mongoUri: process.env.MONGODB_URI, port: Number(process.env.PORT || 5001), trustProxy: Number(process.env.TRUST_PROXY || 0), retrievalThreshold: Number(process.env.RETRIEVAL_THRESHOLD || 0.28) };
}
