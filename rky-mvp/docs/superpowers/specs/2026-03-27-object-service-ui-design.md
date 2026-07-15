# Object Service — UI/UX Design Spec

> Date: 2026-03-27
> Based on: 2026-03-23-full-db-console-ui-design.md (Phase 1: Object Browser 분리)
> Stack: React 18, Tailwind CSS, Radix UI, TanStack Table, Zustand, React Query

---

## 0. Design Philosophy

- **Object = 독립 탭** — Live Console의 5번째 탭으로 추가 (`Connection | Diagram | Data | Query | Object`)
- **읽기 전용 MVP** — 트리 탐색 + 오브젝트 상세 조회. 에디터/CRUD는 다음 단계
- **벤더 확장 가능** — Registry 패턴으로 벤더별 노드 구성. 새 벤더 추가 시 설정만 추가
- **종속 오브젝트 이중 표시** — 테이블 하위 서브 카테고리 + 최상위 독립 카테고리 둘 다
- **타입별 전용 상세 뷰** — 각 오브젝트 타입마다 맞춤 레이아웃

---

## 1. Scope

### In Scope (MVP)
- Object Tree 패널 (벤더별 동적 노드)
- Multi-Tab 상세 뷰 (타입별 전용 읽기 전용 뷰)
- 테이블 서브 카테고리 (Columns, Indexes, Triggers, Policies)
- 최상위 종속 오브젝트 카테고리 (소속 테이블 표시)
- 검색 필터
- PG 스키마 셀렉터 (Live Console 전역, ConnectionBadge 왼쪽)

### Out of Scope (Next Phase)
- 오브젝트 CRUD (Create, Alter, Drop)
- 컨텍스트 메뉴 액션 (View Data, Rename, Vacuum 등)
- Bottom Output Panel (SQL 실행 결과)
- Function/Trigger 에디터
- Data Ops (Export/Import)

---

## 2. Overall Layout

### 2-Panel + Multi-Tab 구조

```
┌──────────────────────────────────────────────────────────────────────┐
│ Connection │ Diagram │ Data │ Query │ Object   [Schema: public ▾] 🟢 prod-db [PG] │
├────────────────┬─────────────────────────────────────────────────────┤
│ Object Tree    │ ┌─ 🗂 users ─┐┌─ ⚡ get_user() ─┐                 │
│ (220px)        ├─┴────────────┴┴─────────────────┴──────────────────┤
│                │                                                     │
│ 🔍 Search...   │  Detail View (selected tab)                        │
│                │                                                     │
│ ▸ 🗂 Tables    │  Header: icon + name + schema badge + actions       │
│ ▸ 👁 Views     │  Sub-tabs: type-specific                            │
│ ▸ ⚡ Functions │  Content: key-value grid or table                   │
│ ...            │                                                     │
│                │                                                     │
│ [↻ Refresh]    │                                                     │
└────────────────┴─────────────────────────────────────────────────────┘
```

### 스키마 셀렉터 위치

기존 LiveConsoleLayout 상단 바에서 ConnectionBadge(`ml-auto`) 왼쪽에 배치.

```
[탭들]                              [Schema: public ▾] | 🟢 prod-db [PG]
```

- PG 접속: 스키마 셀렉터 표시 (사용자 스키마 기본, "Show system schemas" 토글)
- MySQL/MariaDB/SQLite 접속: 숨김
- 스키마 선택은 **Live Console 전역** — Object뿐 아니라 Diagram, Data, Query도 동일 스키마 컨텍스트 공유
- 스키마 필터 상세 설계는 별도 spec으로 분리

---

## 3. Vendor Registry

### Registry 구조

```typescript
interface IVendorObjectConfig {
  categories: TObjectCategoryDef[];
  tableChildren: TTableChildType[];
  hasSchemaFilter: boolean;
  showDbInfo?: boolean;  // SQLite only
}
```

### 벤더별 카테고리

| 카테고리 | PG | MySQL | MariaDB | SQLite |
|----------|:--:|:-----:|:-------:|:------:|
| Tables | O | O | O | O |
| Views | O | O | O | O |
| Materialized Views | O | - | - | - |
| Functions | O | O | O | - |
| Procedures | O | O | O | - |
| Triggers | O | O | O | O |
| Sequences | O | - | O | - |
| Events | - | O | O | - |
| Types | O | - | - | - |
| Extensions | O | - | - | - |
| Policies | O | - | - | - |
| Domains | O | - | - | - |

**카테고리 수**: PG 11 / MariaDB 7 / MySQL 6 / SQLite 3

### 테이블 서브 카테고리 (벤더별)

| 서브 카테고리 | PG | MySQL | MariaDB | SQLite |
|--------------|:--:|:-----:|:-------:|:------:|
| Columns | O | O | O | O |
| Indexes | O | O | O | O |
| Triggers | O | O | O | O |
| Policies | O | - | - | - |

### 오브젝트 종속 관계

**테이블 종속** (테이블 하위 서브 카테고리 + 최상위 독립 카테고리 둘 다 표시):
- Triggers
- Indexes
- Policies (PG only)

**독립** (최상위 카테고리에만 표시):
- Tables, Views, Materialized Views, Functions, Procedures, Sequences, Events, Types, Extensions, Domains

### 최상위 종속 오브젝트 표시

최상위 카테고리에서 종속 오브젝트는 소속 테이블을 뱃지로 표시:

```
▾ ⏰ Triggers (12)
    trg_audit_log    [users]
    trg_update_ts    [orders]
    trg_stock_check  [products]
```

### 새 벤더 추가 시

Registry에 설정 객체만 추가하면 트리/상세 뷰가 자동 구성:

```typescript
vendorRegistry['newdb'] = {
  categories: [...],
  tableChildren: [...],
  hasSchemaFilter: false,
};
```

---

## 4. Object Tree Panel

### Spec

- Width: 220px (고정, 추후 리사이즈 가능)
- 상단: 검색 필터 (오브젝트 이름 기준 필터링)
- 중앙: 벤더별 카테고리 트리
- 하단: Refresh 버튼
- SQLite: 트리 하단에 DB Info 섹션 (파일 경로, 크기, 버전, 페이지 사이즈)

### 트리 노드 구조

```
▸ 🗂 Tables (42)           ← 카테고리 (클릭: 확장/축소)
  ▾ users                  ← 오브젝트 (클릭: 탭 열기)
    ▸ Columns (5)          ← 서브 카테고리 (클릭: 확장/축소)
      🔑 id  int4          ← 컬럼 (PK 아이콘)
      · email  varchar     ← 컬럼 (일반)
      → role_id  int4      ← 컬럼 (FK 아이콘)
    ▸ Indexes (2)
    ▸ Triggers (1)
    ▸ Policies (1)         ← PG only
  ▸ orders
  ▸ products
```

### 카테고리 아이콘

| Type | Icon (lucide-react) | Emoji (fallback) |
|------|-------------------|------------------|
| Table | Table2 | 🗂 |
| View | Eye | 👁 |
| Materialized View | Layers | 🔮 |
| Function | Zap | ⚡ |
| Procedure | ScrollText | 📜 |
| Trigger | Timer | ⏰ |
| Sequence | Hash | 🔢 |
| Event | CalendarClock | 📅 |
| Type | Tag | 🏷 |
| Extension | Puzzle | 🧩 |
| Policy | Shield | 🛡 |
| Domain | Globe | 🌐 |

### 컬럼 아이콘

| 상태 | 표시 |
|------|------|
| Primary Key | 🔑 |
| Foreign Key | → |
| 일반 컬럼 | · |

### 검색 동작

- 오브젝트 이름 기준 필터링 (카테고리 이름 제외)
- 매치되는 항목의 부모 카테고리 자동 확장
- 매치 없는 카테고리는 숨김
- 실시간 필터 (debounce 200ms)

### 카운트 뱃지

- 각 카테고리 옆에 오브젝트 수 표시: `Tables (42)`
- 서브 카테고리에도 표시: `Columns (5)`, `Indexes (2)`

---

## 5. Multi-Tab System

### 탭 바

```
┌─ 🗂 users ─┐┌─ ⚡ get_user() ─┐┌─ ⏰ trg_audit ─┐
└─────────────┘└─────────────────┘└────────────────┘
```

### 탭 동작

- 트리에서 오브젝트 클릭 → 탭 생성 (이미 열려있으면 활성화)
- 클릭: 탭 활성화
- 중클릭 (마우스 휠): 탭 닫기
- 탭 ✕ 버튼: 탭 닫기
- 탭 우클릭: Close / Close Others / Close All (추후)

### 탭 아이콘

카테고리 아이콘과 동일. 탭 라벨에 오브젝트 이름 표시.

| Type | Tab Label 예시 |
|------|----------------|
| Table | 🗂 users |
| Function | ⚡ get_user() |
| Procedure | 📜 create_order() |
| Trigger | ⏰ trg_audit |
| Sequence | 🔢 users_id_seq |
| View | 👁 active_users |
| Event | 📅 cleanup_job |

### Empty State

탭이 없을 때 우측 영역:

```
Select an object to view details
```

---

## 6. Detail Views

### 공통 패턴

모든 Detail View는 동일한 구조:

```
┌──────────────────────────────────────────────────────┐
│ [Icon] ObjectName  [schema badge]    [📜 DDL] [📋 Copy] │  ← Header
├──────────────────────────────────────────────────────┤
│ [Tab1] [Tab2] [Tab3] ...                              │  ← Sub-tabs (type-specific)
├──────────────────────────────────────────────────────┤
│                                                       │
│  Content (key-value grid or data table)               │  ← Content
│                                                       │
└──────────────────────────────────────────────────────┘
```

- Header: 아이콘 + 이름 + 스키마 뱃지 (PG) + 액션 버튼 (DDL, Copy Name)
- Sub-tabs: 오브젝트 타입별 다른 탭 구성
- Content: key-value 그리드 (Info) 또는 데이터 테이블 (Columns, Indexes 등)

### 6.1 Table Detail

**Header**: 🗂 + 테이블명 + 스키마 뱃지 + [DDL] [Copy Name]

**Sub-tabs (벤더별)**:

| Tab | PG | MySQL | MariaDB | SQLite |
|-----|:--:|:-----:|:-------:|:------:|
| Columns | O | O | O | O |
| Constraints | O | - | - | - |
| Indexes | O | O | O | O |
| Triggers | O | O | O | O |
| Statistics | O | O | O | - |
| DDL | O | O | O | O |
| PRAGMA | - | - | - | O |

**Columns Tab**:

| 컬럼 | 설명 |
|------|------|
| # | 순번 |
| Name | 컬럼명 |
| Type | 데이터 타입 |
| Nullable | YES/NO |
| Default | 기본값 |
| PK | 🔑 (Primary Key) |
| FK | → (Foreign Key) |

**Constraints Tab (PG)**:

| 컬럼 | 설명 |
|------|------|
| Name | 제약조건명 |
| Type | PK / FK / UK / CHECK |
| Columns | 대상 컬럼 |
| References | FK 참조 대상 |

**Indexes Tab**:

| 컬럼 | 설명 |
|------|------|
| Name | 인덱스명 |
| Columns | 대상 컬럼 |
| Type | BTREE / HASH / GIN / GiST 등 |
| Unique | YES/NO |

**Triggers Tab**:

| 컬럼 | 설명 |
|------|------|
| Name | 트리거명 |
| Timing | BEFORE / AFTER / INSTEAD OF |
| Events | INSERT / UPDATE / DELETE |
| For Each | ROW / STATEMENT |

**Statistics Tab**:

| 항목 | 설명 |
|------|------|
| Row Count (est) | 추정 행 수 |
| Total Size | 전체 크기 |
| Data Size | 데이터 크기 |
| Index Size | 인덱스 크기 |
| Dead Tuples | dead tuple 수 (PG) |
| Last Analyzed | 마지막 분석 시간 |

**DDL Tab**: CREATE TABLE 문 전체 표시 (read-only CodeMirror, SQL syntax highlighting)

**PRAGMA Tab (SQLite only)**: table_info, foreign_key_list, index_list 결과를 테이블로 표시

### 6.2 View / Materialized View Detail

**Header**: 👁 또는 🔮 + 뷰명 + 스키마 뱃지

**Sub-tabs**:

| Tab | View | Materialized View |
|-----|:----:|:-----------------:|
| Columns | O | O |
| Indexes | - | O |
| Statistics | - | O |
| DDL | O | O |

### 6.3 Function / Procedure Detail

**Header**: ⚡ 또는 📜 + 함수명 + 시그니처 (파라미터 → 리턴 타입)

**Sub-tabs**: Info, Parameters, Source, DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Language | plpgsql / sql / javascript (MySQL) |
| Return Type | 리턴 타입 (Function만) |
| Volatility | IMMUTABLE / STABLE / VOLATILE (PG) |
| Security | INVOKER / DEFINER |
| Owner | 소유자 |

**Parameters Tab**:

| 컬럼 | 설명 |
|------|------|
| # | 순번 |
| Name | 파라미터명 |
| Type | 데이터 타입 |
| Mode | IN / OUT / INOUT |
| Default | 기본값 |

**Source Tab**: 함수 본문 (read-only CodeMirror, SQL/PLpgSQL syntax highlighting)

### 6.4 Trigger Detail

**Header**: ⏰ + 트리거명 + 소속 테이블 뱃지

**Sub-tabs**: Info, Function (PG) / Source (MySQL), DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Table | 소속 테이블 |
| Timing | BEFORE / AFTER |
| Events | INSERT, UPDATE, DELETE |
| For Each | ROW / STATEMENT |
| Function | 실행 함수명 (PG — 클릭 시 해당 함수 탭 열기) |
| Enabled | Yes / No (PG) |
| Condition | WHEN 조건 (있을 경우) |

### 6.5 Sequence Detail

**Header**: 🔢 + 시퀀스명

**탭 없음** — 단일 key-value 뷰:

| 항목 | 설명 |
|------|------|
| Current Value | 현재 값 |
| Start Value | 시작 값 |
| Increment | 증가분 |
| Min Value | 최소값 |
| Max Value | 최대값 |
| Cycle | 순환 여부 |
| Cache Size | 캐시 크기 |
| Owned By | 소속 컬럼 (table.column) |

### 6.6 Event Detail (MySQL/MariaDB)

**Header**: 📅 + 이벤트명

**Sub-tabs**: Info, Source, DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Status | ENABLED / DISABLED |
| Schedule | EVERY / AT |
| Interval | 실행 간격 |
| Starts / Ends | 시작/종료 시간 |
| Last Executed | 마지막 실행 시간 |
| Next Execution | 다음 실행 시간 |

### 6.7 Type Detail (PG)

**Header**: 🏷 + 타입명

**Sub-tabs**: Info, DDL

**Info Tab**: 타입 종류에 따라 다른 내용:
- Enum: 값 목록
- Composite: 필드 목록 (이름 + 타입)
- Range: 서브 타입, 연산자 클래스

### 6.8 Extension Detail (PG)

**Header**: 🧩 + 확장명

**Sub-tabs**: Info, Objects, DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Version | 설치된 버전 |
| Default Version | 사용 가능한 최신 버전 |
| Description | 설명 |
| Schema | 설치된 스키마 |
| Relocatable | 이동 가능 여부 |

**Objects Tab**: 확장이 소유한 오브젝트 목록 (함수, 타입, 연산자 등)

### 6.9 Policy Detail (PG)

**Header**: 🛡 + 정책명 + 소속 테이블 뱃지

**Sub-tabs**: Info, DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Table | 소속 테이블 |
| Command | SELECT / INSERT / UPDATE / DELETE / ALL |
| Permissive | PERMISSIVE / RESTRICTIVE |
| Roles | 적용 대상 역할 |
| USING | 읽기 조건 표현식 |
| WITH CHECK | 쓰기 조건 표현식 |

### 6.10 Domain Detail (PG)

**Header**: 🌐 + 도메인명

**Sub-tabs**: Info, DDL

**Info Tab (key-value)**:

| 항목 | 설명 |
|------|------|
| Base Type | 기반 타입 |
| Default | 기본값 |
| Nullable | NOT NULL 여부 |
| Collation | 정렬 규칙 |
| Constraints | CHECK 제약조건 목록 |

---

## 7. SQLite Specific

### DB Info 섹션

트리 하단에 고정 표시:

```
── DB Info ──
📄 File: ~/data/app.db
📏 Size: 24.3 MB
🔖 SQLite 3.45.0
📐 Page Size: 4096
📊 Page Count: 6,225
```

### Table Detail 차이

- Constraints 탭 없음 (PRAGMA로 대체)
- Statistics 탭 없음
- PRAGMA 탭 추가: table_info, foreign_key_list, index_list, table_xinfo

---

## 8. Empty / Error States

### 오브젝트 없음

카테고리 확장 시 오브젝트가 없으면:

```
▾ 🗂 Tables (0)
    No tables found
```

### 연결 안 됨

Object 탭 전체에 안내 화면:

```
┌──────────────────────────────────┐
│  No active connection            │
│  Go to Connection tab to connect │
└──────────────────────────────────┘
```

### 로딩

트리 카테고리 확장 시 로딩 중:

```
▾ 🗂 Tables
    Loading...
```

---

## 9. Data Flow

```
Object Tree (UI)
  ↓ click category
useObjectTree hook (fetch object list)
  ↓
objectBrowserApi (IPC wrapper)
  ↓
SCHEMA_OBJECTS_FETCH channel (main process)
  ↓
DB introspection query
  ↓
Result → hook state → tree re-render

Object Detail (UI)
  ↓ click object in tree
useObjectDetail hook (fetch detail data)
  ↓
objectBrowserApi (IPC wrapper)
  ↓
SCHEMA_OBJECT_DDL + type-specific queries
  ↓
Result → detail view render
```

---

## 10. File Structure

```
src/renderer/
├── features/
│   └── object-browser/
│       ├── api/
│       │   └── objectBrowserApi.ts         # IPC wrapper
│       ├── model/
│       │   ├── objectBrowserStore.ts        # Zustand store
│       │   ├── useObjectTree.ts             # Tree data hook
│       │   ├── useObjectDetail.ts           # Detail data hook
│       │   └── vendorRegistry.ts            # Vendor config registry
│       ├── ui/
│       │   ├── ObjectTree.tsx               # Left tree panel
│       │   ├── ObjectTabBar.tsx             # Multi-tab bar
│       │   ├── ObjectDetailRouter.tsx       # Route to type-specific view
│       │   ├── details/
│       │   │   ├── TableDetail.tsx
│       │   │   ├── ViewDetail.tsx
│       │   │   ├── FunctionDetail.tsx
│       │   │   ├── TriggerDetail.tsx
│       │   │   ├── SequenceDetail.tsx
│       │   │   ├── EventDetail.tsx
│       │   │   ├── TypeDetail.tsx
│       │   │   ├── ExtensionDetail.tsx
│       │   │   ├── PolicyDetail.tsx
│       │   │   └── DomainDetail.tsx
│       │   └── shared/
│       │       ├── DetailHeader.tsx          # Common header
│       │       ├── DetailSubTabs.tsx         # Common sub-tab bar
│       │       ├── KeyValueGrid.tsx          # Key-value display
│       │       └── EmptyState.tsx            # Empty/error states
│       ├── lib/
│       │   └── vendorConfig.ts              # Vendor registry data
│       └── index.ts
├── pages/
│   └── db-object-browser/
│       └── ui/
│           └── ObjectBrowserPage.tsx        # Page component
```

---

## 11. Store Design

```typescript
interface ObjectBrowserState {
  // Tree state
  expandedCategories: Set<string>;
  expandedObjects: Set<string>;    // table sub-categories
  searchFilter: string;

  // Tab state
  openTabs: IObjectTab[];
  activeTabId: string | null;

  // Actions
  toggleCategory: (categoryId: string) => void;
  toggleObject: (objectId: string) => void;
  setSearchFilter: (filter: string) => void;
  openTab: (tab: IObjectTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

interface IObjectTab {
  id: string;            // `${type}:${schema}.${name}`
  type: TObjectType;
  name: string;
  schema?: string;       // PG only
  icon: string;
  label: string;
}
```

---

## 12. Route Integration

### constants.ts 추가

```typescript
LIVE_CONSOLE: {
  // ... existing
  OBJECT: '/db/console/object',
}
```

### LiveConsoleLayout.tsx 탭 추가

```typescript
{ id: 'object', label: 'Object', icon: Database, path: ROUTES.DB.LIVE_CONSOLE.OBJECT, disabled: !hasConnection }
```

---

## 13. Implementation Phases

### Phase 0: Infrastructure
1. Route 추가 + LiveConsoleLayout 탭 등록
2. objectBrowserStore (Zustand)
3. vendorRegistry 설정 데이터
4. ObjectBrowserPage 페이지 컴포넌트

### Phase 1: Object Tree
1. ObjectTree 컴포넌트 (카테고리 + 오브젝트 목록)
2. 검색 필터
3. 테이블 서브 카테고리 (Columns, Indexes, Triggers, Policies)
4. 최상위 종속 오브젝트 (소속 테이블 뱃지)
5. SQLite DB Info 섹션
6. useObjectTree hook + objectBrowserApi

### Phase 2: Multi-Tab + Detail Views
1. ObjectTabBar + 탭 관리
2. DetailHeader + DetailSubTabs 공통 컴포넌트
3. TableDetail (Columns, Constraints, Indexes, Triggers, Statistics, DDL, PRAGMA)
4. FunctionDetail / ProcedureDetail
5. TriggerDetail
6. SequenceDetail
7. ViewDetail / MaterializedViewDetail
8. EventDetail
9. TypeDetail / ExtensionDetail / PolicyDetail / DomainDetail
10. EmptyState / Error 처리
