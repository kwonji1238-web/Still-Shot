"""분류 규칙은 바꾸지 않고 건수만 세는 일회성 점검. 결과: scripts/menu-check-result.json"""
import json, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rest = json.load(open(os.path.join(ROOT, "data", "restaurants.json"), encoding="utf-8"))
MENU9 = ["커피", "아메리카노", "라떼", "에스프레소", "에이드", "스무디", "케이크", "빙수", "디저트"]
EXTRA = ["베이커리", "제과", "빵", "차", "티", "주스", "브런치", "찻집", "다방", "와플", "마카롱"]
menu = lambda r: r["RPRSNTV_MENU"] or ""
empty = [r for r in rest if not menu(r).strip()]
word_cnt = {w: sum(w in menu(r) for r in rest) for w in MENU9}
rows = []
for r in rest:
    if r["category"] != "restaurant":
        continue
    hit = [w for w in EXTRA if w in (r["MAIN_TITLE"] or "") or w in menu(r)]
    if hit:
        rows.append({"상호명": r["MAIN_TITLE"], "대표메뉴": menu(r).replace("\n", " "), "걸린 단어": hit})
wc = collections.Counter(w for x in rows for w in x["걸린 단어"])
res = {"전체": len(rest), "메뉴 비어 있음": len(empty), "비어 있는 곳 분류": dict(collections.Counter(r["category"] for r in empty)),
       "메뉴단어별": word_cnt, "추가단어 해당 건수": len(rows), "추가단어별": dict(wc), "목록": rows}
json.dump(res, open(os.path.join(ROOT, "scripts", "menu-check-result.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: v for k, v in res.items() if k != "목록"})
