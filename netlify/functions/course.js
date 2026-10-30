// OpenAI 코스 설명: 브라우저가 보낸 후보 안에서만 순서와 짧은 설명을 만든다.
// 키는 Netlify 환경변수 OPENAI_API_KEY에만 둔다. 실패하면 4xx/5xx를 돌려주고, 브라우저는 규칙 기반 코스로 대체한다.
// 응답: { order: [후보 id...], summary: string, notes: { [id]: string } }

// TODO(열린 결정: OpenAI 모델) 배포 전에 쓸 모델을 정해 OPENAI_MODEL 환경변수로 넣는다. 아래는 기본값일 뿐이다.
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_CANDIDATES = 4;
// TODO(열린 결정: OpenAI 대기 시간 기준) Netlify 함수의 기본 제한 시간이 10초라 그 안에서 정한 값이다(src/settings.js의 AI_TIMEOUT_MS와 함께 바꾼다).
const UPSTREAM_TIMEOUT_MS = 8500;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'not configured' });

  let input;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: 'body' });
  }
  const spot = { name: str(input?.spot?.name, 80), work: str(input?.spot?.work, 80) };
  const candidates = (Array.isArray(input?.candidates) ? input.candidates : [])
    .slice(0, MAX_CANDIDATES)
    .map((c) => ({
      id: str(c.id, 20),
      name: str(c.name, 80),
      kind: ['attraction', 'restaurant', 'cafe'].includes(c.kind) ? c.kind : null,
      distanceM: Number.isFinite(c.distanceM) ? Math.round(c.distanceM) : null,
      info: str(c.info, 400),
    }))
    .filter((c) => c.id && c.name && c.kind);
  if (!spot.name || candidates.length === 0) return json(400, { error: 'input' });

  const kindKo = { attraction: '관광지', restaurant: '식당', cafe: '카페' };
  const system = [
    '너는 촬영지 근처 나들이 코스를 정리하는 도우미다.',
    '반드시 주어진 후보 id만 쓰고, 후보 전부를 한 번씩 순서대로 나열한다. 새 장소를 만들지 않는다.',
    '출발점은 촬영지다. 거리는 직선 거리이니 가까운 곳부터 이어 가는 것을 기본으로 하고, 식당·카페는 이어 가기 자연스러운 자리에 둔다.',
    '후보 설명(notes)은 그 후보의 "정보"에 적힌 내용만 근거로 한 문장, 40자 이내로 쓴다.',
    '정보에 없는 분위기·풍경·맛·가격·영업시간·사진 찍기 좋은지 같은 내용은 쓰지 않는다. 정보에 휴관·공사·폐업·운영 중단 안내가 있어도 최신 정보가 아니므로 쓰지 않고, 다른 사실을 고른다. 정보가 "없음"이면 그 후보의 설명은 빈 문자열("")로 둔다.',
    '장소 이름을 그대로 되풀이하거나 "~할 수 있는 곳이에요" 같은 뻔한 말로 채우지 않는다. 정보에서 눈에 띄는 사실 하나를 고른다.',
    '식당·카페는 대표메뉴에 있는 메뉴 이름만 말하고 가격은 말하지 않는다.',
    '요약(summary)은 코스의 흐름을 한 문장, 50자 이내로 쓴다. 후보 설명에 쓴 내용과 거리 순서 안에서만 말한다.',
    '문체는 차분한 해요체. 느낌표·이모지·유행어(힐링, 핫플 등)·지역명·과장 표현을 쓰지 않는다.',
    '걸리는 시간이나 실제 이동 거리는 지어내지 않는다.',
    'JSON만 출력한다: {"order":[id...],"summary":"코스 한 줄 요약","notes":{"id":"후보 한 줄 설명 또는 빈 문자열"}}',
  ].join('\n');
  const user = JSON.stringify({
    촬영지: `${spot.work} — ${spot.name}`,
    후보: candidates.map((c) => ({
      id: c.id,
      이름: c.name,
      분류: kindKo[c.kind],
      촬영지에서_직선거리_m: c.distanceM,
      정보: c.info || '없음',
    })),
  });

  let data;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      // 원인 확인용 로그: 상태와 오류 코드만 남긴다(메시지에는 키 일부가 들어갈 수 있어 남기지 않는다).
      const err = await res.json().catch(() => ({}));
      console.error('OpenAI 호출 실패', res.status, err?.error?.code || err?.error?.type || '');
      return json(502, { error: 'upstream' });
    }
    const body = await res.json();
    data = JSON.parse(body.choices?.[0]?.message?.content || '{}');
  } catch (e) {
    console.error('OpenAI 호출 실패', e?.name || 'error'); // TimeoutError면 시간 초과
    return json(502, { error: 'upstream' });
  }

  // 서버에서도 검증: 후보와 정확히 같은 id 집합이 아니면 버린다(브라우저가 다시 검증한다).
  const ids = new Set(candidates.map((c) => c.id));
  const order = Array.isArray(data.order) ? data.order.filter((id) => typeof id === 'string') : [];
  if (order.length !== ids.size || new Set(order).size !== order.length || !order.every((id) => ids.has(id))) {
    return json(422, { error: 'invalid order' });
  }
  const notes = {};
  for (const id of order) if (typeof data.notes?.[id] === 'string') notes[id] = data.notes[id].slice(0, 120);
  return json(200, { order, summary: str(data.summary, 160), notes });
};
