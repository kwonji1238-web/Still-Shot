// 보통은 쓰지 않는다: npm run dev가 .env의 KAKAO_JS_KEY로 dist/config.js를 만들고 localhost:8000에서 띄운다.
// 빌드 없이 루트를 직접 띄울 때만 이 파일을 config.js로 복사하고 카카오 JavaScript 키를 넣는다.
// config.js는 .gitignore에 있다. 배포본의 config.js는 scripts/build.mjs가 KAKAO_JS_KEY 환경변수로 만든다.
// REST 키는 지도 SDK에 쓸 수 없다. localhost도 카카오 개발자 사이트의 JavaScript SDK 도메인에 등록해야 한다.
window.STILLSPOT_CONFIG = { kakaoJsKey: '' };
