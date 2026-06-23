import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleApi } from './local-sqlite-api.mjs';

const port = Number(process.env.PORT || 3000);
const distDir = resolve(process.cwd(), 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api')) {
      const path = url.pathname.replace(/^\/api/, '') || '/';
      const result = await handleApi(req, path, url.searchParams);
      sendJson(res, result.status, result.body);
      return;
    }

    serveStaticOrSpa(url.pathname, res);
  } catch (error) {
    console.error('[production-server]', error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Erro interno' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`FrotaControl rodando em http://0.0.0.0:${port}`);
});

function serveStaticOrSpa(pathname, res) {
  const filePath = safeResolve(pathname === '/' ? '/index.html' : pathname);
  const target = filePath && existsSync(filePath) && statSync(filePath).isFile()
    ? filePath
    : join(distDir, 'index.html');

  if (!existsSync(target)) {
    sendText(res, 404, 'Build nao encontrado. Rode npm run build antes de iniciar.');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeTypes[extname(target).toLowerCase()] || 'application/octet-stream');
  createReadStream(target).pipe(res);
}

function safeResolve(pathname) {
  const decodedPath = decodeURIComponent(pathname.split('?')[0] || '/');
  const cleanPath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = resolve(join(distDir, cleanPath));

  if (fullPath !== distDir && !fullPath.startsWith(`${distDir}${sep}`)) {
    return null;
  }

  return fullPath;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}
