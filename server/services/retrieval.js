function isHeading(text) {
  const clean = text.replace(/^#+\s*/, '').trim();
  const words = clean.split(/\s+/);
  if (/^#{1,6}\s+/.test(text)) return true;
  if (words.length > 8 || /[.!?:;]/.test(clean) || /\d/.test(clean) || /^[-*•]/.test(clean)) return false;
  if (/\b(is|are|was|were|be|has|have|must|may|can|will|should|receive|receives|includes?|covers?|requires?|allows?|provides?|applies?)\b/i.test(clean)) return false;
  return /^[A-Z]/.test(clean);
}

// Split at paragraphs first; headings travel with the next rule so no extracted text is lost.
export function chunkDocument(content, size = 240, overlap = 40) {
  const paragraphs = content.replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let section = 'Policy details';
  let pendingHeadings = [];
  for (const rawParagraph of paragraphs) {
    const lines = rawParagraph.trim().split('\n').map(line => line.trim()).filter(Boolean);
    let paragraph = rawParagraph.trim();
    if (lines.length > 1 && isHeading(lines[0])) {
      section = lines[0].replace(/^#+\s*/, '');
      pendingHeadings.push(lines[0]);
      paragraph = lines.slice(1).join(' ');
    } else if (isHeading(paragraph)) {
      section = paragraph.replace(/^#+\s*/, '');
      pendingHeadings.push(paragraph);
      continue;
    }
    const text = [...pendingHeadings, paragraph].filter(Boolean).join(' ');
    pendingHeadings = [];
    const words = text.split(/\s+/);
    for (let start = 0; start < words.length; start += size - overlap) {
      chunks.push({ text: words.slice(start, start + size).join(' '), section });
      if (start + size >= words.length) break;
    }
  }
  if (pendingHeadings.length) chunks.push({ text: pendingHeadings.join(' '), section });
  return chunks;
}

export function buildRetrievalQuery(question, messages = []) {
  const followUp = /\b(it|that|this|those|they|also|what about|and for|exceptions?|conditions?|takeaways?|key things?)\b/i.test(question);
  if (!followUp) return question;
  const priorQuestions = messages.filter(message => message.role === 'user').slice(-2).map(message => message.text);
  return [...priorQuestions, question].join('\n');
}

export function cosineSimilarity(a, b) {
  if (!a?.length || a.length !== b?.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;
  let dot = 0, left = 0, right = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; left += a[i] ** 2; right += b[i] ** 2; }
  return left && right ? dot / Math.sqrt(left * right) : 0;
}

export function selectSources(vector, chunks, { threshold = 0.28, limit = 5, similarity = cosineSimilarity } = {}) {
  return chunks.map(chunk => ({ ...chunk, score: similarity(vector, chunk.embedding) }))
    .filter(chunk => chunk.score >= threshold).sort((a, b) => b.score - a.score).slice(0, limit);
}
