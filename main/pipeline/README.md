# Pipeline 시스템

SiteCrawl의 Pipeline 시스템은 DAG(Directed Acyclic Graph) 기반으로 Task들을 연결하여 자동화된 크롤링 워크플로우를 구성합니다.

## 📋 개념

### Task
- **입력**: URL
- **출력**: URLs (다음 Task로 전달) 또는 Data (최종 결과)
- **역할**: URL에 대해 특정 작업 수행

### Pipeline
- Task들의 연결 (DAG 구조)
- **규칙**:
  1. 정확히 하나의 진입점 (`trigger: '_run_'`)
  2. 순환 참조 불가
  3. 모든 Task는 Root에서 도달 가능해야 함

## 🏗️ 구조

```
pipeline/
├── types.ts       # 타입 정의
├── dag.ts         # DAG 자료구조
├── validator.ts   # 검증 시스템
├── database.ts    # 데이터베이스 관리
├── manager.ts     # Pipeline 관리
├── test.ts        # 테스트 코드
└── index.ts       # Entry Point
```

## 📝 사용 예시

### 1. Pipeline 생성

```typescript
import { PipelineManager, Pipeline, PipelineTask } from './pipeline'

// Manager 생성
const manager = new PipelineManager(pipelineDB)

// Pipeline 생성
const pipeline = manager.createPipeline('상품 크롤링', '상품 페이지 자동 수집')

// Task 추가
manager.addTask(pipeline.id, {
  taskId: 'crawler-1',
  name: 'crawl',
  trigger: '_run_'
})

manager.addTask(pipeline.id, {
  taskId: 'filter-1',
  name: 'filter_products',
  trigger: 'crawl',
  config: JSON.stringify({ pattern: '*/products/*' })
})

manager.addTask(pipeline.id, {
  taskId: 'screenshot-1',
  name: 'screenshot',
  trigger: 'filter_products'
})

// 저장
manager.savePipeline(pipeline)
```

### 2. 검증

```typescript
const result = manager.validatePipeline(pipeline.id)

if (!result.valid) {
  console.error('Validation Errors:', result.errors)
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings)
}
```

### 3. DAG 변환

```typescript
const dag = manager.getPipelineAsDAG(pipeline.id)

if (dag) {
  // 위상 정렬
  const sorted = dag.topologicalSort()
  console.log('Execution Order:', sorted.map(n => n.name).join(' → '))

  // 리프 노드
  const leaves = dag.getLeafNodes()
  console.log('Leaf Nodes:', leaves.map(n => n.name).join(', '))

  // 시각화
  console.log(dag.toString())
}
```

## 🔍 DAG 예시

### 단순 체인
```
crawl → filter → screenshot
```

### 분기 (병렬)
```
        ┌→ screenshot
crawl → ├→ scrape
        └→ pdf
```

### 복잡한 DAG
```
            ┌→ filter_products → ┌→ product_screenshot
main_crawl →|                    └→ product_data
            └→ filter_blogs → blog_text
```

## ✅ 검증 규칙

1. **진입점**: `trigger: '_run_'`인 Task가 정확히 하나
2. **이름 유일성**: Pipeline 내에서 Task name 중복 불가
3. **Trigger 유효성**: 존재하는 Task name만 trigger 가능
4. **DAG 구조**: 순환 참조 불가
5. **도달 가능성**: 모든 Task가 Root에서 도달 가능

## 🛠️ API

### PipelineManager

```typescript
// Pipeline 생성
createPipeline(name: string, description?: string): Pipeline

// Pipeline 저장
savePipeline(pipeline: Pipeline): { success: boolean; error?: string }

// Pipeline 조회
getPipeline(id: string): Pipeline | null
getAllPipelines(): Pipeline[]
searchPipelines(query: string): Pipeline[]

// Pipeline 삭제
deletePipeline(id: string): boolean

// Task 관리
addTask(pipelineId: string, task: PipelineTask): Result
removeTask(pipelineId: string, taskName: string): Result
updateTask(pipelineId: string, taskName: string, updates: Partial<PipelineTask>): Result

// 검증
validatePipeline(pipelineId: string): ValidationResult

// DAG 변환
getPipelineAsDAG(pipelineId: string): DAG | null

// 복제
clonePipeline(pipelineId: string, newName?: string): Pipeline | null

// 통계
getPipelineStats(pipelineId: string): Stats | null
```

### DAG

```typescript
// 노드 조회
getRoot(): DAGNode | null
getNode(name: string): DAGNode | null
getAllNodes(): DAGNode[]
getLeafNodes(): DAGNode[]

// 그래프 연산
topologicalSort(): DAGNode[]
hasCycle(): boolean
getReachableNodes(startNode: DAGNode): Set<string>
getUnreachableNodes(): DAGNode[]
getAncestors(node: DAGNode): Set<string>
getDescendants(node: DAGNode): Set<string>

// 유틸리티
toString(): string
toJSON(): DAGGraph
```

## 🧪 테스트

```typescript
import { runPipelineTests } from './pipeline'

// 모든 테스트 실행
runPipelineTests()
```

테스트 케이스:
- ✅ 단순 체인
- ✅ 분기 (병렬)
- ✅ 복잡한 DAG
- ✅ 순환 참조 감지
- ✅ 검증 시스템
- ✅ DAG 연산

## 📊 데이터베이스 스키마

```sql
-- Pipelines
CREATE TABLE pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Pipeline Tasks (DAG 구조)
CREATE TABLE pipeline_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,        -- Pipeline 내 고유 이름
  trigger TEXT NOT NULL,      -- '_run_' 또는 다른 Task의 name
  config TEXT,                -- JSON
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
  UNIQUE(pipeline_id, name)
);

-- Pipeline 실행 히스토리
CREATE TABLE pipeline_executions (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  initial_url TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
);
```

## 🚀 향후 확장

- [ ] Pipeline 실행 엔진
- [ ] Task 정의 시스템
- [ ] 조건부 분기 (if/else)
- [ ] 반복 (loop)
- [ ] 병렬 실행 제어
- [ ] 실행 모니터링
- [ ] 에러 핸들링 및 재시도
