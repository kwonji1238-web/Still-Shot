// UT 기록: 이벤트를 한 줄씩 만들어 브라우저에 쌓아 두고, 구글 시트(Apps Script)로 보낸다.
// 보내기에 실패하면 지우지 않고 다시 보낸다. 새로고침·인터넷 끊김에도 쌓인 기록이 남는다.
//
// 보내는 방식: fetch + mode 'no-cors' + 본문은 text/plain.
// Apps Script 웹 앱은 브라우저의 사전 확인(CORS preflight)에 답하지 못한다. 본문을 text/plain으로 보내면
// 사전 확인이 생기지 않아 요청이 나간다. 대신 응답 내용은 브라우저가 숨겨서 "받았는지"는 알 수 없다.
// 그래서 "네트워크 오류가 없으면 보냈다"로 보고, 받는 쪽(Code.gs)이 event_id로 중복을 걸러 낸다.

const QUEUE_KEY = 'ut-queue';
const QUEUE_KEY_DRY = 'ut-queue-dry'; // 미리보기(dry) 모드의 기록은 따로 둔다. 나중에 시트로 섞여 나가지 않게
const SEQ_KEY = 'ut-seq';
const QUEUE_MAX = 1000;
const BATCH = 25;
const RETRY_MS = [3000, 10000, 30000, 60000];

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장이 막힌 브라우저면 메모리에만 둔다 */ }
};

export function createLogger({ endpoint, token, base, dry = false, onLog = null }) {
  const key = dry ? QUEUE_KEY_DRY : QUEUE_KEY;
  let queue = read(key, []);
  let seq = read(SEQ_KEY, 0);
  let flushing = false;
  let fails = 0;
  let timer = 0;

  function log(event, { task = '', question_id = '', value = '', task_elapsed_ms = '', extra = null } = {}) {
    seq += 1;
    write(SEQ_KEY, seq);
    let extra_json = extra ? JSON.stringify(extra) : '';
    if (extra_json.length > 1000) extra_json = '{"truncated":true}'; // 한 줄 크기 제한
    const row = {
      event_id: `${base.session_id}-${seq}`,
      session_id: base.session_id,
      participant_id: base.participant_id,
      is_test: base.is_test,
      mode: base.mode,
      device: base.device,
      client_ts: new Date().toISOString(),
      task,
      event,
      question_id,
      value: String(value).slice(0, 200),
      task_elapsed_ms: task_elapsed_ms === '' ? '' : Math.round(task_elapsed_ms),
      extra_json,
    };
    queue.push(row);
    if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
    write(key, queue);
    if (onLog) onLog(row);
    flush();
    return row;
  }

  async function flush() {
    if (dry || flushing || !endpoint || !queue.length) return; // dry면 아무것도 보내지 않는다
    if (navigator.onLine === false) return; // 인터넷이 돌아오면 online 이벤트가 다시 부른다
    flushing = true;
    const batch = queue.slice(0, BATCH);
    let ok = false;
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token, rows: batch }),
        keepalive: true,
      });
      const sent = new Set(batch.map((r) => r.event_id));
      queue = queue.filter((r) => !sent.has(r.event_id));
      write(key, queue);
      fails = 0;
      if (onLog) onLog(null); // 대기 건수만 새로 그리게 알린다
      ok = true;
    } catch {
      fails += 1;
      clearTimeout(timer);
      timer = setTimeout(flush, RETRY_MS[Math.min(fails - 1, RETRY_MS.length - 1)]);
    }
    flushing = false;
    if (ok && queue.length) flush();
  }

  addEventListener('online', () => { fails = 0; flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  flush(); // 지난번에 못 보낸 기록이 있으면 시작할 때 보낸다

  return { log, flush, pending: () => queue.slice(), configured: !!endpoint && !dry, dry };
}
