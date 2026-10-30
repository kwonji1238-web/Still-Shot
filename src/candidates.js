// 근처 후보 선택: 촬영지 좌표에서 반경 안, 가까운 순으로 분류별 최대 개수만큼.

import { distanceM, hasCoords } from './geo.js';
import { NEARBY_RADIUS_M, PREVIEW_LIMITS, COURSE_LIMITS } from './settings.js';

// 돌려주는 항목: { place, distance } (distance는 촬영지에서의 직선 거리 m)
export function nearby(spot, places, limits, radius = NEARBY_RADIUS_M) {
  if (!hasCoords(spot)) return [];
  const byKind = {};
  for (const place of places) {
    if (!(place.kind in limits) || !hasCoords(place)) continue;
    const d = distanceM(spot, place);
    if (d > radius) continue;
    (byKind[place.kind] ||= []).push({ place, distance: d });
  }
  const out = [];
  for (const kind of Object.keys(limits)) {
    const list = (byKind[kind] || []).sort((a, b) => a.distance - b.distance);
    out.push(...list.slice(0, limits[kind]));
  }
  return out;
}

// S3 근처 미리보기, S2 근처 장소 핀: 관광지 최대 2 + 식당 최대 1
export const previewCandidates = (spot, places, radius) => nearby(spot, places, PREVIEW_LIMITS, radius);

// S4 코스 후보: 관광지 최대 2 + 식당 최대 1 + 카페 최대 1
export const courseCandidates = (spot, places, radius) => nearby(spot, places, COURSE_LIMITS, radius);
