// 작품 검색: 띄어쓰기를 무시한 부분 일치 [제안], 앞부분 일치를 위로.

export const normalize = (s) => s.replace(/\s+/g, '').toLowerCase();

// 원문 글자 위치 ↔ 정규화 글자 위치 대응표
function indexMap(text) {
  const map = [];
  for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) map.push(i);
  return map;
}

// 결과: [{ work, ranges: [[start, end)] }] — ranges는 원문 기준으로 굵게 할 구간
export function searchWorks(works, query, limit = 30) {
  const q = normalize(query);
  if (!q) return [];
  const hits = [];
  for (const work of works) {
    const n = normalize(work.title);
    const at = n.indexOf(q);
    if (at < 0) continue;
    hits.push({ work, at, len: n.length });
  }
  hits.sort((a, b) => a.at - b.at || a.len - b.len || a.work.title.localeCompare(b.work.title, 'ko'));
  return hits.slice(0, limit).map(({ work, at }) => {
    const map = indexMap(work.title);
    return { work, ranges: toRanges(map.slice(at, at + q.length)) };
  });
}

// 연속된 원문 위치를 구간으로 묶는다 (사이에 낀 공백은 굵게 하지 않음)
function toRanges(positions) {
  const ranges = [];
  for (const p of positions) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === p) last[1] = p + 1;
    else ranges.push([p, p + 1]);
  }
  return ranges;
}

export function findWorkByName(works, name) {
  const n = normalize(name);
  return works.find((w) => normalize(w.title) === n) || null;
}
