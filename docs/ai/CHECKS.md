# 검사 명령과 결과

## 핏로그 첫 사용 개선 — 2026-11-18

기준 GitHub 커밋은 b489dd724b111853711506b69a7fd417a25d4652이며 작업 브랜치 feature/fitlog-20261118과 Draft PR #1을 유지한다. 앱 실행 위치는 apps/fitlog, Node 24.22.1이다.

| 검사 | 실제 실행/관찰 | 결과와 범위 |
| --- | --- | --- |
| 최종 자동 검사 | npm test → node --test tests/*.test.mjs | **45/45 성공**. API 23, 초안·전송 helper 17, 탐색 5 |
| 타입 | npm run typecheck | 성공, 전체 TypeScript 오류 0개 |
| 배포 빌드 | Sites source workflow에서 build-site.mjs → npm run build | 성공. 동일 검증 소스에서 Worker/client 아카이브 생성 |
| DB 변경 | npm run db:generate + 생성 SQL 읽기 | answers/questions/shoes에 nullable request_fingerprint 열 3개 추가. 기존0000 불변, 기존행 유지 검사 통과 |
| 로컬 D1 | 새0001 SQL을 --local --persist-to .wrangler/state로 한 번 실행 | 성공, SQL 3개. 기존0000 재실행 및 DB 초기화 없음 |
| 비공개 배포 | save_version_and_deploy_private | 성공. source572fc602e1423f3ea60687941053577b7cf1f25b / deployment appgdep_6afd6a6aa8888191bba3366d20e7fb31 / succeeded |
| 실제 로그인 | ChatGPT 로그인 시작→사용자가 선택한 Google→보안 입력 | 시작 권한은 명시적으로 받음. 이후 Google이 비활동으로 세션 종료를 표시. 로그인 성공·운영 DB 쓰기는 미확인 |
| 로컬 화면 | sites-preview start/status 및 Cloud Browser | 처음 연결 거절, 종료된 preview 확인 뒤 재시작. 실패 탭 재연결에서 URL 정책 제한. 우회하지 않음 |
| 데스크톱/모바일 사용 | 핵심 CRUD, 가상 키보드, 화면 배치 | **미검증**. 코드상 반응형 대응과 helper 검사를 시각·실계정 검증으로 표현하지 않음 |
| GitHub 개선본 | 작업 브랜치·기존 Draft PR #1 반영 및 원격 트리 대조 | `f8def8368ef98a5837fc6c7fbdfec232ae1aabb2` 업로드 성공, 원격 트리와 로컬 스테이징 일치 |
| GitHub 자동 검사 | 개선 소스 커밋의 Fitlog CI | [실행 44273087582](https://github.com/superkkj/ai-workspace-2/actions/runs/44273087582), `completed / success` 확인 |

### 검사한 중요한 조건

- 생성은 저장됐지만 응답만 유실된 뒤 같은 ID·같은 내용으로 확인하며, 중간 인증 거절이 이전 저장 실패를 의미한다고 취급하지 않음.
- 같은 ID의 다른 입력은 명시적 충돌로 처리. 원본 수정·기준 신발 삭제 뒤 원래 요청의 재시도는 유지.
- 미확정 수정은 최신 기록을 읽어 일치할 때만 성공으로 확인하고, 바뀌거나 삭제된 기록에 쓰지 않음.
- 초안은 사용자·폼·대상별 분리. 저장소 거절·용량 오류·늦은 응답·명시적 초안 정리와 충돌 복구를 확인.
- 같은 후기 재전송의 관찰일 보존, 삭제 멱등성·타인 자료 보존·존재 여부 응답 동일화, 최종 선택과 후기 검색.
- 기존/새 URL 호환, 탭·예시/실제·검색·필터·선택 글의 직렬화와 복원. 실제 브라우저 히스토리를 조작한 검사와 구분.

독립 검토는 별도 ChatGPT 작업자가 수행했다. 운영 테스트 자료는 생성하지 않았고 테스트는 메모리 SQLite와 가상 입력을 사용했다. 실제 두 계정 참여와 일반적인 동시 최초 수정의 서버 버전 잠금은 확인/구현 범위 밖이다.

## 핏로그 첫 버전 — 2026-11-18

실행 위치: apps/fitlog. Node 24.22.1, npm, Vinext 1.0.0-beta.5, Vite 8.0.13, Wrangler 4.92.0. 아래 명령은 package.json 또는 제공된 Sites 실행 가이드에서 확인했다.

| 검사 | 명령·방법 | 결과와 범위 |
|---|---|---|
| 의존성 설치 | Sites install-dependencies.mjs → npm ci | 성공. lockfile의 687 packages 설치. esbuild는 검사 코드의 직접 devDependency로 고정 |
| 타입 | npm run typecheck | 성공, 전체 TypeScript 오류 0개 |
| API 통합 | npm test → node --test tests/api.test.mjs | 성공, 16개 모두 통과. 실제 생성 SQL을 node:sqlite에 적용하고 실제 API handler 실행 |
| 스키마 | npm run db:generate | 성공, 7개 테이블의 초기 schema-only SQL과 Drizzle metadata 생성. 예시 INSERT 없음 |
| 빌드 | Sites build-site.mjs → npm run build | 성공, Worker + client 산출물. / 및 /api/:path+ 라우트 생성 |
| 로컬 D1 | node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lumpy_yellow_claw.sql | 성공, 로컬 DB에 16개 SQL 명령 적용. 운영 DB 검사와 구분 |
| 비공개 배포 | Sites source workflow 및 save_version_and_deploy_private | 성공. source 39ea40673b05a56b377cdebbc8838d9d14f4cb85, deployment appgdep_6afd581a465081919f2be4fd1cf078b0, 상태 succeeded |
| 배포 진입 화면 | Cloud Browser에서 실제 배포 주소 열기 | 성공, owner-private ‘Log in to access’ 화면 확인 |
| 로그인 이후 UI/저장/휴대폰 실사용 | 브라우저 ChatGPT 로그인 시도 | 미실행. 자동 승인 검토가 로그인 시작 동작을 거절함. 코드 검사·배포 성공과 구분 |
| 로컬 브라우저 | sites-preview start / status | 해당 preview가 다른 앱 ‘열어줘’를 제공하는 것을 확인. 이를 수정하지 않았으므로 핏로그의 로컬 화면 검사는 미실행 |
| 실제 두 계정 | 실계정 간 작성·수정·권한 확인 | 미실행. SQLite 테스트의 두 사용자 fixture와 구분 |
| GitHub 소스 반영 | Git objects로 소스 커밋 → 작업 브랜치 반영 → git fetch 후 index와 원격 commit의 diff 확인 | 성공. 앱 소스 커밋 ab45a347a8d9de41761eae14281b4ef68067843e, 137개 변경 파일. 원격과 로컬 준비본의 차이 없음. Draft PR #1 생성 |
| GitHub Actions | .github/workflows/fitlog-ci.yml, pull_request 실행 | 성공. 실행 44264167415의 상태 completed / conclusion success 확인. 앱 소스 커밋 ab45a347a8d9de41761eae14281b4ef68067843e에서 의존성 설치·typecheck·test·build 모두 성공 |

원격 검사: https://github.com/superkkj/ai-workspace-2/actions/runs/44264167415 · 검토용 PR: https://github.com/superkkj/ai-workspace-2/pull/1

### 16개 API 검사의 범위

빈 DB·실제/예시 분리, 무인증 쓰기 및 비공개 읽기 차단, 본인 ID만 session에 반환, 비공개 메모·인증 ID의 게시물 유출 차단, 신발 입력 검증과 소유권, 중복 요청, 신발 스냅샷 보존, 타인 글/답변/선택/후기 수정 차단, 질문→선택→후기 전이, 후기 작성 당시 사용 기간 고정, 날짜/숫자 검증, 답변 재시도 대상 충돌, 검색/필터, FK 연관 삭제, 명시적 운영자 신고 권한, 신고 처리 경쟁 조건, Origin/본문 크기/저장소 실패 처리.

D1의 전송 모양만 SQLite adapter로 연결했다. 애플리케이션 SQL과 판단 로직을 가짜 성공 응답으로 바꾸지 않았다. 실제 hosted D1·ChatGPT 로그인 서비스·여러 실계정 동작까지 검증했다는 뜻은 아니다.

### 독립 검토와 수정

별도 ChatGPT 검토자가 서버 권한·자료 공개·삭제·상태 로직을 읽었다. ‘조회 날짜가 지나면 첫날 후기도 30일 후기로 표시될 수 있는 문제’를 발견했다. updated_at을 기준으로 사용 기간을 고정했고, 30일 뒤 재조회와 실제 후기 수정의 차이를 회귀 검사로 확인했다. Claude Code를 실행하지 않았다.

## 확인된 저장소 점검

아래에는 이 저장소에서 실제 수행한 확인만 기록한다. 원본 저장소의 성공 기록은 새 저장소의 검사 결과로 옮기지 않는다.

| 날짜 | 대상 | 확인 방법 | 결과·범위 |
| --- | --- | --- | --- |
| 2026-11-18 | 원본 구성 확인 | GitHub 연결 도구로 원본의 전체 파일 목록과 문서 8개 조회 | 성공 — 공통 개발 규칙과 기록 문서 8개 확인. 앱 소스·CI·배포 설정 없음 |
| 2026-11-18 | 새 저장소 생성 | GitHub 저장소 정보 조회 | 성공 — `superkkj/ai-workspace-2`, 공개(Public), 기본 브랜치 main 확인 |
| 2026-11-18 | ChatGPT 연결 대상 추가 | GitHub App 설정에서 선택 저장소에 새 저장소 추가 후 저장 | 성공 — 선택 저장소 2개와 Connector 갱신 완료 화면 확인 |
| 2026-11-18 | 원본 복제 | 원본·복제본 main 커밋과 파일 8개의 blob SHA 대조 | 성공 — 복제 기준 커밋 `cf25dd7c5c3b04388bfe9586d03e504bcef3275e` 및 파일 8개 일치 |
| 2026-11-18 | 문서 참조 | 로컬 초안의 상대 링크와 CLAUDE.md 가져오기 대상 존재 확인 | 성공 — 상대 링크 22개와 AGENTS.md 연결 대상에 누락 없음 |
| 2026-11-18 | 문서 수정·업로드 | 연결 도구로 커밋 생성·main 반영 후 문서 8개 전체 내용 재조회·대조 | 성공 — [d879c2c](https://github.com/superkkj/ai-workspace-2/commit/d879c2c9639bb9908edba8bc968cc981c7b71603)의 문서 8개가 준비한 내용과 모두 일치. 실제 읽기·쓰기 확인 |

## 실행 결과를 남기는 방법

작업별로 날짜, 대상 변경, 명령 또는 확인 방법, 실행 위치와 환경, 관찰 결과를 기록합니다. 긴 로그 전체 대신 판단에 필요한 결과를 남기고 필요하면 로그 위치를 적습니다. 최근 결과를 갱신하되 중요한 실패 원인과 해결 경험은 [LESSONS.md](../../LESSONS.md)에 남깁니다.

- **성공:** 실제로 실행했고 정한 기준을 만족한 항목
- **실패:** 실제로 실행했지만 오류 또는 기준 미달이 있었던 항목
- **미실행:** 실행하지 않은 항목. 환경 부재, 권한, 범위 밖 등 이유를 함께 기록

## 새 검사 기록 양식

- 날짜 / 작업:
- 확인 대상과 완료 기준:
- 대상 커밋·변경 범위:
- 명령 또는 수동 확인 방법:
- 실행 위치 / 환경:
- 결과: 성공 · 실패 · 미실행 중 하나
- 실제 관찰 내용 또는 미실행 사유:
- 남은 확인 / 다음 조치:

프로젝트에서 실제 검사 명령을 찾으면 명령을 확인한 설정 파일이나 스크립트 경로도 함께 기록합니다. 문서만 바꾼 작업에는 코드 테스트를 새로 만들지 않습니다.
