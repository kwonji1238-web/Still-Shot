# 시트 기록 읽는 방법 (참가자 5~10명용)

구글 시트의 `responses` 탭에 쌓인 기록을 "몇 명 중 몇 명" 형태로 읽는 순서예요.
어려운 피벗 표는 쓰지 않고, **필터와 간단한 수식**만 써요.

> **먼저 알려 드려요.**
> - 아래 수식은 제가 구글 시트에서 직접 실행해 보지 못했어요(확인 못함). 4단계에서 실제 시트로 돌려 보면서 맞는지 확인하고, 틀린 곳이 있으면 이 문서를 고칠게요.
> - 값이 숫자로 저장될지 글자로 저장될지도 확인 못함이라, 두 경우 모두 되도록 썼어요.
> - 수식을 붙여 넣었는데 빨간 오류가 나면 그 칸과 오류 글을 알려 주세요.
> - 참가자가 5~10명이면 **통계가 아니라 "어디서 막혔는지 찾는 용도"**예요. 퍼센트 대신 "7명 중 5명"으로 읽고, 평균보다 **한 명 한 명의 줄**을 같이 보세요.

---

## 0. 원본 탭의 열 (A~N)

`responses` 탭의 열은 이 순서예요. 아래 수식의 열 이름이 이걸 따라요.

| 열 | 이름 | 열 | 이름 |
| --- | --- | --- | --- |
| A | received_at | H | client_ts |
| B | event_id | I | task |
| C | session_id | J | event |
| D | participant_id | K | question_id |
| E | is_test | L | value |
| F | mode | M | task_elapsed_ms |
| G | device | N | extra_json |

한 줄은 "일어난 일 하나"예요. 한 사람이 끝까지 하면 수십 줄이 쌓여요.

### 한 사람의 이야기를 순서대로 보고 싶을 때

1. `responses` 탭에서 **데이터 → 필터 만들기**를 눌러요.
2. C열(session_id) 필터에서 그 사람의 세션 하나만 체크해요.
3. 보이는 줄을 H열(client_ts)로 **오름차순 정렬**해요.
4. 위에서부터 `event`와 `value`를 읽으면 그 사람이 한 일이 순서대로 나와요.

자주 보는 이벤트(`event`)는 이래요.

| event | 뜻 |
| --- | --- |
| ut_start / consent | 시작 / 동의 |
| q_answer | 질문에 답함(`question_id`가 질문 번호, `value`가 답) |
| task_start / task_end | 과업 시작 / 끝(`task`가 task1·task2) |
| spot_select | 목록에서 촬영지 줄을 눌러 지도가 확대됨(상세 아님) |
| spot_tap | 촬영지 상세로 들어가려는 첫 탭 |
| nearby_card_tap | "근처에 이런 곳" 카드를 누름 |
| course_button_tap / course_view | "이 근처 코스 보기" 버튼을 누름 / 코스 화면이 열림 |
| search_submit / search_no_result | 검색을 제출함 / 결과 없음 안내가 뜸 |
| pause / resume | 질문 창이 뜨거나 화면이 가려져 시간이 멈춤 / 다시 흐름 |
| ut_end | 끝까지 마침 |

---

## 1. 연습 기록 거르기

연습 기록은 **세션 단위**로 거르는 게 안전해요. 연습인지 알려 주는 표시가 줄마다 다르게 붙기 때문이에요.

- `is_test`가 TRUE인 줄: 참가자 번호가 `TEST`로 시작하거나, 주소에 `dry=1`·`debug=1`이 있던 줄이에요.
- `extra_json`에 `"dry":true` 또는 `"debug":true`가 있는 줄: **세션의 첫 줄(`ut_start`)에만** 붙어요.

그래서 줄만 걸러 내면 같은 세션의 다른 줄이 남아요. 아래 2번의 `sessions` 탭이 세션 단위로 "연습/진짜"를 판단해 줘요(D열).

**원본 탭에서 눈으로 잠깐 거르기**
1. `responses` 탭에서 **데이터 → 필터 만들기**를 눌러요.
2. E열(is_test) 필터에서 **TRUE를 체크 해제**해요. 연습 줄이 대부분 사라져요.
3. 확인 한 번 더: N열(extra_json) 필터의 **조건별 필터 → 텍스트 포함**에 `dry`를 넣어 보고, 나오는 줄의 session_id가 연습 세션이면 그 세션은 연습이에요.

---

## 2. 참가자 구분하기: `sessions` 탭 만들기

`session_id`가 **한 사람이 한 번 진행한 번호**예요. 새로고침해도 같은 번호가 유지돼요.
참가자 번호(P01 등)는 사람이 정한 이름표라서, 같은 사람이 두 번 하거나 번호를 잘못 넣으면 겹칠 수 있어요. 그래서 **세션 번호를 기준**으로 한 사람당 한 줄을 만들어요.

### 만드는 방법

1. 시트 맨 아래의 **+** 버튼으로 새 탭을 만들고 이름을 `sessions`로 바꿔요. (영어 이름이어야 수식이 편해요.)
2. 1행에 아래 이름을 그대로 입력해요. **P~AB열(질문 번호)은 글자까지 똑같이** 써야 해요.

| 열 | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1행 | 세션 | 참가자 | 방식 | 구분 | 기기 | 과업1결과 | 과업1성공 | 과업1초 | 과업2결과 | 과업2성공 | 과업2초 | 코스발견 | 코스열람 | 끝까지 | 번호중복 |

| 열 | P | Q | R | S | T | U | V | W | X | Y | Z | AA | AB | AC | AD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1행 | Q1 | Q2 | S1 | S2 | S2-1 | S3 | Q3 | Q3_reason | Q4 | E1 | E2 | Q5 | F2 | S2-S1 | S3-S2 |

3. **2행**의 각 칸에 아래 수식을 입력해요(복사해서 붙여 넣기). `responses!`는 원본 탭을 가리켜요.
4. 2행을 **복사**하고, 3~30행을 선택해 **붙여넣기**해요. (A열은 A2 한 칸의 수식이 아래로 저절로 펼쳐지니 **A3 아래는 비워 두세요.**)

### 2행 수식

**A2 (세션 목록, 이 칸 하나만)**
```
=UNIQUE(FILTER(responses!C2:C, responses!C2:C<>""))
```

**B2 참가자 / C2 방식 / E2 기기**
```
=IF($A2="","",INDEX(FILTER(responses!$D$2:$D,responses!$C$2:$C=$A2),1))
=IF($A2="","",INDEX(FILTER(responses!$F$2:$F,responses!$C$2:$C=$A2),1))
=IF($A2="","",INDEX(FILTER(responses!$G$2:$G,responses!$C$2:$C=$A2),1))
```

**D2 구분 (연습 / 진짜)** — `is_test`가 TRUE이거나 `ut_start`에 dry·debug가 있으면 "연습"
```
=IF($A2="","",IF(COUNTIFS(responses!$C:$C,$A2,responses!$E:$E,"TRUE")+COUNTIFS(responses!$C:$C,$A2,responses!$N:$N,"*""dry"":true*")+COUNTIFS(responses!$C:$C,$A2,responses!$N:$N,"*""debug"":true*")>0,"연습","진짜"))
```
(`is_test`가 TRUE인지 글자 "TRUE"로 읽히는지는 확인 못함이에요. D열에 "진짜"인데 원본에서 TEST 번호라면 알려 주세요.)

**F2 과업 1 결과 / G2 성공(1=성공) / H2 소요 시간(초)**
```
=IF($A2="","",IFERROR(INDEX(FILTER(responses!$L$2:$L,responses!$C$2:$C=$A2,responses!$J$2:$J="task_end",responses!$I$2:$I="task1"),1),"없음"))
=IF($A2="","",IF(F2="success",1,0))
=IF($A2="","",IFERROR(INDEX(FILTER(responses!$M$2:$M,responses!$C$2:$C=$A2,responses!$J$2:$J="task_end",responses!$I$2:$I="task1"),1)/1000,""))
```
F열 값은 `success`(성공) / `giveup`(못 찾겠어요) / `timeout`(시간초과) / `없음`(과업 1 끝을 못 남김)이에요.

**I2 과업 2 결과 / J2 성공(1=성공) / K2 소요 시간(초)**
```
=IF($A2="","",IFERROR(INDEX(FILTER(responses!$L$2:$L,responses!$C$2:$C=$A2,responses!$J$2:$J="task_end",responses!$I$2:$I="task2"),1),"없음"))
=IF($A2="","",IF(COUNTIFS(responses!$C:$C,$A2,responses!$J:$J,"task_end",responses!$I:$I,"task2",responses!$N:$N,"*""success"":true*")>0,1,0))
=IF($A2="","",IFERROR(INDEX(FILTER(responses!$M$2:$M,responses!$C$2:$C=$A2,responses!$J$2:$J="task_end",responses!$I$2:$I="task2"),1)/1000,""))
```
I열 값은 `decided`(정했어요) / `giveup`(못 정하겠어요) / `timeout`이에요. **과업 2의 성공은 I열이 아니라 J열**로 봐요. "정했어요"를 눌렀고, 근처 장소 카드를 눌러 봤거나 코스 화면을 열어 봤을 때만 성공(1)이에요.

**L2 코스 스스로 발견 / M2 코스 열람 / N2 끝까지**
```
=IF($A2="","",IF(COUNTIFS(responses!$C:$C,$A2,responses!$J:$J,"course_button_tap",responses!$N:$N,"*""course_found_unprompted"":true*")>0,1,0))
=IF($A2="","",IF(COUNTIFS(responses!$C:$C,$A2,responses!$J:$J,"course_view")>0,1,0))
=IF($A2="","",IF(COUNTIFS(responses!$C:$C,$A2,responses!$J:$J,"ut_end")>0,1,0))
```

**O2 번호 중복 확인**
```
=IF($A2="","",IF(COUNTIF($B$2:$B,B2)>1,"확인",""))
```
"확인"이 뜨면 같은 참가자 번호가 세션 두 개로 나뉜 거예요(브라우저 저장 삭제, 다른 폰으로 다시 시작 등). 두 줄 중 더 끝까지 한 쪽만 남기고 다른 쪽은 D열을 "연습"으로 바꿔 빼세요. (D열은 수식이라 그 칸에 직접 `연습`이라고 덮어쓰면 돼요.)

**P2~AB2 질문 답 (글자 답)**: P(Q1), Q(Q2), T(S2-1), W(Q3_reason), X(Q4), Y(E1), Z(E2), AA(Q5), AB(F2) 열에 아래 수식을 넣어요. 1행의 질문 번호를 읽어서 그 질문의 답을 가져와요.
```
=IF($A2="","",IFERROR(INDEX(FILTER(responses!$L$2:$L,responses!$C$2:$C=$A2,responses!$K$2:$K=P$1),1),""))
```
(붙여넣으면 `P$1`이 열마다 `Q$1`, `T$1`… 로 저절로 바뀌어요.)

**R2~V2 점수 답 (숫자 답)**: R(S1), S(S2), U(S3), V(Q3) 열에는 **숫자로 바꿔 주는** 아래 수식을 넣어요.
```
=IF($A2="","",IFERROR(VALUE(INDEX(FILTER(responses!$L$2:$L,responses!$C$2:$C=$A2,responses!$K$2:$K=R$1),1)),""))
```

**AC2 S2−S1 / AD2 S3−S2**
```
=IF(OR(R2="",S2=""),"",S2-R2)
=IF(OR(S2="",U2=""),"",U2-S2)
```

> 줄이 30개를 넘게 쌓이면(세션이 30개 이상) 2행을 더 아래까지 붙여넣으세요.

### 이렇게 되면 이미 한 사람 한 줄이에요
`sessions` 탭의 **구분이 "진짜"인 줄**만 읽으면 돼요. D열 필터로 "연습"을 빼면(**데이터 → 필터 만들기**) 참가자 한 명이 한 줄로 보여요.

---

## 3. 과업 성공·시간·코스 발견율: `summary` 탭 만들기

1. 새 탭을 만들어 이름을 `summary`로 해요.
2. 아래 표대로 **A열(이름표)**과 **1~2행**을 입력해요.

| | A | B | C | D |
| --- | --- | --- | --- | --- |
| 1행 | (비움) | 전체 | 직접(inperson) | 원격(remote) |
| 2행 | 방식 조건 | `*` | `inperson` | `remote` |

3. 3행부터 A열에 이름표를 적고, B열에 수식을 넣은 뒤 **C, D열로 복사**해요. 2행의 조건(`*`, `inperson`, `remote`)을 읽어서 자동으로 나눠 줘요. 이것이 5번(직접·원격 나눠 보기)이에요.

| 행 | A열 이름표 | B열 수식 |
| --- | --- | --- |
| 3 | 참가자 수 | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2)` |
| 4 | 끝까지 마친 사람 | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2,sessions!$N:$N,1)&" / "&B$3&"명"` |
| 5 | 과업 1 성공 | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2,sessions!$G:$G,1)&" / "&B$3&"명"` |
| 6 | 과업 1 시간 중앙값(성공자, 초) | `=IFERROR(MEDIAN(FILTER(sessions!$H$2:$H,sessions!$D$2:$D="진짜",sessions!$G$2:$G=1,((B$2="*")+(sessions!$C$2:$C=B$2))>0)),"")` |
| 7 | 과업 1 가장 짧은 / 긴 시간(성공자, 초) | `=IFERROR(MIN(FILTER(sessions!$H$2:$H,sessions!$D$2:$D="진짜",sessions!$G$2:$G=1,((B$2="*")+(sessions!$C$2:$C=B$2))>0))&" ~ "&MAX(FILTER(sessions!$H$2:$H,sessions!$D$2:$D="진짜",sessions!$G$2:$G=1,((B$2="*")+(sessions!$C$2:$C=B$2))>0)),"")` |
| 8 | 과업 2 성공 | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2,sessions!$J:$J,1)&" / "&B$3&"명"` |
| 9 | 과업 2 시간 중앙값(성공자, 초) | `=IFERROR(MEDIAN(FILTER(sessions!$K$2:$K,sessions!$D$2:$D="진짜",sessions!$J$2:$J=1,((B$2="*")+(sessions!$C$2:$C=B$2))>0)),"")` |
| 10 | **코스를 스스로 발견** | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2,sessions!$L:$L,1)&" / "&B$3&"명"` |
| 11 | 코스 화면을 한 번이라도 열어 봄 | `=COUNTIFS(sessions!$D:$D,"진짜",sessions!$C:$C,B$2,sessions!$M:$M,1)&" / "&B$3&"명"` |

### 읽는 법

- **"5 / 7명"**은 "7명 중 5명이 성공했다"는 뜻이에요. 퍼센트(71%)로 바꾸지 마세요. 사람 수가 적어서 한 명이 14%p를 흔들어요.
- **시간은 평균이 아니라 중앙값**으로 봐요. 한 명이 유난히 오래 걸려도 흔들리지 않아요. 가장 짧은 값과 긴 값도 같이 봐요.
- **소요 시간(초)**은 질문 창이 떠 있거나 화면이 가려진 시간을 **뺀** 과업 시간이에요. 제한 시간(과업 1은 90초, 과업 2는 60초)에 가까우면 시간초과로 끝났다는 뜻이에요.
- **코스 스스로 발견(행 10)**의 정의: 코스 안내 문구("이제 코스 화면도 한번 열어 보세요")가 뜨기 **전에** "이 근처 코스 보기" 버튼을 누른 사람이에요. 안내를 보고 나서야 연 사람은 여기에 안 들어가고, "코스 열람(행 11)"에만 들어가요. 두 숫자가 많이 다르면 "코스 버튼이 안 눈에 띈다"는 신호예요.
- **직접·원격은 각각 2~5명**이라 두 열을 비교해서 "원격이 더 못한다"고 결론짓지 마세요. "이런 경향이 보인다" 정도로 읽고, 왜 그런지는 그 사람들의 줄(2번의 이야기 보기)과 `F2`(불편했던 점) 답에서 찾아요.
- 과업 1 실패자(결과가 `giveup`·`timeout`)는 어느 화면에서 멈췄는지 이야기 보기로 꼭 한 명씩 보세요. 검색을 못 한 건지(`search_no_result`), 촬영지를 못 고른 건지(`spot_select`만 있고 `spot_tap`이 없음) 구분돼요.

---

## 4. S1 → S2 → S3 점수 변화, 질문별 답 모으기

### 점수 변화

`summary` 탭 12행부터 이어서 적어요.

| 행 | A열 이름표 | B열 수식 |
| --- | --- | --- |
| 12 | S1 평균 (상세 보기 전) | `=IFERROR(AVERAGEIFS(sessions!$R:$R,sessions!$D:$D,"진짜",sessions!$C:$C,B$2),"")` |
| 13 | S2 평균 (과업 2 직후) | `=IFERROR(AVERAGEIFS(sessions!$S:$S,sessions!$D:$D,"진짜",sessions!$C:$C,B$2),"")` |
| 14 | S3 평균 (코스까지 본 뒤) | `=IFERROR(AVERAGEIFS(sessions!$U:$U,sessions!$D:$D,"진짜",sessions!$C:$C,B$2),"")` |
| 15 | S1→S2 올랐다 | `=COUNTIFS(sessions!$AC:$AC,">0",sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |
| 16 | S1→S2 같다 | `=COUNTIFS(sessions!$AC:$AC,0,sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |
| 17 | S1→S2 내렸다 | `=COUNTIFS(sessions!$AC:$AC,"<0",sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |
| 18 | S2→S3 올랐다 | `=COUNTIFS(sessions!$AD:$AD,">0",sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |
| 19 | S2→S3 같다 | `=COUNTIFS(sessions!$AD:$AD,0,sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |
| 20 | S2→S3 내렸다 | `=COUNTIFS(sessions!$AD:$AD,"<0",sessions!$D:$D,"진짜",sessions!$C:$C,B$2)&" / "&B$3&"명"` |

**읽는 법**
- 점수는 1~5점이에요. "평균 3.4"보다 "7명 중 4명이 올랐다"를 먼저 보세요.
- **S1은 "상세 화면을 보기 전"** 점수예요(모바일에서 상세로 가려는 순간 물어요). 그런데 PC에서는 상세에 도착한 **직후**에 물어서 시점이 달라요. 원본 `responses` 탭의 `q_answer`(question_id=S1) 줄에서 `extra_json`에 `"s1_after_detail":true`가 있으면 PC·클릭 없이 도착한 경우예요. 이 사람들의 S1은 다른 사람과 같은 기준으로 비교하지 마세요.
- **S1→S2**는 "근처 정보를 보고 마음이 바뀌었나", **S2→S3**은 "코스까지 보고 마음이 바뀌었나"로 읽어요. S1·S2가 다르면 `S2-1`(점수가 바뀐 이유)을 같이 보세요.
- 점수가 오른 사람이 적다면, 근처 정보나 코스가 "가 볼 만하다"는 마음을 별로 못 키웠다는 신호예요. 그 사람들의 `F2` 답을 찾아보세요.

### 질문별 답 모으기

`sessions` 탭의 한 줄이 한 사람이라서, 열을 아래로 읽으면 그 질문의 답이 **한 사람당 하나씩** 모여 있어요. 숫자로 세어 보려면 빈 곳(예: `summary` 탭 22행 아래)에 이 수식을 써요.

**선택형 질문의 답별 인원** (질문 열의 글자를 바꿔 써요: Q1=`P`, Q2=`Q`, S2-1=`T`, Q3 이유=`W`, Q4=`X`, E1=`Y`, Q5=`AA`)
```
=QUERY(sessions!A1:AD,"select X, count(X) where D='진짜' and X is not null group by X label count(X) '명'",1)
```
위는 **Q4**(근처 장소 목록 vs 순서가 있는 코스)의 예예요. 다른 질문은 `X`를 해당 열 글자로 모두(세 군데) 바꿔 주세요.

**직접·원격으로 나누기**: `where` 뒤에 조건을 붙여요.
```
=QUERY(sessions!A1:AD,"select X, count(X) where D='진짜' and C='inperson' and X is not null group by X label count(X) '명'",1)
```

**점수 질문**(S3, Q3 점수): 평균(`summary` 12~14행과 같은 방식) 대신 점수별 인원을 세 보세요.
```
=QUERY(sessions!A1:AD,"select V, count(V) where D='진짜' and V is not null group by V order by V label count(V) '명'",1)
```
(`V`가 Q3 점수 열이에요. S3는 `U`예요.)

**글로 쓴 답**(E2 "어디를 어떻게 바꾸실래요?", F2 "가장 불편했던 점")은 한꺼번에 목록으로 모아요.
```
=FILTER({sessions!B2:B,sessions!AB2:AB},sessions!D2:D="진짜",sessions!AB2:AB<>"")
```
(F2 답이에요. E2 답은 `AB`를 `Z`로 바꿔요. 왼쪽이 참가자 번호, 오른쪽이 답이에요.)

**읽는 법**
- 선택형은 "7명 중 5명이 이걸 골랐다" 식으로 읽어요. 한두 명 차이는 의미가 없고, **한쪽으로 확 쏠렸을 때**만 의미가 있어요.
- `Q4`(하나만 남겨야 한다면)는 "근처 목록 vs 순서가 있는 코스"의 직접 비교라서, 이 서비스의 코스가 필요한지 판단하는 핵심 질문이에요. `E1`(코스를 그대로 쓸 것 같나요)과 같이 보세요. 코스가 좋다면 `E1`에 "그대로·조금 고침"이 많고 `Q4`가 코스 쪽이에요.
- `E1`이 "조금 고침·많이 고침"인 사람의 `E2`(어디를 어떻게 바꿀지)가 가장 구체적인 개선 힌트예요.
- `Q3`(위치·정보가 정확하다고 느꼈나)와 이유(`Q3_reason`)는 출처 문구가 믿음을 주는지 볼 때 써요.
- 글로 쓴 답은 **건너뛴 사람이 많을 수 있어요.** 건너뛴 줄은 비어 있어요.

---

## 5. 직접(inperson)과 원격(remote) 나눠 보기

방법은 두 가지예요.

1. **`summary` 탭의 C열(직접)·D열(원격)**: 3~20행이 방식별로 이미 나뉘어 나와요(3번의 `방식 조건` 행 덕분이에요).
2. **`sessions` 탭 필터**: C열(방식)에서 `inperson`만 또는 `remote`만 골라서 한 줄씩 비교해요.
   - **데이터 → 필터 만들기**를 누르고, C열 필터에서 한쪽만 체크해요. D열은 "진짜"만 체크해요.

**나눠서 볼 때 주의**
- 직접 만난 테스트는 진행자가 옆에서 말을 거들 수 있어서 과업 성공률이 높게 나올 수 있어요. 원격은 혼자 하니 더 어려워요. 그러니 **"직접에서 잘 되고 원격에서 막히는 곳"**이 가장 좋은 힌트예요.
- 두 방식이 각각 2~5명이라 숫자 차이로 결론짓지 말고, **어디서 멈췄는지(이야기 보기)**를 한 명씩 비교하세요.
- 원격 참가자의 `device` 열(E열)도 같이 보세요. 화면이 작은 기기에서만 막혔다면 UT 바나 질문 창 문제일 수 있어요.

---

## 한눈에 순서

1. `responses` 탭에 기록이 들어왔는지 확인해요.
2. `sessions` 탭을 만들고(2번) "구분" 열에서 **연습을 뺀** 줄만 봐요.
3. `summary` 탭을 만들고(3번) 과업 성공·시간·코스 발견을 "몇 명 중 몇 명"으로 읽어요.
4. 점수 변화와 질문별 답을 봐요(4번).
5. 직접·원격으로 나눠 봐요(5번).
6. 숫자가 이상한 곳이나 막힌 사람은 `responses` 탭에서 그 세션의 이야기를 순서대로 읽어요(0번).
