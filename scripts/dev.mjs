// 로컬 개발 서버: dist/를 보여 주고, /.netlify/functions/course를 Netlify 없이 같은 코드로 실행한다.
// 배포본과 같은 netlify/functions/course.js를 그대로 불러 쓴다. .env의 값은 출력하지 않는다.
// 카카오 도메인에 등록된 주소가 http://localhost:8000이라 포트 기본값을 8000으로 둔다.
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import handler from '../netlify/functions/course.js';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1 || line.trimStart().startsWith('#')) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

const PORT = Number(process.env.PORT) || 8000;
const ROOT = 'dist';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/.netlify/functions/course') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const out = await handler(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }));
    res.writeHead(out.status, Object.fromEntries(out.headers));
    return res.end(Buffer.from(await out.arrayBuffer()));
  }

  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`${url}  (OpenAI 코스: ${process.env.OPENAI_API_KEY ? '켜짐' : 'OPENAI_API_KEY 없음 — 규칙 기반'})`);
  // 브라우저를 자동으로 연다. 열고 싶지 않으면 NO_OPEN=1
  if (!process.env.NO_OPEN) {
    const cmd = { win32: `start "" "${url}"`, darwin: `open "${url}"` }[process.platform] || `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
