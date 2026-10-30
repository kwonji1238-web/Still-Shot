// 작품 정보 수집(한 번만 돌린다): TMDB에서 작품명으로 찾아 포스터·개봉연도·장르·출연진·줄거리를 data/posters.json에 저장한다.
// 쓰는 법: .env에 TMDB_API_KEY를 넣고 `node scripts/posters.mjs` (이미 있는 작품은 건너뛴다. 다시 받으려면 --force)
// 포스터는 경로(/abc.jpg)만 저장하고, 화면에서 https://image.tmdb.org/t/p/w185 를 앞에 붙인다.
// 값이 없는 항목(줄거리가 비어 있는 작품 등)은 저장하지 않는다. 화면은 있는 칸만 보여 준다.
// 찾은 제목(matched)이 작품명과 전혀 다르면 엉뚱한 작품이라 버린다. 눈으로 확인하려면 matched를 본다.
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

async function api(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set('language', 'ko-KR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!bearer) url.searchParams.set('api_key', key);
  const res = await fetch(url, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); return api(path, params); }
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const norm = (t) => t.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
const related = (a, b) => {
  const x = norm(a), y = norm(b);
  return x && y && (x.includes(y) || y.includes(x));
};

async function lookup(title) {
  const query = clean(title);
  const { results } = await api('search/multi', { query });
  const hit = results.find((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path);
  if (!hit) return null;
  const matched = hit.title || hit.name;
  if (!related(query, matched)) return null;
  const d = await api(`${hit.media_type}/${hit.id}`, { append_to_response: 'credits' });
  const out = { path: hit.poster_path, matched, id: hit.id, type: hit.media_type };
  const year = (d.release_date || d.first_air_date || '').slice(0, 4);
  if (year) out.year = year;
  if (d.genres?.length) out.genres = d.genres.map((g) => g.name);
  const cast = (d.credits?.cast || []).slice(0, 4).map((c) => c.name);
  if (cast.length) out.cast = cast;
  if (d.overview?.trim()) out.overview = d.overview.trim();
  return out;
}

const titles = [...new Set(JSON.parse(readFileSync('data/cinemap.json', 'utf8')).map((r) => r.opusNm).filter(Boolean))];
const prev = existsSync(OUT) && !process.argv.includes('--force') ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
// 포스터만 있고 상세(id)가 없는 옛 항목은 다시 받는다
const posters = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.id));
const todo = titles.filter((t) => !posters[t]);
let found = 0;
const missing = [];
let next = 0;
async function worker() {
  while (next < todo.length) {
    const title = todo[next++];
    try {
      const info = await lookup(title);
      if (info) { posters[title] = info; found++; } else missing.push(title);
    } catch (e) {
      console.error(`${title}: ${e.message}`);
      missing.push(title);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const sorted = Object.fromEntries(Object.entries(posters).sort(([a], [b]) => a.localeCompare(b, 'ko')));
writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
console.log(`새로 ${found}편, 전체 ${Object.keys(sorted).length}/${titles.length}편 저장. 못 찾은 작품 ${missing.length}편.`);
if (missing.length) console.log(missing.join('\n'));
