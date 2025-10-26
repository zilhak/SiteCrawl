# Task 시스템

SiteCrawl의 Task 시스템은 크롤링 워크플로우에서 사용되는 개별 작업 단위를 정의합니다.

## 📋 개념

### Task
- **CrawlTask**: URL 필터링 및 추출 작업
- **ActionTask**: 데이터 수집 및 저장 작업

## 🏗️ 구조

```
task/
├── types.ts       # 타입 정의
├── database.ts    # 데이터베이스 관리
├── manager.ts     # Task 관리
└── index.ts       # Entry Point
```

## 📝 Task 종류

### 1. CrawlTask (URL 추출 태스크)

URL을 필터링하고 다음 단계로 전달하는 작업

**필드**:
- `type`: `'blacklist'` | `'whitelist'`
  - `whitelist`: 패턴에 매칭되는 URL만 통과
  - `blacklist`: 패턴에 매칭되는 URL 제외
- `patterns`: 정규식 패턴 배열 (예: `['^https://example.com/.*', '.*\\.pdf$']`)
- `limit`: 최대 URL 개수 (`-1`이면 무제한)

**사용 예시**:
```typescript
const crawlTask = await window.task.createCrawl({
  name: 'Product URL Filter',
  description: '상품 페이지 URL만 필터링',
  type: 'whitelist',
  patterns: ['.*/products/.*', '.*/items/.*'],
  limit: 100
})
```

### 2. ActionTask (작업 태스크)

URL에 대해 실제 작업을 수행하고 결과를 저장

**필드**:
- `action`: 작업 종류 (현재 미정, 향후 확장)
  - 예: `'screenshot'`, `'scrape'`, `'download'`, etc.
- `resultName`: 결과 저장 폴더명
  - 저장 경로: `{저장데이터경로}/results/{resultName}/`
  - 상대 경로만 허용 (`..` 불가)

**사용 예시**:
```typescript
const actionTask = await window.task.createAction({
  name: 'Screenshot Capture',
  description: '페이지 스크린샷 캡처',
  action: 'screenshot',
  resultName: 'product-screenshots'
})
```

## 🔍 API 사용법

### Task 생성

```typescript
// CrawlTask 생성
const crawlTask = await window.task.createCrawl({
  name: 'Blog URL Filter',
  description: '블로그 포스트만 필터링',
  type: 'whitelist',
  patterns: ['.*/blog/.*', '.*/posts/.*'],
  limit: 50
})

// ActionTask 생성
const actionTask = await window.task.createAction({
  name: 'Content Scraper',
  description: '본문 내용 추출',
  action: 'scrape',
  resultName: 'blog-content'
})
```

### Task 조회

```typescript
// 모든 Task 조회
const allTasks = await window.task.getAll()

// CrawlTask만 조회
const crawlTasks = await window.task.getCrawl()

// ActionTask만 조회
const actionTasks = await window.task.getAction()

// 특정 Task 조회
const task = await window.task.get(taskId)

// Task 검색
const results = await window.task.search('screenshot')
```

### Task 업데이트

```typescript
// CrawlTask 업데이트
await window.task.updateCrawl(taskId, {
  patterns: ['.*/new-pattern/.*'],
  limit: 200
})

// ActionTask 업데이트
await window.task.updateAction(taskId, {
  resultName: 'new-folder-name'
})
```

### Task 삭제

```typescript
const success = await window.task.delete(taskId)
```

### Task 검증

```typescript
// CrawlTask 검증
const result = await window.task.validateCrawl(crawlTask)
if (!result.valid) {
  console.error('Validation Errors:', result.errors)
}

// ActionTask 검증
const result = await window.task.validateAction(actionTask)
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings)
}
```

## ✅ 검증 규칙

### CrawlTask
1. **이름**: 필수 (비어있으면 안됨)
2. **패턴**: 최소 1개 이상 필요
3. **정규식**: 모든 패턴이 유효한 정규식이어야 함
4. **Limit**: -1 이상이어야 함
5. **경고**: limit이 0이면 경고

### ActionTask
1. **이름**: 필수 (비어있으면 안됨)
2. **Action**: 필수 (비어있으면 안됨)
3. **Result Name**: 필수 (비어있으면 안됨)
4. **경로 안전성**: `< > : " | ? *` 문자 사용 불가
5. **상대 경로**: `..` 사용 불가 (보안)

## 📊 데이터베이스 스키마

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('crawl', 'action')),
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_name ON tasks(name);
```

## 🔗 Pipeline 연동

Task는 Pipeline에서 사용됩니다:

```typescript
// Task 생성
const crawlTask = await window.task.createCrawl({ ... })
const actionTask = await window.task.createAction({ ... })

// Pipeline에 Task 추가
await window.pipeline.addTask(pipelineId, {
  taskId: crawlTask.id,
  name: 'filter-products',
  trigger: '_run_',
  config: JSON.stringify({ /* 추가 설정 */ })
})

await window.pipeline.addTask(pipelineId, {
  taskId: actionTask.id,
  name: 'capture-screenshot',
  trigger: 'filter-products',
  config: JSON.stringify({ /* 추가 설정 */ })
})
```

## 🚀 향후 확장

### ActionTask Action 종류
- [ ] `screenshot`: 페이지 스크린샷
- [ ] `scrape`: HTML/텍스트 추출
- [ ] `download`: 파일 다운로드
- [ ] `pdf`: PDF 저장
- [ ] `api`: API 호출
- [ ] `custom`: 사용자 정의 스크립트

### 추가 기능
- [ ] Task 실행 히스토리
- [ ] Task 성능 통계
- [ ] Task 템플릿
- [ ] Task 복제
- [ ] Task 카테고리 확장
