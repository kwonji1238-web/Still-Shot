// Netlify 빌드: 배포에 필요한 파일만 dist/로 복사하고 config.js를 만든다.
// 저장소 루트를 그대로 배포하면 .env, scripts/geocode-cache.json 같은 파일이 같이 올라가므로 이렇게 나눈다.
// 번들러가 아니라 복사만 한다.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'dist';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/data`, { recursive: true });

for (const f of ['index.html', 'styles.css', 'site.webmanifest']) cpSync(f, `${OUT}/${f}`);
// 화면에서 쓰는 아이콘만 복사한다(icon/에는 락업·심볼 같은 원본도 있다). favicon.ico는 루트에도 둔다(옛 도구가 /favicon.ico를 찾는다).
mkdirSync(`${OUT}/icon`, { recursive: true });
for (const f of ['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  cpSync(`icon/${f}`, `${OUT}/icon/${f}`);
}
cpSync('icon/favicon.ico', `${OUT}/favicon.ico`);
cpSync('src', `${OUT}/src`, { recursive: true });
for (const f of ['cinemap.json', 'attractions.json', 'restaurants.json']) {
  cpSync(`data/${f}`, `${OUT}/data/${f}`);
}
// 포스터 주소 파일은 scripts/posters.mjs를 돌린 뒤에만 있다(없어도 동작한다)
if (existsSync('data/posters.json')) cpSync('data/posters.json', `${OUT}/data/posters.json`);

// 카카오 JavaScript 키는 브라우저에서 쓰는 공개 키라 config.js에 들어간다.
// 값은 Netlify 환경변수 KAKAO_JS_KEY에서 읽고, 저장소에는 넣지 않는다.
// 로컬 빌드에서는 .env(.gitignore에 있음)의 KAKAO_JS_KEY를 읽는다. dist/도 .gitignore에 있다.
const fromDotenv = () => {
  if (!existsSync('.env')) return '';
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('KAKAO_JS_KEY='));
  return line ? line.slice('KAKAO_JS_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
};
const key = process.env.KAKAO_JS_KEY || fromDotenv();
writeFileSync(`${OUT}/config.js`, `window.STILLSPOT_CONFIG = ${JSON.stringify({ kakaoJsKey: key })};\n`);

// UT 모드(?ut=1일 때만 쓰임). 시트 주소·토큰은 Netlify 환경변수 UT_ENDPOINT·UT_TOKEN(로컬은 .env)에서 읽어 dist/ut/config.js로 만든다.
// 값은 출력하지 않는다. apps-script/와 SETUP.md는 배포하지 않는다.
const envVal = (name) => {
  if (process.env[name]) return process.env[name];
  if (!existsSync('.env')) return '';
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
};
mkdirSync(`${OUT}/ut`, { recursive: true });
for (const f of ['ut.js', 'log.js', 'ut.css', 'questions.json']) cpSync(`ut/${f}`, `${OUT}/ut/${f}`);
const utEndpoint = envVal('UT_ENDPOINT');
const utToken = envVal('UT_TOKEN');
writeFileSync(`${OUT}/ut/config.js`, `export default ${JSON.stringify({ endpoint: utEndpoint, token: utToken })};\n`);
console.log(`UT 설정 (UT_ENDPOINT ${utEndpoint ? '있음' : '없음'}, UT_TOKEN ${utToken ? '있음' : '없음'})`);

console.log(`dist/ 준비 완료 (KAKAO_JS_KEY ${key ? '있음' : '없음 — 지도 없이 동작'})`);
