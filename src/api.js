// OpenAI 코스 설명 호출 (Netlify Function 경유). 실패·지연·검증 실패는 모두 null → 규칙 기반 코스.

import { AI_TIMEOUT_MS } from './settings.js';
import { validateAiCourse, placeInfo } from './course.js';

export async function fetchAiCourse(spot, candidates) {
  if (candidates.length === 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch('/.netlify/functions/course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        spot: { id: spot.id, name: spot.name, work: spot.work },
        candidates: candidates.map((c) => ({
          id: c.place.id,
          name: c.place.name,
          kind: c.place.kind,
          distanceM: Math.round(c.distance),
          info: placeInfo(c.place),
        })),
      }),
    });
    if (!res.ok) return null;
    return validateAiCourse(spot, candidates, await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
