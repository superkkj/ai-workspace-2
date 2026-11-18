# ai-workspace-2

이 대화에서 별도 애플리케이션을 개발하기 위한 작업 공간입니다. 기존 [superkkj/ai-workspace](https://github.com/superkkj/ai-workspace)의 문서와 변경 이력을 복제하고, 새 프로젝트의 진행 기록을 초기화했습니다. 개발 규칙은 이어받되, 앱의 목표·코드·진행 상황은 이 저장소에서 관리합니다.

- GitHub 계정: `superkkj`
- 저장소: [superkkj/ai-workspace-2](https://github.com/superkkj/ai-workspace-2)
- 공개 범위: **공개(Public)**
- 복제 원본: [superkkj/ai-workspace](https://github.com/superkkj/ai-workspace)
- 실제 연결·업로드 상태: [STATUS.md](STATUS.md)에서 확인합니다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| [README.md](README.md) | 전체 사용 방법과 시작·종료 요청문 |
| [AGENTS.md](AGENTS.md) | AI가 이 저장소에서 작업할 때 따를 지침 |
| [STATUS.md](STATUS.md) | 현재 목표, 완료한 일, 막힌 점, 다음 할 일 |
| [LESSONS.md](LESSONS.md) | 원인과 해결 방법을 확인한 사례 |
| [.gitignore](.gitignore) | 로컬 설정과 불필요한 산출물이 Git에 추가되는 것을 줄이는 설정 |
| [CLAUDE.md](CLAUDE.md) | Claude Code에서 공통 지침을 가져오기 위한 짧은 연결 파일 |
| [docs/ai/WORKFLOW.md](docs/ai/WORKFLOW.md) | 계획·구현·검사·기록 방법과 Codex·Claude 역할 분담 |
| [docs/ai/CHECKS.md](docs/ai/CHECKS.md) | 실제 검사 명령, 실행 환경, 성공·실패·미실행 기록 |

## 매번 이렇게 사용합니다

**계획 → 필요한 검토 → 구현 → 필요한 검사·실사용 확인 → 기록**을 기본 흐름으로 사용합니다.

1. `AGENTS.md`와 `STATUS.md`를 읽고, 관련된 `LESSONS.md`와 검사 목록을 확인합니다.
2. 만들 기능과 완료 기준을 짧게 정합니다. 영향이 큰 변경은 계획의 빠진 조건도 검토합니다.
3. 작은 단위로 구현하고, 실제 프로젝트에서 확인한 명령과 실행 방법으로 결과를 점검합니다.
4. 검사 결과는 `docs/ai/CHECKS.md`, 진행 상황과 다음 작업은 `STATUS.md`에 갱신합니다.
5. 원인과 해결법을 확인한 문제는 `LESSONS.md`에 남깁니다. 반복되는 실수라면 관련 지침이나 검사도 필요한 만큼 보완합니다.
6. 변경 내용을 확인한 뒤, 요청받은 범위에서 커밋하고 GitHub에 반영됐는지 확인합니다.

문서의 오탈자 수정처럼 영향이 작은 작업은 별도 계획서나 코드 테스트를 만들지 않습니다. 자세한 기준은 [개발 흐름](docs/ai/WORKFLOW.md)에 있습니다.

**파일 수정, 커밋, GitHub 업로드는 서로 다른 단계입니다.** 로컬에서 저장한 것만으로 GitHub에 올라가지 않습니다.

## 새 대화에서 시작할 때

> superkkj/ai-workspace-2의 AGENTS.md와 STATUS.md를 먼저 읽어 줘. 현재 작업에 필요한 README.md, docs/ai/WORKFLOW.md, LESSONS.md, docs/ai/CHECKS.md도 확인하고, 다음 할 일을 이어서 진행해 줘. 실제로 확인한 결과만 기록해 줘.

## 작업을 마칠 때

> 오늘 실제로 완료한 일, 남은 문제, 다음 할 일을 STATUS.md에 갱신해 줘. 실행한 검사와 결과는 docs/ai/CHECKS.md에, 원인과 해결법을 확인한 사례는 LESSONS.md에 기록해 줘. 이번 작업의 변경 내용을 확인하고 커밋해서 GitHub에 저장해 줘.

사용하는 AI 도구가 파일을 직접 읽고 수정할 수 있어야 이 흐름을 실행할 수 있습니다. 조회만 가능한 연결이라면 수정 가능한 개발 도구 또는 사용자가 변경 내용을 저장해야 합니다. 저장소에 기록한다고 모든 AI가 내용을 자동으로 영구 기억하는 것은 아닙니다.

## Codex와 Claude를 함께 쓸 때

공통 규칙은 `AGENTS.md` 한 곳에서 관리합니다. `CLAUDE.md`는 그 파일을 가져오도록 구성했습니다. 도구별 파일 읽기 방식과 확인 방법은 [개발 흐름](docs/ai/WORKFLOW.md)에 정리했습니다.

필요할 때 **Codex로 구현 → Claude로 독립 검토 → Codex로 수정·재검사**하는 방식으로 나눌 수 있습니다. 검토할 변경 범위, 완료 기준, 검사 결과를 함께 전달합니다. 두 도구를 자동 연결하는 설정은 아직 없으며, 한 도구만으로 작업을 진행해도 됩니다.

## 이 저장소에서 만들 앱

2026-11-18 사용자가 선택한 첫 앱은 **핏로그(FITLOG)**입니다. 러닝화 기록 → 질문 → 답변 → 선택 → 착용 후기를 연결하는 웹 플랫폼입니다.

- 소스와 실행 방법: [apps/fitlog/README.md](apps/fitlog/README.md)
- 기능 범위와 API: [apps/fitlog/docs/IMPLEMENTATION.md](apps/fitlog/docs/IMPLEMENTATION.md)
- 앱 진행 기록: [apps/fitlog/STATUS.md](apps/fitlog/STATUS.md)
- 검증 계획: [apps/fitlog/docs/VALIDATION_PLAN.md](apps/fitlog/docs/VALIDATION_PLAN.md)

앱별 코드와 문서는 `apps/` 아래에서 분리합니다. 이 저장소는 공개 소스를 관리하며, 운영 데이터와 인증 정보는 포함하지 않습니다.

프로젝트의 실제 빌드·테스트 명령과 실행 결과는 `docs/ai/CHECKS.md`에 기록합니다. 자동 훅·CI·배포는 실제 구성과 확인 결과가 있는 경우만 완료로 표시합니다. 최신 상태는 `STATUS.md`에서 확인합니다.

## 기록할 때 지킬 점

- API 키, 비밀번호, 개인 인증 파일, 실제 비밀 설정값을 저장하지 않습니다.
- `.gitignore`는 이미 Git이 추적 중인 비밀 파일을 제거하지 않으므로 커밋할 변경 내용도 확인합니다.
- 회사 코드나 자료는 해당 자료에 적용되는 저장·접근 정책을 확인한 범위에서 다룹니다.
- 대화 원문 전체보다 결정 사항, 확인한 근거, 다음 작업을 간결하게 남깁니다.
- 커밋·푸시 완료 여부는 실제 결과를 확인해서 기록합니다.
