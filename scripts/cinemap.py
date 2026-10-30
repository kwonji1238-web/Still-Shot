"""씨네맵·부산명소 받기 + 씨네맵 주소 -> 좌표 변환 (일회성 데이터 준비 스크립트)

실행: python scripts/cinemap.py
만드는 파일: data/cinemap.json, data/geocode-failures.json, data/attractions.json
인증키는 .env 의 DATA_GO_KR_KEY, KAKAO_REST_KEY 를 읽는다. 키 값은 어디에도 출력/저장하지 않는다.
카카오 결과는 scripts/geocode-cache.json 에 저장해 두고, 다시 실행하면 같은 주소는 다시 부르지 않는다.
(한도에 걸리거나 중간에 멈춰도 다시 실행하면 이어서 한다.)
"""
import json, os, re, sys, time, urllib.parse, urllib.request

# ===== 설정 =====
CINEMAP_URL = "https://apis.data.go.kr/6260000/CineMapService/getCineMap"
ATTRACTION_URL = "https://apis.data.go.kr/6260000/AttractionService/getAttractionKr"
KAKAO_ADDR_LIMIT = 100000      # 카카오 주소 변환 하루 한도
KAKAO_ADDR_USED_BEFORE = 21    # 이 스크립트를 쓰기 전에 이미 쓴 양 (2026-10-28 기준)
KAKAO_KEYWORD_LIMIT = 100000   # 카카오 키워드 검색 한도
CALL_GAP = 0.12                # 카카오 호출 사이 간격(초)
# ================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, "scripts", "geocode-cache.json")


def load_env():
    d = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8-sig"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            d[k] = v.strip().strip("\"'")
    return d


ENV = load_env()
DATA_KEY, KAKAO_KEY = ENV["DATA_GO_KR_KEY"], ENV["KAKAO_REST_KEY"]


def mask(s):
    for x in (DATA_KEY, urllib.parse.quote(DATA_KEY, safe=""), KAKAO_KEY):
        if x:
            s = s.replace(x, "***")
    return s


def http(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def fetch_data_go(base, rows=3000):
    """공공데이터포털 API 를 한 번에 받는다 (씨네맵은 2,193건, 부산명소는 213건이라 1번이면 충분)."""
    url = f"{base}?serviceKey={urllib.parse.quote(DATA_KEY, safe='')}&resultType=json&pageNo=1&numOfRows={rows}"
    s, b = http(url)
    if s != 200:
        raise SystemExit(f"공공데이터 호출 실패 {s}: {mask(b)[:200]}")
    return json.loads(b)


# ---------- 카카오 ----------
class Stop(Exception):
    pass


cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {"addr": {}, "kw": {}, "n_addr": 0, "n_kw": 0}


def save_cache():
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)


def kakao(path, q, kind):
    if kind == "addr" and KAKAO_ADDR_USED_BEFORE + cache["n_addr"] >= KAKAO_ADDR_LIMIT - 100:
        raise Stop("주소변환 한도 근접")
    if kind == "kw" and cache["n_kw"] >= KAKAO_KEYWORD_LIMIT - 100:
        raise Stop("키워드검색 한도 근접")
    for t in range(4):
        time.sleep(CALL_GAP)
        s, b = http("https://dapi.kakao.com/v2/local/" + path + "?size=5&query=" + urllib.parse.quote(q),
                    {"Authorization": "KakaoAK " + KAKAO_KEY})
        if s == 200:
            cache["n_" + kind] += 1
            return json.loads(b)["documents"]
        if s == 429:
            time.sleep(5 * (t + 1))
            continue
        raise Stop(f"카카오 오류 {s}: {mask(b)[:150]}")
    raise Stop("카카오 호출 한도(429) 계속됨")


def shop_name(addr):
    """주소 끝 괄호 안의 상호명 (예: '(우동, 하찌하찌산토리)' -> '하찌하찌산토리'). 동·길 이름뿐이면 None."""
    m = re.search(r"\(([^()]*)\)\s*$", addr)
    if not m:
        return None
    seg = [x.strip() for x in m.group(1).split(",")]
    n = seg[-1]
    if len(seg) == 1 and re.search(r"(동|로|길|가|리)$|^\d", n):
        return None
    return n if n and not re.fullmatch(r"[\d\-\s]+", n) else None


def geocode(addr):
    if addr in cache["addr"]:
        return cache["addr"][addr]
    r = None
    d = kakao("search/address.json", addr, "addr")
    if d:
        r = {"lat": float(d[0]["y"]), "lng": float(d[0]["x"]), "s": "성공"}
    else:
        n = shop_name(addr)
        if n and addr not in cache["kw"]:
            cache["kw"][addr] = 1  # 키워드 검색은 주소당 한 번만
            d = kakao("search/keyword.json", "부산 " + n, "kw")
            d = [x for x in d if x.get("address_name", "").startswith("부산")]
            if d:  # 위치가 틀릴 수 있어 상태로 구분
                r = {"lat": float(d[0]["y"]), "lng": float(d[0]["x"]), "s": "키워드검색성공", "matched": d[0].get("place_name")}
        if not r:
            r = {"lat": None, "lng": None, "s": "실패"}
    cache["addr"][addr] = r
    return r


def main():
    os.makedirs(DATA, exist_ok=True)

    j = fetch_data_go(CINEMAP_URL)["response"]["body"]
    items = j["items"]["item"]
    print(f"[1/3] 씨네맵 받기 완료: {len(items)}건 (전체 {j['totalCount']}건)", flush=True)

    stopped = None
    try:
        for i, it in enumerate(items):
            geocode(it["roadNmAddr"])
            if i % 200 == 0:
                save_cache()
                print(f"      변환 진행 {i}/{len(items)}", flush=True)
    except Stop as e:
        stopped = str(e)
    save_cache()
    if stopped:
        print(f"멈춤: {stopped}. 지금까지 결과는 저장했으니 다시 실행하면 이어서 합니다.")
        sys.exit(1)

    out = []
    for it in items:
        r = cache["addr"][it["roadNmAddr"]]
        out.append({"opusNm": it["opusNm"], "plcNm": it["plcNm"], "roadNmAddr": it["roadNmAddr"],
                    "lat": r["lat"], "lng": r["lng"], "변환상태": r["s"]})
    json.dump(out, open(os.path.join(DATA, "cinemap.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    fails = [{"opusNm": o["opusNm"], "roadNmAddr": o["roadNmAddr"]} for o in out if o["변환상태"] == "실패"]
    json.dump(fails, open(os.path.join(DATA, "geocode-failures.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[2/3] 씨네맵 저장 완료 (변환 실패 {len(fails)}건)", flush=True)

    att = fetch_data_go(ATTRACTION_URL, rows=1000)["getAttractionKr"]["item"]
    json.dump(att, open(os.path.join(DATA, "attractions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[3/3] 부산명소 저장 완료: {len(att)}건", flush=True)


if __name__ == "__main__":
    main()
