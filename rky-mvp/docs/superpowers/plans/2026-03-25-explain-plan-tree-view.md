# EXPLAIN Plan Tree View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw JSON DataGrid display with an interactive collapsible Tree View for EXPLAIN results, including per-field Korean descriptions.

**Architecture:** Frontend-only parser normalizes vendor-specific JSON into `IPlanNode[]`. New `ExplainPlanView` component renders the tree recursively with collapsible nodes. `useQueryExecution.explain()` switches from `queryApi.execute()` to `queryApi.explainAnalyze()` to reuse backend parsing. An `isExplainOnly` flag distinguishes EXPLAIN-button results from Run-with-EXPLAIN-ANALYZE.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-explain-plan-tree-view-design.md`

---

### Task 1: Field Descriptions Map

**Files:**
- Create: `src/shared/lib/explainFieldDescriptions.ts`
- Test: `src/shared/lib/explainFieldDescriptions.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/shared/lib/explainFieldDescriptions.test.ts
import { describe, it, expect } from 'vitest';
import { getFieldDescription } from './explainFieldDescriptions';

describe('getFieldDescription', () => {
  it('returns PG description for known field', () => {
    expect(getFieldDescription('Total Cost', 'postgresql')).toBe('전체 실행 예상 비용 (상대 단위)');
  });
  it('returns MySQL description for known field', () => {
    expect(getFieldDescription('access_type', 'mysql')).toBe('테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)');
  });
  it('returns MariaDB description (shared with MySQL)', () => {
    expect(getFieldDescription('access_type', 'mariadb')).toBe('테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)');
  });
  it('returns SQLite description for known field', () => {
    expect(getFieldDescription('detail', 'sqlite')).toBe('실행 계획 상세 설명');
  });
  it('returns empty string for unknown field', () => {
    expect(getFieldDescription('SomeRandomKey', 'postgresql')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/lib/explainFieldDescriptions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement explainFieldDescriptions.ts**

Create `src/shared/lib/explainFieldDescriptions.ts` with:
- `PG_FIELD_DESCRIPTIONS` — all PostgreSQL fields from spec Section 4.1
- `MYSQL_FIELD_DESCRIPTIONS` — all MySQL/MariaDB fields from spec Section 4.2
- `SQLITE_FIELD_DESCRIPTIONS` — all SQLite fields from spec Section 4.3
- `getFieldDescription(key: string, dbType: TDbType): string` — lookup function
- `HIGHLIGHT_FIELDS` set — fields that get visual emphasis (`'Total Cost'`, `'Actual Total Time'`)

```typescript
import type { TDbType } from '~/shared/types/db';

const PG_FIELD_DESCRIPTIONS: Record<string, string> = {
  'Node Type': '실행 노드 유형 (Seq Scan, Index Scan, Hash Join 등)',
  'Relation Name': '스캔 대상 테이블 이름',
  'Alias': '쿼리에서 사용된 테이블 별칭',
  'Schema': '테이블이 속한 스키마',
  'Join Type': 'JOIN 유형 (Inner, Left, Right, Full)',
  'Parent Relationship': '부모 노드와의 관계 (Outer, Inner, Subquery)',
  'Parallel Aware': '병렬 실행 가능 여부',
  'Async Capable': '비동기 실행 가능 여부',
  'Startup Cost': '첫 번째 행 반환 전 초기 비용',
  'Total Cost': '전체 실행 예상 비용 (상대 단위)',
  'Plan Rows': '반환 예상 행 수',
  'Plan Width': '평균 행 크기 (bytes)',
  'Actual Startup Time': '실제 첫 행 반환까지 시간 (ms)',
  'Actual Total Time': '실제 전체 실행 시간 (ms)',
  'Actual Rows': '실제 반환 행 수',
  'Actual Loops': '실제 반복 실행 횟수',
  'Rows Removed by Filter': '필터 조건으로 제거된 행 수',
  'Filter': '행 필터 조건',
  'Index Cond': '인덱스 조건',
  'Hash Cond': '해시 조인 조건',
  'Merge Cond': '머지 조인 조건',
  'Recheck Cond': '비트맵 스캔 재확인 조건',
  'Index Name': '사용된 인덱스 이름',
  'Scan Direction': '스캔 방향 (Forward, Backward)',
  'Sort Key': '정렬 기준 컬럼',
  'Sort Method': '정렬 방법 (quicksort, top-N heapsort 등)',
  'Sort Space Used': '정렬에 사용된 메모리 (kB)',
  'Sort Space Type': '정렬 공간 유형 (Memory, Disk)',
  'Group Key': '그룹핑 기준 컬럼',
  'Strategy': '집계 전략 (Plain, Sorted, Hashed)',
  'Shared Hit Blocks': '공유 버퍼 캐시 히트 블록 수',
  'Shared Read Blocks': '디스크에서 읽은 공유 블록 수',
  'Shared Written Blocks': '디스크에 쓴 공유 블록 수',
  'Local Hit Blocks': '로컬 버퍼 캐시 히트 블록 수',
  'Local Read Blocks': '디스크에서 읽은 로컬 블록 수',
  'Temp Read Blocks': '임시 파일에서 읽은 블록 수',
  'Temp Written Blocks': '임시 파일에 쓴 블록 수',
  'Hash Buckets': '해시 버킷 수',
  'Hash Batches': '해시 배치 수 (1이면 메모리 내 처리)',
  'Peak Memory Usage': '최대 메모리 사용량 (kB)',
  'CTE Name': 'CTE(WITH절) 이름',
  'Subplan Name': '서브플랜 이름',
  'Output': '출력 컬럼 목록',
  'Workers Planned': '계획된 병렬 워커 수',
  'Workers Launched': '실제 시작된 병렬 워커 수',
};

const MYSQL_FIELD_DESCRIPTIONS: Record<string, string> = {
  'access_type': '테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)',
  'table_name': '접근 대상 테이블',
  'key': '사용된 인덱스',
  'possible_keys': '사용 가능한 인덱스 목록',
  'key_length': '사용된 인덱스 키 길이 (bytes)',
  'rows_examined_per_scan': '스캔당 검사 행 수',
  'rows_produced_per_join': '조인당 생성 행 수',
  'filtered': '테이블 조건으로 필터링된 행 비율 (%)',
  'cost_info': '비용 정보',
  'query_cost': '쿼리 전체 예상 비용',
  'read_cost': '읽기 비용',
  'eval_cost': '평가 비용',
  'prefix_cost': '누적 비용',
  'used_columns': '사용된 컬럼 목록',
  'attached_condition': '적용된 WHERE 조건',
};

const SQLITE_FIELD_DESCRIPTIONS: Record<string, string> = {
  'id': '서브쿼리 번호 (0=메인 쿼리)',
  'parent': '부모 노드 ID',
  'notused': '미사용 필드',
  'detail': '실행 계획 상세 설명',
};

export const HIGHLIGHT_FIELDS = new Set(['Total Cost', 'Actual Total Time']);

export function getFieldDescription(key: string, dbType: TDbType): string {
  if (dbType === 'postgresql') return PG_FIELD_DESCRIPTIONS[key] ?? '';
  if (dbType === 'mysql' || dbType === 'mariadb') return MYSQL_FIELD_DESCRIPTIONS[key] ?? '';
  if (dbType === 'sqlite') return SQLITE_FIELD_DESCRIPTIONS[key] ?? '';
  return '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/lib/explainFieldDescriptions.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/explainFieldDescriptions.ts src/shared/lib/explainFieldDescriptions.test.ts
git commit -m "feat(query-browser): add EXPLAIN field descriptions for all vendors"
```

---

### Task 2: Plan JSON Parser

**Files:**
- Create: `src/shared/lib/explainPlanParser.ts`
- Test: `src/shared/lib/explainPlanParser.test.ts`

**Context:** The backend `queryService.explainAnalyze()` returns `IExplainResult` where:
- `planRows`: raw result rows from `EXPLAIN` query
- `rawJson`: for PostgreSQL = `{ 'QUERY PLAN': [{ Plan: { ... } }] }` (first row object), for MySQL = first row object containing JSON string, for SQLite = `undefined`
- `summary`: pre-parsed summary string

This parser converts `IExplainResult` into `IPlanNode[]` for tree rendering.

- [ ] **Step 1: Write the test**

```typescript
// src/shared/lib/explainPlanParser.test.ts
import { describe, it, expect } from 'vitest';
import { parsePlanNodes } from './explainPlanParser';
import type { IExplainResult } from '~/shared/types/db';

describe('parsePlanNodes', () => {
  it('parses PostgreSQL simple plan', () => {
    const result: IExplainResult = {
      planRows: [{ 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'api_keys',
        'Startup Cost': 0,
        'Total Cost': 10.8,
        'Plan Rows': 80,
        'Plan Width': 983,
        'Parallel Aware': false,
        'Async Capable': false,
      }}] }],
      summary: 'Seq Scan on api_keys',
      rawJson: { 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'api_keys',
        'Startup Cost': 0,
        'Total Cost': 10.8,
        'Plan Rows': 80,
        'Plan Width': 983,
        'Parallel Aware': false,
        'Async Capable': false,
      }}] },
    };

    const nodes = parsePlanNodes(result, 'postgresql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('Seq Scan');
    expect(nodes[0].relationName).toBe('api_keys');
    expect(nodes[0].children).toHaveLength(0);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.value).toBe(10.8);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.highlight).toBe(true);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.description).toBe('전체 실행 예상 비용 (상대 단위)');
  });

  it('parses PostgreSQL nested plan (Hash Join)', () => {
    const result: IExplainResult = {
      planRows: [{ 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Hash Join',
        'Hash Cond': '(u.id = o.user_id)',
        'Total Cost': 35.2,
        'Plan Rows': 120,
        'Plan Width': 100,
        'Startup Cost': 0,
        Plans: [
          { 'Node Type': 'Seq Scan', 'Relation Name': 'users', 'Total Cost': 12.5, 'Plan Rows': 50, 'Plan Width': 50, 'Startup Cost': 0 },
          { 'Node Type': 'Hash', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0,
            Plans: [
              { 'Node Type': 'Index Scan', 'Relation Name': 'orders', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0 },
            ],
          },
        ],
      }}] }],
      summary: 'Hash Join',
      rawJson: { 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Hash Join',
        'Hash Cond': '(u.id = o.user_id)',
        'Total Cost': 35.2,
        'Plan Rows': 120,
        'Plan Width': 100,
        'Startup Cost': 0,
        Plans: [
          { 'Node Type': 'Seq Scan', 'Relation Name': 'users', 'Total Cost': 12.5, 'Plan Rows': 50, 'Plan Width': 50, 'Startup Cost': 0 },
          { 'Node Type': 'Hash', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0,
            Plans: [
              { 'Node Type': 'Index Scan', 'Relation Name': 'orders', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0 },
            ],
          },
        ],
      }}] },
    };

    const nodes = parsePlanNodes(result, 'postgresql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('Hash Join');
    expect(nodes[0].children).toHaveLength(2);
    expect(nodes[0].children[0].nodeType).toBe('Seq Scan');
    expect(nodes[0].children[1].nodeType).toBe('Hash');
    expect(nodes[0].children[1].children).toHaveLength(1);
    expect(nodes[0].children[1].children[0].nodeType).toBe('Index Scan');
  });

  it('parses MySQL plan', () => {
    const mysqlJson = JSON.stringify({
      query_block: {
        select_id: 1,
        cost_info: { query_cost: '1.00' },
        table: {
          table_name: 'users',
          access_type: 'ALL',
          rows_examined_per_scan: 100,
          rows_produced_per_join: 100,
          filtered: '100.00',
          cost_info: { read_cost: '0.75', eval_cost: '10.00', prefix_cost: '1.00' },
        },
      },
    });
    const result: IExplainResult = {
      planRows: [{ EXPLAIN: mysqlJson }],
      summary: 'ALL on users',
      rawJson: { EXPLAIN: mysqlJson },
    };

    const nodes = parsePlanNodes(result, 'mysql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('ALL');
    expect(nodes[0].relationName).toBe('users');
    expect(nodes[0].properties.find(p => p.key === 'rows_examined_per_scan')?.value).toBe(100);
  });

  it('parses SQLite plan from planRows', () => {
    const result: IExplainResult = {
      planRows: [
        { id: 0, parent: 0, notused: 0, detail: 'SCAN api_keys' },
        { id: 0, parent: 0, notused: 0, detail: 'SEARCH users USING INDEX idx_email' },
      ],
      summary: 'SCAN api_keys → SEARCH users',
    };

    const nodes = parsePlanNodes(result, 'sqlite');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].nodeType).toBe('SCAN api_keys');
    expect(nodes[0].children).toHaveLength(0);
  });

  it('returns empty array for empty result', () => {
    const result: IExplainResult = { planRows: [], summary: '' };
    expect(parsePlanNodes(result, 'postgresql')).toEqual([]);
  });

  it('returns empty array on parse error', () => {
    const result: IExplainResult = { planRows: [{ garbage: 'data' }], summary: '', rawJson: { garbage: true } };
    expect(parsePlanNodes(result, 'postgresql')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/lib/explainPlanParser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement explainPlanParser.ts**

Create `src/shared/lib/explainPlanParser.ts`:

```typescript
import type { TDbType, IExplainResult } from '~/shared/types/db';
import { getFieldDescription, HIGHLIGHT_FIELDS } from './explainFieldDescriptions';

export interface IPlanNode {
  nodeType: string;
  relationName?: string;
  properties: IPlanProperty[];
  children: IPlanNode[];
}

export interface IPlanProperty {
  key: string;
  value: unknown;
  description: string;
  highlight?: boolean;
}

// Keys that represent child nodes, not properties
const PG_CHILD_KEYS = new Set(['Plans']);
// Keys already extracted to nodeType / relationName header
const PG_HEADER_KEYS = new Set(['Node Type', 'Relation Name']);

export function parsePlanNodes(result: IExplainResult, dbType: TDbType): IPlanNode[] {
  try {
    if (dbType === 'sqlite') return parseSqliteNodes(result);
    if (dbType === 'postgresql') return parsePgNodes(result);
    if (dbType === 'mysql' || dbType === 'mariadb') return parseMysqlNodes(result);
    return [];
  } catch {
    return [];
  }
}

function parsePgNodes(result: IExplainResult): IPlanNode[] {
  // rawJson is the first row: { 'QUERY PLAN': [{ Plan: { ... } }] }
  const raw = result.rawJson as Record<string, unknown> | undefined;
  const queryPlan = raw?.['QUERY PLAN'];
  const plans = Array.isArray(queryPlan)
    ? queryPlan
    : (typeof queryPlan === 'string' ? JSON.parse(queryPlan) : null);
  if (!plans?.[0]?.Plan) return [];
  return [parsePgNode(plans[0].Plan)];
}

function parsePgNode(plan: Record<string, unknown>): IPlanNode {
  const nodeType = String(plan['Node Type'] ?? 'Unknown');
  const relationName = plan['Relation Name'] ? String(plan['Relation Name']) : undefined;
  const children: IPlanNode[] = Array.isArray(plan.Plans)
    ? plan.Plans.map((child: Record<string, unknown>) => parsePgNode(child))
    : [];

  const properties: IPlanProperty[] = [];
  for (const [key, value] of Object.entries(plan)) {
    if (PG_CHILD_KEYS.has(key) || PG_HEADER_KEYS.has(key)) continue;
    properties.push({
      key,
      value,
      description: getFieldDescription(key, 'postgresql'),
      highlight: HIGHLIGHT_FIELDS.has(key),
    });
  }

  return { nodeType, relationName, properties, children };
}

function parseMysqlNodes(result: IExplainResult): IPlanNode[] {
  // MySQL/MariaDB: rawJson is first row, value is JSON string
  const raw = result.rawJson as Record<string, unknown> | undefined;
  if (!raw) return [];
  const jsonStr = Object.values(raw)[0];
  const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  if (!parsed?.query_block) return [];
  return [parseMysqlBlock(parsed.query_block, 'mysql')];
}

function parseMysqlBlock(block: Record<string, unknown>, dbType: TDbType): IPlanNode {
  const table = block.table as Record<string, unknown> | undefined;
  const nodeType = table?.access_type ? String(table.access_type) : 'query_block';
  const relationName = table?.table_name ? String(table.table_name) : undefined;

  const children: IPlanNode[] = [];
  const nestedLoop = block.nested_loop as Record<string, unknown>[] | undefined;
  if (Array.isArray(nestedLoop)) {
    for (const item of nestedLoop) {
      if (item.table) children.push(parseMysqlBlock(item as Record<string, unknown>, dbType));
    }
  }
  const ordering = block.ordering_operation as Record<string, unknown> | undefined;
  if (ordering) children.push(parseMysqlBlock(ordering, dbType));

  const source = table ?? block;
  const properties: IPlanProperty[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (key === 'table' || key === 'nested_loop' || key === 'ordering_operation' || key === 'query_block') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Flatten cost_info etc.
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        properties.push({
          key: subKey,
          value: subVal,
          description: getFieldDescription(subKey, dbType),
          highlight: HIGHLIGHT_FIELDS.has(subKey),
        });
      }
    } else {
      properties.push({
        key,
        value,
        description: getFieldDescription(key, dbType),
        highlight: HIGHLIGHT_FIELDS.has(key),
      });
    }
  }

  return { nodeType, relationName, properties, children };
}

function parseSqliteNodes(result: IExplainResult): IPlanNode[] {
  return result.planRows
    .filter((row) => row.detail)
    .map((row) => ({
      nodeType: String(row.detail),
      properties: Object.entries(row)
        .filter(([key]) => key !== 'detail')
        .map(([key, value]) => ({
          key,
          value,
          description: getFieldDescription(key, 'sqlite'),
        })),
      children: [],
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/lib/explainPlanParser.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/explainPlanParser.ts src/shared/lib/explainPlanParser.test.ts
git commit -m "feat(query-browser): add EXPLAIN plan JSON parser with vendor normalization"
```

---

### Task 3: Modify useQueryExecution Hook

**Files:**
- Modify: `src/renderer/features/query-browser/model/useQueryExecution.ts`

**Context:** Currently `explain()` calls `queryApi.execute()` and stores result in `result` state. Change it to call `queryApi.explainAnalyze()` and store in `explainResult`. Add `isExplainOnly` flag.

- [ ] **Step 1: Add `isExplainOnly` state, remove unused import, update return**

In `useQueryExecution.ts`:
- Remove: `import { buildExplainSql } from '~/shared/lib/explainSql';` (no longer used after rewrite)
- Add: `const [isExplainOnly, setIsExplainOnly] = useState(false);` (after line 20)
- In `execute()` (line 31 area): add `setIsExplainOnly(false);` alongside existing reset statements
- Add `isExplainOnly` to the return object:

```typescript
return {
  result, explainResult, error, isLoading, txState, isDdlWarning,
  isExplainOnly,
  execute, explain, confirm, rollback, dismissError,
};
```

- [ ] **Step 2: Rewrite `explain()` function**

Replace the `explain` callback (lines 85-104) with:

```typescript
const explain = useCallback(async (sql: string) => {
  if (!dbType) return;
  setError(null);
  setResult(null);
  setExplainResult(null);
  setTxState(null);
  setIsDdlWarning(false);
  setIsExplainOnly(true);
  setIsLoading(true);

  try {
    const res = await queryApi.explainAnalyze({ connectionId, sql, dbType });
    if (!res.success) throw new Error((res as any).error ?? 'EXPLAIN failed');
    setExplainResult(res.data ?? null);
  } catch (e) {
    setError((e as Error).message);
  } finally {
    setIsLoading(false);
  }
}, [connectionId, dbType]);
```

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/query-browser/model/useQueryExecution.ts
git commit -m "refactor(query-browser): explain() uses explainAnalyze API with isExplainOnly flag"
```

---

### Task 4: ExplainPlanView Component

**Files:**
- Create: `src/renderer/features/query-browser/ui/ExplainPlanView.tsx`

**Context:** This component replaces DataGrid when `isExplainOnly` is true. It renders the summary banner at top, then the recursive tree of plan nodes. Uses `parsePlanNodes` from Task 2 and `ExplainSummaryBanner` (existing).

- [ ] **Step 1: Create ExplainPlanView.tsx**

```typescript
// src/renderer/features/query-browser/ui/ExplainPlanView.tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ExplainSummaryBanner } from './ExplainSummaryBanner';
import { parsePlanNodes, type IPlanNode, type IPlanProperty } from '~/shared/lib/explainPlanParser';
import type { IExplainResult, TDbType } from '~/shared/types/db';

interface ExplainPlanViewProps {
  result: IExplainResult;
  dbType: TDbType;
}

export function ExplainPlanView({ result, dbType }: ExplainPlanViewProps) {
  const nodes = parsePlanNodes(result, dbType);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {result.summary && <ExplainSummaryBanner summary={result.summary} />}
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {result.planRows.length > 0 ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-muted/30 p-4 text-xs">
              {JSON.stringify(result.rawJson ?? result.planRows, null, 2)}
            </pre>
          ) : (
            'Plan data unavailable'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {result.summary && <ExplainSummaryBanner summary={result.summary} />}
      <div className="flex-1 overflow-auto p-3">
        {nodes.map((node, i) => (
          <PlanNodeTree key={i} node={node} depth={0} defaultExpanded />
        ))}
      </div>
    </div>
  );
}

/* ---- Recursive tree node ---- */

interface PlanNodeTreeProps {
  node: IPlanNode;
  depth: number;
  defaultExpanded?: boolean;
}

function PlanNodeTree({ node, depth, defaultExpanded = false }: PlanNodeTreeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const hasProperties = node.properties.length > 0;
  const isExpandable = hasChildren || hasProperties;

  // Collapsed summary: cost + rows
  const costProp = node.properties.find((p) => p.key === 'Total Cost' || p.key === 'query_cost');
  const startupProp = node.properties.find((p) => p.key === 'Startup Cost');
  const rowsProp = node.properties.find((p) => p.key === 'Plan Rows' || p.key === 'rows_examined_per_scan');
  const collapsedSummary = [
    startupProp && costProp ? `cost=${startupProp.value}..${costProp.value}` : costProp ? `cost=${costProp.value}` : '',
    rowsProp ? `${rowsProp.value} rows` : '',
  ].filter(Boolean).join(' · ');

  // Find a representative condition for the header
  const condProp = node.properties.find((p) =>
    ['Hash Cond', 'Merge Cond', 'Index Cond', 'Filter', 'attached_condition'].includes(p.key),
  );

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-border pl-4' : ''}>
      {/* Node header */}
      <div className="flex items-center gap-1.5 py-0.5">
        {isExpandable ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="rounded bg-primary/15 px-2 py-px text-xs font-semibold text-primary">
          {node.nodeType}
        </span>
        {node.relationName && (
          <>
            <span className="text-xs text-muted-foreground">on</span>
            <span className="text-xs font-medium text-green-500">{node.relationName}</span>
          </>
        )}
        {!expanded && condProp && (
          <span className="text-[11px] text-muted-foreground">{String(condProp.value)}</span>
        )}
        {!expanded && collapsedSummary && (
          <span className="text-[11px] text-muted-foreground">{collapsedSummary}</span>
        )}
      </div>

      {/* Expanded: properties table + children */}
      {expanded && (
        <div className={depth >= 0 ? 'ml-5 border-l border-border pl-4' : ''}>
          {hasProperties && (
            <table className="mb-2 w-full border-collapse">
              <tbody>
                {node.properties.map((prop) => (
                  <PropertyRow key={prop.key} prop={prop} />
                ))}
              </tbody>
            </table>
          )}
          {node.children.map((child, i) => (
            <PlanNodeTree key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Property row ---- */

function PropertyRow({ prop }: { prop: IPlanProperty }) {
  const displayValue = Array.isArray(prop.value)
    ? prop.value.join(', ')
    : typeof prop.value === 'object' && prop.value !== null
      ? JSON.stringify(prop.value)
      : String(prop.value);

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="w-[150px] whitespace-nowrap py-1 pr-3 text-xs text-muted-foreground">
        {prop.key}
      </td>
      <td className={`w-[80px] py-1 text-xs tabular-nums ${prop.highlight ? 'font-semibold text-amber-500' : 'text-foreground'}`}>
        {displayValue}
      </td>
      {prop.description && (
        <td className="py-1 pl-3 text-[11px] text-muted-foreground/50">
          {prop.description}
        </td>
      )}
    </tr>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/query-browser/ui/ExplainPlanView.tsx
git commit -m "feat(query-browser): add ExplainPlanView tree component"
```

---

### Task 5: Wire Up QueryTab

**Files:**
- Modify: `src/renderer/features/query-browser/ui/QueryTab.tsx`

**Context:** Two changes:
1. Guard existing `ExplainSummaryBanner` to not render when `isExplainOnly` (prevents duplicate banner)
2. Add `ExplainPlanView` condition before `DataGrid` in the result area

- [ ] **Step 1: Add import**

At top of `QueryTab.tsx`, add:
```typescript
import { ExplainPlanView } from './ExplainPlanView';
```

- [ ] **Step 2: Guard ExplainSummaryBanner**

Change line 508 area from:
```tsx
{execution.explainResult?.summary && (
  <ExplainSummaryBanner summary={execution.explainResult.summary} />
)}
```
to:
```tsx
{!execution.isExplainOnly && execution.explainResult?.summary && (
  <ExplainSummaryBanner summary={execution.explainResult.summary} />
)}
```

- [ ] **Step 3: Add ExplainPlanView condition in result area**

In the result area ternary chain (line 532 area), add `ExplainPlanView` before `hasSelectResult`:

```tsx
) : execution.isExplainOnly && execution.explainResult ? (
  <ExplainPlanView result={execution.explainResult} dbType={dbType} />
) : hasSelectResult ? (
```

This inserts between the `isDdlWarning` check and the `hasSelectResult` check.

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/query-browser/ui/QueryTab.tsx
git commit -m "feat(query-browser): render ExplainPlanView instead of DataGrid for EXPLAIN results"
```

---

### Task 6: Fix SQLite Backend Stub

**Files:**
- Modify: `src/main/services/queryService.ts:128-129`

**Context:** Currently returns a stub `{ planRows: [], summary: 'SQLite EXPLAIN not yet supported' }`. Need to actually execute `EXPLAIN QUERY PLAN` and return real results. `executeQuery()` does NOT support SQLite — it only handles MySQL/MariaDB and PostgreSQL. SQLite uses `better-sqlite3` with synchronous `db.prepare().all()` pattern (see `schemaService.ts` for reference). Must use `createSqliteConnection` directly.

- [ ] **Step 1: Add SQLite imports if not present**

In `queryService.ts`, ensure these imports exist (add if missing):
```typescript
import { createSqliteConnection, closeSqliteConnection } from '#/infrastructure';
```

- [ ] **Step 2: Replace SQLite stub**

In `queryService.ts` `explainAnalyze()` method, replace lines 128-129:
```typescript
} else if (dbType === 'sqlite') {
  return { planRows: [], summary: 'SQLite EXPLAIN not yet supported', rawJson: undefined };
```
with:
```typescript
} else if (dbType === 'sqlite') {
  const db = createSqliteConnection({ database: config.database });
  try {
    const rows = db.prepare(explainSql).all() as Record<string, unknown>[];
    result = {
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      rowCount: rows.length,
      executionTimeMs: 0,
    };
  } finally {
    closeSqliteConnection(db);
  }
```

This uses the same `better-sqlite3` pattern as `schemaService.ts`, then flows to the existing `parseExplainSummary` call at line 134.

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main/services/queryService.ts
git commit -m "fix(query-browser): implement actual SQLite EXPLAIN QUERY PLAN execution"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type check entire project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify no lint issues in changed files**

Run: `npx eslint src/shared/lib/explainFieldDescriptions.ts src/shared/lib/explainPlanParser.ts src/renderer/features/query-browser/ui/ExplainPlanView.tsx src/renderer/features/query-browser/ui/QueryTab.tsx src/renderer/features/query-browser/model/useQueryExecution.ts`
Expected: No errors
