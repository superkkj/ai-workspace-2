# 핏로그 첫 버전

사용자 선택: 2026-11-18 러닝화 질문–선택–후속 후기 플랫폼(3번). 실제 저장과 핵심 사용 흐름이 동작하는 비공개 베타를 만든다. 공개 커뮤니티의 사용자 확보·지불 수요는 이번 구현으로 증명하지 않는다.

## 완료 기준

1. 내 신발을 서버에 등록·수정·삭제하고 새로고침해도 남는다. 신발장은 본인만 조회한다.
2. 기준 신발의 공개할 정보만 스냅샷으로 붙여 질문을 쓴다. 원본 신발 수정·삭제는 질문의 과거 조건을 바꾸지 않는다.
3. 로그인한 사용자가 답변을 남기며 자신이 작성한 내용만 삭제할 수 있다.
4. 질문자만 선택한 신발과 사용 후기를 기록·수정·삭제한다. 후기의 사용 기간은 실제 입력 날짜로 계산하고, 미래 날짜를 거절한다.
5. 예시는 가상임을 표시하며 실제 목록·통계·저장 데이터에 섞지 않는다. 실명·이메일·인증 ID는 게시물에 공개하지 않는다.
6. 인증/소유권/입력 검증, 상태 전이, 중복 요청, 연관 삭제를 검사하고 가능한 실제 브라우저 흐름을 확인한다.

## 구조

Sites Vinext/React + Cloudflare D1. 로그인은 Sites의 ChatGPT 인증을 사용한다. 외부 리뷰 수집·AI 추천·결제·자동 알림·업로드는 이번 범위에서 제외한다. 본인이 입력한 정보는 주관적 착용 경험으로 취급하며 제조사 사양이나 사이즈 정답으로 표시하지 않는다.

`lib/contracts.ts`가 프런트/서버의 계약이다. 표시 이름은 별도 닉네임 또는 기본값 `러너`이며 이메일로 대체하지 않는다. API 실패 형식은 `{ error: string, code?: string }`이다. 모든 API 응답은 캐시하지 않는다. 요청 본문의 사용자 ID는 신뢰하지 않는다.

## API 계약

| Method / path | 입력 | 출력 |
|---|---|---|
| GET /api/session | 없음 | Session |
| PATCH /api/session | nickname | Session |
| GET /api/shoes | 없음, 로그인 필수 | {items: Shoe[]} |
| POST /api/shoes | requestId(UUID), brand, model, size, width, fit, purpose, memo | {item: Shoe} |
| PATCH /api/shoes/:id | brand, model, size, width, fit, purpose, memo | {item: Shoe} |
| DELETE /api/shoes/:id | 없음 | {ok:true} |
| GET /api/questions | q, status, purpose, width, mine=1(선택) | {items: Question[], total:number}; 최대100건 |
| POST /api/questions | requestId(UUID), title, body, purpose, width, targetModel, referenceShoeId(선택) | {item: Question} |
| GET /api/questions/:id | 없음 | QuestionDetail |
| PATCH /api/questions/:id | title, body, purpose, width, targetModel | {item: Question}; 과거 reference 불변 |
| DELETE /api/questions/:id | 없음 | {ok:true}; 연관 답변·선택·후기·신고도 원자적으로 정리 |
| POST /api/questions/:id/answers | requestId(UUID), body, referenceShoeId(선택) | {item: Answer} |
| DELETE /api/questions/:id/answers/:answerId | 없음 | {ok:true} |
| PUT /api/questions/:id/choice | brand, model, size | {item: Choice}; 작성자만, 후기가 있으면 변경은409 |
| PUT /api/questions/:id/review | body, fit, distanceKm(숫자 또는null), firstUsedAt(YYYY-MM-DD) | {item: Followup}; choice 필수, 질문당1개 upsert |
| DELETE /api/questions/:id/review | 없음 | {ok:true}; 상태 chosen 복귀 |
| POST /api/reports | requestId(UUID), targetType(question/answer), targetId, reason | {ok:true} |
| GET /api/reports | moderator만 | {items:Report[]} |
| PATCH /api/reports/:id | action(hide/dismiss) | {ok:true}; moderator만 |

신발 size는 유한 숫자 180~350mm, 5mm 단위. brand 1~40자, model 1~80자, nickname 2~20자, 질문 제목 5~100자, 본문 10~3000자, 답변/후기 10~3000자, 메모 최대500자. 신고 사유 5~500자. 목적·발볼·착용감은 계약의 enum만 허용한다. distanceKm는0~10000, firstUsedAt는 유효 날짜이자 오늘(Asia/Seoul) 이전 또는 오늘. daysUsed는 후기 마지막 작성일(updatedAt, Asia/Seoul)과 firstUsedAt 사이의 경과 일수이며 시작 당일0이다. 조회 날짜만 지나도 후기 기간이 늘어나게 하지 않는다. 실제 후기 수정 저장 때만 작성 기준일이 갱신된다. 표시를 위해1로 임의 증가시키지 않는다.

읽기 목록에 비공개 신발과 인증 ID를 포함하지 않는다. 질문/답변의 표시 이름과 기준 신발은 작성 시점 스냅샷. 신고 후 즉시 자동 삭제하지 않으며 운영자가 확인한다. FITLOG_MODERATOR_USER_IDS가 설정되지 않으면 운영 권한은 아무에게도 부여하지 않는다. owner-private 단계의 실제 서로 다른 로그인 계정 검증은 별도로 기록한다.

## 구현 분담

- 프런트: app/page.tsx, app/layout.tsx, app/globals.css, app/components/**, lib/examples.ts, public/favicon.svg, 필요시 public의 직접 제작 벡터.
- 서버: app/api/**, lib/server/**, db/**, drizzle/**, tests/**, cloudflare-env.d.ts.
- 루트: 계약, 문서/프로젝트 설정, Sites 배포, GitHub 반영, 통합 확인.

빌드 설정과 기존 Sites 런타임 파일은 보존한다. 다른 담당의 파일을 동시에 수정하지 않는다.
