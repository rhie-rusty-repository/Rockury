# EXPLAIN Plan Tree View — Design Spec

> Date: 2026-03-25
> Scope: EXPLAIN 버튼 결과를 DataGrid 대신 Tree View로 렌더링 + 필드별 설명
> Target: 기존 QueryTab 결과 영역 (zero-breaking-change for Run 결과)

---

## 1. Problem

현재 EXPLAIN 버튼을 누르면 `EXPLAIN (FORMAT JSON)` 결과가 DataGrid에 raw JSON 한 줄로 표시됨.
- PostgreSQL은 `QUERY PLAN` 컬럼 하나에 전체 JSON이 들어옴
- 가독성이 떨어지고 실행 계획을 이해하기 어려움

## 2. Solution

EXPLAIN 버튼 클릭 시 DataGrid 대신 **Tree View 컴포넌트**를 표시한다.

- JSON plan을 파싱하여 트리 구조로 렌더링
- 각 노드는 접기/펼치기 가능
- 모든 필드에 한국어 설명 표시
- 기존 Run 버튼 동작은 변경 없음 (DataGrid 그대로)

---

## 3. UI Design

### 3.1 Tree View 구조

```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ Seq Scan on api_keys · cost=0..10.8 · rows=80            │  ← ExplainSummaryBanner (기존)
├──────────────────────────────────────────────────────────────┤
│ ▼ [Seq Scan] on api_keys                                    │
│   ┊                                                          │
│   ┊  Startup Cost     0        첫 번째 행 반환 전 초기 비용     │
│   ┊  Total Cost       10.8     전체 실행 예상 비용 (상대 단위)  │
│   ┊  Plan Rows        80       반환 예상 행 수                 │
│   ┊  Plan Width       983      평균 행 크기 (bytes)           │
│   ┊  Parallel Aware   false    병렬 실행 가능 여부             │
│   ┊  Async Capable    false    비동기 실행 가능 여부            │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 접힌 상태 (Collapsed)

```
│ ▶ [Seq Scan] on users       cost=0..12.5 · 50 rows          │
│ ▶ [Index Scan] on orders    cost=0..18.3 · 200 rows         │
```

접힌 노드는 한 줄 요약 (Node Type, Relation Name, cost, rows)만 표시.

### 3.3 중첩 노드 (Nested Plan)

```
│ ▼ [Hash Join]  Hash Cond: (u.id = o.user_id)                │
│   ┊  Total Cost       35.2    전체 실행 예상 비용 (상대 단위)  │
│   ┊  Plan Rows        120     반환 예상 행 수                 │
│   ┊  Hash Cond        (u.id = o.user_id)                     │
│   ┊                                                          │
│   ┊  ▶ [Seq Scan] on users   cost=0..12.5 · 50 rows         │
│   ┊  ▼ [Hash]                                                │
│   ┊    ┊  ▶ [Index Scan] on orders  cost=0..18.3 · 200 rows │
```

자식 노드(`Plans` 배열)를 재귀적으로 렌더링하되, 들여쓰기 + 왼쪽 보더로 계층 표현.

### 3.4 스타일링

| 요소 | 스타일 |
|------|--------|
| Node Type badge | `bg-primary/15 text-primary font-semibold text-xs rounded px-2` |
| Relation Name | `text-green-500 font-medium` |
| 필드 key (label) | `text-muted-foreground text-xs` (고정 너비 150px) |
| 필드 value | `text-foreground text-xs tabular-nums` |
| Total Cost value | `text-amber-500 font-semibold` (시각적 강조) |
| 필드 description | `text-muted-foreground/50 text-[11px]` |
| 접힌 요약 텍스트 | `text-muted-foreground text-[11px]` |
| 트리 보더 | `border-l border-border` + `pl-4 ml-5` |
| 토글 아이콘 | `▶`/`▼` text-muted-foreground, cursor-pointer |

---

## 4. Field Descriptions

### 4.1 PostgreSQL EXPLAIN 필드 설명 맵

```typescript
const PG_FIELD_DESCRIPTIONS: Record<string, string> = {
  // Plan node info
  'Node Type':           '실행 노드 유형 (Seq Scan, Index Scan, Hash Join 등)',
  'Relation Name':       '스캔 대상 테이블 이름',
  'Alias':               '쿼리에서 사용된 테이블 별칭',
  'Schema':              '테이블이 속한 스키마',
  'Join Type':           'JOIN 유형 (Inner, Left, Right, Full)',
  'Parent Relationship': '부모 노드와의 관계 (Outer, Inner, Subquery)',
  'Parallel Aware':      '병렬 실행 가능 여부',
  'Async Capable':       '비동기 실행 가능 여부',

  // Cost estimates
  'Startup Cost':        '첫 번째 행 반환 전 초기 비용',
  'Total Cost':          '전체 실행 예상 비용 (상대 단위)',
  'Plan Rows':           '반환 예상 행 수',
  'Plan Width':          '평균 행 크기 (bytes)',

  // EXPLAIN ANALYZE 실측 (있을 때만)
  'Actual Startup Time': '실제 첫 행 반환까지 시간 (ms)',
  'Actual Total Time':   '실제 전체 실행 시간 (ms)',
  'Actual Rows':         '실제 반환 행 수',
  'Actual Loops':        '실제 반복 실행 횟수',
  'Rows Removed by Filter': '필터 조건으로 제거된 행 수',

  // Scan/Join conditions
  'Filter':              '행 필터 조건',
  'Index Cond':          '인덱스 조건',
  'Hash Cond':           '해시 조인 조건',
  'Merge Cond':          '머지 조인 조건',
  'Recheck Cond':        '비트맵 스캔 재확인 조건',
  'Index Name':          '사용된 인덱스 이름',
  'Scan Direction':      '스캔 방향 (Forward, Backward)',

  // Sort/Group
  'Sort Key':            '정렬 기준 컬럼',
  'Sort Method':         '정렬 방법 (quicksort, top-N heapsort 등)',
  'Sort Space Used':     '정렬에 사용된 메모리 (kB)',
  'Sort Space Type':     '정렬 공간 유형 (Memory, Disk)',
  'Group Key':           '그룹핑 기준 컬럼',
  'Strategy':            '집계 전략 (Plain, Sorted, Hashed)',

  // Buffers (ANALYZE + BUFFERS)
  'Shared Hit Blocks':   '공유 버퍼 캐시 히트 블록 수',
  'Shared Read Blocks':  '디스크에서 읽은 공유 블록 수',
  'Shared Written Blocks': '디스크에 쓴 공유 블록 수',
  'Local Hit Blocks':    '로컬 버퍼 캐시 히트 블록 수',
  'Local Read Blocks':   '디스크에서 읽은 로컬 블록 수',
  'Temp Read Blocks':    '임시 파일에서 읽은 블록 수',
  'Temp Written Blocks': '임시 파일에 쓴 블록 수',

  // Hash
  'Hash Buckets':        '해시 버킷 수',
  'Hash Batches':        '해시 배치 수 (1이면 메모리 내 처리)',
  'Peak Memory Usage':   '최대 메모리 사용량 (kB)',

  // CTE / Subquery
  'CTE Name':            'CTE(WITH절) 이름',
  'Subplan Name':        '서브플랜 이름',
  'Output':              '출력 컬럼 목록',

  // Workers (parallel)
  'Workers Planned':     '계획된 병렬 워커 수',
  'Workers Launched':    '실제 시작된 병렬 워커 수',
};
```

### 4.2 MySQL / MariaDB 필드 설명 맵

```typescript
const MYSQL_FIELD_DESCRIPTIONS: Record<string, string> = {
  'access_type':           '테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)',
  'table_name':            '접근 대상 테이블',
  'key':                   '사용된 인덱스',
  'possible_keys':         '사용 가능한 인덱스 목록',
  'key_length':            '사용된 인덱스 키 길이 (bytes)',
  'rows_examined_per_scan': '스캔당 검사 행 수',
  'rows_produced_per_join': '조인당 생성 행 수',
  'filtered':              '테이블 조건으로 필터링된 행 비율 (%)',
  'cost_info':             '비용 정보',
  'query_cost':            '쿼리 전체 예상 비용',
  'read_cost':             '읽기 비용',
  'eval_cost':             '평가 비용',
  'prefix_cost':           '누적 비용',
  'used_columns':          '사용된 컬럼 목록',
  'attached_condition':    '적용된 WHERE 조건',
};
```

### 4.3 SQLite 필드 설명 맵

```typescript
const SQLITE_FIELD_DESCRIPTIONS: Record<string, string> = {
  'id':     '서브쿼리 번호 (0=메인 쿼리)',
  'parent': '부모 노드 ID',
  'notused': '미사용 필드',
  'detail': '실행 계획 상세 설명',
};
```

### 4.4 알 수 없는 필드

맵에 없는 필드는 description을 빈 문자열로 표시 (key + value만 표시, 설명 생략).

---

## 5. Data Flow 변경

### 5.1 현재 EXPLAIN 버튼 플로우 (문제점)

```
handleExplain → explain(sql)
  → buildExplainSql(dbType, sql)     // "EXPLAIN (FORMAT JSON) SELECT ..."
  → queryApi.execute(explainSql)
  → setResult(res.data)              // ← IQueryResult로 저장
  → DataGrid에 렌더링               // ← raw JSON 한 줄 표시
```

### 5.2 변경된 플로우

```
handleExplain → explain(sql)
  → queryApi.explainAnalyze({ connectionId, sql, dbType })   // 기존 백엔드 파싱 재사용
  → setExplainResult(res.data)      // ← IExplainResult로 저장
  → setResult(null)                 // ← DataGrid 표시 안함
  → setIsExplainOnly(true)
  → ExplainPlanView에 렌더링        // ← 새 Tree View 컴포넌트
```

핵심 변경:
1. `explain()`이 `queryApi.execute()` 대신 `queryApi.explainAnalyze()`를 호출하여 기존 백엔드 파싱 로직 재사용
2. 결과를 `result`가 아닌 `explainResult`에 저장
3. `isExplainOnly` 플래그로 EXPLAIN-only 모드 구분

### 5.3 IExplainResult & rawJson 형태

```typescript
// 기존 (변경 없음)
export interface IExplainResult {
  planRows: Record<string, unknown>[];
  summary: string;
  rawJson?: unknown;
}
```

`rawJson` 형태는 벤더에 따라 다름:
- **PostgreSQL**: `[{ "Plan": { "Node Type": "Seq Scan", ... , "Plans": [...] } }]` (배열)
- **MySQL/MariaDB**: `{ "query_block": { "table": { ... } } }` (객체)
- **SQLite**: `undefined` (SQLite는 JSON 형태가 아닌 `planRows` 사용)

`parsePlanJson()`은 이 차이를 처리하여 공통 `IPlanNode[]`로 정규화한다.

---

## 6. 컴포넌트 설계

### 6.1 ExplainPlanView (새 컴포넌트)

```
src/renderer/features/query-browser/ui/ExplainPlanView.tsx
```

```typescript
interface ExplainPlanViewProps {
  result: IExplainResult;
  dbType: TDbType;
}
```

- ExplainSummaryBanner를 상단에 포함
- 하위에 `PlanNodeTree` 재귀 컴포넌트 렌더링
- 스크롤 가능한 영역

### 6.2 PlanNodeTree (내부 재귀 컴포넌트)

```typescript
interface PlanNodeTreeProps {
  node: Record<string, unknown>;
  dbType: TDbType;
  depth: number;
  defaultExpanded?: boolean;
}
```

- `depth=0`인 루트 노드는 기본 펼침
- 나머지 노드는 기본 접힘
- 접기/펼치기는 로컬 state로 관리
- `Plans` 배열(PostgreSQL) / `nested_loop`·`attached_subqueries`(MySQL)를 재귀 렌더링

### 6.3 Plan JSON 파싱 유틸

```
src/shared/lib/explainPlanParser.ts
```

벤더별로 JSON 구조가 다르므로, 공통 노드 구조로 정규화:

```typescript
interface IPlanNode {
  nodeType: string;           // "Seq Scan", "Hash Join", etc.
  relationName?: string;      // table name
  properties: IPlanProperty[];
  children: IPlanNode[];
}

interface IPlanProperty {
  key: string;                // "Total Cost"
  value: unknown;             // 10.8
  description: string;        // "전체 실행 예상 비용 (상대 단위)"
  highlight?: boolean;        // Total Cost 등 강조 여부
}
```

파싱 함수:

```typescript
function parsePlanJson(raw: unknown, dbType: TDbType): IPlanNode[]
```

- **PostgreSQL**: `raw[0].Plan` → 재귀 `Plans` 배열
- **MySQL/MariaDB**: `raw.query_block` → `table`, `nested_loop`, `ordering_operation` 등
- **SQLite**: `planRows` 배열의 `detail` 필드 → 플랫 리스트 (트리 아님)

---

## 7. QueryTab 렌더링 로직 변경

### 현재 결과 영역 조건:

```
txState → DmlResultPanel
isDdlWarning → DmlResultPanel
hasSelectResult → DataGrid
isLoading → Spinner
```

### 변경 후:

```
txState → DmlResultPanel
isDdlWarning → DmlResultPanel
explainResult (EXPLAIN 버튼 결과) → ExplainPlanView   ← 추가
hasSelectResult → DataGrid
isLoading → Spinner
```

EXPLAIN 버튼 결과와 EXPLAIN ANALYZE(Run 동반) 결과를 구분하기 위해 `isExplainOnly` 플래그 추가:

```typescript
// useQueryExecution.ts
const [isExplainOnly, setIsExplainOnly] = useState(false);

// explain() 에서: setIsExplainOnly(true)
// execute() 에서: setIsExplainOnly(false)

// return에 추가:
return {
  result, explainResult, error, isLoading, txState, isDdlWarning,
  isExplainOnly,  // ← 추가
  execute, explain, confirm, rollback, dismissError,
};
```

QueryTab 조건:

```typescript
// ExplainSummaryBanner — EXPLAIN-only일 때는 ExplainPlanView 내부에서 렌더하므로 중복 방지
{!execution.isExplainOnly && execution.explainResult?.summary && (
  <ExplainSummaryBanner summary={execution.explainResult.summary} />
)}

// 결과 영역
execution.isExplainOnly && execution.explainResult
  ? <ExplainPlanView result={execution.explainResult} dbType={dbType} />
  : hasSelectResult
  ? <DataGrid ... />
  : ...
```

---

## 8. 변경 파일 요약

### 신규 파일
| File | Path | Purpose |
|------|------|---------|
| `ExplainPlanView.tsx` | `src/renderer/features/query-browser/ui/` | Tree View 메인 컴포넌트 |
| `explainPlanParser.ts` | `src/shared/lib/` | Plan JSON → IPlanNode 정규화 |
| `explainFieldDescriptions.ts` | `src/shared/lib/` | 벤더별 필드 설명 맵 |

### 수정 파일
| File | Change |
|------|--------|
| `useQueryExecution.ts` | `explain()` → result 대신 explainResult에 저장, `isExplainOnly` 플래그 |
| `QueryTab.tsx` | 결과 영역에 ExplainPlanView 조건 추가 |
| `db.ts` | 변경 없음 (IExplainResult 그대로 활용) |

### 변경 없는 파일
| File | Reason |
|------|--------|
| `ExplainSummaryBanner.tsx` | ExplainPlanView 내부에서 재사용 |
| `explainSql.ts` | EXPLAIN SQL 빌드 로직 그대로 |
| `queryApi.ts` | IPC 변경 없음 |
| `queryHandlers.ts` | 백엔드 변경 없음 |

---

## 9. SQLite 특수 처리

SQLite의 `EXPLAIN QUERY PLAN`은 JSON이 아닌 테이블 형태 (`id`, `parent`, `notused`, `detail`) 반환.
→ `detail` 컬럼의 텍스트를 플랫 리스트로 표시 (트리 중첩 없음, 각 행이 하나의 설명).

```
│ SCAN api_keys                                                │
│ SEARCH users USING INDEX idx_users_email (email=?)           │
```

**주의**: 현재 백엔드 `queryService.explainAnalyze()`는 SQLite에 대해 stub 응답을 반환함.
EXPLAIN 버튼은 `queryApi.explainAnalyze()`를 호출하므로, SQLite EXPLAIN 지원을 위해
백엔드에서 `EXPLAIN QUERY PLAN` 실행 후 `planRows`를 실제로 채워야 함.
→ 이 개선은 본 스펙의 구현 범위에 포함.

---

## 10. 에러 처리

| 상황 | 처리 |
|------|------|
| JSON 파싱 실패 | raw JSON을 코드 블록으로 fallback 표시 |
| 알 수 없는 DB type | `parsePlanJson`이 빈 배열 반환 → "Plan data unavailable" 메시지 |
| EXPLAIN 실행 실패 | 기존 에러 배너에 표시 (변경 없음) |
