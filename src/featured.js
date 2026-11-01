// 검색 화면의 "요즘 뜨는 촬영지"·"사진 남기기 좋은 촬영지": 섹션마다 두 곳. 고정 촬영지가 먼저, 모자란 자리는 무작위.
// 고정 촬영지는 settings.js의 FEATURED에서 작품명·장소명으로 찾고, 데이터에 없으면 빠진다. 지도에 찍을 수 있는 촬영지(좌표 있음)만 고른다.

import { FEATURED } from './settings.js';

const PER_SECTION = 2;

export function pickFeatured(spots, { rand = Math.random, featured = FEATURED } = {}) {
  const pool = spots.filter((s) => s.lat !== null);
  const used = new Set();
  const card = (spot, f) => ({
    spot,
    label: f?.label || spot.name,
    work: spot.work,
    image: f?.image || null,
    credit: f?.credit || null,
  });

  const sections = {};
  for (const [key, list] of Object.entries(featured)) {
    sections[key] = [];
    for (const f of list) {
      const spot = pool.find((s) => s.work === f.work && s.name === f.place);
      if (!spot) continue;
      used.add(spot.id);
      sections[key].push(card(spot, f));
    }
  }
  const random = () => {
    const rest = pool.filter((s) => !used.has(s.id));
    if (!rest.length) return null;
    const spot = rest[Math.floor(rand() * rest.length)];
    used.add(spot.id);
    return card(spot);
  };
  for (const list of Object.values(sections)) {
    while (list.length < PER_SECTION) {
      const c = random();
      if (!c) break;
      list.push(c);
    }
  }
  return sections;
}
