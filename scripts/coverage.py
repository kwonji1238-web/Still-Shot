"""코스 구성 가능성 점검 (일회성): 촬영지 주변에 관광지·식당·카페가 있는지 센다.
거리는 두 좌표 사이의 직선거리(km). 결과는 scripts/coverage-result.json 에 저장.
실행: python scripts/coverage.py
"""
import json, math, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(ROOT, "data", f)
load = lambda f: json.load(open(D(f), encoding="utf-8"))

SHOWCASE = ["보안관", "암수살인", "발신제한", "친구 2", "황제를 위하여"]

cine = [c for c in load("cinemap.json") if c["lat"] is not None]
attr = [(a["LAT"], a["LNG"]) for a in load("attractions.json")]
rest = load("restaurants.json")
food = [(r["LAT"], r["LNG"]) for r in rest if r["category"] == "restaurant"]
cafe_only = [(r["LAT"], r["LNG"]) for r in rest if r["category"] == "cafe"]
cafe_plus = [(r["LAT"], r["LNG"]) for r in rest if r["category"] in ("cafe", "cafe_candidate")]


def km(a1, o1, a2, o2):
    p = math.pi / 180
    x = math.sin((a2 - a1) * p / 2) ** 2 + math.cos(a1 * p) * math.cos(a2 * p) * math.sin((o2 - o1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))


def n_within(c, pts, r):
    return sum(1 for (a, o) in pts if km(c["lat"], c["lng"], a, o) <= r)


for c in cine:
    for name, pts in (("A", attr), ("F", food), ("Co", cafe_only), ("Cp", cafe_plus)):
        for r in (1, 2, 3):
            c[f"{name}{r}"] = n_within(c, pts, r)

N = len(cine)
pct = lambda n, d=N: f"{n} / {d} ({n / d * 100:.1f}%)" if d else "0 / 0 (해당 없음)"
R = {"촬영지(좌표 있음)": N}

# a) 반경별 식당 / 카페 / 둘 다
a = {}
for r in (1, 2, 3):
    a[r] = {
        "식당": sum(c[f"F{r}"] >= 1 for c in cine),
        "카페(cafe만)": sum(c[f"Co{r}"] >= 1 for c in cine),
        "카페(cafe+후보)": sum(c[f"Cp{r}"] >= 1 for c in cine),
        "식당+카페(cafe만)": sum(c[f"F{r}"] >= 1 and c[f"Co{r}"] >= 1 for c in cine),
        "식당+카페(cafe+후보)": sum(c[f"F{r}"] >= 1 and c[f"Cp{r}"] >= 1 for c in cine),
    }
R["a"] = a

# b) 2km: 관광지 1곳↑/2곳↑ + 식당 + 카페
b = {}
for label, ck in (("cafe만", "Co2"), ("cafe+후보", "Cp2")):
    b[label] = {
        "관광지1+식당+카페": sum(c["A2"] >= 1 and c["F2"] >= 1 and c[ck] >= 1 for c in cine),
        "관광지2+식당+카페": sum(c["A2"] >= 2 and c["F2"] >= 1 and c[ck] >= 1 for c in cine),
    }
R["b"] = b

# d) 2km 안에 식당이나 카페가 0곳인 구·군 (부산 구·군만)
def gu_of(c):
    t = c["roadNmAddr"].split()
    return t[1] if len(t) > 1 and c["roadNmAddr"].startswith("부산") and t[1][-1] in "구군" else None

d = {}
for label, ck in (("cafe만", "Co2"), ("cafe+후보", "Cp2")):
    tot, miss = collections.Counter(), collections.Counter()
    for c in cine:
        g = gu_of(c)
        if not g:
            continue
        tot[g] += 1
        if c["F2"] == 0 or c[ck] == 0:
            miss[g] += 1
    d[label] = [(g, n, tot[g]) for g, n in miss.most_common(3)]
    d[label + "_부산 구군 밖 제외"] = N - sum(tot.values())
R["d"] = d

# e) 작품별 b) 비율
e = []
for w in SHOWCASE:
    cs = [c for c in cine if c["opusNm"] == w]
    row = {"작품": w, "촬영지": len(cs)}
    for label, ck in (("cafe만", "Co2"), ("cafe+후보", "Cp2")):
        row[label + " 관광지1+식당+카페"] = sum(c["A2"] >= 1 and c["F2"] >= 1 and c[ck] >= 1 for c in cs)
        row[label + " 관광지2+식당+카페"] = sum(c["A2"] >= 2 and c["F2"] >= 1 and c[ck] >= 1 for c in cs)
    e.append(row)
R["e"] = e

json.dump(R, open(os.path.join(ROOT, "scripts", "coverage-result.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- 표 출력 (마크다운) ----
out = []
out.append("| 반경 | 식당 1곳 이상 | 카페 1곳 이상 (cafe만) | 카페 1곳 이상 (cafe+후보) | 식당+카페 둘 다 (cafe만) | 식당+카페 둘 다 (cafe+후보) |")
out.append("|---|---|---|---|---|---|")
for r in (1, 2, 3):
    x = a[r]
    out.append(f"| {r}km | {pct(x['식당'])} | {pct(x['카페(cafe만)'])} | {pct(x['카페(cafe+후보)'])} | {pct(x['식당+카페(cafe만)'])} | {pct(x['식당+카페(cafe+후보)'])} |")
out.append("")
out.append("**b) 반경 2km, 관광지 + 식당 + 카페를 모두 갖춘 촬영지**")
out.append("")
out.append("| 카페 기준 | 관광지 1곳↑ + 식당 + 카페 | 관광지 2곳↑ + 식당 + 카페 |")
out.append("|---|---|---|")
for label in ("cafe만", "cafe+후보"):
    out.append(f"| {label} | {pct(b[label]['관광지1+식당+카페'])} | {pct(b[label]['관광지2+식당+카페'])} |")
out.append("")
out.append("**d) 반경 2km 안에 식당이나 카페가 0곳인 촬영지가 많은 구·군 상위 3**")
for label in ("cafe만", "cafe+후보"):
    out.append("")
    out.append(f"카페 기준 {label}:")
    out.append("")
    out.append("| 순위 | 구·군 | 해당 촬영지 | 그 구·군 촬영지 | 비율 |")
    out.append("|---|---|---|---|---|")
    for i, (g, n, t) in enumerate(d[label], 1):
        out.append(f"| {i} | {g} | {n} | {t} | {n / t * 100:.0f}% |")
out.append("")
out.append("**e) 5개 작품별 b) 비율 (반경 2km)**")
out.append("")
out.append("| 작품 | 촬영지 | 관광지1↑+식당+카페 (cafe만) | 관광지2↑+식당+카페 (cafe만) | 관광지1↑+식당+카페 (cafe+후보) | 관광지2↑+식당+카페 (cafe+후보) |")
out.append("|---|---|---|---|---|---|")
for row in e:
    n = row["촬영지"]
    out.append(f"| {row['작품']} | {n} | {pct(row['cafe만 관광지1+식당+카페'], n)} | {pct(row['cafe만 관광지2+식당+카페'], n)} | {pct(row['cafe+후보 관광지1+식당+카페'], n)} | {pct(row['cafe+후보 관광지2+식당+카페'], n)} |")
open(os.path.join(ROOT, "scripts", "coverage-tables.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("\n".join(out))
print("부산 구·군 밖이라 d) 에서 뺀 촬영지:", d["cafe만_부산 구군 밖 제외"])
