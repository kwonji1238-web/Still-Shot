// UT(사용성 테스트) 모드. 주소에 ?ut=1이 있을 때만 index.html이 이 파일을 불러온다.
// 서비스 코드(src/)는 건드리지 않고, 문서 전체의 클릭·주소 변화를 바깥에서 지켜보며 기록한다.
// 질문·문구·제한 시간은 ut/questions.json에서 읽는다.
//
// 진행 단계(st.step): consent → pre → t1_ready → t1_run → (t1_fail_wait) → s1 → t2_run → s2 → t3 → post → end
// 새로고침해도 st(브라우저 localStorage)에서 이어진다.

import { createLogger } from './log.js';

const STATE_KEY = 'ut-state';
const PANEL_AUTO_CLOSE_MS = 8000;
const mq = matchMedia('(min-width: 768px)'); // src/app.js와 같은 PC 기준

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// 이벤트의 task 열: 지금 단계가 어느 과업에 속하는지
const TASK_OF_STEP = { t1_ready: 'task1', t1_run: 'task1', t1_fail_wait: 'task1', s1: 'task1', t2_run: 'task2', s2: 'task2', t3: 'task3' };
const RESULT_TEXT = { success: '성공', giveup: '포기', timeout: '시간초과', decided: '정했어요' };

async function main() {
  let Q, cfg;
  try {
    [Q, cfg] = await Promise.all([
      fetch(new URL('questions.json', import.meta.url)).then((r) => r.json()),
      import('./config.js').then((m) => m.default).catch(() => ({})), // 없으면 기록을 보내지 않고 브라우저에만 쌓는다
    ]);
  } catch (err) {
    console.error('[UT] questions.json을 읽지 못했어요', err);
    return;
  }
  const ui = Q.ui;

  // ── 참가자·세션 ──
  const params = new URLSearchParams(location.search);
  const cleanId = (s) => (s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  const pidParam = cleanId(params.get('p'));
  const mode = params.get('m') === 'inperson' ? 'inperson' : 'remote';
  const rid = () => Math.random().toString(36).slice(2, 10);
  // 확인 모드: dry=1은 시트로 보내지 않고 기록 미리보기만, debug=1은 보내면서 미리보기도. 둘 다 없으면 미리보기 패널은 만들지 않는다.
  const dry = params.get('dry') === '1';
  const showLog = dry || params.get('debug') === '1';

  const fresh = () => ({
    session: rid() + rid(), participant: pidParam || `R${Math.floor(1000 + Math.random() * 9000)}`, mode,
    step: 'consent', answers: {}, results: {},
    s1Done: false, s1Pending: false, t1Failed: false, spotId: '',
    courseOpened: false, courseDuringT2: false, nearbyTaps: 0, t3Shown: false, spotTapLogged: false,
    started: false, ended: false, clockMs: 0, postIdx: 0,
  });
  let st;
  try { st = JSON.parse(localStorage.getItem(STATE_KEY)); } catch { st = null; }
  if (!st || (pidParam && st.participant !== pidParam)) st = fresh();
  st.mode = mode;
  const save = () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch { /* 저장이 막혀도 진행은 된다 */ } };

  const w = innerWidth;
  const device = `${w}x${innerHeight} ${w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'}`;
  const testNumber = /^TEST/i.test(st.participant); // 번호가 TEST로 시작하면 연습용
  const isTest = testNumber || showLog; // dry·debug로 연 세션도 번호와 상관없이 연습용으로 표시한다. 거르는 것은 나중에 시트에서
  // 시험용 단축: 연습용(TEST) 번호에서만 &fast=1이 먹는다. 다른 번호에서는 무시한다.
  const fast = params.get('fast') === '1' && testNumber; // fast는 번호 규칙(TEST)만 따른다
  if (fast) { Q.tasks.T1.limit_s = Q.fast.T1_limit_s; Q.tasks.T2.limit_s = Q.fast.T2_limit_s; }

  const recent = []; // 기록 미리보기 패널용: 최근 이벤트(새것이 앞)
  let renderLog = () => {};
  const logger = createLogger({
    endpoint: cfg.endpoint, token: cfg.token, dry,
    base: { session_id: st.session, participant_id: st.participant, is_test: isTest, mode: st.mode, device },
    onLog: (row) => { if (row) { recent.unshift(row); recent.length = Math.min(recent.length, 40); } renderLog(); },
  });
  if (dry) logger.pending().reverse().slice(0, 40).forEach((r) => recent.push(r));
  if (!logger.configured && !dry) console.warn('[UT] 시트 주소가 없어 기록을 브라우저에만 쌓아요(UT_ENDPOINT).');

  // ── 과업 시계: 질문 창이 떠 있거나 화면이 가려진 시간은 뺀다 ──
  const clock = { active: false, limit: 0, ms: 0, t0: null, reasons: new Set() };
  clock.elapsed = () => clock.ms + (clock.t0 === null ? 0 : performance.now() - clock.t0);

  function ev(event, o = {}) {
    return logger.log(event, { task: TASK_OF_STEP[st.step] || '', task_elapsed_ms: clock.active ? clock.elapsed() : '', ...o });
  }
  function pauseClock(reason) {
    if (!clock.active || clock.reasons.has(reason)) return;
    if (!clock.reasons.size) { clock.ms = clock.elapsed(); clock.t0 = null; st.clockMs = clock.ms; save(); }
    clock.reasons.add(reason);
    ev('pause', { extra: { reason } });
  }
  function resumeClock(reason) {
    if (!clock.active || !clock.reasons.has(reason)) return;
    clock.reasons.delete(reason);
    if (!clock.reasons.size) clock.t0 = performance.now();
    ev('resume', { extra: { reason } });
  }
  function startTask(name, limitS) {
    clock.limit = limitS; clock.ms = 0; st.clockMs = 0;
    clock.reasons.clear();
    clock.t0 = document.hidden ? null : performance.now();
    if (document.hidden) clock.reasons.add('hidden');
    ev('task_start', { task: name, task_elapsed_ms: 0, value: String(limitS) });
    clock.active = true;
    save();
  }
  function finishTask(name, value, success, extra = {}) {
    const ms = clock.elapsed();
    ev('task_end', { task: name, value, task_elapsed_ms: ms, extra: { success, ...extra } });
    clock.active = false; clock.t0 = null; clock.reasons.clear();
    st.results[name] = { value, success, ms: Math.round(ms) };
    st.clockMs = 0; save();
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? pauseClock('hidden') : resumeClock('hidden')));

  // ── 화면 뼈대 ──
  document.documentElement.classList.add('ut-on');
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('ut.css', import.meta.url).href;
  document.head.appendChild(css);
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ut-root">
      <div class="ut-bar" id="ut-bar" role="region" aria-label="테스트 진행">
        <span class="ut-tag">UT</span><span class="ut-status" id="ut-status"></span>
        ${showLog ? `<button class="ut-toggle" id="ut-logbtn" data-ut="logtoggle" aria-expanded="false">${esc(ui.log_button)}</button>` : ''}
        <button class="ut-toggle" id="ut-toggle" data-ut="toggle" aria-expanded="false" hidden></button>
      </div>
      <div class="ut-panel" id="ut-panel" hidden></div>
      ${showLog ? '<div class="ut-panel ut-logpanel" id="ut-logpanel" hidden></div>' : ''}
      <div class="ut-overlay" id="ut-overlay" hidden role="dialog" aria-modal="true"></div>
    </div>`);
  const root = $('#ut-root'), statusEl = $('#ut-status'), toggle = $('#ut-toggle'), panel = $('#ut-panel'), overlay = $('#ut-overlay');

  // 위쪽 바: 한 줄(남은 시간)은 늘 보이고, 과업 문장·버튼이 든 패널은 접고 펼 수 있다.
  let panelOpen = false, autoTimer = 0;
  function panelHtml() {
    const btn = (act, label, fill) => `<button class="ut-btn${fill ? ' is-fill' : ''}" data-ut="${act}">${esc(label)}</button>`;
    switch (st.step) {
      case 't1_run': return `<p>${esc(Q.tasks.T1.text)}</p><div class="ut-row">${btn('t1-giveup', ui.t1_giveup)}</div>`;
      case 't1_fail_wait': return `<p>${esc(ui.t1_fail_hint)}</p>`;
      case 't2_run': return `<p>${esc(Q.tasks.T2.text)}</p><div class="ut-row">${btn('t2-done', ui.t2_done)}${btn('t2-giveup', ui.t2_giveup)}</div>`;
      // 코스를 이미 열었다면 [다 봤어요]만, 아직이면 안내 문장을 보여 주고 코스가 열린 뒤에 버튼이 나온다
      case 't3': return `${st.courseAtT3 ? '' : `<p>${esc(Q.tasks.T3.text)}</p>`}${st.courseOpened ? `<div class="ut-row">${btn('t3-done', ui.t3_done, true)}</div>` : ''}`;
      default: return '';
    }
  }
  function statusHtml() {
    const label = { t1_run: ui.bar_label_t1, t2_run: ui.bar_label_t2 }[st.step];
    if (clock.active && label) {
      const rem = Math.max(0, clock.limit * 1000 - clock.elapsed());
      return `${esc(label)} · ${esc(ui.bar_remaining)} <span class="ut-num">${fmt(rem)}</span>${clock.reasons.size ? ` (${esc(ui.bar_paused)})` : ''}`;
    }
    return esc({ t1_ready: ui.bar_label_t1, t1_fail_wait: ui.bar_label_t1, t3: ui.bar_label_t3 }[st.step] || ui.bar_idle);
  }
  function renderBar() {
    statusEl.innerHTML = statusHtml();
    const html = panelHtml();
    panel.innerHTML = html;
    panel.hidden = !(html && panelOpen);
    toggle.hidden = !html;
    toggle.textContent = panelOpen ? ui.bar_close : ui.bar_open;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  }
  // 기록 미리보기 패널(확인 모드에서만 있다). 바 아래로 열리고, 과업 패널과 동시에 열리지 않는다. 기본은 접힘.
  const logPanel = $('#ut-logpanel'), logBtn = $('#ut-logbtn');
  let logOpen = false;
  if (logPanel) {
    renderLog = () => {
      const n = logger.pending().length;
      const title = dry ? ui.log_title_dry : ui.log_title_debug;
      const pend = dry ? `${ui.log_pending_dry} ${n}${ui.log_unit}` : `${ui.log_pending} ${n}${ui.log_unit}`;
      logBtn.innerHTML = `${esc(ui.log_button)} <span class="ut-num">${n}</span>`;
      if (!logOpen) return; // 접혀 있으면 목록은 다시 그리지 않는다
      const line = (r) => {
        const name = r.question_id ? `${r.event} ${r.question_id}` : r.event;
        const sec = r.task_elapsed_ms === '' ? '' : ` · ${(r.task_elapsed_ms / 1000).toFixed(1)}초`;
        const extra = r.extra_json ? `<span class="ut-log-extra">${esc(r.extra_json)}</span>` : '';
        return `<li><span class="ut-log-name">${esc(name)}</span>${r.value !== '' ? ` · ${esc(r.value)}` : ''}${sec}${extra}</li>`;
      };
      logPanel.innerHTML = `<p class="ut-qtext">${esc(title)}</p>
        <p class="ut-log-meta">${esc(pend)}</p>
        <div class="ut-row"><button class="ut-btn" data-ut="copy">${esc(ui.copy_result)}</button></div>
        ${recent.length ? `<ol class="ut-log">${recent.map(line).join('')}</ol>` : `<p class="ut-log-meta">${esc(ui.log_empty)}</p>`}`;
    };
    renderLog();
  }
  function setLogOpen(open) {
    if (!logPanel) return;
    logOpen = open;
    logPanel.hidden = !open;
    logBtn.setAttribute('aria-expanded', String(open));
    if (open) { panelOpen = false; clearTimeout(autoTimer); renderBar(); }
    renderLog();
  }

  function openPanel(auto) {
    if (logOpen) setLogOpen(false);
    panelOpen = true;
    clearTimeout(autoTimer);
    if (auto) autoTimer = setTimeout(() => { panelOpen = false; renderBar(); }, PANEL_AUTO_CLOSE_MS);
    renderBar();
  }
  function closePanel() { panelOpen = false; clearTimeout(autoTimer); renderBar(); }

  let ticks = 0;
  setInterval(() => {
    if (!clock.active) return;
    const e = clock.elapsed();
    statusEl.innerHTML = statusHtml();
    if (!clock.reasons.size && ++ticks % 4 === 0) { st.clockMs = e; save(); }
    if (!clock.reasons.size && e >= clock.limit * 1000) {
      if (st.step === 't1_run') endTask1('timeout');
      else if (st.step === 't2_run') endTask2('timeout');
    }
  }, 250);

  // ── 질문 창 ──
  function openOverlay(kind) {
    overlay.className = `ut-overlay is-${kind}`;
    overlay.hidden = false;
    overlay.innerHTML = '<div class="ut-card"></div>';
    pauseClock('modal'); // 질문 창이 떠 있는 동안 과업 시간은 멈춘다
    return overlay.firstChild;
  }
  function closeOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
    resumeClock('modal');
  }

  const shown = (q) => {
    const c = q.show_if;
    if (!c) return true;
    const a = st.answers[c.id];
    if (c.in) return c.in.includes(a);
    if (c.not_equal_to_id) return a !== undefined && a !== st.answers[c.not_equal_to_id];
    return true;
  };
  const pick = (sec) => new Promise((res) => {
    sec.addEventListener('click', function h(e) {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      sec.removeEventListener('click', h);
      res(b.dataset.v);
    });
  });
  const record = (id, value, extra = {}, skipped = false) => {
    st.answers[id] = value; save();
    ev('q_answer', { question_id: id, value, extra: { ...extra, ...(skipped ? { skipped: true } : {}) } });
  };
  const optBtns = (list) => `<div class="ut-opts">${list.map((o) => `<button class="ut-opt" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  const scaleBtns = (q) => `<div class="ut-scale">${[1, 2, 3, 4, 5].map((n) => `<button class="ut-opt" data-v="${n}" aria-label="${n}점">${n}</button>`).join('')}</div>
    <div class="ut-scale-ends"><span>1 ${esc(q.min_label)}</span><span>5 ${esc(q.max_label)}</span></div>`;
  const doneView = (sec, q, answerText) => {
    sec.classList.add('is-done');
    sec.innerHTML = `<p class="ut-qtext">${esc(q.text)}</p><p class="ut-answer">${esc(answerText)}</p>`;
  };

  // 질문 하나. 선택형은 한 번 탭하면 끝난다.
  async function askOne(sec, id, q, extra) {
    const head = `<p class="ut-qtext">${esc(q.text)}</p>`;
    if (q.type === 'single') {
      sec.innerHTML = head + optBtns(q.options);
      const v = await pick(sec);
      record(id, v, extra);
      return doneView(sec, q, v);
    }
    if (q.type === 'scale' || q.type === 'scale_reason') {
      let score = st.answers[id];
      if (score === undefined) {
        sec.innerHTML = head + scaleBtns(q);
        score = await pick(sec);
        record(id, score, extra);
      }
      if (q.type === 'scale') return doneView(sec, q, score);
      sec.innerHTML = `${head}<p class="ut-answer">${esc(score)}</p><p class="ut-qtext">${esc(q.reason_text)}</p>${optBtns(q.reasons)}`;
      const why = await pick(sec);
      record(`${id}_reason`, why, extra);
      return doneView(sec, q, `${score} · ${why}`);
    }
    // text: 선택 질문. 건너뛸 수 있고 글자 수를 제한한다.
    sec.innerHTML = `${head}<textarea class="ut-text" maxlength="${q.max_len}" rows="3" aria-label="${esc(q.text)}"></textarea>
      <p class="ut-count"><span data-count>0</span>/${q.max_len}${esc(ui.text_counter)}</p>
      <div class="ut-row"><button class="ut-btn" data-act="skip">${esc(ui.skip)}</button><button class="ut-btn is-fill" data-act="next">${esc(ui.next)}</button></div>`;
    const ta = sec.querySelector('textarea');
    ta.addEventListener('input', () => { sec.querySelector('[data-count]').textContent = ta.value.length; });
    const act = await new Promise((res) => sec.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) res(b.dataset.act); }, { once: false }));
    const text = act === 'next' ? ta.value.trim().slice(0, q.max_len) : '';
    record(id, text, extra, !text);
    return doneView(sec, q, text || '(건너뜀)');
  }

  // 한 화면에 질문 여러 개를 차례로 보여 준다(조건에 안 맞는 질문은 건너뛴다).
  async function runQuestions(ids, kind, extra = {}) {
    const card = openOverlay(kind);
    for (const id of ids) {
      const q = Q.questions[id];
      if (!shown(q)) continue;
      const sec = document.createElement('section');
      sec.className = 'ut-q';
      card.appendChild(sec);
      sec.scrollIntoView({ block: 'nearest' });
      if (id in st.answers && (q.type !== 'scale_reason' || `${id}_reason` in st.answers)) {
        doneView(sec, q, q.type === 'scale_reason' ? `${st.answers[id]} · ${st.answers[`${id}_reason`]}` : st.answers[id] || '(건너뜀)');
        continue;
      }
      await askOne(sec, id, q, extra);
      await sleep(150);
    }
    closeOverlay();
  }

  // ── 단계 이동 ──
  function go(step) { st.step = step; save(); renderStep(); }

  function renderStep() {
    renderBar();
    switch (st.step) {
      case 'consent': return showConsent();
      case 'pre': return runQuestions(Q.screens.pre, 'full').then(() => go('t1_ready'));
      case 't1_ready': return showTaskIntro();
      case 't1_run':
        if (st.s1Pending) askS1({ s1_after_detail: false }); // 질문 창이 떠 있을 때 새로고침한 경우
        return;
      case 't1_fail_wait': return openPanel(true);
      case 's1': return askS1({ s1_after_detail: true, task1_failed: st.t1Failed }).then(beginTask2);
      case 't2_run': return openPanel(true);
      case 's2': return runQuestions(Q.screens.s2, 'sheet').then(() => go('t3'));
      case 't3': if (!st.t3Shown) st.courseAtT3 = st.courseOpened; st.t3Shown = true; save(); return openPanel(true);
      case 'post': return runPost();
      case 'end': return showEnd();
    }
  }

  function showConsent() {
    const card = openOverlay('full');
    card.innerHTML = `${mq.matches ? `<p class="ut-notice">${esc(ui.pc_notice)}</p>` : ''}
      <p class="ut-intro">${esc(Q.ui.intro)}</p>
      <div class="ut-row"><button class="ut-btn is-fill" data-ut="consent">${esc(ui.consent)}</button></div>`;
  }
  function showTaskIntro() {
    const card = openOverlay('sheet');
    card.innerHTML = `<p class="ut-qtext">${esc(Q.tasks.T1.text)}</p>
      <div class="ut-row"><button class="ut-btn is-fill" data-ut="t1-start">${esc(ui.start)}</button></div>`;
  }

  function askS1(extra) {
    st.s1Pending = true; save();
    return runQuestions(Q.screens.s1, 'sheet', extra).then(() => { st.s1Done = true; st.s1Pending = false; save(); });
  }

  function endTask1(value) {
    finishTask('task1', value, false);
    st.t1Failed = true;
    go('t1_fail_wait');
  }
  function beginTask2() {
    st.nearbyTaps = 0; st.courseDuringT2 = false;
    st.step = 't2_run'; save();
    startTask('task2', Q.tasks.T2.limit_s);
    renderStep();
  }
  function endTask2(value) {
    const success = value === 'decided' && (st.nearbyTaps >= 1 || st.courseDuringT2);
    finishTask('task2', value, success, { nearby_taps: st.nearbyTaps, course_opened_before_s2: st.courseDuringT2, spot_id: st.spotId });
    go('s2');
  }

  async function runPost() {
    for (; st.postIdx < Q.screens.post.length; st.postIdx++) {
      save();
      await runQuestions(Q.screens.post[st.postIdx], 'sheet');
    }
    go('end');
  }

  function summaryText() {
    const lines = ['스틸스팟 UT 결과', `참가자: ${st.participant} · 방식: ${st.mode}${isTest ? ' · 연습용' : ''}`, `기기: ${device}`];
    for (const [k, label] of [['task1', '과업 1'], ['task2', '과업 2']]) {
      const r = st.results[k];
      if (r) lines.push(`${label}: ${RESULT_TEXT[r.value] || r.value}${r.success ? '(성공)' : '(실패)'} ${(r.ms / 1000).toFixed(1)}초`);
    }
    lines.push(`코스 화면: ${st.courseOpened ? '열어 봄' : '안 열어 봄'}`);
    for (const [id, v] of Object.entries(st.answers)) lines.push(`${id}: ${v === '' ? '(건너뜀)' : v}`);
    const pending = logger.pending();
    if (pending.length) lines.push('', `[시트에 못 보낸 기록 ${pending.length}건]`, ...pending.map((r) => JSON.stringify(r)));
    return lines.join('\n');
  }
  function showEnd() {
    if (!st.ended) {
      st.ended = true; save();
      ev('ut_end', { extra: { task1: st.results.task1 || null, task2: st.results.task2 || null, course_opened: st.courseOpened } });
    }
    const card = openOverlay('full');
    // 참가자 화면은 "고마워요!"만 보인다. [결과 복사]는 확인 모드(dry·debug)에서만 있다.
    card.innerHTML = `<div class="ut-end"><h1>${esc(ui.end_title)}</h1>
      ${showLog ? `<button class="ut-btn" data-ut="copy">${esc(ui.copy_result)}</button>` : ''}</div>`;
  }
  async function copy(btn) {
    const text = summaryText();
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    btn.textContent = ui.copied;
    setTimeout(() => (btn.textContent = ui.copy_result), 1800);
  }

  // ── UT 바·질문 창의 버튼 ──
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ut]');
    if (!b) return;
    switch (b.dataset.ut) {
      case 'toggle': return panelOpen ? closePanel() : openPanel(false);
      case 'logtoggle': return setLogOpen(!logOpen);
      case 'consent': ev('consent'); closeOverlay(); return go('pre');
      case 't1-start': closeOverlay(); st.step = 't1_run'; save(); startTask('task1', Q.tasks.T1.limit_s); panelOpen = false; return renderStep();
      case 't1-giveup': return endTask1('giveup');
      case 't2-done': return endTask2('decided');
      case 't2-giveup': return endTask2('giveup');
      case 't3-done': closePanel(); return go('post');
      case 'copy': return copy(b);
    }
  });

  // ── 서비스 화면 지켜보기 ──
  function parseRoute() {
    const [path] = (location.hash.replace(/^#/, '') || '/').split('?');
    const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    const name = { w: 'work', s: 'spot', c: 'course', p: 'place', m: 'placemap' }[parts[0]];
    if (!name || !parts[1]) return { name: 'home', extra: null };
    if (name === 'work') return { name, extra: { work: parts[1] } };
    return { name, id: parts[1], extra: { spot_id: parts[1], ...(parts[2] ? { place_id: parts[2] } : {}) } };
  }
  const onT1 = () => st.step === 't1_run' || st.step === 't1_fail_wait';

  let lastHash = null;
  function onRoute() {
    const key = location.hash || '#/';
    if (key === lastHash) return;
    lastHash = key;
    const r = parseRoute();
    ev('screen_view', { value: r.name, extra: r.extra });
    if (r.name === 'course') {
      st.courseOpened = true;
      const during2 = st.step === 't2_run';
      if (during2) st.courseDuringT2 = true;
      save();
      ev('course_view', { extra: { spot_id: r.id, during_task2: during2 } });
      if (st.step === 't3') openPanel(true); // [다 봤어요]가 나타난다
    }
    if (r.name === 'spot' && onT1()) {
      // 촬영지 상세에 닿았다 = 과업 1 성공
      const failed = st.step === 't1_fail_wait';
      if (!failed) finishTask('task1', 'success', true, { spot_id: r.id });
      st.spotId = r.id;
      if (st.s1Done) beginTask2();
      else go('s1'); // PC에서는 상세에 닿은 직후에 S1을 묻는다(s1_after_detail=true)
    }
  }
  // 서비스는 history.pushState로 화면을 바꾸는데, 이때는 주소 변화 알림이 오지 않는다. 그래서 두 함수를 감싼다.
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function (...a) {
      const r = orig.apply(this, a);
      queueMicrotask(onRoute); // 서비스가 화면을 다 그린 뒤에 읽는다
      return r;
    };
  }
  addEventListener('popstate', onRoute);
  addEventListener('hashchange', onRoute);

  const tapOnce = (kind) => {
    if (st.spotTapLogged || !onT1()) return;
    st.spotTapLogged = true; save();
    ev('spot_tap', { extra: { kind } }); // 촬영지 상세로 들어가려는 첫 탭
  };
  let bypass = false;
  document.addEventListener('click', (e) => {
    if (bypass || !e.target.closest || e.target.closest('#ut-root')) return;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;
    if (act === 'select-spot') {
      // 모바일: 줄만 눌러 지도가 확대됨(상세 아님). PC: 바로 상세로 간다.
      ev('spot_select', { extra: { spot_id: el.dataset.id, layout: mq.matches ? 'pc' : 'mobile' } });
      if (mq.matches) tapOnce('row_pc');
    } else if (act === 'open-spot') {
      tapOnce(mq.matches ? 'pc' : 'arrow');
      // 모바일에서 상세로 들어가려는 첫 탭은 멈추고 S1을 물은 뒤 같은 탭을 다시 보낸다.
      if (!mq.matches && onT1() && !st.s1Done && !st.s1Pending) {
        e.preventDefault();
        e.stopImmediatePropagation();
        askS1({ s1_after_detail: false, task1_failed: st.t1Failed }).then(() => {
          bypass = true;
          try { el.click(); } finally { bypass = false; }
        });
      }
    } else if (act === 'open-place' && parseRoute().name === 'spot') {
      if (st.step === 't2_run') st.nearbyTaps += 1;
      save();
      ev('nearby_card_tap', { extra: { place_id: el.dataset.id, spot_id: parseRoute().id } });
    } else if (act === 'open-course') {
      ev('course_button_tap', { extra: { course_found_unprompted: !st.t3Shown, spot_id: el.dataset.id } });
    }
  }, true);

  // 검색: 제출은 바로, 결과 없음은 화면에 안내가 뜬 것을 보고 기록한다(같은 검색어는 한 번만).
  document.addEventListener('submit', (e) => {
    if (e.target.closest?.('#ut-root')) return;
    ev('search_submit', { value: ($('#q')?.value || '').trim().slice(0, 60) });
  }, true);
  let noResultTimer = 0, lastNoResult = '';
  new MutationObserver(() => {
    clearTimeout(noResultTimer);
    noResultTimer = setTimeout(() => {
      const q = ($('#q')?.value || '').trim();
      if (q && $('#results .empty-msg') && q !== lastNoResult) { lastNoResult = q; ev('search_no_result', { value: q.slice(0, 60) }); }
    }, 800);
  }).observe($('#screen'), { childList: true, subtree: true });

  // ── 시작 ──
  if (!st.started) { st.started = true; save(); ev('ut_start', { extra: { participant_given: !!pidParam, ...(dry ? { dry: true } : {}), ...(showLog && !dry ? { debug: true } : {}), ...(fast ? { fast: true } : {}) } }); }
  if (st.step === 't1_run' || st.step === 't2_run') {
    // 새로고침으로 돌아온 경우: 저장해 둔 경과 시간에서 이어 간다
    clock.active = true;
    clock.limit = st.step === 't1_run' ? Q.tasks.T1.limit_s : Q.tasks.T2.limit_s;
    clock.ms = st.clockMs || 0;
    clock.t0 = document.hidden ? null : performance.now();
    if (document.hidden) clock.reasons.add('hidden');
    ev('resume', { extra: { reason: 'reload' } });
  }
  renderStep();
  onRoute();
}

main();
