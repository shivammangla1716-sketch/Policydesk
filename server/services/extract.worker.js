import { parentPort, workerData } from 'node:worker_threads';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

try {
  const buffer = Buffer.from(workerData.buffer);
  let text;
  if (workerData.extension === '.pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const info = await parser.getInfo();
      if (info.total > 100) throw new Error('Please upload a PDF with 100 pages or fewer.');
      text = (await parser.getText()).text;
    } finally { await parser.destroy(); }
  } else if (workerData.extension === '.docx') {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  }
  if (text.length > 100000) throw new Error('This document is too long. Use a document with fewer than 100,000 characters.');
  if (!text.trim()) throw new Error('No readable text was found. Scanned PDFs need text recognition before uploading.');
  parentPort.postMessage({ text: text.trim() });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
