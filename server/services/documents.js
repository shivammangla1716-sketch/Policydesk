import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { AppError } from '../lib/errors.js';

export function extractDocument(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!['.pdf', '.docx', '.txt'].includes(extension)) throw new AppError(400, 'Upload a PDF, DOCX, or TXT file.');
  if (extension === '.pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new AppError(400, 'This file is not a valid PDF.');
  if (extension === '.docx' && file.buffer.subarray(0, 2).toString() !== 'PK') throw new AppError(400, 'This file is not a valid DOCX document.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./extract.worker.js', import.meta.url), { workerData: { buffer: file.buffer, extension }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    let settled = false;
    const finish = (error, text) => {
      if (settled) return;
      settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(new AppError(400, error)); else resolve(text);
    };
    const timer = setTimeout(() => finish('This document took too long to read. Try a smaller file.'), 20000);
    worker.on('message', result => finish(result.error, result.text));
    worker.on('error', () => finish('This document could not be read. Try saving it again as PDF, DOCX, or TXT.'));
    worker.on('exit', code => { if (code !== 0) finish('This document could not be processed. Try a smaller file.'); });
  });
}
