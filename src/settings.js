// 확정 문구와 [제안]·열린 결정 값을 한 곳에 모은다. 바꿀 때는 이 파일만 고친다.

// 확정 문구 (design.md 5장 "화면별 문구", naming.md)
export const COPY = {
  // 상단 서비스명(영문 워드마크). 한글 이름은 스틸스팟(naming.md), 화면 상단에는 이 표기를 쓴다.
  wordmark: 'STILL-SPOT',
  heroCopy: '영화 속 그 장소로 이어지는 길',
  searchPlaceholder: '어떤 작품 속 그곳인가요?',
  trendingLabel: '요즘 뜨는 촬영지',
  matchingLabel: '일치하는 작품',
  noResult: '아직 이 작품의 촬영지를 못 찾았어요. 다른 작품 이름으로 검색해 보세요',
  noCoords: '지도에는 표시할 수 없어요. 주소만 안내해요',
  courseLoading: '다음 장면을 고르고 있어요',
  courseDone: '찾았다! 이 근처 코스예요',
  addressOnly: '주소만 표시',
  viewOnMap: '지도로 보기',
  nearbyTitle: '근처에 이런 곳',
  nearbySub: '촬영지에서 가까운 곳',
  courseButton: '이 근처 코스 보기',
  courseTopbar: '근처 코스',
  copyAddress: '주소 복사',
  sameWorkTitle: '같은 작품의 다른 촬영지',
  intro: '소개',
  cancel: '취소',
  source:
    '촬영지 정보는 부산광역시가 제공한 공공데이터를 바탕으로 합니다. 지도 위치는 주소를 변환한 값이라 실제와 다를 수 있습니다.',
  // TMDB 고지 원문(2026-10-30 사용자 제공, 홈 맨 아래에만). 말투를 바꾸지 않는다. 포스터가 하나라도 있을 때만 보인다.
  tmdbCredit: '© TMDB - All movie-related data and images. (This product uses the TMDB API but is not endorsed or certified by TMDB.)',
  // TODO(열린 결정: S5 출처 문구) 관광지·식당 데이터 제공처를 확인한 뒤 정한다. 비어 있으면 화면에 칸을 만들지 않는다.
  placeSource: '',
  // TODO(열린 결정: 토스트 문구와 표시 시간) design.md 5장의 예시 문구. 확정 아님.
  copiedToast: '주소를 복사했어요',
  // TODO(열린 결정: 오류 문구) design.md 5장의 예시 문구. 확정 아님.
  loadError: '정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
  retry: '다시 시도',
  // TODO(열린 결정: 테마 전환 버튼의 문구) design.md·naming.md에 없는 안내 문구라 임시로 정했다. 아이콘 버튼의 접근성 이름으로만 쓴다.
  themeToDark: '다크 모드로 전환',
  themeToLight: '라이트 모드로 전환',
};

export const KIND_LABEL = { spot: '촬영지', attraction: '관광지', restaurant: '식당', cafe: '카페' };

// "요즘 뜨는 촬영지" 고정 2편. 팀이 고른 목록이고 순위가 아니다.
// 데이터의 작품명(opusNm)과 띄어쓰기를 무시하고 비교한다. 데이터에는 플랫폼 이름이 붙어 있다
// (2026-10-29 확인: "디즈니+ 파인: 촌뜨기들", "서울의 봄"). 데이터에 없으면 목록에서 빠진다.
export const TRENDING = ['디즈니+ 파인: 촌뜨기들', '서울의 봄'];
// TODO(열린 결정: "요즘 뜨는 촬영지" 한 줄의 이동 대상) 지금은 제안대로 작품 단위(S2)로 간다.

// TODO(열린 결정: 코스 후보 반경) PRD 6장. 1·2·3km 채움 비율을 계산한 뒤 정한다. 지금 값은 임시.
export const NEARBY_RADIUS_M = 3000;

// 근처 미리보기(S3)와 근처 장소 핀(S2): 관광지 최대 2 + 식당 최대 1
export const PREVIEW_LIMITS = { attraction: 2, restaurant: 1 };
// 코스(S4): 관광지 최대 2 + 식당 최대 1 + 카페 최대 1
export const COURSE_LIMITS = { attraction: 2, restaurant: 1, cafe: 1 };
// TODO(열린 결정: 코스 표시 순서) 와이어프레임의 가정(촬영지 → 관광지 → 식당 → 카페)을 쓴다. 가까운 순 정렬은 미정.
export const COURSE_KIND_ORDER = ['spot', 'attraction', 'restaurant', 'cafe'];

// TODO(열린 결정: OpenAI 대기 시간 기준) PRD 5장 미정. 넘으면 규칙 기반 코스로 대체한다.
export const AI_TIMEOUT_MS = 9500; // 서버 함수의 대기 한도(netlify/functions/course.js, 8.5초)보다 길게 둔다

// [제안] 토스트 표시 시간
export const TOAST_MS = 2000;

// [제안] "같은 작품의 다른 촬영지" 칩 수
export const SAME_WORK_CHIPS = 3;

// TODO(열린 결정: 경로 지도 높이) PRD 6장 제안 약 200px. styles.css의 --route-map-h와 같이 바꾼다.
