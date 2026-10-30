// 좌표 직선 거리와 화면 표기

const R = 6371008.8; // 지구 평균 반지름(m)
const rad = (d) => (d * Math.PI) / 180;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const hasCoords = (p) => p && p.lat !== null && p.lng !== null && p.lat !== undefined;

// 1km 미만은 10m 단위 m, 반올림해서 1,000m 이상이면 km. 1km 이상은 소수 첫째 자리 km.
// 숫자와 단위를 나눠 돌려준다(숫자만 accent 색).
export function formatDistance(m) {
  const r10 = Math.round(m / 10) * 10;
  if (r10 < 1000) return { value: String(r10), unit: 'm' };
  return { value: (m / 1000).toFixed(1), unit: 'km' };
}
