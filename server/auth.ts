import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function basicAuth(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const username = env.DEVLOOM_AUTH_USERNAME ?? '';
  const password = env.DEVLOOM_AUTH_PASSWORD ?? '';
  if (!username && !password) return (_req, _res, next) => next();
  if (
    !username ||
    !password ||
    username.includes(':') ||
    /[\x00-\x1f\x7f]/.test(username + password)
  )
    throw new Error(
      'Set both DEVLOOM_AUTH_USERNAME and DEVLOOM_AUTH_PASSWORD; username cannot contain a colon and credentials cannot contain control characters.',
    );
  const expectedUsername = digest(username);
  const expectedPassword = digest(password);
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(req.headers.authorization ?? '');
    if (match) {
      const decoded = Buffer.from(match[1], 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const userMatches = timingSafeEqual(digest(decoded.slice(0, separator)), expectedUsername);
      const passwordMatches = timingSafeEqual(
        digest(decoded.slice(separator + 1)),
        expectedPassword,
      );
      if (separator >= 0 && userMatches && passwordMatches) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Devloom", charset="UTF-8"');
    res.status(401).json({ error: 'Authentication required.' });
  };
}
