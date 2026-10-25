import express from 'express';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createGeminiAI } from './services/ai.js';
import { startWorker } from './services/ingestion.js';
import User from './models/User.js';
import Policy from './models/Policy.js';
import Chunk from './models/Chunk.js';
import Company from './models/Company.js';

let worker, server;
async function main() {
  const config = loadConfig();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User, Policy, Chunk, Company].map(model => model.init()));
  const ai = createGeminiAI(config);
  const app = createApp({ config, ai });
  if (config.production) {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url));
    app.use(express.static(dist, { index: false }));
    app.get('*', (_req, res) => res.sendFile(`${dist}/index.html`));
  }
  worker = startWorker(ai);
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`PolicyDesk API ready at http://localhost:${config.port}`);
  });
  server.on('error', async error => { console.error(`Server could not start: ${error.code}`); await shutdown(1); });
}
let closing = false;
async function shutdown(code = 0) {
  if (closing) return; closing = true;
  const timeout = setTimeout(() => process.exit(code), 10000); timeout.unref();
  server?.close();
  await worker?.stop();
  await mongoose.disconnect();
  process.exit(code);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
main().catch(async error => { console.error(`Startup failed: ${error.name === 'MongoServerSelectionError' ? 'Cannot connect to MongoDB. Check MONGODB_URI and Atlas network access.' : error.message}`); await shutdown(1); });
