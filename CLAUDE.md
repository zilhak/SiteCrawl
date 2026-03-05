# SiteCrawl - 프로젝트 규칙

## 기획 우선 원칙 (CRITICAL)

- `.claude/[concept]/` 폴더의 기획 문서와 소스 코드가 충돌할 경우, **기획 문서가 항상 우선**한다.
- 기획과 코드 사이에서 판단이 애매한 경우, **작업을 즉시 중지하고 사용자에게 질문**한다.
- 기획 문서에 명시되지 않은 동작을 임의로 추가하지 않는다.

## 데이터 불변성 원칙

- Task 바깥에서 URL 데이터, URL 목록 등 모든 데이터는 **불변(immutable)**이다.
- Task가 리턴한 목록을 다음 Task에 전달할 때, **반드시 새로운 배열을 생성**하여 전달한다.
- Task 내부에서 input으로 받은 배열 등의 데이터를 **절대 수정하지 않는다.** 변경이 필요하면 내부에서 새로 만든다.

## 직접 실행 및 검증 지침 (Windows 환경)

DB 영속성, UI 동작, IPC 흐름 등 앱을 실행해야만 확인할 수 있는 문제가 발생하면 **직접 앱을 실행하여 검증**한다.

### 실행 전 포트 충돌 확인 (필수)

앱을 시작하기 전에 **반드시** Vite 개발 서버 포트(5173)와 Electron 프로세스가 이미 실행 중인지 확인한다.

```bash
# 1. Vite 포트 확인
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "OCCUPIED" || echo "FREE"

# 2. Electron 프로세스 확인
tasklist 2>/dev/null | grep -i electron && echo "RUNNING" || echo "NOT RUNNING"
```

- 포트가 **이미 사용 중**이고, 본인이 백그라운드로 시작하지 않은 경우:
  - **사용자가 직접 실행한 것으로 판단**한다.
  - 사용자에게 "이미 앱이 실행 중이므로 자동 확인을 중단합니다"라고 명시적으로 알린다.
  - 사용자가 실행 중인 앱을 활용하여 확인하거나, 종료 후 재시작을 요청한다.

### 앱 실행 방법

```bash
# 1. TypeScript 컴파일
cd E:/workspace/siteCrawl && npx tsc

# 2. Vite 개발 서버 시작 (백그라운드)
pnpm run dev:vite  # run_in_background: true

# 3. Vite 준비 대기
curl -s http://localhost:5173 > /dev/null  # 성공할 때까지 대기

# 4. Electron 앱 시작 (백그라운드)
npx electron .  # run_in_background: true, 터미널 출력으로 디버그 로그 확인

# 5. 종료 시: Electron TaskStop → Vite TaskStop
```

### DB 직접 검증 도구

```bash
# Python으로 DB 상태 확인 (앱 실행 여부 무관)
python tools/db-monitor.py --once

# 실시간 모니터링 (앱과 동시 실행)
python tools/db-monitor.py

# 자동화된 영속성 진단
python tools/db-diagnose.py --app-db

# Electron 환경에서 앱의 실제 코드로 영속성 테스트
npx electron tools/electron-real-test.js
```

### Electron 터미널 로그 키 (DEBUG 태그)

| 태그 | 의미 |
|------|------|
| `[DEBUG:startup]` | 앱 시작 시 DB 초기화 흐름 |
| `[DEBUG:init]` | PipelineDatabase 테이블 초기화 |
| `[DEBUG:set-path]` | storage:set-path IPC guard 분기 |
| `[DEBUG:ipc]` | pipeline IPC 호출 |
| `[DEBUG:db]` | PipelineDatabase 저장 |
| `[DEBUG:verify]` | 저장 후 별도 연결 검증 |
| `[DEBUG:close]` | 앱 종료 시 DB 상태 |
