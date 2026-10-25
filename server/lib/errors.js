export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const route = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, result.error.issues[0]?.message || 'Please check your input.');
  return result.data;
}
