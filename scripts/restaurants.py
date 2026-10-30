"""부산맛집정보 API -> data/restaurants.json (일회성 데이터 준비 스크립트)

실행: python scripts/restaurants.py
인증키는 .env 의 DATA_GO_KR_KEY 를 읽는다. 키 값은 어디에도 출력/저장하지 않는다.
"""
import json, os, random, re, sys, time, urllib.parse, urllib.request, collections

# ============================================================
# ★ 분류 규칙 (단어만 바꾸면 됨) ★
# 규칙 1: 상호명(MAIN_TITLE)에 이 단어가 있으면 category = "cafe"
CAFE_TITLE_WORDS = ["카페", "커피"]
# 규칙 2: (규칙 1이 아닐 때) 대표메뉴(RPRSNTV_MENU)에 이 단어가 있으면 "cafe_candidate"(검토 필요)
CAFE_MENU_WORDS = ["커피", "아메리카노", "라떼", "에스프레소", "에이드", "스무디", "케이크", "빙수", "디저트"]
# 규칙 3: 그 외는 "restaurant" (소개글에만 카페/커피가 있어도 restaurant)
# 분류에는 쓰지 않고 건수만 세는 단어
ENGLISH_CAFE_PATTERN = r"cafe|coffee|까페"
# 휴업 표시 단어 (USAGE_DAY_WEEK_AND_TIME)
CLOSED_WORDS = ["휴업", "폐업", "폐점"]
# 좌표 점검 범위 (대략값)
LAT_RANGE = (34.8, 35.5)
LNG_RANGE = (128.7, 129.4)
# 저장할 항목 (소개글 ITEMCNTNTS 는 분류에만 쓰고 저장하지 않는다)
KEEP_FIELDS = ["UC_SEQ", "MAIN_TITLE", "GUGUN_NM", "ADDR1", "LAT", "LNG", "RPRSNTV_MENU",
               "USAGE_DAY_WEEK_AND_TIME", "CNTCT_TEL", "MAIN_IMG_THUMB"]
SAMPLE_SEED = 20261029
# ============================================================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
URL = "https://apis.data.go.kr/6260000/FoodService/getFoodKr"


def load_env():
    d = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8-sig"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            d[k] = v.strip().strip("\"'")
    return d


KEY = load_env()["DATA_GO_KR_KEY"]


def mask(s):
    for x in (KEY, urllib.parse.quote(KEY, safe="")):
        if x:
            s = s.replace(x, "***")
    return s


def call(page, rows):
    q = f"{URL}?serviceKey={urllib.parse.quote(KEY, safe='')}&pageNo={page}&numOfRows={rows}&resultType=json"
    last = None
    for t in range(4):
        try:
            time.sleep(0.3)
            with urllib.request.urlopen(q, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            res = j["getFoodKr"]
            if res["header"]["code"] != "00":
                raise RuntimeError(res["header"])
            return res
        except Exception as e:
            last = mask(str(e))
            time.sleep(2 * (t + 1))
    raise RuntimeError("호출 실패: " + str(last))


def fetch_all():
    try:
        res = call(1, 500)
        total = int(res["totalCount"])
        items = res["item"]
        if len(items) >= total:
            print(f"[받기] 500건 방식 성공: {len(items)}/{total}건", flush=True)
            return total, items, "500건씩 1번에 받음"
        print("[받기] 500건 요청에 일부만 와서 100건씩 나눠 받습니다", flush=True)
    except Exception as e:
        print("[받기] 500건 요청 실패 -> 100건씩 나눠 받습니다:", mask(str(e)), flush=True)
    res = call(1, 100)
    total = int(res["totalCount"])
    items = list(res["item"])
    page = 2
    while len(items) < total:
        got = call(page, 100)["item"]
        if not got:
            break
        items += got
        page += 1
    return total, items, "100건씩 나눠 받음"


def clean(v):
    return v.strip() if isinstance(v, str) else v


def classify(title, menu):
    if any(w in title for w in CAFE_TITLE_WORDS):
        return "cafe", "title", False
    if any(w in menu for w in CAFE_MENU_WORDS):
        return "cafe_candidate", "menu", True
    return "restaurant", "default", False


def bad_coord(lat, lng):
    try:
        la, lo = float(lat), float(lng)
    except (TypeError, ValueError):
        return "좌표가 비어 있거나 숫자가 아님"
    if not (LAT_RANGE[0] <= la <= LAT_RANGE[1] and LNG_RANGE[0] <= lo <= LNG_RANGE[1]):
        return "부산 범위를 벗어남"
    return None


def main():
    total, raw, how = fetch_all()
    print(f"[1/4] 전체 받기 완료: {len(raw)}건 (totalCount {total}, {how})", flush=True)

    kept, issues, intros = [], [], {}
    for r in raw:
        row = {k: clean(r.get(k)) for k in KEEP_FIELDS}
        intro = clean(r.get("ITEMCNTNTS")) or ""
        reason = bad_coord(r.get("LAT"), r.get("LNG"))
        if reason:
            issues.append({"UC_SEQ": row["UC_SEQ"], "MAIN_TITLE": row["MAIN_TITLE"], "ADDR1": row["ADDR1"],
                           "LAT": r.get("LAT"), "LNG": r.get("LNG"), "reason": reason})
            continue
        row["LAT"], row["LNG"] = float(r["LAT"]), float(r["LNG"])
        cat, why, review = classify(row["MAIN_TITLE"] or "", row["RPRSNTV_MENU"] or "")
        row["category"], row["category_reason"], row["needs_review"] = cat, why, review
        row["closed_notice"] = any(w in (row["USAGE_DAY_WEEK_AND_TIME"] or "") for w in CLOSED_WORDS)
        kept.append(row)
        intros[row["UC_SEQ"]] = intro
    print(f"[2/4] 분류·좌표 점검 완료: 사용 {len(kept)}건, 좌표 문제로 제외 {len(issues)}건", flush=True)

    os.makedirs(DATA, exist_ok=True)
    json.dump(kept, open(os.path.join(DATA, "restaurants.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(issues, open(os.path.join(DATA, "restaurants-issues.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ---- 통계 (분류 규칙에 넣지 않고 건수만 센다) ----
    cnt = collections.Counter(r["category"] for r in kept)
    english = [r for r in kept if re.search(ENGLISH_CAFE_PATTERN, r["MAIN_TITLE"] or "", re.I) and r["category"] != "cafe"]
    dk = collections.Counter(((r["MAIN_TITLE"] or ""), (r["ADDR1"] or "")) for r in kept)
    dups = {k: v for k, v in dk.items() if v > 1}
    closed = [r["MAIN_TITLE"] for r in kept if r["closed_notice"]]
    intro_cafe = [r for r in kept if r["category"] == "restaurant"
                  and any(w in intros[r["UC_SEQ"]] for w in ("카페", "커피"))]
    stats = {
        "받은 건수": len(raw), "totalCount": total, "받은 방식": how,
        "사용": len(kept), "좌표 문제": len(issues),
        "category": dict(cnt),
        "category_reason": dict(collections.Counter(r["category_reason"] for r in kept)),
        "구군별": dict(collections.Counter(r["GUGUN_NM"] for r in kept).most_common()),
        "영문cafe/coffee/까페인데 cafe 아님": len(english),
        "영문 예시": [r["MAIN_TITLE"] for r in english][:10],
        "같은 상호+같은 주소 중복 묶음": len(dups), "중복에 해당하는 행 수": sum(dups.values()),
        "중복 예시": [list(k) for k in list(dups)[:5]],
        "휴업 표시 건수": len(closed), "휴업 상호명": closed,
        "소개글에만 카페/커피(=restaurant)": len(intro_cafe),
        "needs_review": sum(r["needs_review"] for r in kept),
    }
    json.dump(stats, open(os.path.join(ROOT, "scripts", "restaurants-stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("[3/4] 통계 저장 완료", flush=True)

    # ---- 검수표 ----
    rnd = random.Random(SAMPLE_SEED)
    by = {c: [r for r in kept if r["category"] == c] for c in ("cafe", "cafe_candidate", "restaurant")}
    pick = lambda lst, n: rnd.sample(lst, min(n, len(lst)))
    cell = lambda s: (s or "").replace("|", "/").replace("\n", " ").strip() or "-"
    t1 = pick(by["cafe"], 8) + pick(by["cafe_candidate"], 6) + pick(by["restaurant"], 6)
    rnd.shuffle(t1)
    t2 = pick(intro_cafe, 8)
    L = ["# 맛집정보 분류 검수표", "",
         f"무작위 추출(seed {SAMPLE_SEED}로 고정이라 다시 만들어도 같은 목록). '내 판정'과 '맞음/틀림'을 채워 주세요.", "",
         "## 표 1. 자동 분류 확인 (cafe 8 · cafe_candidate 6 · restaurant 6)", "",
         "| 상호명 | 대표메뉴 | 자동 분류 | 내 판정 | 맞음/틀림 |", "|---|---|---|---|---|"]
    for r in t1:
        L.append(f"| {cell(r['MAIN_TITLE'])} | {cell(r['RPRSNTV_MENU'])} | {r['category']} | | |")
    L += ["", f"## 표 2. 소개글에 \"카페\"·\"커피\"가 있지만 restaurant 으로 분류된 곳 ({len(t2)}건, 전체 {len(intro_cafe)}건 중)", "",
          "| 상호명 | 대표메뉴 | 소개글 첫 40자 | 내 판정 | 맞음/틀림 |", "|---|---|---|---|---|"]
    for r in t2:
        L.append(f"| {cell(r['MAIN_TITLE'])} | {cell(r['RPRSNTV_MENU'])} | {cell(intros[r['UC_SEQ']][:40])} | | |")
    open(os.path.join(DATA, "restaurants-review-sample.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("[4/4] 검수표 저장 완료", flush=True)


if __name__ == "__main__":
    main()
