// 화면 마크업. 상태를 갖지 않고 HTML 문자열만 만든다. 이벤트는 data-action으로 app.js가 받는다.

import { COPY, KIND_LABEL } from './settings.js';
import { formatDistance } from './geo.js';
import { themeButton } from './theme.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── 아이콘 (선 아이콘, currentColor) ──
const svg = (d, size = 20, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
export const icon = {
  back: () => svg('<path d="M15 5l-7 7 7 7"/>'),
  close: () => svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: () => svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  chev: () => svg('<path d="M9 5l7 7-7 7"/>', 18),
  up: () => svg('<path d="M5 15l7-7 7 7"/>'),
  down: () => svg('<path d="M5 9l7 7 7-7"/>'),
  pin: () => svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.25"/>', 16),
  warn: () =>
    `<svg class="warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.25v.01" stroke-linecap="round"/></svg>`,
};

// ── 필름 코너 마크: 모서리마다 가로·세로 선 1개씩, 모두 8개 ──
export function corners(len, sw = 1.5) {
  const s = len, h = sw / 2;
  const c = (pos, d) =>
    `<svg class="fc fc-${pos}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}"/></svg>`;
  return (
    c('tl', `M${h} ${s}V${h}H${s}`) + c('tr', `M0 ${h}H${s - h}V${s}`) +
    c('bl', `M${h} 0V${s - h}H${s}`) + c('br', `M0 ${s - h}H${s - h}V0`)
  );
}

// 로고 심볼(브랜드 마크). 좌표는 icon/ 폴더의 원본 벡터와 같고, 색은 currentColor라 ink 토큰을 따른다.
export const logoMark = () =>
  `<svg class="logo-mark" viewBox="3.75 3.75 56.5 56.5" aria-hidden="true"><path d="M6 24V6H24M40 6H58V24M58 40V58H40M24 58H6V40" fill="none" stroke="currentColor" stroke-width="4.5" stroke-miterlimit="10"/><circle cx="32" cy="32" r="8" fill="currentColor"/></svg>`;

export const numBadge = (no) =>
  no == null
    ? `<span class="badge framed is-none" aria-hidden="true">${corners(7)}<span class="n">–</span></span>`
    : `<span class="badge framed" aria-hidden="true">${corners(7)}<span class="n">${no}</span></span>`;

const emptyTile = () => `<span class="tile framed" aria-hidden="true">${corners(10)}</span>`;
const thumbTile = (place) =>
  place.thumb
    ? `<span class="tile"><img src="${esc(place.thumb)}" alt="" loading="lazy" data-fallback="tile"></span>`
    : emptyTile();

const count = (n) => `촬영지 <span class="num">${n}</span>곳`;
const dist = (m) => {
  const d = formatDistance(m);
  return `<span class="num">${d.value}</span>${d.unit}`;
};
const kindDist = (kind, m) => `${KIND_LABEL[kind]} · 직선 ${dist(m)}`;
const source = () => `<p class="source">${esc(COPY.source)}</p>`;
const chev = () => `<span class="chev">${icon.chev()}</span>`;

// ── S1·E1·E2 ──
export function homeScreen(q, { credit = false } = {}) {
  return `
  <div class="home" id="home">
    <header class="home-top"><span class="brand-lock">${logoMark()}<span class="wordmark" lang="en">${esc(COPY.wordmark)}</span></span>${themeButton()}</header>
    <h1 class="t-display hero">${esc(COPY.heroCopy)}</h1>
    <form class="search-row" role="search" data-action="search-submit">
      <label class="search">
        <span class="sr-only">작품 검색</span>
        <input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(COPY.searchPlaceholder)}" value="${esc(q)}">
        <button class="btn-icon" type="submit" aria-label="검색">${icon.search()}</button>
      </label>
      <button class="btn-text" type="button" data-action="search-cancel" id="cancel" hidden>${esc(COPY.cancel)}</button>
    </form>
    <div class="results" id="results"></div>
    ${credit ? `<p class="source home-credit">${esc(COPY.tmdbCredit)}</p>` : ''}
  </div>`;
}

const workRow = (work, label, strong = true) => `
  <li><button class="row" data-action="open-work" data-title="${esc(work.title)}">
    <span class="grow"><span class="${strong ? 't-strong ' : ''}clamp2">${label ?? esc(work.title)}</span><span class="t-sub">${count(work.spots.length)}</span></span>
    ${chev()}
  </button></li>`;

export function trendingBlock(works) {
  if (!works.length) return '';
  return `<section class="stack-8"><h2 class="section-title">${esc(COPY.trendingLabel)}</h2>
    <ul class="list">${works.map((w) => workRow(w)).join('')}</ul></section>`;
}

function highlight(title, ranges) {
  let out = '', i = 0;
  for (const [a, b] of ranges) {
    out += esc(title.slice(i, a)) + `<b>${esc(title.slice(a, b))}</b>`;
    i = b;
  }
  return out + esc(title.slice(i));
}

export function matchBlock(hits) {
  return `<section class="stack-8"><h2 class="section-title">${esc(COPY.matchingLabel)}</h2>
    <ul class="list">${hits
      .map((h) => workRow(h.work, `<span class="match">${highlight(h.work.title, h.ranges)}</span>`, false))
      .join('')}</ul></section>`;
}

export function noResultBlock(trending) {
  const [title, body] = COPY.noResult.split('. ');
  return `<section class="empty-msg" aria-live="polite"><h2 class="t-title">${esc(title)}</h2><p class="t-sub c-sub">${esc(body)}</p></section>${trendingBlock(trending)}`;
}

// ── S2 시트 · PC 목록 패널 ──
function spotRow(spot, selectedId) {
  const chip = spot.no == null ? `<span class="chip-kind"><span class="dot-ring" aria-hidden="true"></span>${esc(COPY.addressOnly)}</span>` : '';
  const label = spot.no == null ? '' : `<span class="sr-only">${spot.no}번 </span>`;
  const sel = spot.id === selectedId;
  const body = `${numBadge(spot.no)}
    <span class="grow"><span class="t-strong clamp2">${label}${esc(spot.name)}</span><span class="t-sub c-sub">${esc(spot.address)}</span>${chip ? `<span class="meta">${chip}</span>` : ''}</span>`;
  // 핀이 없는 촬영지는 확대할 곳이 없으니 줄 전체가 상세(E3)로 간다.
  if (spot.no == null) {
    return `<li><button class="row" data-action="open-spot" data-id="${spot.id}" id="row-${spot.id}">${body}${chev()}</button></li>`;
  }
  // 줄을 누르면 지도에서 그 핀으로 확대하고(2026-10-30 사용자 결정), 오른쪽 화살표를 누르면 상세(S3)로 간다.
  return `<li class="row-split${sel ? ' is-sel' : ''}">
    <button class="row" data-action="select-spot" data-id="${spot.id}" id="row-${spot.id}"${sel ? ' aria-current="true"' : ''}>${body}</button>
    <button class="row-go" data-action="open-spot" data-id="${spot.id}" aria-label="${esc(spot.name)} 상세 보기">${icon.chev()}</button>
  </li>`;
}

// 작품 정보. 포스터 옆 칸에는 개봉연도 · 장르 / 출연, 포스터 아래에는 줄거리가 온다. 있는 줄만 나온다(접힌 시트에서는 CSS가 감춘다).
// 말줄임된 글(data-expand)은 누르면 펼쳐지고 다시 누르면 접힌다.
function workMeta(info) {
  if (!info) return '';
  const yg = [info.year, info.genres.join(', ')].filter(Boolean).join(' · ');
  return [
    yg && `<p class="t-sub work-meta">${esc(yg)}</p>`,
    info.cast.length && `<p class="t-sub c-sub work-meta clamp1" data-expand aria-expanded="false">출연 ${esc(info.cast.join(', '))}</p>`,
  ].filter(Boolean).join('');
}
const workOverview = (info) =>
  info?.overview ? `<p class="work-overview clamp3" data-expand aria-expanded="false">${esc(info.overview)}</p>` : '';

export function workHead(work, { toggle = null } = {}) {
  const btn = toggle
    ? `<button class="btn-icon is-bare" data-action="sheet-toggle" aria-label="${toggle === 'down' ? '목록 접기' : '목록 펼치기'}">${toggle === 'down' ? icon.down() : icon.up()}</button>`
    : '';
  // 포스터는 data/posters.json에 있을 때만 보이고, 없거나 못 불러오면 빈 프레임이다. 개봉연도·장르·줄거리는 데이터에 없어 작품명 + 촬영지 N곳으로 성립한다(F-15).
  const meta = workMeta(work.info);
  return `<header class="sheet-head">
    <div class="sheet-head-row">
    ${work.poster ? `<span class="poster"><img src="${esc(work.poster)}" alt="" loading="lazy" onerror="this.parentNode.className='poster framed';this.remove()"></span>` : `<span class="poster framed" aria-hidden="true">${corners(10)}</span>`}
    <div class="grow${meta ? ' has-meta' : ''}"><h1 class="t-title${meta ? ' clamp1" data-expand aria-expanded="false' : ''}">${esc(work.title)}</h1><div class="work-facts"><p class="t-sub">${count(work.spots.length)}</p>${meta}</div></div>
    ${btn}
    </div>
    ${workOverview(work.info)}
  </header>`;
}

export function spotList(work, selectedId) {
  return `<ol class="list">${work.spots.map((s) => spotRow(s, selectedId)).join('')}</ol>${source()}`;
}

export function workScreenMobile(work, { mapOn, selectedId, level }) {
  if (!mapOn) {
    return `<div class="map-ctrl is-static" style="padding-left:var(--gutter);padding-right:var(--gutter)">
      <button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button></div>
      <section class="sheet is-static">${workHead(work)}<div class="sheet-body">${spotList(work, selectedId)}</div></section>`;
  }
  return `
    <div class="map-ctrl">
      <button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button>
    </div>
    <section class="sheet" id="sheet" data-level="${level}">
      <div class="sheet-grip" data-drag><span></span></div>
      <div data-drag>${workHead(work, { toggle: level === 'expanded' ? 'down' : 'up' })}</div>
      <div class="sheet-body" id="sheet-body">${spotList(work, selectedId)}</div>
    </section>`;
}

// ── S3 · E3 ──
export function spotDetail(spot, { work, preview, hasCourse, others, pc }) {
  const coords = spot.lat !== null;
  const top = pc
    ? `<div class="lowbar is-close"><button class="btn-icon" data-action="close-panel" aria-label="닫기">${icon.close()}</button></div>`
    : `<div class="lowbar"><button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button></div>`;

  const nearby = preview.length
    ? `<section class="nearby stack-8">
        <div class="nearby-head"><h2 class="section-title">${esc(COPY.nearbyTitle)}</h2><p class="t-sub c-sub">${esc(COPY.nearbySub)}</p></div>
        <ul class="list">${preview
          .map(
            // 줄을 누르면 장소 상세(S5)로 간다(2026-10-30 사용자 결정). 뒤로 가기는 이 화면으로 돌아온다.
            (c) => `<li><button class="row" data-action="open-place" data-id="${c.place.id}">${thumbTile(c.place)}
              <span class="grow"><span class="t-strong clamp2">${esc(c.place.name)}</span><span class="t-sub">${kindDist(c.place.kind, c.distance)}</span></span>${chev()}</button></li>`,
          )
          .join('')}</ul>
      </section>`
    : '';

  const sameWork =
    !pc && others.length
      ? `<section class="stack-8"><h2 class="section-title">${esc(COPY.sameWorkTitle)}</h2>
          <div class="hscroll">${others
            .map((o) => `<button class="chip-move" data-action="open-spot" data-id="${o.id}">${esc(o.name)}</button>`)
            .join('')}</div></section>`
      : '';

  return `<article class="page">
    ${top}
    <div class="page-body">
      <div class="stack-12">
        <div><span class="chip-info">${esc(work.title)}</span></div>
        <h1 class="t-display">${esc(spot.name)}</h1>
        <p class="addr t-sub">${icon.pin()}<span>${esc(spot.address)}</span></p>
      </div>
      ${
        coords
          ? pc ? '' : `<button class="btn btn-fill" data-action="view-on-map" data-id="${spot.id}">${esc(COPY.viewOnMap)}</button>`
          : `<p class="notice">${esc(COPY.noCoords)}</p>
             <button class="btn btn-ghost" data-action="copy" data-text="${esc(spot.address)}">${esc(COPY.copyAddress)}</button>`
      }
      ${coords ? nearby : ''}
      ${coords && hasCourse ? `<button class="btn btn-ghost" data-action="open-course" data-id="${spot.id}">${esc(COPY.courseButton)}</button>` : ''}
      ${sameWork}
      ${source()}
    </div>
  </article>`;
}

// ── S4 ──
export function courseScreen(spot, { work, pc }) {
  return `<article class="page">
    <div class="topbar"><button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button><span class="t-strong">${esc(COPY.courseTopbar)}</span></div>
    <div class="page-body">
      <h1 class="t-title">${esc(spot.name)} 근처 코스</h1>
      <div id="course-status"></div>
      <div id="course-body"></div>
      <button class="btn btn-ghost" data-action="open-work" data-title="${esc(work.title)}">${esc(work.title)}의 다른 촬영지 보기</button>
      ${source()}
    </div>
  </article>`;
}

export function frameMsg(state) {
  const text = state === 'loading' ? COPY.courseLoading : COPY.courseDone;
  return `<div class="frame-msg framed is-${state}" role="status">${corners(12)}<span>${esc(text)}</span></div>`;
}

export function courseBody(course, { showRouteMap }) {
  const items = course.items;
  const summary = course.summary ? `<p class="t-sub c-sub">${esc(course.summary)}</p>` : '';
  const routeMap = showRouteMap ? `<div class="route-map" id="route-map" aria-hidden="true"></div>` : '';
  const cards = items
    .map((it, i) => {
      const p = it.place;
      const note = it.note ? `<span class="t-sub c-sub">${esc(it.note)}</span>` : '';
      const body =
        p.kind === 'spot'
          ? `<span class="grow"><span class="chip-kind">${KIND_LABEL.spot}</span><span class="t-strong clamp2">${esc(p.name)}</span><span class="t-sub c-sub">${esc(p.work)}</span>${note}</span>`
          : `${thumbTile(p)}
             <span class="grow"><span class="chip-kind">${KIND_LABEL[p.kind]}</span><span class="t-strong clamp2">${esc(p.name)}</span><span class="t-sub">직선 ${dist(it.distance)}</span>${note}</span>`;
      const action = p.kind === 'spot' ? `data-action="open-spot" data-id="${p.id}"` : `data-action="open-place" data-id="${p.id}"`;
      return `<li>${numBadge(i + 1)}<button class="card" ${action}><span class="sr-only">${i + 1}번 </span>${body}${chev()}</button></li>`;
    })
    .join('');
  return `<div class="stack-12">${summary}${routeMap}<ol class="timeline">${cards}</ol></div>`;
}

// ── S5 ──
export function placeScreen(place, { spot, distance, canMap = false }) {
  const back = `<button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button>`;
  const top = place.photo
    ? `<div class="photo-wrap"><img class="photo" src="${esc(place.photo)}" alt="" data-fallback="remove-photo">${back}</div>`
    : `<div class="lowbar">${back}</div>`;
  const intro = place.intro
    ? `<section class="stack-8"><h2 class="section-title">${esc(COPY.intro)}</h2><p class="clamp4" data-expand aria-expanded="false">${esc(place.intro)}</p></section>`
    : '';
  // TODO(열린 결정: S5 출처 문구) COPY.placeSource가 비어 있으면 칸을 만들지 않는다.
  const src = COPY.placeSource ? `<p class="source">${esc(COPY.placeSource)}</p>` : '';
  return `<article class="page">
    ${top}
    <div class="page-body">
      <div class="stack-12">
        <p class="meta"><span class="chip-kind">${KIND_LABEL[place.kind]}</span><span class="t-sub">${esc(spot.name)}에서 직선 ${dist(distance)}</span></p>
        <h1 class="t-display">${esc(place.name)}</h1>
        <p class="addr t-sub">${icon.pin()}<span>${esc(place.address)}</span></p>
      </div>
      ${canMap ? `<button class="btn btn-ghost" data-action="view-place-map" data-id="${place.id}" data-spot="${spot.id}">${esc(COPY.viewOnMap)}</button>` : ''}
      ${intro}
      <button class="btn btn-ghost" data-action="open-spot" data-id="${spot.id}">${esc(spot.name)} 보러 가기</button>
      ${src}
    </div>
  </article>`;
}

// ── PC ──
// 장소 지도(모바일): 촬영지 번호 핀과 이 장소 핀을 한 화면에 보여 주는 보기 전용 지도(2026-10-30 사용자 결정, S5의 "지도로 보기").
export function placeMapScreen(place, { spot, distance }) {
  return `
    <div class="map-ctrl"><button class="btn-icon" data-action="back" aria-label="뒤로 가기">${icon.back()}</button></div>
    <section class="map-card" id="map-card">
      <p class="meta"><span class="chip-kind">${KIND_LABEL[place.kind]}</span><span class="t-sub">${esc(spot.name)}에서 직선 ${dist(distance)}</span></p>
      <h1 class="t-title">${esc(place.name)}</h1>
      <p class="addr t-sub">${icon.pin()}<span>${esc(place.address)}</span></p>
    </section>`;
}

export function pcFrame(work, { selectedId }) {
  return `
    <header class="pc-top">
      <button class="brand" data-action="home">${logoMark()}<span class="wordmark" lang="en">${esc(COPY.wordmark)}</span></button>
      <label class="search"><span class="sr-only">작품 검색</span>
        <input id="pc-q" type="search" autocomplete="off" placeholder="${esc(COPY.searchPlaceholder)}" value="${esc(work.title)}">
        <span class="btn-icon" aria-hidden="true">${icon.search()}</span>
      </label>
      ${themeButton()}
    </header>
    <aside class="pc-list" id="pc-list">${workHead(work)}<div class="sheet-body">${spotList(work, selectedId)}</div></aside>
    <section class="pc-detail" id="pc-detail" hidden></section>`;
}

export function errorScreen() {
  return `<div class="boot-error"><div class="notice is-error" role="alert">${icon.warn()}<p>${esc(COPY.loadError)}</p>
    <button class="btn-text" data-action="retry">${esc(COPY.retry)}</button></div></div>`;
}
