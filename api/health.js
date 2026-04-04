import { handleCors } from './_lib/middleware.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  res.status(200).json({ status: 'ok', serverless: true });
}
