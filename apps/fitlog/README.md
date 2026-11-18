# 핏로그 · FITLOG

**잘 맞는 러닝화에서 시작해, 다음 한 켤레의 선택과 사용 경험을 잇는 플랫폼.**

내 신발장 → 조건을 붙인 질문 → 러너의 답변 → 선택한 신발 → 착용 후기를 연결합니다. 개발 중인 비공개 베타이며, 예시 글과 실제 기록을 구분합니다.

## 첫 버전의 범위

- 내 신발 등록·수정·삭제, 본인만 조회하는 신발장
- 질문 검색·발볼/목적/상태 필터, 기준 신발의 당시 정보를 붙인 질문
- 답변 작성·삭제와 질문자의 선택·후속 후기 기록
- 실제 입력 날짜에 따른 사용 기간 표시
- 로그인 사용자 소유권 검사, 신고와 명시적으로 지정한 운영자의 처리
- 실제 서버 저장, 가상 예시는 별도 화면에서만 제공

외부 리뷰를 수집하지 않으며 사이즈 정답·의학적 효과를 보장하지 않습니다. 제품명과 조건은 사용자가 입력한 내용입니다. 결제·자동 알림·AI 추천·이미지 업로드는 현재 기능이 아닙니다.

## 구성

- React 19 / TypeScript / Vinext
- Cloudflare D1 + Drizzle schema/migrations
- Sites의 ChatGPT 로그인. 닉네임은 로그인 실명·이메일과 별개
- 공개 GitHub 소스와 owner-private 시험 배포

[구현 범위·API 계약](docs/IMPLEMENTATION.md) · [검증 계획](docs/VALIDATION_PLAN.md) · [현재 상태](STATUS.md)

## 개발 시작

Node.js 24 이상과 npm을 기준으로 작업했습니다. 저장소 루트에서:

```sh
cd apps/fitlog
npm ci
npm run typecheck
npm test
npm run build
```

새 로컬 데이터베이스에 **처음 한 번만** 초기 마이그레이션을 적용합니다. 빌드가 dist/server/wrangler.json을 생성합니다.

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lumpy_yellow_claw.sql
npm run dev
```

이미 적용된 SQL을 다시 실행하지 마세요. 스키마 변경 시 `npm run db:generate`로 새 마이그레이션을 만들고 생성된 SQL과 metadata를 함께 검토합니다. 기존에 배포된 마이그레이션은 고치지 않습니다.

실행된 검사의 구체적 명령과 결과는 저장소 루트 `docs/ai/CHECKS.md`에 남깁니다. 사용자 PC에서 직접 실행한 것은 아직 아닙니다.

## 로그인과 자료 범위

운영 배포의 인증은 Sites에서 처리합니다. 인증되지 않은 API 쓰기는 거절합니다. 기본 닉네임은 `러너`이며, 질문을 올리기 전 변경할 수 있습니다.

신발장의 비공개 메모는 질문·답변에 복사하지 않습니다. 기준 신발의 브랜드·모델·사이즈·발볼·착용감만 게시 당시 스냅샷으로 연결합니다. 나중에 신발장을 수정하거나 삭제해도 과거 게시물의 스냅샷은 남습니다. 게시물 자체를 삭제하면 연결된 답변·선택·후기·신고도 정리됩니다.

개발용 portable 프로필은 loopback에서만 starter의 모의 로그인을 지원합니다. managed preview와 운영에는 그 모의 로그인이 없습니다. 로그인 없이 저장이 성공한 것처럼 가장하는 경로를 두지 않습니다.

## 운영 권한

`FITLOG_MODERATOR_USER_IDS`에 지정한 Site 사용자만 신고를 처리할 수 있습니다. 비어 있으면 누구도 운영 권한을 얻지 않으며 첫 가입자에게 권한을 주지 않습니다. 실제 값은 서버 환경 설정에만 두고 Git에 저장하지 않습니다. `.env.example`에는 키 이름만 있습니다. 본인 ID는 로그인한 자신의 `/api/session` 응답에서만 확인할 수 있습니다.

현재 owner-private 버전은 소유자에게 보여 주는 시험 배포입니다. 공개 모집 전에 운영 계정 설정, 실제 두 계정 참여, 신고 처리 책임, 개인정보/이용 안내를 점검해야 합니다. 실제 사용 후기나 구매 증빙을 검증한 서비스로 표현하지 않습니다.

## 소스와 배포

`superkkj/ai-workspace-2`의 `apps/fitlog`가 이 앱의 소스 위치입니다. `.openai/hosting.json`은 배포 프로젝트와 DB binding을 선언하며 인증 키를 담지 않습니다. Sites로 수정할 때 기존 project_id를 유지합니다. 로컬 `.env*`, `.dev.vars*`, 데이터베이스 상태, 인증 정보, node_modules와 dist는 커밋하지 않습니다.
