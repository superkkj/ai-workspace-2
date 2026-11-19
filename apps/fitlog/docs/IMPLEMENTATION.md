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

## 2026-11-18 개선 계약

- 생성 요청은 정규화한 최초 입력의 fingerprint를 서버에서 계산해 불변으로 보관한다. 같은 사용자·요청 ID에 다른 입력을 보내면 `409 REQUEST_ID_CONFLICT`다. 게시물 수정이나 기준 신발 삭제 뒤에도 동일한 최초 입력의 재시도는 유효하다. fingerprint는 응답에 노출하지 않는다. 기존 null 기록에는 과거 입력을 추정해 채우지 않는다.
- 신발·질문·답변 DELETE는 인증 후 소유자와 부모 조건으로만 삭제하며, 대상이 없거나 타인 소유여도 같은 `{ok:true}`를 반환한다. 이는 타인의 삭제 권한을 부여하는 응답이 아니며 ID 존재 여부도 드러내지 않는다.
- 후기의 본문·착용감·거리·시작일이 모두 같으면 동일 PUT은 작성일을 갱신하지 않는다. 원래 관찰 기간을 그대로 유지한다.
- 질문 검색에는 최종 선택 신발의 브랜드·모델, 후기 본문도 포함한다. 예시 검색도 같은 공개 필드를 사용한다.
- 핵심 폼의 초안과 미확정 요청은 사용자·폼·대상별 탭 저장소에 보관한다. 원요청 ID·전송값은 함께 보존하며, 과거에 미확정 제출이 있었다면 이후 인증 오류만으로 기존 요청을 폐기하지 않는다.
- 미확정 PATCH/PUT은 현재 서버 값을 조회해 보낸 내용과 일치할 때만 저장 완료를 확인한다. 다르면 `REMOTE_RECORD_CHANGED`로 안내하고 자동 덮어쓰기를 하지 않는다. 충돌 초안은 사용자가 저장된 기록을 확인했다고 명시적으로 확인한 뒤 로컬에서만 정리할 수 있다.
- 주소의 탭·실제/예시 모드·검색·필터·선택한 글을 일관되게 복원한다. 기존 `?question=`과 `?example=` 주소도 유지한다.

## 2026-11-19 동시 편집 충돌 보호

새 UI는 신발·질문 수정 시 편집 시작 당시의 `expected` 값(변경 가능한 필드 전부)을 함께 전송한다. 선택·후기는 현재 기록이 없으면 `expected: null`, 있으면 기존 필드를 포함한다(후기는 기존 `updatedAt`도 포함). 서버는 별도 읽기→쓰기 대신 단일 SQL INSERT/UPDATE에서 이전값과 비교한다. 둘째 탭이 오래된 기준으로 쓰려고 하면 `409 REMOTE_RECORD_CHANGED`를 보낸다.

- `PATCH /api/shoes/:id`: expected `{brand,model,size,width,fit,purpose,memo}`.
- `PATCH /api/questions/:id`: expected `{title,body,purpose,width,targetModel}`.
- `PUT /api/questions/:id/choice`: expected `null | {brand,model,size}`.
- `PUT /api/questions/:id/review`: expected `null | {body,fit,distanceKm,firstUsedAt,updatedAt}`.
- 클라이언트가 409를 받으면 현재 초안을 계속 보관하고 사용자에게 최신 값을 확인하도록 안내한다. 충돌한 쓰기를 자동 재시도하지 않는다.
- 구버전 클라이언트 호환용 `expected` 생략 요청은 여전히 허용한다. 따라서 이 변경만으로 모든 외부 클라이언트에 서버 버전 잠금이 강제되는 것은 아니다. 여러 창의 최초 편집에서 ABA 상황(중간 변경 뒤 동일 값 복구)까지 검출하는 독립 버전 카운터는 추가하지 않았다.
- 데이터베이스 마이그레이션은 없다. 자동 SQLite/API 검사 2개를 추가했고 GitHub CI 47개 통과. 비공개 서비스에는 아직 재배포하지 못했다.


## 구현 분담

- 프런트: app/page.tsx, app/layout.tsx, app/globals.css, app/components/**, lib/examples.ts, public/favicon.svg, 필요시 public의 직접 제작 벡터.
- 서버: app/api/**, lib/server/**, db/**, drizzle/**, tests/**, cloudflare-env.d.ts.
- 루트: 계약, 문서/프로젝트 설정, Sites 배포, GitHub 반영, 통합 확인.

빌드 설정과 기존 Sites 런타임 파일은 보존한다. 다른 담당의 파일을 동시에 수정하지 않는다.
