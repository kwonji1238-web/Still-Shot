/**
 * 스틸스팟 UT: 구글 시트에 기록을 받아 적는 Apps Script.
 *
 * 하는 일
 *  - 브라우저(ut/log.js)가 보낸 기록(rows)을 시트의 한 줄씩으로 적는다.
 *  - 토큰이 맞지 않는 요청은 받지 않는다.
 *  - 한 번에 받는 크기, 줄 수, 칸 길이를 제한한다.
 *  - 같은 event_id가 이미 있으면 다시 적지 않는다(재전송으로 생기는 중복을 막는다).
 *
 * 토큰은 이 코드에 적지 않는다. Apps Script의 "스크립트 속성"에 UT_TOKEN으로 넣는다(ut/SETUP.md 참고).
 */

// 받는 시트 탭 이름. 없으면 새로 만든다.
const SHEET_NAME = 'responses';

// 시트 열 순서. 새 열은 맨 뒤에만 붙인다(앞의 열이 밀리면 이미 쌓인 기록과 어긋난다).
const COLUMNS = [
  'received_at', 'event_id', 'session_id', 'participant_id', 'is_test', 'mode', 'device',
  'client_ts', 'task', 'event', 'question_id', 'value', 'task_elapsed_ms', 'extra_json',
];

// 제한값
const MAX_BODY_CHARS = 100000; // 요청 하나의 글자 수
const MAX_ROWS_PER_REQUEST = 50; // 요청 하나에 담을 수 있는 기록 줄 수
const MAX_CELL_CHARS = 1000; // 칸 하나의 글자 수(넘으면 잘라서 적는다)
const DEDUPE_LOOKBACK_ROWS = 3000; // 중복을 확인할 때 거슬러 올라가 볼 시트 줄 수

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!body || body.length > MAX_BODY_CHARS) return reply('too_large');

    let payload;
    try { payload = JSON.parse(body); } catch (err) { return reply('bad_json'); }

    const expected = PropertiesService.getScriptProperties().getProperty('UT_TOKEN');
    if (!expected || payload.token !== expected) {
      console.warn('토큰이 맞지 않는 요청을 받지 않았어요.'); // 실행 기록에 남는다. 토큰 값은 적지 않는다.
      return reply('forbidden');
    }

    const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, MAX_ROWS_PER_REQUEST) : [];
    if (!rows.length) return reply('empty');

    lock.waitLock(10000); // 동시에 여러 명이 보내도 줄이 섞이지 않게 차례를 기다린다
    const sheet = getSheet();
    const seen = recentEventIds(sheet);
    const now = new Date();
    const out = [];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const id = cell(r.event_id);
      if (!id || seen.has(id)) continue; // 이미 적은 기록
      seen.add(id);
      out.push(COLUMNS.map((c) => (c === 'received_at' ? now : cell(r[c]))));
    }
    if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, COLUMNS.length).setValues(out);
    return reply('ok');
  } catch (err) {
    console.error(String(err));
    return reply('error');
  } finally {
    try { lock.releaseLock(); } catch (err) { /* 잠금을 못 잡았으면 풀 것도 없다 */ }
  }
}

// 주소를 브라우저로 열어 봤을 때 "살아 있다"만 보여 준다. 시트 내용은 보여 주지 않는다.
function doGet() {
  return reply('ut-receiver ok');
}

function reply(text) {
  return ContentService.createTextOutput(text);
}

// 칸에 넣을 값: 글자로 바꾸고 길이를 제한한다. 앞이 = + - @ 이면 시트가 수식으로 읽지 않게 ' 를 붙인다.
function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  let s = String(v).slice(0, MAX_CELL_CHARS);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function recentEventIds(sheet) {
  const last = sheet.getLastRow();
  const idCol = COLUMNS.indexOf('event_id') + 1;
  const set = new Set();
  if (last < 2) return set;
  const from = Math.max(2, last - DEDUPE_LOOKBACK_ROWS + 1);
  sheet.getRange(from, idCol, last - from + 1, 1).getValues().forEach((row) => set.add(String(row[0])));
  return set;
}
