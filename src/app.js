// 라우팅, 화면 전환, 이벤트, 지도 연결.
// 경로: #/ (S1·E1·E2) · #/w/<작품명>[?sel=<촬영지id>] (S2) · #/s/<id> (S3·E3) · #/c/<id> (S4) · #/p/<촬영지id>/<장소id> (S5)
// 뒤로 가기는 브라우저 history를 쓰고, 떠나는 화면의 지도 위치·시트 높이·스크롤을 history.state에 저장해 복원한다.

import { loadData } from './data.js';
import { searchWorks, findWorkByName } from './search.js';
import { previewCandidates, courseCandidates } from './candidates.js';
import { ruleCourse } from './course.js';
import { fetchAiCourse } from './api.js';
import { distanceM } from './geo.js';
import { TRENDING, SAME_WORK_CHIPS, TOAST_MS, COPY } from './settings.js';
import * as R from './render.js';
import { loadKakao, MainMap, createRouteMap } from './map.js';
import { toggleTheme } from './theme.js';

const $ = (sel) => document.querySelector(sel);
const screen = $('#screen');
const mq = matchMedia('(min-width: 768px)');

const app = {
  db: null,
  mapOk: false,
  mapChecked: false,
  main: null,
  courses: new Map(), // 촬영지 id → 확정된 코스 (OpenAI 결과 또는 규칙 기반)
  route: null,
  sheetLevel: 'half',
  selectedId: null,
  token: 0, // 화면이 바뀌면 늦게 끝난 비동기 작업을 버린다
  pcWork: null, // PC에서 지금 그려진 목록 패널의 작품
};

// ── 라우팅 ──
function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const query = new URLSearchParams(qs || '');
  if (parts[0] === 'w' && parts[1]) return { name: 'work', title: parts[1], sel: query.get('sel') };
  if (parts[0] === 's' && parts[1]) return { name: 'spot', id: parts[1] };
  if (parts[0] === 'c' && parts[1]) return { name: 'course', id: parts[1] };
  if (parts[0] === 'p' && parts[2]) return { name: 'place', spotId: parts[1], id: parts[2] };
  if (parts[0] === 'm' && parts[2]) return { name: 'placemap', spotId: parts[1], id: parts[2] };
  return { name: 'home', q: query.get('q') || '' };
}

const href = {
  home: (q) => (q ? `#/?q=${encodeURIComponent(q)}` : '#/'),
  work: (title, sel) => `#/w/${encodeURIComponent(title)}${sel ? `?sel=${sel}` : ''}`,
  spot: (id) => `#/s/${id}`,
  course: (id) => `#/c/${id}`,
  place: (spotId, id) => `#/p/${spotId}/${id}`,
  placeMap: (spotId, id) => `#/m/${spotId}/${id}`,
};

function mapVisible() {
  return document.body.dataset.map === 'on' && app.main && document.body.dataset.screen !== 'home';
}

function saveState() {
  const st = { ...(history.state || {}) };
  st.scroll = window.scrollY;
  st.sheet = app.sheetLevel;
  st.sel = app.selectedId;
  const body = $('#sheet-body');
  st.listScroll = body ? body.scrollTop : 0;
  if (mapVisible()) st.view = app.main.getView();
  else delete st.view;
  history.replaceState(st, '');
}

function navigate(h, { replace = false } = {}) {
  saveState();
  const depth = history.state?.depth || 0;
  if (replace) history.replaceState({ depth }, '', h);
  else history.pushState({ depth: depth + 1 }, '', h);
  render(true);
}

// 바로 전 화면으로. 이 사이트 안에서 처음 연 화면이면 위 단계 화면으로 바꾼다.
function goBack(fallback) {
  if ((history.state?.depth || 0) > 0) history.back();
  else navigate(fallback, { replace: true });
}

addEventListener('popstate', () => render(false));
mq.addEventListener('change', () => { saveState(); render(false); });

// ── 렌더 ──
function render(fresh) {
  let r = parse();
  // PC는 S5 패널 뒤에 항상 지도가 있어서 별도 지도 화면이 없다. 장소 상세로 보여 준다.
  if (r.name === 'placemap' && mq.matches) r = { name: 'place', spotId: r.spotId, id: r.id };
  app.route = r;
  app.token++;
  const st = fresh ? null : history.state;
  const layout = mq.matches ? 'pc' : 'mobile';
  document.body.dataset.layout = layout;
  document.body.dataset.screen = r.name;

  if (r.name === 'home') {
    app.pcWork = null;
    document.body.dataset.map = 'off';
    renderHome(r.q || st?.q || '', fresh && !!r.q);
    restoreScroll(st);
    return;
  }

  const ctx = resolve(r);
  if (!ctx) return navigate(href.home(), { replace: true });

  if (layout === 'pc') renderPc(r, ctx, st);
  else renderMobile(r, ctx, st);
}

// 경로에서 작품·촬영지·장소를 찾는다. 없으면 null.
function resolve(r) {
  const { byId, workByTitle } = app.db;
  if (r.name === 'work') {
    const work = workByTitle.get(r.title);
    return work ? { work } : null;
  }
  const spot = byId.get(r.name === 'place' || r.name === 'placemap' ? r.spotId : r.id);
  if (!spot || spot.kind !== 'spot') return null;
  const work = workByTitle.get(spot.work);
  if (r.name === 'course' && spot.lat === null) return null;
  if (r.name === 'place' || r.name === 'placemap') {
    const place = byId.get(r.id);
    if (!place || place.kind === 'spot' || spot.lat === null) return null;
    return { work, spot, place };
  }
  return { work, spot };
}

function restoreScroll(st) {
  window.scrollTo(0, st?.scroll || 0);
}

// ── S1·E1·E2 ──
function trendingWorks() {
  return TRENDING.map((t) => findWorkByName(app.db.works, t)).filter(Boolean);
}

function renderHome(q, focus) {
  screen.innerHTML = R.homeScreen(q, { credit: app.db.hasPosters });
  const input = $('#q');
  updateResults(q);
  input.addEventListener('input', () => {
    updateResults(input.value);
    history.replaceState({ ...(history.state || {}), q: input.value }, '');
  });
  if (focus) {
    input.focus();
    input.setSelectionRange(q.length, q.length);
  }
}

function updateResults(q) {
  const searching = q.trim().length > 0;
  $('#cancel').hidden = !searching;
  const results = $('#results');
  if (!searching) {
    results.innerHTML = R.trendingBlock(trendingWorks());
    return;
  }
  const hits = searchWorks(app.db.works, q);
  results.innerHTML = hits.length ? R.matchBlock(hits) : R.noResultBlock(trendingWorks());
}

// ── 모바일 ──
function renderMobile(r, ctx, st) {
  if (r.name === 'work') return renderWorkMobile(r, ctx, st);
  if (r.name === 'placemap') return renderPlaceMapMobile(ctx, st);
  document.body.dataset.map = 'off';
  if (r.name === 'spot') screen.innerHTML = spotHtml(ctx.spot, false);
  if (r.name === 'course') {
    screen.innerHTML = R.courseScreen(ctx.spot, { work: ctx.work, pc: false });
    runCourse(ctx.spot, false);
  }
  if (r.name === 'place') screen.innerHTML = placeHtml(ctx);
  restoreScroll(st);
}

// 장소 지도(모바일): 촬영지 핀 + 이 장소 핀을 한눈에. 보기 전용이다.
function renderPlaceMapMobile({ spot, place }, st) {
  if (!app.mapChecked) return; // 지도 준비를 기다린다. 준비되면 boot가 다시 그린다
  if (!app.mapOk) return navigate(href.place(spot.id, place.id), { replace: true });
  document.body.dataset.map = 'on';
  app.selectedId = null;
  screen.innerHTML = R.placeMapScreen(place, { spot, distance: distanceM(spot, place) });
  app.main.relayout();
  app.main.clear('course');
  app.main.clear('nearby');
  app.main.clear('spots');
  app.main.add('spots', spot, { no: spot.no, label: spot.name });
  app.main.showPlace(place);
  if (st?.view) return app.main.setView(st.view);
  const card = $('#map-card').getBoundingClientRect().height;
  app.main.fit([spot, place], [88, 72, card + 48, 72]);
}

function spotHtml(spot, pc) {
  const work = app.db.workByTitle.get(spot.work);
  const preview = previewCandidates(spot, app.db.places);
  const hasCourse = courseCandidates(spot, app.db.places).length > 0;
  return R.spotDetail(spot, { work, preview, hasCourse, others: sameWork(work, spot), pc });
}

function placeHtml({ spot, place }) {
  return R.placeScreen(place, { spot, distance: distanceM(spot, place), canMap: app.mapOk && place.lat !== null });
}

// 같은 작품의 다른 촬영지 [제안]: 목록에서 이 촬영지 다음 순서로 최대 3곳
function sameWork(work, spot) {
  const list = work.spots;
  const i = list.findIndex((s) => s.id === spot.id);
  const out = [];
  for (let k = 1; k < list.length && out.length < SAME_WORK_CHIPS; k++) out.push(list[(i + k) % list.length]);
  return out;
}

// ── S2 (모바일): 지도 + 시트 3단계 ──
function sheetHeights() {
  const h = window.innerHeight;
  // 844px 화면 기준 접힘 136 / 반 열림 404 / 펼침 740(위 104)
  return { collapsed: 136, half: Math.round((h * 404) / 844), expanded: h - Math.round((h * 104) / 844) };
}

function renderWorkMobile(r, { work }, st) {
  const hasPins = work.spots.some((s) => s.lat !== null);
  const mapOn = app.mapOk && hasPins;
  document.body.dataset.map = mapOn ? 'on' : 'off';
  const sel = r.sel || st?.sel;
  app.selectedId = work.spots.some((s) => s.id === sel) ? sel : null;
  // "지도로 보기"로 들어오면 반 열림. 뒤로 가기면 저장한 높이.
  app.sheetLevel = mapOn ? (r.sel ? 'half' : st?.sheet || 'half') : 'half';
  screen.innerHTML = R.workScreenMobile(work, { mapOn, selectedId: app.selectedId, level: app.sheetLevel });

  if (!mapOn) {
    restoreScroll(st);
    return;
  }
  setSheetLevel(app.sheetLevel, false);
  bindSheet();
  const body = $('#sheet-body');
  if (st?.listScroll) body.scrollTop = st.listScroll;
  else if (app.selectedId) scrollRowIntoView(app.selectedId);

  app.main.relayout();
  drawWorkPins(work);
  if (st?.view) app.main.setView(st.view);
  else if (app.selectedId) fitSelection();
  else fitWork(work);
}

function drawWorkPins(work) {
  app.main.setSpots(work.spots, app.selectedId, pickSpot);
  const sel = app.selectedId && app.db.byId.get(app.selectedId);
  if (sel && sel.lat !== null) app.main.setNearby(previewCandidates(sel, app.db.places));
  else app.main.clear('nearby');
}

function mapPadding() {
  if (document.body.dataset.layout === 'pc') {
    const panelOpen = !$('#pc-detail')?.hidden;
    return [48, 48, 48, panelOpen ? 432 + 24 : 48];
  }
  return [72, 40, sheetHeights()[app.sheetLevel] + 24, 40];
}

function fitWork(work) {
  app.main.fit(work.spots.filter((s) => s.lat !== null), mapPadding());
}

// 선택한 촬영지와 근처 장소 핀이 함께 보이게 [제안]
// TODO(열린 결정: 근처 핀이 보이게 확대할지) 대안은 확대 수준 유지.
function fitSelection() {
  const sel = app.db.byId.get(app.selectedId);
  if (!sel || sel.lat === null) return;
  const pts = [sel, ...previewCandidates(sel, app.db.places).map((c) => c.place)];
  app.main.fit(pts, mapPadding());
}

// 핀을 누르면: 모바일은 줄 강조 + 근처 핀, PC는 상세 패널을 연다.
function pickSpot(id) {
  if (document.body.dataset.layout === 'pc') return navigate(href.spot(id));
  app.selectedId = id;
  markSelectedRow(id);
  // 접힘에서 핀을 누르면 반 열림까지 올린다 [제안]
  if (app.sheetLevel === 'collapsed') setSheetLevel('half', false);
  scrollRowIntoView(id);
  const work = app.db.workByTitle.get(app.db.byId.get(id).work);
  drawWorkPins(work);
  focusSelection();
  saveState();
}

// 줄이나 핀을 눌렀을 때: 그 핀으로 확대한다(2026-10-30 사용자 결정). 펼침 시트는 지도가 보이게 반 열림으로 내린다.
// TODO(열린 결정: 확대 수준) 지금은 카카오 레벨 4. 근처 핀까지 함께 보이게 맞추는 fitSelection은 다른 곳에서 쓴다.
const FOCUS_LEVEL = 4;
function focusSelection() {
  const sel = app.db.byId.get(app.selectedId);
  if (!sel || sel.lat === null) return;
  if (app.sheetLevel === 'expanded') setSheetLevel('half', false);
  app.main.focus(sel, FOCUS_LEVEL, mapPadding());
}

// 목록에서 선택한 줄 표시(촬영지 줄은 li.row-split 전체에 걸린다)
function markSelectedRow(id) {
  document.querySelectorAll('.row.is-sel, .row-split.is-sel').forEach((el) => { el.classList.remove('is-sel'); el.removeAttribute('aria-current'); });
  const row = id && $(`#row-${id}`);
  if (!row) return;
  row.classList.add('is-sel');
  row.setAttribute('aria-current', 'true');
  row.closest('.row-split')?.classList.add('is-sel');
}

function scrollRowIntoView(id) {
  const row = $(`#row-${id}`);
  const body = $('#sheet-body');
  if (!row || !body) return;
  body.scrollTop = row.offsetTop - body.offsetTop - 8;
}

function setSheetLevel(level, save = true) {
  const sheet = $('#sheet');
  if (!sheet) return;
  app.sheetLevel = level;
  sheet.dataset.level = level;
  sheet.style.setProperty('--sheet-h', `${sheetHeights()[level]}px`);
  const btn = sheet.querySelector('[data-action="sheet-toggle"]');
  if (btn) {
    const down = level === 'expanded';
    btn.innerHTML = down ? R.icon.down() : R.icon.up();
    btn.setAttribute('aria-label', down ? '목록 접기' : '목록 펼치기');
  }
  if (save) saveState();
}

function bindSheet() {
  const sheet = $('#sheet');
  sheet.querySelectorAll('[data-drag]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, [data-expand]')) return;
      const startY = e.clientY;
      const startH = sheet.getBoundingClientRect().height;
      const hs = sheetHeights();
      let moved = false;
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add('is-dragging');
      const move = (ev) => {
        const dy = startY - ev.clientY;
        if (Math.abs(dy) > 4) moved = true;
        const h = Math.max(hs.collapsed, Math.min(hs.expanded, startH + dy));
        sheet.style.setProperty('--sheet-h', `${h}px`);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        sheet.classList.remove('is-dragging');
        if (!moved) return setSheetLevel(app.sheetLevel);
        const h = sheet.getBoundingClientRect().height;
        const level = Object.entries(hs).sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0];
        setSheetLevel(level);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  });
}

addEventListener('resize', () => {
  if ($('#sheet') && !$('#sheet').classList.contains('is-static')) setSheetLevel(app.sheetLevel, false);
});

// ── S4: 코스 ──
async function runCourse(spot, pc) {
  const token = app.token;
  const status = $('#course-status');
  let course = app.courses.get(spot.id);
  if (!course) {
    const cands = courseCandidates(spot, app.db.places);
    status.innerHTML = R.frameMsg('loading'); // OpenAI 설명을 기다리는 동안만
    const ai = await fetchAiCourse(spot, cands);
    course = ai || { items: ruleCourse(spot, cands), summary: null };
    app.courses.set(spot.id, course);
    if (token !== app.token) return;
  }
  // 순서가 정해진 뒤에 카드 번호·경로 지도를 그린다.
  status.innerHTML = R.frameMsg('done');
  const showRouteMap = !pc && app.mapOk;
  $('#course-body').innerHTML = R.courseBody(course, { showRouteMap });
  if (showRouteMap) createRouteMap($('#route-map'), course.items);
  if (pc && mapVisible()) {
    // TODO(열린 결정: PC에서 코스 핀과 촬영지 번호 핀이 겹칠 때) 지금은 코스를 여는 동안 촬영지 번호 핀을 숨긴다.
    app.main.clear('spots');
    app.main.clear('nearby');
    app.main.setCourse(course.items);
    app.main.fit(course.items.map((it) => it.place), mapPadding());
  }
}

// ── PC (768px 이상): 목록 패널 + 지도 + 지도 위 상세 패널 ──
function renderPc(r, ctx, st) {
  const { work } = ctx;
  const hasPins = work.spots.some((s) => s.lat !== null);
  const mapOn = app.mapOk && hasPins;
  document.body.dataset.map = mapOn ? 'on' : 'off';
  app.selectedId = r.name === 'work' ? null : ctx.spot.id;

  if (app.pcWork !== work.title || !$('#pc-list')) {
    screen.innerHTML = R.pcFrame(work, { selectedId: app.selectedId });
    app.pcWork = work.title;
    $('#pc-q').addEventListener('input', (e) => navigate(href.home(e.target.value)));
  } else {
    markSelectedRow(app.selectedId);
  }

  const panel = $('#pc-detail');
  panel.hidden = r.name === 'work';
  panel.scrollTop = 0;
  if (r.name === 'spot') panel.innerHTML = spotHtml(ctx.spot, true);
  if (r.name === 'course') panel.innerHTML = R.courseScreen(ctx.spot, { work, pc: true });
  if (r.name === 'place') panel.innerHTML = placeHtml(ctx);

  if (mapOn) {
    app.main.relayout();
    if (r.name === 'work' || r.name === 'spot') {
      app.main.clear('course');
      drawWorkPins(work);
      if (st?.view) app.main.setView(st.view);
      else if (app.selectedId && ctx.spot.lat !== null) fitSelection();
      else if (r.name === 'work') fitWork(work);
    }
  }
  if (r.name === 'course') runCourse(ctx.spot, true);
  if (r.name === 'place' && mapOn) {
    // S5에서도 코스 핀·선을 그대로 둔다
    const course = app.courses.get(ctx.spot.id);
    if (course) {
      app.main.clear('spots');
      app.main.clear('nearby');
      app.main.setCourse(course.items);
    }
  }
}

// ── 이벤트 ──
document.addEventListener('click', (e) => {
  const ex = e.target.closest('[data-expand]');
  if (ex) {
    const open = ex.classList.toggle('is-open');
    ex.setAttribute('aria-expanded', String(open));
    // 시트 안에서 펼치면 글이 들어갈 자리가 모자라니 시트도 끝까지 올린다
    if (open && ex.closest('#sheet') && !$('#sheet').classList.contains('is-static') && app.sheetLevel !== 'expanded') setSheetLevel('expanded');
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM') return;
  const { action, id, title } = el.dataset;
  const r = app.route;
  switch (action) {
    case 'open-work': return navigate(href.work(title));
    case 'open-spot': return navigate(href.spot(id));
    // 모바일은 지도 확대, PC는 상세 패널(핀을 누를 때와 같다)
    case 'select-spot': return document.body.dataset.layout === 'pc' ? navigate(href.spot(id)) : pickSpot(id);
    case 'open-course': return navigate(href.course(id));
    case 'open-place': return navigate(href.place(r.id, id));
    case 'view-on-map': return navigate(href.work(app.db.byId.get(id).work, id));
    case 'home': return navigate(href.home());
    case 'search-cancel': {
      const input = $('#q');
      input.value = '';
      updateResults('');
      history.replaceState({ ...(history.state || {}), q: '' }, '');
      return;
    }
    case 'sheet-toggle': {
      const next = { collapsed: 'half', half: 'expanded', expanded: 'half' }[app.sheetLevel];
      return setSheetLevel(next);
    }
    case 'toggle-theme': return toggleTheme();
    // 모바일은 장소 지도 화면으로, PC는 뒤에 있는 지도에 이 장소를 띄우고 확대한다
    case 'view-place-map': {
      if (document.body.dataset.layout !== 'pc') return navigate(href.placeMap(el.dataset.spot, id));
      app.main.showPlace(app.db.byId.get(id));
      return app.main.focus(app.db.byId.get(id), FOCUS_LEVEL, mapPadding());
    }
    case 'copy': return copyText(el.dataset.text);
    case 'close-panel': return navigate(href.work(app.db.byId.get(r.id).work));
    case 'retry': return boot();
    case 'back': return back();
  }
});

function back() {
  const r = app.route;
  if (r.name === 'work') return goBack(href.home());
  if (r.name === 'spot') return goBack(href.work(app.db.byId.get(r.id).work));
  if (r.name === 'course') return goBack(href.spot(r.id));
  if (r.name === 'place') return goBack(href.course(r.spotId));
  if (r.name === 'placemap') return goBack(href.place(r.spotId, r.id));
}

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#q');
  if (!input) return;
  // TODO(열린 결정: 빈 입력 안내 문구) PRD F-01 "빈 입력이면 안내한다". 문구가 없어 지금은 입력창으로 돌아간다.
  if (!input.value.trim()) return input.focus();
  const hits = searchWorks(app.db.works, input.value, 1);
  if (hits.length) navigate(href.work(hits[0].work.title));
  else input.blur();
});

// 사진 주소가 깨지면 그 칸을 없앤다(빈 칸을 남기지 않음)
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallback === 'tile') {
      const tile = img.parentElement;
      tile.classList.add('framed');
      tile.innerHTML = R.corners(10);
    } else if (img.dataset.fallback === 'remove-photo') {
      img.parentElement.className = 'lowbar';
      img.remove();
    }
  },
  true,
);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(COPY.copiedToast);
}

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), TOAST_MS);
}

// ── 시작 ──
let mapPromise = null;
async function boot() {
  if (!history.state) history.replaceState({ depth: 0 }, '');
  mapPromise ||= loadKakao(window.STILLSPOT_CONFIG?.kakaoJsKey);
  try {
    app.db = await loadData();
  } catch {
    document.body.dataset.screen = 'error';
    screen.innerHTML = R.errorScreen();
    return;
  }
  render(false);
  app.mapOk = await mapPromise;
  app.mapChecked = true;
  // 지도가 안 되면 지도 화면(#/m)은 장소 상세로 돌려보낸다
  if (!app.mapOk) return app.route.name === 'placemap' ? render(false) : undefined;
  app.main = new MainMap($('#map'));
  // 지도가 필요한 화면이면 지도와 함께 다시 그린다(홈·S3는 그대로 둔다. S5는 "지도로 보기" 버튼이 지도에 달려 있다)
  const n = app.route.name;
  if (n !== 'home' && (document.body.dataset.layout === 'pc' || n === 'work' || n === 'course' || n === 'place' || n === 'placemap')) {
    saveState();
    app.pcWork = null;
    render(false);
  }
}

boot();
