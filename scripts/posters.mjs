// 작품 포스터 주소 수집(한 번만 돌린다): TMDB에서 작품명으로 찾아 data/posters.json에 저장한다.
// 쓰는 법: .env에 TMDB_API_KEY를 넣고 `node scripts/posters.mjs` (이미 있는 작품은 건너뛴다. 다시 받으려면 --force)
// 저장 값은 포스터 경로(/abc.jpg)뿐이고, 화면에서 https://image.tmdb.org/t/p/w185 를 앞에 붙인다.
// 이름이 비슷한 다른 작품이 잡힐 수 있어 matched(찾은 제목)를 같이 적는다. 틀린 건 posters.json에서 직접 고치거나 지운다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/posters.json';
const fromDotenv = () => {
  if (!existsSync('.env')) return '';
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('TMDB_API_KEY='));
  return line ? line.slice('TMDB_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
};
const key = process.env.TMDB_API_KEY || fromDotenv();
if (!key) {
  console.error('TMDB_API_KEY가 없어요. .env에 넣고 다시 실행하세요.');
  process.exit(1);
}
// 긴 값(eyJ...)은 v4 읽기 토큰, 짧은 값은 v3 키
const bearer = key.length > 60;

const PREFIX = /^(넷플릭스|디즈니\+?|티빙|웨이브|쿠팡플레이|왓챠|애플tv\+?|tvn|jtbc|kbs|mbc|sbs)\s+/i;
const clean = (t) => t.replace(PREFIX, '').trim();

async function search(query) {
  const url = new URL('https://api.themoviedb.org/3/search/multi');
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'ko-KR');
  if (!bearer) url.searchParams.set('api_key', key);
  const res = await fetch(url, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); return search(query); }
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const { results } = await res.json();
  return results.find((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path);
}

const titles = [...new Set(JSON.parse(readFileSync('data/cinemap.json', 'utf8')).map((r) => r.opusNm).filter(Boolean))];
const posters = existsSync(OUT) && !process.argv.includes('--force') ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let found = 0, missing = [];
for (const title of titles) {
  if (posters[title]) continue;
  try {
    const hit = await search(clean(title));
    if (hit) { posters[title] = { path: hit.poster_path, matched: hit.title || hit.name }; found++; }
    else missing.push(title);
  } catch (e) {
    console.error(`${title}: ${e.message}`);
    missing.push(title);
  }
}
writeFileSync(OUT, JSON.stringify(posters, null, 1) + '\n');
console.log(`새로 ${found}편, 전체 ${Object.keys(posters).length}/${titles.length}편 저장. 못 찾은 작품 ${missing.length}편.`);
if (missing.length) console.log(missing.join('\n'));
