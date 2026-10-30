// 코스: 규칙 기반 순서와 OpenAI 응답 검증.
// 코스 항목 = { place, distance, note? } — 첫 항목은 항상 촬영지(distance 0).

import { COURSE_KIND_ORDER } from './settings.js';

// AI 설명의 근거로 넘길 글. 없으면 빈 글자(모델은 정보가 없는 후보의 설명을 비운다).
// 관광지는 소개 제목·부제 + 소개글 앞부분, 식당·카페는 대표메뉴(가격 표기는 뺀다).
const INFO_MAX = { attraction: 300, restaurant: 120, cafe: 120 };
export function placeInfo(place) {
  const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  let text = '';
  if (place.kind === 'attraction') text = [place.title, place.subtitle, place.intro].map(squash).filter(Boolean).join(' / ');
  else if (place.menu) text = `대표메뉴: ${squash(place.menu).replace(/￦\s?[\d,.-]+/g, '').replace(/\s+/g, ' ').trim()}`;
  return text.slice(0, INFO_MAX[place.kind] || 0);
}

export function ruleCourse(spot, candidates) {
  const rank = (k) => COURSE_KIND_ORDER.indexOf(k);
  const rest = [...candidates].sort((a, b) => rank(a.place.kind) - rank(b.place.kind) || a.distance - b.distance);
  return [{ place: spot, distance: 0 }, ...rest];
}

// 화면 문구 규칙에 어긋나는 설명은 버린다(느낌표·이모지·지역명). 순서는 그대로 쓴다.
const REGION_WORDS = ['부산'];
const EMOJI = /\p{Extended_Pictographic}/u;
export function cleanNote(text, max = 80) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t || t.length > max) return null;
  if (t.includes('!') || EMOJI.test(t) || REGION_WORDS.some((w) => t.includes(w))) return null;
  return t;
}

// OpenAI 응답 검증. 통과하면 코스 배열, 아니면 null(→ 규칙 기반으로 대체).
// 응답 모양: { order: [id...], summary?: string, notes?: { [id]: string } }
// 조건: order가 후보 id와 정확히 같은 집합(빠짐·중복·지어낸 id 없음). 촬영지는 항상 맨 앞에 고정한다.
export function validateAiCourse(spot, candidates, ai) {
  if (!ai || !Array.isArray(ai.order)) return null;
  const byId = new Map(candidates.map((c) => [c.place.id, c]));
  const order = ai.order.filter((id) => id !== spot.id);
  if (order.length !== byId.size) return null;
  if (new Set(order).size !== order.length) return null;
  if (!order.every((id) => byId.has(id))) return null;
  const notes = ai.notes && typeof ai.notes === 'object' ? ai.notes : {};
  const items = [{ place: spot, distance: 0 }, ...order.map((id) => byId.get(id))].map((c) => ({
    ...c,
    note: cleanNote(notes[c.place.id]),
  }));
  return { items, summary: cleanNote(ai.summary, 120) };
}
