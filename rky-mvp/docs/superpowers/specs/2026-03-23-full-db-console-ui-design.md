# Full DB Console — UI/UX Design Spec

> Date: 2026-03-23
> Based on: 2026-03-23-full-db-console-feature-matrix.md
> Current Stack: React 18, Tailwind CSS, Radix UI, CodeMirror v6, TanStack Table, @dnd-kit, Zustand, React Query

---

## 0. Design Philosophy

- **기존 Query 서비스 100% 유지** — Query 탭은 AS-IS 그대로 보존
- **Console = 신규 탭** — Object CRUD, DBA, Monitor, Data Ops를 Console 탭에 통합
- **DBeaver-inspired but modern** — 트리 기반 오브젝트 브라우저 + 멀티탭 에디터
- **Progressive disclosure** — 벤더/권한에 따라 UI 동적 노출
- **Consistent patterns** — 모든 오브젝트에 동일한 CRUD 패턴 적용

---

## 1. Overall Layout

### 현재 (AS-IS) — 변경 없음
```
┌──────────────────────────────────────────────────────────────┐
│  Connection │ Diagram │ Data │ Query        [connection info] │
├──────────────────────────────────────────────────────────────┤
│  [Query] [Collection] [History]   ← sub-tabs                 │
├──────────┬───────────────────────────────────────────────────┤
│ FileTree │  SQL Editor + Results                    │ Schema │
│ (queries)│                                          │ Panel  │
│          │                                          │(toggle)│
└──────────┴───────────────────────────────────────────────────┘
```
**Query 탭은 기존 코드 그대로 유지. 수정/리팩토링 없음.**

### 신규: Console 탭 (TO-BE)
```
┌──────────────────────────────────────────────────────────────────────┐
│  Connection │ Diagram │ Data │ Query │ Console        [conn badge]   │
│                                (AS-IS)  (NEW)                        │
├────┬─────────────────────────────────────────────────────────────────┤
│ N  │  ┌─ Tab1 ─┐ ┌─ Tab2 ─┐ ┌─ Tab3 ─┐           [⌘K] [⚙]       │
│ A  ├──┴────────┴──┴────────┴──┴────────┴─────────────────────────────┤
│ V  │                                                                  │
│    │                    MAIN CONTENT AREA                              │
│ B  │              (selected tab's content)                            │
│ A  │                                                                  │
│ R  │                                                                  │
│    ├──────────────────────────────────────────────────────────────────┤
│    │  ⌄ Output │ Messages                     [height: resizable]    │
│    │  Result grid / execution messages                                │
└────┴──────────────────────────────────────────────────────────────────┘
```

### Query vs Console 역할 분리

| | Query (기존) | Console (신규) |
|---|---|---|
| **목적** | SQL 작성/실행/관리 | DB 오브젝트/관리/모니터링 |
| **대상 유저** | 개발자, DBA | DBA, 운영자 |
| **핵심 기능** | SQL Editor, Collection, History | Object CRUD, User/Grant, Session, Stats |
| **좌측 패널** | FileTree (쿼리/컬렉션) | Nav Bar + Side Panel (Object/DBA/Monitor) |
| **결과 표시** | 에디터 아래 인라인 | Bottom Output Panel |
| **상태 관리** | queryBrowserStore (기존) | consoleBrowserStore (신규) |

### 핵심 설계 원칙
1. **Query 탭 코드 zero-touch** — 기존 파일 수정 없음
2. **Console은 독립 feature** — `src/renderer/features/console-browser/` 신규
3. **공유 컴포넌트만 재사용** — DataGrid, CodeMirror, Dialog 등
4. **라우팅 추가** — `/db/console/admin` (Console 페이지)

---

## 2. Navigation Bar (Console 탭 좌측 아이콘 바)

> Console 탭 전용. Query 탭에는 영향 없음.

### Layout
```
┌────┐
│ 📦 │  ← Object Browser (스키마 오브젝트)
│ 👤 │  ← DBA (유저/권한)
│ 📊 │  ← Monitor (세션/성능/통계)
│ 📥 │  ← Data Ops (Import/Export)
│    │
│ ─  │  ← divider
│ ⚙ │  ← Console Settings
└────┘
```

### Spec
- Width: 40px (고정)
- 아이콘: lucide-react, size-4 (16px)
- Active 상태: `bg-accent`, `text-foreground`
- Hover: `bg-accent/50`
- Tooltip: 아이콘 hover 시 이름 표시
- 각 아이콘 클릭 → 좌측에 해당 패널 토글 (VSCode Activity Bar 방식)
- SQL 에디터는 Nav에 없음 — **Query 탭**에서 접근

### 아이콘-패널 매핑

| Icon | Panel | Width | Content | SQLite |
|------|-------|-------|---------|--------|
| Database | Object Browser | 240px | 스키마 오브젝트 트리 (기본 활성) | O |
| Users | DBA Panel | 240px | 유저/역할/권한 트리 | X (disabled) |
| Activity | Monitor Panel | 240px | 세션/통계/서버설정 | X (disabled) |
| ArrowDownToLine | Data Ops Panel | 240px | Export/Import/Dump/Restore | O (축소) |

---

## 3. Console 내 SQL 실행 (Self-Contained)

> Console은 Query 탭에 의존하지 않음. 모든 DDL/DML을 Console 내에서 자체 실행.

### Console 내 SQL 실행 흐름

| Console 액션 | 동작 |
|-------------|------|
| Object Browser에서 "View Data" 클릭 | Bottom Output Panel에서 `SELECT * FROM table LIMIT 50` 실행 + 결과 표시 |
| Object Browser에서 "Script as CREATE" | Bottom Output Panel의 SQL Preview에 DDL 표시 (read-only) |
| Object Editor에서 "Save" 클릭 | ALTER/CREATE 문 생성 → 확인 다이얼로그 → Bottom Output에서 실행 |
| Monitor에서 쿼리 복사 | 클립보드 복사 (Query 탭에서 직접 붙여넣기는 사용자 판단) |
| DBA에서 GRANT 적용 | 생성된 SQL Preview → 확인 → Bottom Output에서 실행 |

### Bottom Output Panel 확장

```
┌──────────────────────────────────────────────────────────────────┐
│ ⌄ [Results] [Messages] [SQL Preview]              [Clear] [⌃ Max]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── SQL Preview Tab (신규) ──                                    │
│  Console에서 생성된 DDL/DML을 미리보기 + 실행 버튼 제공            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ALTER TABLE public.users ADD COLUMN phone varchar(20);    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [📋 Copy]  [▶ Execute]  [✏ Edit in Query Tab]                   │
│              ↑ 여기서 바로 실행    ↑ 복잡한 수정이 필요할 때만 이동  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 핵심 원칙
1. **Console은 자체 완결** — CRUD 작업의 SQL 생성/미리보기/실행을 모두 Console 내에서 처리
2. **Query 탭 이동은 선택적** — "Edit in Query Tab" 버튼으로 복잡한 SQL 수정이 필요할 때만
3. **Bottom Output = 실행 허브** — Results(결과 그리드), Messages(로그), SQL Preview(생성된 SQL)

---

## 4. Object Browser Panel (Nav: 📦)

### 벤더에 따라 동적으로 노드 구성

```
┌────────────────────────┐
│ OBJECTS                │
├────────────────────────┤
│ 🔍 Search objects...   │
├────────────────────────┤
│ 📋 Schema: public  ▾  │  ← PG only (schema selector)
├────────────────────────┤
│ ▸ 🗂 Tables (42)       │
│ ▸ 👁 Views (8)         │
│ ▸ 🔮 Materialized (3)  │  ← PG only
│ ▸ ⚡ Functions (15)     │
│ ▸ 📜 Procedures (5)    │
│ ▸ ⏰ Triggers (12)     │
│ ▸ 🔢 Sequences (7)     │  ← PG + MariaDB
│ ▸ 📅 Events (2)        │  ← MySQL/MariaDB only
│ ▸ 🏷 Types (4)         │  ← PG only
│ ▸ 🧩 Extensions (6)    │  ← PG only
│ ▸ 🛡 Policies (3)      │  ← PG only
│ ▸ 🌐 Domains (1)       │  ← PG only
├────────────────────────┤
│ [↻ Refresh]            │
└────────────────────────┘
```

### SQLite Object Browser

> SQLite는 파일 기반 DB로 지원 오브젝트가 제한적.
> DBA/Monitor 기능 대부분 불가 — Object Browser + Data Ops만 활성.

```
┌────────────────────────┐
│ OBJECTS                │
├────────────────────────┤
│ 🔍 Search objects...   │
├────────────────────────┤
│ ▸ 🗂 Tables (15)       │
│ ▸ 👁 Views (3)         │
│ ▸ 📇 Indexes (8)       │  ← SQLite: 독립 카테고리로 표시
│ ▸ ⏰ Triggers (2)      │
├────────────────────────┤
│ ── DB Info ──          │
│ 📄 File: ~/data/app.db │
│ 📏 Size: 24.3 MB       │
│ 🔖 SQLite 3.45.0       │
│ 📐 Page Size: 4096     │
│ 📊 Page Count: 6,225   │
├────────────────────────┤
│ [↻ Refresh]            │
└────────────────────────┘
```

#### SQLite Table 컨텍스트 메뉴 (축소)
```
┌─────────────────────┐
│ 📝 Open Detail       │
│ 👁 View Data         │
│ 📋 Copy Name         │
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 🗑 Drop               │  ← ALTER TABLE 미지원 (SQLite 제약)
└─────────────────────┘
```
> SQLite는 `ALTER TABLE`이 매우 제한적(ADD COLUMN만 가능).
> Rename, Drop Column 등은 "recreate table" 워크플로우 필요 → MVP에서는 미지원, Script as CREATE로 대체.

#### SQLite Table Detail View (차이점)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🗂 users                              [📜 DDL] [🗑 DROP]         │
├──────────────────────────────────────────────────────────────────┤
│ [Columns] [Indexes] [Triggers] [DDL] [PRAGMA]                    │
│                                                                  │
│  ← Constraints 탭 없음 (PRAGMA로 대체)                            │
│  ← Statistics 탭 없음 (SQLite에 pg_stat 없음)                     │
│  ← PRAGMA 탭 추가 (SQLite 전용)                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ PRAGMA Tab (SQLite 전용) ──────────────────────────────────┐ │
│  │ table_info        │ 5 columns                               │ │
│  │ foreign_key_list   │ 1 FK → roles(id)                       │ │
│  │ index_list         │ 2 indexes                              │ │
│  │ table_xinfo        │ 5 columns (with hidden)                │ │
│  │                                                             │ │
│  │ [Run PRAGMA]  PRAGMA: [table_info ▾]  Table: [users]        │ │
│  │ ┌──────────────────────────────────────────────────────┐    │ │
│  │ │ cid │ name       │ type    │ notnull │ dflt │ pk     │    │ │
│  │ │─────┼────────────┼─────────┼─────────┼──────┼────────│    │ │
│  │ │ 0   │ id         │ INTEGER │ 1       │      │ 1      │    │ │
│  │ │ 1   │ email      │ TEXT    │ 1       │      │ 0      │    │ │
│  │ │ 2   │ name       │ TEXT    │ 0       │ NULL │ 0      │    │ │
│  │ └──────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### SQLite 전용 Index 카테고리

> PG/MySQL은 Index가 Table 하위에 표시되지만, SQLite는 독립 카테고리로도 노출.
> (SQLite에서 인덱스는 테이블과 별도로 `sqlite_master`에서 조회)

```
│ ▾ 📇 Indexes (8)       │
│   ├ idx_users_email    │  ← users 테이블
│   ├ idx_orders_date    │  ← orders 테이블
│   └ sqlite_autoindex_* │  ← 자동 생성 (UNIQUE 등)
```

#### SQLite Index 컨텍스트 메뉴
```
┌─────────────────────┐
│ 📝 Open Detail       │  ← PRAGMA index_info + index_xinfo
│ 📋 Copy Name         │
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

---

### 트리 확장 시

```
│ ▾ 🗂 Tables (42)       │
│   ├ users              │
│   │ ├ 🔑 id (int4)     │  ← PK icon
│   │ ├ → email (varchar)│  ← FK icon (→)
│   │ ├ · name (varchar) │
│   │ └ · created_at (ts)│
│   ├ orders             │
│   │ ├ 🔑 id (int4)     │
│   │ └ ...              │
│   └ products           │
```

### 오브젝트 상호작용

| Level | Action | Behavior |
|-------|--------|----------|
| 카테고리 (Tables, Functions 등) | 클릭 | 트리 확장/축소 |
| 카테고리 | 우클릭 | Create New + Refresh |
| 오브젝트 (users, get_user 등) | 클릭 | 탭 열기 (상세/에디터) |
| 오브젝트 | 우클릭 | 타입별 컨텍스트 메뉴 (아래) |
| 컬럼 | 클릭 | Query 탭 활성 에디터에 컬럼명 삽입 |

### 컨텍스트 메뉴 (오브젝트 타입별)

#### 카테고리 헤더 (모든 타입 공통)
```
┌─────────────────────┐
│ ＋ Create New...     │
│ ↻ Refresh           │
└─────────────────────┘
```

#### Table / View
```
┌─────────────────────┐
│ 📝 Open Detail       │  ← 탭 열기 (Columns, Constraints, DDL 등)
│ 👁 View Data         │  ← Query 탭에서 SELECT * LIMIT 50
│ 📋 Copy Name         │
│ ─────────────────── │
│ 📜 Script as CREATE  │  ← DDL 클립보드 복사
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 📊 Statistics        │  ← 행 수, 크기, dead tuple 등
│ 🧹 Vacuum / Optimize │  ← PG: VACUUM / MySQL: OPTIMIZE TABLE
│ ─────────────────── │
│ ✏️ Rename             │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Materialized View (PG only)
```
┌─────────────────────┐
│ 📝 Open Detail       │
│ 👁 View Data         │
│ 📋 Copy Name         │
│ ─────────────────── │
│ 🔄 Refresh Data      │  ← REFRESH MATERIALIZED VIEW
│ 🔄 Refresh Concurrent│  ← REFRESH ... CONCURRENTLY
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Function / Procedure
```
┌─────────────────────┐
│ 📝 Open Editor       │  ← 코드 에디터 탭 열기
│ ▶ Execute            │  ← 파라미터 입력 후 실행
│ 📋 Copy Name         │
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Trigger
```
┌─────────────────────┐
│ 📝 Open Editor       │  ← 트리거 설정 + 함수 본문 에디터
│ 📋 Copy Name         │
│ ─────────────────── │
│ ⏸ Disable            │  ← PG only: ALTER TABLE ... DISABLE TRIGGER
│ ▶ Enable             │  ← PG only: ALTER TABLE ... ENABLE TRIGGER
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as Drop    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Sequence
```
┌─────────────────────┐
│ 📝 Open Detail       │  ← 속성 조회 (current value, increment 등)
│ 📋 Copy Name         │
│ ─────────────────── │
│ 🔄 Reset Value       │  ← ALTER SEQUENCE ... RESTART
│ ⏭ Set Value...       │  ← setval() / ALTER SEQUENCE ... RESTART WITH
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as DROP    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Event (MySQL/MariaDB only)
```
┌─────────────────────┐
│ 📝 Open Editor       │  ← 스케줄 + SQL 본문 에디터
│ 📋 Copy Name         │
│ ─────────────────── │
│ ⏸ Disable            │  ← ALTER EVENT ... DISABLE
│ ▶ Enable             │  ← ALTER EVENT ... ENABLE
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as Drop    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Extension (PG only)
```
┌─────────────────────┐
│ 📝 Open Detail       │  ← 버전, 소속 오브젝트 목록
│ 📋 Copy Name         │
│ ─────────────────── │
│ ⬆ Update Version     │  ← ALTER EXTENSION ... UPDATE
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

#### Type / Domain / Policy (PG only)
```
┌─────────────────────┐
│ 📝 Open Editor       │
│ 📋 Copy Name         │
│ ─────────────────── │
│ 📜 Script as CREATE  │
│ 📜 Script as Drop    │
│ ─────────────────── │
│ 🗑 Drop               │
└─────────────────────┘
```

---

## 5. Main Content Area — Nav별 동작 방식

### 핵심 원칙
- **📦 Object Browser → Multi-Tab** (여러 오브젝트를 열어두고 전환)
- **👤 DBA / 📊 Monitor / 📥 Data Ops → 단일 뷰** (좌측 클릭 시 우측이 바뀜)

### Nav 전환 시 동작
```
📦 Object Browser 활성 → 탭 바 표시 ([users] [get_user()] ...)
👤 DBA 클릭            → 탭 바 사라짐, DBA 고정 화면 표시
📦 다시 클릭            → 탭 바 복원 (이전 탭들 그대로 유지)
```

### SQLite 연결 시 Nav Bar 제한
```
┌────┐
│ 📦 │  ← Object Browser (활성)
│ 👤 │  ← DBA — disabled (SQLite는 유저/권한 없음)
│ 📊 │  ← Monitor — disabled (SQLite는 세션/통계 없음)
│ 📥 │  ← Data Ops (활성 — Export/Import만)
│    │
│ ─  │
│ ⚙ │  ← Console Settings
└────┘
```

- Disabled 아이콘: `opacity-40`, `cursor-not-allowed`
- Hover 시 Tooltip: "Not available for SQLite connections"
- 클릭해도 반응 없음 (패널 전환 안 됨)

### SQLite Data Ops 제한
```
┌──────────────────────────┐
│ DATA OPS                 │
├──────────────────────────┤
│ 📤 Export Data            │  ← 활성
│ 📥 Import Data            │  ← 활성
│ 💾 SQL Dump               │  ← ".backup" 명령 대체 or 파일 복사
│ 📂 Restore                │  ← 파일 교체 방식
└──────────────────────────┘
```
> SQLite Dump는 `mysqldump`/`pg_dump`와 다르게 `.dump` 명령 또는 파일 자체 복사.
> Export/Import는 CSV/JSON 단위로 동작하므로 PG/MySQL과 동일 UX 유지.

---

### 5.1 Object Browser — Multi-Tab

#### 탭 바
```
┌─ 🗂 users ──┐┌─ ⚡ get_user() ──┐┌─ ⏰ trg_audit ──┐
└──────────────┘└──────────────────┘└─────────────────┘
```

#### 탭 유형별 아이콘

| Type | Icon | Tab Label |
|------|------|-----------|
| Table Detail | Table2 | 테이블명 |
| Function Editor | Zap | 함수명() |
| Procedure Editor | ScrollText | 프로시저명() |
| Trigger Editor | Timer | 트리거명 |
| Sequence Detail | Hash | 시퀀스명 |
| Event Editor | CalendarClock | 이벤트명 |
| Materialized View | Layers | 뷰명 |
| Extension Detail | Puzzle | 확장명 |
| Type Editor | Tag | 타입명 |

#### 탭 동작
- 좌측 Object Browser에서 항목 클릭 → 탭 생성 (이미 열려있으면 해당 탭 활성화)
- 클릭: 탭 활성화
- 중클릭 (마우스 휠): 탭 닫기
- 수정된 탭: 탭 이름 옆에 `●` 표시 (unsaved dot)
- 탭 우클릭: Close / Close Others / Close All

---

### 5.2 DBA — 단일 뷰

```
┌────┬──────────────┬──────────────────────────────────────┐
│ 📦 │ ▸ Users (12) │                                      │
│[👤]│ ▸ Roles (5)  │  Users 목록 + 상세 화면               │
│ 📊 │ ▸ Privileges │  (좌측에서 다른 항목 클릭하면           │
│ 📥 │ ▸ Variables  │   이 영역이 통째로 바뀜)               │
│    │ ▸ Databases  │                                      │
└────┴──────────────┴──────────────────────────────────────┘
```

탭 바 없음. 좌측 트리에서 클릭하면 우측 전체가 해당 화면으로 전환.

---

### 5.3 Monitor — 단일 뷰

```
┌────┬──────────────┬──────────────────────────────────────┐
│ 📦 │ ▸ Sessions   │                                      │
│ 👤 │ ▸ Locks      │  Active Sessions 대시보드              │
│[📊]│ ▸ Table Stats│  (좌측에서 다른 항목 클릭하면           │
│ 📥 │ ▸ Index Stats│   이 영역이 통째로 바뀜)               │
│    │ ▸ Server     │                                      │
└────┴──────────────┴──────────────────────────────────────┘
```

탭 바 없음. 동일한 단일 뷰 패턴.

---

### 5.4 Data Ops — 단일 뷰

```
┌────┬──────────────┬──────────────────────────────────────┐
│ 📦 │ 📤 Export    │                                      │
│ 👤 │ 📥 Import    │  Export Wizard (3-step)               │
│ 📊 │ 💾 SQL Dump  │  (좌측에서 다른 항목 클릭하면           │
│[📥]│ 📂 Restore   │   이 영역이 통째로 바뀜)               │
└────┴──────────────┴──────────────────────────────────────┘
```

탭 바 없음. 위자드 형태의 단일 뷰.

---

## 6. Tab Content Views (Console 탭 — Object Browser Multi-Tab 전용)

> ~~Query 탭 추가 기능 (Format, EXPLAIN, EXPLAIN ANALYZE)은 이미 구현 완료 → 설계 문서에서 제거.~~

### 6.1 Table Detail View

```
┌──────────────────────────────────────────────────────────────────┐
│ 🗂 users                        [✏️ ALTER] [📜 DDL] [🗑 DROP]    │
├──────────────────────────────────────────────────────────────────┤
│ [Columns] [Constraints] [Indexes] [Triggers] [Statistics] [DDL] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Columns Tab ─────────────────────────────────────────────┐  │
│  │ # │ Name       │ Type      │ Nullable │ Default │ PK │ FK │  │
│  │───┼────────────┼───────────┼──────────┼─────────┼────┼────│  │
│  │ 1 │ id         │ int4      │ NO       │ nextval │ 🔑 │    │  │
│  │ 2 │ email      │ varchar   │ NO       │         │    │    │  │
│  │ 3 │ name       │ varchar   │ YES      │ NULL    │    │    │  │
│  │ 4 │ role_id    │ int4      │ NO       │         │    │ →  │  │
│  │ 5 │ created_at │ timestamp │ NO       │ now()   │    │    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [+ Add Column]                                                  │
│                                                                  │
│  ┌─ Constraints Tab ────────────────────────────────────────┐   │
│  │ Name          │ Type │ Columns        │ References       │   │
│  │───────────────┼──────┼────────────────┼──────────────────│   │
│  │ users_pkey    │ PK   │ id             │                  │   │
│  │ users_email_u │ UK   │ email          │                  │   │
│  │ users_role_fk │ FK   │ role_id        │ roles(id)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Statistics Tab ─────────────────────────────────────────┐   │
│  │ Row Count (est)  │ 12,450                                │   │
│  │ Total Size       │ 4.2 MB                                │   │
│  │ Data Size        │ 3.1 MB                                │   │
│  │ Index Size       │ 1.1 MB                                │   │
│  │ Dead Tuples      │ 234 (1.8%)       [🧹 Vacuum]         │   │
│  │ Last Analyzed    │ 2026-03-23 10:30                      │   │
│  │ Seq Scans        │ 1,205                                 │   │
│  │ Idx Scans        │ 45,678                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ DDL Tab ────────────────────────────────────────────────┐   │
│  │ CREATE TABLE public.users (                              │   │
│  │   id integer NOT NULL DEFAULT nextval('users_id_seq'),   │   │
│  │   email varchar(255) NOT NULL,                           │   │
│  │   name varchar(100),                                     │   │
│  │   ...                                                    │   │
│  │ );                                     [📋 Copy] [💾 Save]│  │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Function/Procedure Editor

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚡ get_user_by_email          [💾 Save] [▶ Test] [📜 DDL] [🗑]   │
├──────────────────────────────────────────────────────────────────┤
│ [Definition] [Parameters] [Options] [DDL]                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Definition Tab ─────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  Language: [plpgsql ▾]    Returns: [TABLE ▾]             │   │
│  │                                                           │   │
│  │  ┌─ Return Columns (RETURNS TABLE) ──────────────────┐   │   │
│  │  │ user_id  │ integer  │ [×]                         │   │   │
│  │  │ email    │ varchar  │ [×]                         │   │   │
│  │  │ name     │ varchar  │ [×]                         │   │   │
│  │  │ [+ Add Column]                                    │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                           │   │
│  │  ┌─ Function Body (CodeMirror) ──────────────────────┐   │   │
│  │  │  1 │ DECLARE                                      │   │   │
│  │  │  2 │   v_user RECORD;                             │   │   │
│  │  │  3 │ BEGIN                                        │   │   │
│  │  │  4 │   RETURN QUERY                               │   │   │
│  │  │  5 │   SELECT u.id, u.email, u.name               │   │   │
│  │  │  6 │   FROM users u                               │   │   │
│  │  │  7 │   WHERE u.email = p_email;                   │   │   │
│  │  │  8 │ END;                                         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Parameters Tab ─────────────────────────────────────────┐   │
│  │ Direction │ Name     │ Type      │ Default │             │   │
│  │───────────┼──────────┼───────────┼─────────┼─────────────│   │
│  │ IN        │ p_email  │ varchar   │         │ [×]         │   │
│  │ [+ Add Parameter]                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Options Tab ────────────────────────────────────────────┐   │
│  │ Volatility:  (●) STABLE  ( ) IMMUTABLE  ( ) VOLATILE    │   │
│  │ Security:    (●) INVOKER  ( ) DEFINER                    │   │
│  │ Strict:      [✓] RETURNS NULL ON NULL INPUT              │   │
│  │ Parallel:    [UNSAFE ▾]                                  │   │
│  │ Cost:        [100    ]                                   │   │
│  │ Rows:        [1000   ]  (for SETOF/TABLE returns)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ DDL Tab (read-only, generated) ─────────────────────────┐   │
│  │ CREATE OR REPLACE FUNCTION public.get_user_by_email(     │   │
│  │   p_email varchar                                        │   │
│  │ ) RETURNS TABLE(user_id integer, email varchar, ...)     │   │
│  │ LANGUAGE plpgsql STABLE                                  │   │
│  │ AS $function$                                            │   │
│  │ ...                                                      │   │
│  │ $function$;                             [📋 Copy]        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Trigger Editor (PG — 2-step unified)

```
┌──────────────────────────────────────────────────────────────────┐
│ ⏰ trg_audit_users              [💾 Save] [🔄 Toggle] [🗑 Drop]  │
├──────────────────────────────────────────────────────────────────┤
│ [Trigger Config] [Function Body] [DDL]                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Trigger Config Tab ─────────────────────────────────────┐   │
│  │                                                           │   │
│  │  Table:   [users ▾]                                      │   │
│  │  Timing:  (●) BEFORE  ( ) AFTER  ( ) INSTEAD OF         │   │
│  │  Events:  [✓] INSERT  [✓] UPDATE  [ ] DELETE  [ ] TRUNC │   │
│  │  Level:   (●) FOR EACH ROW  ( ) FOR EACH STATEMENT      │   │
│  │                                                           │   │
│  │  ── PG only ──────────────────────────────────────────   │   │
│  │  UPDATE OF: [✓] email  [ ] name  [✓] status              │   │
│  │  WHEN:      [OLD.status IS DISTINCT FROM NEW.status   ]  │   │
│  │                                                           │   │
│  │  Status:    [● Enabled  ○ Disabled]                      │   │
│  │  Function:  [trg_audit_users_fn ▾] [Edit →]             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Function Body Tab (자동 연결된 트리거 함수) ────────────┐   │
│  │  1 │ BEGIN                                               │   │
│  │  2 │   INSERT INTO audit_log (                           │   │
│  │  3 │     table_name, operation, old_data, new_data       │   │
│  │  4 │   ) VALUES (                                        │   │
│  │  5 │     TG_TABLE_NAME, TG_OP,                           │   │
│  │  6 │     row_to_json(OLD), row_to_json(NEW)              │   │
│  │  7 │   );                                                │   │
│  │  8 │   RETURN NEW;                                       │   │
│  │  9 │ END;                                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ── MySQL/MariaDB 버전 ──                                       │
│  ┌─ Trigger Config Tab ─────────────────────────────────────┐   │
│  │  Table:   [users ▾]                                      │   │
│  │  Timing:  (●) BEFORE  ( ) AFTER                          │   │
│  │  Event:   ( ) INSERT  (●) UPDATE  ( ) DELETE             │   │
│  │  Order:   [FOLLOWS trg_validate ▾]  (optional)           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  ── Trigger Body (inline, no separate function) ──       │   │
│  │  1 │ BEGIN                                               │   │
│  │  2 │   SET NEW.updated_at = NOW();                       │   │
│  │  3 │ END                                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 Sequence Detail

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔢 users_id_seq                       [✏️ ALTER] [📜 DDL] [🗑]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Properties ─────────────────────────────────────────────┐   │
│  │ Data Type     │ bigint                                   │   │
│  │ Start Value   │ 1                                        │   │
│  │ Current Value │ 12,451                                   │   │
│  │ Increment     │ 1                                        │   │
│  │ Min Value     │ 1                                        │   │
│  │ Max Value     │ 9,223,372,036,854,775,807                │   │
│  │ Cache         │ 1                                        │   │
│  │ Cycle         │ No                                       │   │
│  │ Owned By      │ users.id  [→ Go to table]                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [🔄 Reset Value]  [⏭ Set Value: [_____] Apply]                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.5 Event Editor (MySQL/MariaDB)

```
┌──────────────────────────────────────────────────────────────────┐
│ 📅 cleanup_old_sessions         [💾 Save] [⏯ Toggle] [🗑 Drop]  │
├──────────────────────────────────────────────────────────────────┤
│ [Schedule] [SQL Body] [DDL]                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Schedule Tab ───────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  Type:  (●) Recurring (EVERY)   ( ) One-time (AT)        │   │
│  │                                                           │   │
│  │  ── Recurring ──                                          │   │
│  │  Every: [1 ▾] [DAY ▾]                                    │   │
│  │  Starts: [2026-03-01 00:00 📅]  (optional)               │   │
│  │  Ends:   [                  📅]  (optional)               │   │
│  │                                                           │   │
│  │  ── One-time ──                                           │   │
│  │  At: [2026-04-01 00:00 📅]                                │   │
│  │                                                           │   │
│  │  Status:      [● Enabled  ○ Disabled]                     │   │
│  │  On Complete: [● Preserve  ○ Drop]                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ SQL Body Tab ───────────────────────────────────────────┐   │
│  │  1 │ DELETE FROM sessions                                │   │
│  │  2 │ WHERE last_active < DATE_SUB(NOW(), INTERVAL 30 DAY)│   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. DBA Panel (Nav: 👤)

### 7.1 DBA Navigation Panel

```
┌──────────────────────────┐
│ DBA                      │
├──────────────────────────┤
│ 🔍 Search...             │
├──────────────────────────┤
│ ▸ 👤 Users (12)          │
│ ▸ 🎭 Roles (5)           │
│ ▸ 🛡 Privileges           │
│ ▸ 🗄 Databases/Schemas (3)│  ← PG: Schema, MySQL: Database (동일 개념)
│ ▸ ⚙ Variables             │  ← 서버 설정 편집 (DBA 작업)
└──────────────────────────┘
```

> **DBA = 변경하는 것 (Configure)** / Monitor = 관찰하는 것 (Observe)
>
> **Databases/Schemas**: PG에서는 Schema(네임스페이스), MySQL에서는 Database — 용어만 다르고 같은 개념이므로 하나로 통합 표시. UI에서는 벤더에 따라 라벨 자동 전환: PG → "Schemas", MySQL → "Databases".
>
> **제거 항목:**
> - ~~Server Status~~: 읽기 전용 현재 상태 → Monitor 패널로 이동

### 7.2 User Management Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 👤 Users                                        [+ Create User]  │
├──────────────────────────────────────────────────────────────────┤
│ 🔍 Filter users...                                               │
├──────────────────────────────────────────────────────────────────┤
│ │ User         │ Host       │ Auth Method │ Locked │ Actions  │  │
│ │──────────────┼────────────┼─────────────┼────────┼──────────│  │
│ │ root         │ localhost  │ sha2        │ No     │ [✏][🗑] │  │
│ │ app_user     │ %          │ sha2        │ No     │ [✏][🗑] │  │
│ │ readonly     │ 10.0.0.%   │ sha2        │ No     │ [✏][🗑] │  │
│ │ backup_user  │ localhost  │ socket      │ Yes    │ [✏][🔓] │  │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ── User Detail (선택 시) ──                                       │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ [General] [Privileges] [Role Membership]                    │  │
│ ├─────────────────────────────────────────────────────────────┤  │
│ │ Username:  app_user                                         │  │
│ │ Host:      %                    ← MySQL only                │  │
│ │ Auth:      caching_sha2_password                            │  │
│ │ Password:  [••••••••] [Change]                              │  │
│ │ Locked:    [ ] Account Locked                               │  │
│ │ Expires:   [          📅]       (optional)                  │  │
│ │                                                             │  │
│ │ Conn Limit: [0 = unlimited]     ← PG only                  │  │
│ │ Superuser:  [ ]                 ← PG only                   │  │
│ │ Can Login:  [✓]                 ← PG only                   │  │
│ │ Inherits:   [✓]                 ← PG only                   │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Privilege Matrix Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 🛡 Privileges: app_user                           [💾 Apply]     │
├──────────────────────────────────────────────────────────────────┤
│ User: [app_user ▾]   Scope: [Table ▾]   Schema: [public ▾]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  │ Object      │ SELECT │ INSERT │ UPDATE │ DELETE │ ALL │      │
│  │─────────────┼────────┼────────┼────────┼────────┼─────│      │
│  │ users       │  [✓]   │  [✓]   │  [✓]   │  [ ]   │ [ ] │      │
│  │ orders      │  [✓]   │  [✓]   │  [✓]   │  [✓]   │ [ ] │      │
│  │ products    │  [✓]   │  [ ]   │  [ ]   │  [ ]   │ [ ] │      │
│  │ audit_log   │  [ ]   │  [ ]   │  [ ]   │  [ ]   │ [ ] │      │
│  │ ─ All ─     │  [ ]   │  [ ]   │  [ ]   │  [ ]   │ [ ] │      │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Legend: [✓] = Granted  [✓✓] = With Grant Option  [ ] = None    │
│                                                                  │
│  ── Generated SQL Preview ──                                     │
│  GRANT SELECT, INSERT, UPDATE ON public.users TO app_user;       │
│  GRANT ALL ON public.orders TO app_user;                         │
│  REVOKE DELETE ON public.users FROM app_user;                    │
│                                                   [📋 Copy SQL]  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.4 Variables/Parameters Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚙ Server Variables               [Scope: Global ▾] [💾 Apply]   │
├──────────────────────────────────────────────────────────────────┤
│ 🔍 Search variables...       Category: [All ▾]                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  │ Variable           │ Value      │ Default │ Context  │        │
│  │────────────────────┼────────────┼─────────┼──────────│        │
│  │ max_connections     │ [150    ]  │ 100     │ 🔄reload │        │
│  │ shared_buffers      │ 256MB      │ 128MB   │ 🔁restart│        │
│  │ work_mem            │ [4MB    ]  │ 4MB     │ ⚡user    │        │
│  │ maintenance_work_mem│ [64MB   ]  │ 64MB    │ ⚡user    │        │
│  │ effective_cache_size│ [4GB    ]  │ 4GB     │ ⚡user    │        │
│  │ log_min_duration_st │ [-1     ]  │ -1      │ 👑super  │        │
│  │────────────────────┼────────────┼─────────┼──────────│        │
│  │ ... (350+ params)  │            │         │          │        │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Context Legend:                                                  │
│  🔁 = Requires restart  🔄 = Requires reload (pg_reload_conf)   │
│  👑 = Superuser session  ⚡ = User session (immediate)            │
│                                                                  │
│  Modified: 2 variables              [Reset All] [💾 Apply]       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Monitor Panel (Nav: 📊)

### 8.1 Monitor Navigation Panel

```
┌──────────────────────────┐
│ MONITOR                  │
├──────────────────────────┤
│ ── Live ──               │
│ ▸ 🖥 Active Sessions      │
│ ▸ 🔒 Locks                │
│ ▸ 📡 Replication          │  ← 연결 설정에 따라
│ ── Statistics ──         │
│ ▸ 📊 Table Statistics     │
│ ▸ 📈 Index Statistics     │
│ ▸ 🏆 Top SQL              │  ← pg_stat_statements / performance_schema 기반
│ ── Server ──             │
│ ▸ 🖧 Server Status        │  ← DBA에서 이동 (읽기 전용 현재 상태)
└──────────────────────────┘
```

> **서브그룹 설명:**
> - **Live**: 실시간 자동 갱신 (auto-refresh 5s). 현재 진행 중인 세션/잠금/복제 상태.
> - **Statistics**: 누적 통계. 수동 Refresh. 성능 분석/튜닝 용도.
> - **Server**: 서버 설정/상태. 변경 빈도 낮음.

#### Top SQL 기준

| 기준 | 소스 | 설명 |
|------|------|------|
| PG | `pg_stat_statements` (확장 필요) | 총 실행 시간, 평균 시간, 호출 횟수, 반환 행 수 |
| MySQL/MariaDB | `performance_schema.events_statements_summary_by_digest` | 동일 기준 |

- 기본 정렬: **총 실행 시간 (total_time) DESC** — 가장 많은 리소스를 소비한 쿼리
- 사용자가 정렬 기준 변경 가능: `[Sort: Total Time ▾]` (Avg Time, Calls, Rows)
- 확장 미설치 시:

```
┌──────────────────────────────────────────────────────────────────┐
│ 🏆 Top SQL                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠ Extension Required                                            │
│                                                                  │
│  Top SQL requires the pg_stat_statements extension.              │
│  Currently not installed on this database.                        │
│                                                                  │
│  ── Install SQL ──                                               │
│  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;              │
│                                                                  │
│  [📋 Copy SQL]  [▶ Execute]                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Table Statistics 기준

| 항목 | PG 소스 | MySQL 소스 | 의미 |
|------|---------|-----------|------|
| Rows (est) | `pg_stat_user_tables.n_live_tup` | `information_schema.tables.TABLE_ROWS` | 추정 행 수 |
| Total Size | `pg_total_relation_size()` | `DATA_LENGTH + INDEX_LENGTH` | 디스크 총 크기 |
| Data Size | `pg_relation_size()` | `DATA_LENGTH` | 데이터만 크기 |
| Index Size | `pg_indexes_size()` | `INDEX_LENGTH` | 인덱스 크기 |
| Dead Tuples | `n_dead_tup` / `n_live_tup` | N/A (InnoDB 자동 처리) | VACUUM 필요 판단 |
| Seq Scans | `seq_scan` | N/A | 풀스캔 빈도 → 인덱스 필요 신호 |
| Idx Scans | `idx_scan` | N/A | 인덱스 활용 빈도 |
| Last Analyzed | `last_analyze` | N/A | 통계 신선도 |

- 기본 정렬: **Total Size DESC** — 큰 테이블부터
- 사용자가 정렬 기준 변경 가능: `[Sort: Total Size ▾]`
- Dead Tuples > 5% 시 경고 아이콘 `⚠` + VACUUM 버튼 강조

#### Index Statistics 기준

| 항목 | PG 소스 | MySQL 소스 | 의미 |
|------|---------|-----------|------|
| Index Name | `pg_stat_user_indexes` | `information_schema.STATISTICS` | 인덱스 이름 |
| Table | 소속 테이블 | 소속 테이블 | 어떤 테이블의 인덱스인지 |
| Size | `pg_relation_size(indexrelid)` | 별도 계산 필요 | 인덱스 디스크 크기 |
| Scans | `idx_scan` | N/A | 사용 빈도 (0이면 미사용) |
| Rows Read | `idx_tup_read` | N/A | 인덱스로 읽은 행 수 |
| Rows Fetched | `idx_tup_fetch` | N/A | 실제 반환 행 수 |

- **핵심 목적**: 미사용 인덱스 식별 (`idx_scan = 0`)
- 미사용 인덱스 강조: `⚠ Unused` 뱃지 → DROP 제안
- 기본 정렬: **Scans ASC** — 가장 안 쓰이는 인덱스부터

### 8.2 Active Sessions Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 🖥 Active Sessions          [Auto-refresh: 5s ▾] [⏸ Pause]      │
├──────────────────────────────────────────────────────────────────┤
│ Filter: [All ▾]  State: [Active ▾]  User: [All ▾]               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  │PID  │User     │DB     │State         │Duration│Wait    │ Act │
│  │─────┼─────────┼───────┼──────────────┼────────┼────────┼─────│
│  │1234 │app_user │mydb   │🟢 active      │ 0.3s   │        │[⏹] │
│  │1235 │app_user │mydb   │🟡 idle in tx  │ 45s    │Lock    │[⏹] │
│  │1236 │admin    │mydb   │🟢 active      │ 2.1s   │IO      │[⏹] │
│  │1237 │readonly │mydb   │⚪ idle         │ 120s   │        │[⏹] │
│  │1238 │backup   │mydb   │🟢 active      │ 5m 23s │        │[⏹] │
│  └────────────────────────────────────────────────────────────── │
│                                                                  │
│  ── Selected Session Detail (PID: 1235) ──                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ User: app_user    Client: 10.0.0.5:52341                  │  │
│  │ Database: mydb    Application: my-api                      │  │
│  │ State: idle in transaction (45s)                           │  │
│  │ Wait: Lock (relation)                                      │  │
│  │ Blocked by: PID 1234                                       │  │
│  │                                                            │  │
│  │ Query:                                                     │  │
│  │ ┌──────────────────────────────────────────────────────┐  │  │
│  │ │ UPDATE orders SET status = 'shipped'                 │  │  │
│  │ │ WHERE order_id = 12345                               │  │  │
│  │ └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ [🚫 Cancel Query]  [💀 Kill Connection]  [📋 Copy SQL]    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Table Statistics Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 📊 Table Statistics                              [↻ Refresh]     │
├──────────────────────────────────────────────────────────────────┤
│ Schema: [public ▾]   Sort by: [Total Size ▾]                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  │Table      │Rows(est)│Total   │Data    │Index  │Dead  │ Act   │
│  │───────────┼─────────┼────────┼────────┼───────┼──────┼───────│
│  │orders     │ 1.2M    │ 892MB  │ 640MB  │ 252MB │ 2.3% │[🧹]  │
│  │events     │ 890K    │ 456MB  │ 380MB  │  76MB │ 0.5% │[🧹]  │
│  │users      │  12K    │  4.2MB │  3.1MB │ 1.1MB │ 1.8% │[🧹]  │
│  │products   │   2K    │  1.8MB │  1.2MB │ 0.6MB │ 0.1% │[🧹]  │
│  │sessions   │  45K    │  12MB  │   9MB  │  3MB  │ 8.2% │[🧹⚠]│
│  └────────────────────────────────────────────────────────────── │
│                                                                  │
│  ⚠ sessions: Dead tuple ratio 8.2% exceeds 5% threshold         │
│                                                                  │
│  [🧹 Vacuum Selected]  [📊 Analyze Selected]                    │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 EXPLAIN Visualizer (쿼리 결과에서 열림)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🌳 Query Plan                    [Format: Tree ▾] [📋 Copy JSON] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Planning Time: 0.234ms    Execution Time: 45.678ms              │
│                                                                  │
│  ┌─ Nested Loop (cost=4.56..123.45 rows=100) ──────────────┐   │
│  │ Actual: rows=98, loops=1, time=42.3ms                     │   │
│  │ Buffers: shared hit=234, read=12                          │   │
│  │                                                           │   │
│  │  ┌─ Index Scan on users_pkey (cost=0.29..8.30) ──────┐  │   │
│  │  │ Actual: rows=1, loops=98, time=2.1ms               │  │   │
│  │  │ Index Cond: (id = orders.user_id)                  │  │   │
│  │  │ Buffers: shared hit=196                            │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                           │   │
│  │  ┌─ ⚠ Seq Scan on orders (cost=0.00..35.50) ─────────┐  │   │
│  │  │ Actual: rows=98, loops=1, time=38.5ms  ← SLOW      │  │   │
│  │  │ Filter: (status = 'active')                        │  │   │
│  │  │ Rows Removed by Filter: 902                        │  │   │
│  │  │ Buffers: shared hit=38, read=12                    │  │   │
│  │  │ ⚠ Consider: CREATE INDEX ON orders(status)         │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ── Estimated vs Actual ──                                       │
│  │ Node           │ Est Rows │ Act Rows │ Ratio │ Status   │    │
│  │────────────────┼──────────┼──────────┼───────┼──────────│    │
│  │ Nested Loop    │ 100      │ 98       │ 0.98  │ ✅ Good  │    │
│  │ Index Scan     │ 1        │ 1        │ 1.00  │ ✅ Good  │    │
│  │ Seq Scan       │ 100      │ 98       │ 0.98  │ ⚠ SeqScan│    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Operations Panel (Nav: 📥)

### 9.1 Data Ops Navigation Panel

```
┌──────────────────────────┐
│ DATA OPS                 │
├──────────────────────────┤
│ 📤 Export Data            │  ← 테이블 데이터를 CSV/JSON/SQL로 내보내기
│ 📥 Import Data            │  ← CSV/JSON 파일을 테이블로 가져오기
│ 💾 SQL Dump               │  ← DB 전체/선택 테이블을 .sql 파일로 백업
│ 📂 Restore                │  ← .sql 파일로 DB 복원
└──────────────────────────┘
```

### Data Ops vs Snapshot (Diagram) 차이

| | Data Ops | Snapshot (Diagram 기능) |
|---|---|---|
| **대상** | 실제 DB의 데이터 + 스키마 | Virtual Diagram의 스키마 정의 |
| **저장 위치** | 사용자 지정 파일 경로 (.sql, .csv, .json) | 로컬 SQLite (`diagram_versions.schema_snapshot`) |
| **목적** | 백업/마이그레이션/데이터 이동 | 스키마 설계 버전 관리/Diff 비교 |
| **포함 내용** | DDL + 데이터 (INSERT문 포함) | DDL 구조만 (데이터 없음) |
| **복원 방식** | SQL 파일 실행 (DB에 직접 적용) | Diagram 버전 롤백 (UI 내에서만) |

> Snapshot은 설계 도구(Diagram)의 버전 관리.
> Data Ops는 실제 DB에 대한 백업/복원. 서로 다른 레이어.

### SQL Dump 저장 방식

#### 벤더별 Dump 도구

| 벤더 | 도구 | 실행 방식 |
|------|------|----------|
| PostgreSQL | `pg_dump` | Electron `child_process.spawn()` |
| MySQL/MariaDB | `mysqldump` | Electron `child_process.spawn()` |
| SQLite | 파일 복사 (`fs.copyFile`) | Node.js `fs` API 직접 사용 |

#### Dump Wizard (3-step)

```
┌──────────────────────────────────────────────────────────────────┐
│ 💾 SQL Dump                                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 3: Scope                                              │
│  ● ○ ○                                                           │
│                                                                  │
│  Dump Type:                                                      │
│  (●) Full Database                                               │
│  ( ) Selected Tables                                             │
│  ( ) Schema Only (no data)                                       │
│                                                                  │
│  ── Selected Tables (when enabled) ──                            │
│  Schema: [public ▾]                                              │
│  [✓] users   [✓] orders   [ ] audit_log   [ ] sessions          │
│                                                                  │
│                                          [Cancel]  [Next →]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 3: Options                                            │
│  ○ ● ○                                                           │
│                                                                  │
│  Format:  (●) Plain SQL (.sql)                                   │
│           ( ) Custom Archive (.dump)  ← PG only (pg_restore용)   │
│                                                                  │
│  Options:                                                        │
│  [✓] Include CREATE statements                                   │
│  [✓] Include INSERT data                                         │
│  [ ] Add DROP IF EXISTS before CREATE                            │
│  [ ] Include privileges (GRANT/REVOKE)                           │
│  Encoding: [UTF-8 ▾]                                             │
│                                                                  │
│                                    [← Back]  [Cancel]  [Next →]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 3 of 3: Save                                               │
│  ○ ○ ●                                                           │
│                                                                  │
│  Save to: [~/backups/mydb-2026-03-26.sql  📁]                    │
│                                                                  │
│  Summary:                                                        │
│  • Database: mydb (PostgreSQL 15.4)                              │
│  • Scope: Full database (42 tables)                              │
│  • Format: Plain SQL with CREATE + INSERT                        │
│  • Estimated size: ~45 MB                                        │
│                                                                  │
│  ── CLI Command Preview ──                                       │
│  pg_dump -h localhost -p 5432 -U admin -d mydb -F p > dump.sql  │
│                                                    [📋 Copy]     │
│                                                                  │
│  ┌─ Progress ─────────────────────────────────────────────┐     │
│  │ ████████████████░░░░░░░░░░░░  55%                      │     │
│  │ Dumping: public.orders (800K rows)                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│                                    [← Back]  [Cancel]  [Dump]    │
└──────────────────────────────────────────────────────────────────┘
```

#### CLI 도구 미설치 시
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ pg_dump not found                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SQL Dump requires "pg_dump" to be installed on your system.     │
│                                                                  │
│  Install via:                                                    │
│  • macOS: brew install postgresql                                │
│  • Ubuntu: sudo apt install postgresql-client                    │
│  • Windows: Download from postgresql.org                         │
│                                                                  │
│  Or set custom path in Console Settings.                         │
│                                                                  │
│  [⚙ Open Settings]  [Dismiss]                                    │
└──────────────────────────────────────────────────────────────────┘
```

#### SQLite Dump (특수 처리)
```
┌──────────────────────────────────────────────────────────────────┐
│ 💾 SQLite Backup                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Backup Method:                                                  │
│  (●) File Copy — DB 파일 자체를 복사 (가장 빠름, 권장)             │
│  ( ) SQL Export — .dump 형식으로 SQL 텍스트 생성                   │
│                                                                  │
│  Source: ~/data/app.db (24.3 MB)                                 │
│  Save to: [~/backups/app-2026-03-26.db  📁]                      │
│                                                                  │
│  ⚠ Ensure no other process is writing to the database.           │
│                                                                  │
│                                          [Cancel]  [Backup]      │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Export Wizard Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 📤 Export Data                                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 3: Select Source                                      │
│  ● ● ○                                                           │
│                                                                  │
│  Source: (●) Table  ( ) Custom Query                             │
│                                                                  │
│  Schema: [public ▾]                                              │
│  Tables: [✓] users                                               │
│          [✓] orders                                              │
│          [ ] products                                            │
│          [ ] sessions                                            │
│                                                                  │
│  ── or ──                                                        │
│  Custom SQL:                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SELECT * FROM users WHERE created_at > '2026-01-01'      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│                                          [Cancel]  [Next →]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 3: Format & Options                                   │
│  ○ ● ○                                                           │
│                                                                  │
│  Format: (●) CSV  ( ) JSON  ( ) INSERT SQL  ( ) XLSX            │
│                                                                  │
│  ── CSV Options ──                                               │
│  Delimiter:  [, ▾]   (comma, tab, pipe, semicolon)              │
│  Quote:      [" ▾]                                               │
│  Header:     [✓] Include column headers                          │
│  Encoding:   [UTF-8 ▾]                                          │
│  NULL as:    [NULL    ]                                          │
│  Row limit:  [All ▾]  (All, 100, 1000, 10000, Custom)          │
│                                                                  │
│                                    [← Back]  [Cancel]  [Next →]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 3 of 3: Confirm & Export                                   │
│  ○ ○ ●                                                           │
│                                                                  │
│  Summary:                                                        │
│  • Tables: users, orders                                         │
│  • Format: CSV (comma-delimited, UTF-8)                          │
│  • Estimated rows: ~1,212,450                                    │
│                                                                  │
│  Save to: [~/Downloads/export-2026-03-23/  📁]                   │
│                                                                  │
│  ┌─ Progress ──────────────────────────────────────────────┐    │
│  │ users:   ████████████████████████░░░░░░  80%  9,600/12K│    │
│  │ orders:  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Waiting...    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                                    [← Back]  [Cancel]  [Export]  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.3 Import Wizard Tab

```
┌──────────────────────────────────────────────────────────────────┐
│ 📥 Import Data                                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 3: Column Mapping                                     │
│  ○ ● ○                                                           │
│                                                                  │
│  File: users_backup.csv (12,450 rows detected)                   │
│  Target Table: [users ▾]   [+ Create New Table]                  │
│                                                                  │
│  ┌─ Column Mapping ─────────────────────────────────────────┐   │
│  │ CSV Column    │  →  │ Table Column │ Type     │ Preview  │   │
│  │───────────────┼─────┼──────────────┼──────────┼──────────│   │
│  │ user_id       │  →  │ [id ▾]       │ int4     │ 1, 2, 3 │   │
│  │ email_address │  →  │ [email ▾]    │ varchar  │ a@b.c   │   │
│  │ full_name     │  →  │ [name ▾]     │ varchar  │ John    │   │
│  │ signup_date   │  →  │ [created ▾]  │ timestmp │ 2026-.. │   │
│  │ phone         │  →  │ [(skip) ▾]   │ -        │ 010-... │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Options:                                                        │
│  On Conflict: (●) Skip  ( ) Update  ( ) Error                   │
│  Batch Size:  [1000 ▾]                                           │
│  Truncate First: [ ] (dangerous)                                 │
│                                                                  │
│  ── Data Preview (first 5 rows) ──                               │
│  │ id │ email      │ name  │ created_at         │                │
│  │────┼────────────┼───────┼────────────────────│                │
│  │ 1  │ a@test.com │ Alice │ 2026-01-15 10:30   │                │
│  │ 2  │ b@test.com │ Bob   │ 2026-01-16 14:22   │                │
│  │ ...                                           │                │
│                                                                  │
│                                    [← Back]  [Cancel]  [Import]  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Bottom Output Panel

### Layout
```
┌──────────────────────────────────────────────────────────────────┐
│ ⌄ [Results] [Messages] [History]              [Clear] [⌃ Max]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── Results Tab ──                                               │
│  Full DataGrid (기존 컴포넌트 재사용)                              │
│  + 페이지네이션, 컬럼 토글, Export 버튼                            │
│                                                                  │
│  ── Messages Tab ──                                              │
│  [10:30:15] ✅ Query executed successfully (45ms, 12 rows)       │
│  [10:30:10] ❌ ERROR: relation "users2" does not exist           │
│  [10:29:55] ✅ CREATE INDEX concurrently completed (2.3s)        │
│  [10:29:50] ⚠ WARNING: VACUUM FULL requires exclusive lock       │
│                                                                  │
│  ── History Tab ──                                               │
│  기존 HistoryTab 내용 (간소화 버전, 필터 + 재실행)                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Spec
- Height: 리사이즈 가능 (min: 100px, default: 200px, max: 50vh)
- 상단 드래그 핸들로 높이 조절
- 더블클릭 시 최대화/복원 토글
- `⌄` 버튼: 패널 최소화 (tab bar만 표시)
- `⌃ Max` 버튼: 패널 최대화

---

## 11. Global Search (⌘K)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔍 Search everything...                                [ESC]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── Recent ──                                                    │
│  🗂 users                               Table                    │
│  📄 select-active-users                 Query                    │
│                                                                  │
│  ── Tables ──                                                    │
│  🗂 users                               public.users             │
│  🗂 user_sessions                       public.user_sessions     │
│                                                                  │
│  ── Columns ──                                                   │
│  · user_id                              orders.user_id (int4)   │
│  · user_email                           profiles.user_email     │
│                                                                  │
│  ── Functions ──                                                 │
│  ⚡ get_user_by_email(varchar)           public                  │
│                                                                  │
│  ── Queries ──                                                   │
│  📄 user-report                         folder/reports           │
│                                                                  │
│  Press Enter to open · Tab to preview · Esc to close             │
└──────────────────────────────────────────────────────────────────┘
```

### Spec
- 단축키: `⌘K` (Mac) / `Ctrl+K` (Windows)
- Overlay dialog (중앙 상단)
- 실시간 검색 (debounce 200ms)
- 카테고리별 그룹핑: Tables, Views, Functions, Procedures, Triggers, Columns, Queries
- Enter: 선택 항목 열기 (탭으로)
- 최근 항목 우선 표시

---

## 12. Vendor Feature Toggle

### 벤더별 UI 동적 노출

```typescript
// useVendorFeatures.ts
interface VendorFeatures {
  // Objects
  materializedViews: boolean   // PG only
  sequences: boolean           // PG + MariaDB
  events: boolean              // MySQL + MariaDB
  customTypes: boolean         // PG only
  extensions: boolean          // PG only
  domains: boolean             // PG only
  rlsPolicies: boolean         // PG only
  rules: boolean               // PG only
  independentIndexBrowse: boolean  // SQLite only (인덱스 독립 카테고리)
  pragmaInspector: boolean     // SQLite only (PRAGMA 기반 메타데이터)

  // Nav Panels
  dbaPanel: boolean            // PG + MySQL + MariaDB (SQLite 미지원)
  monitorPanel: boolean        // PG + MySQL + MariaDB (SQLite 미지원)
  dataOpsPanel: boolean        // All vendors

  // DBA
  databaseSchemaLabel: 'databases' | 'schemas'  // MySQL→"Databases", PG→"Schemas" (동일 기능, 라벨만 다름)
  hostBasedAuth: boolean       // MySQL/MariaDB (user@host)
  userManagement: boolean      // PG + MySQL + MariaDB (SQLite 미지원)
  privilegeMatrix: boolean     // PG + MySQL + MariaDB (SQLite 미지원)
  variableEditor: boolean      // PG + MySQL + MariaDB (SQLite: PRAGMA만) — DBA 패널

  // Table Operations
  alterTable: boolean          // PG + MySQL + MariaDB (SQLite: ADD COLUMN만)
  renameColumn: boolean        // PG + MySQL + MariaDB (SQLite 3.25+: 제한적)
  dropColumn: boolean          // PG + MySQL + MariaDB (SQLite 3.35+: 제한적)
  vacuum: boolean              // PG + SQLite (MySQL: OPTIMIZE TABLE)
  analyze: boolean             // All vendors

  // Triggers
  statementLevelTrigger: boolean  // PG only
  insteadOfTrigger: boolean       // PG + SQLite (SQLite: VIEW에만)
  triggerDisable: boolean         // PG only
  triggerColumnSpec: boolean      // PG only

  // Functions
  functions: boolean           // PG + MySQL + MariaDB (SQLite 미지원)
  procedures: boolean          // PG + MySQL + MariaDB (SQLite 미지원)
  multiLanguage: boolean       // PG only
  functionOverloading: boolean // PG only
  dollarQuoting: boolean       // PG only
  createOrReplace: boolean     // PG + MariaDB

  // Session/Monitor
  activeSessions: boolean      // PG + MySQL + MariaDB (SQLite 미지원)
  lockMonitoring: boolean      // PG + MySQL + MariaDB (SQLite 미지원)
  cancelQuery: boolean         // PG only (soft kill)
  serverStatus: boolean        // PG + MySQL + MariaDB (SQLite 미지원)

  // EXPLAIN
  explainAnalyze: boolean      // PG + MySQL + MariaDB (SQLite: EXPLAIN QUERY PLAN만)
  explainBuffers: boolean      // PG only
  explainWal: boolean          // PG only
  explainTree: boolean         // MySQL 8.0.16+
  explainQueryPlan: boolean    // SQLite only (EXPLAIN QUERY PLAN)

  // Data Ops
  sqlDump: boolean             // PG + MySQL + MariaDB (SQLite: .dump/.backup)
  fileCopyBackup: boolean      // SQLite only (파일 복사 백업)
}
```

### 벤더별 지원 매트릭스 요약

| Feature Area | PostgreSQL | MySQL | MariaDB | SQLite |
|---|:---:|:---:|:---:|:---:|
| **Object Browser** | Full (12 types) | 8 types | 9 types | 4 types |
| **DBA Panel** | Full | Full | Full | N/A |
| **Monitor Panel** | Full | Full | Full | N/A |
| **Data Ops** | Full | Full | Full | Export/Import + File backup |
| **ALTER TABLE** | Full | Full | Full | ADD COLUMN only |
| **Functions/Procedures** | Full | Full | Full | N/A |
| **Transactions** | Full | Full | Full | N/A (single-user) |
| **EXPLAIN** | ANALYZE + Buffers | ANALYZE + Tree | ANALYZE | QUERY PLAN only |
```

### 적용 방식
- Object Browser: 벤더에 없는 노드는 렌더링하지 않음
- Editor: 벤더별 옵션 필드 조건부 표시
- Context Menu: 미지원 기능 항목 제거

---

## 13. Shared UI Components (신규)

### 재사용 컴포넌트 목록

| Component | Used In | Description |
|-----------|---------|-------------|
| `CodeEditorModal` | Function, Procedure, Trigger, View | Monaco/CodeMirror 래퍼 + 언어 선택 |
| `ParameterForm` | Function, Procedure | IN/OUT/INOUT 파라미터 CRUD 테이블 |
| `PrivilegeMatrix` | Grants, Default Privileges | 체크박스 그리드 (오브젝트 × 권한) |
| `ObjectDetailLayout` | Table, Sequence, Type, Extension | 헤더 + 서브탭 + 속성 그리드 |
| `StatisticsTable` | Table Stats, Index Stats, Processes | 정렬/필터 가능한 메트릭 테이블 |
| `WizardStepper` | Import, Export, Backup, Restore | 단계별 진행 UI |
| `SqlPreviewPanel` | Grants, DDL, Import | 생성될 SQL 미리보기 (read-only) |
| `PlanTree` | EXPLAIN Visualizer | 실행 계획 트리 노드 시각화 |
| `AutoRefreshControl` | Sessions, Locks, Active Queries | 자동 새로고침 간격 선택 + 일시정지 |
| `ContextMenuBuilder` | Object Browser, All trees | 벤더별 동적 컨텍스트 메뉴 생성 |

---

## 14. Layout Dimensions Summary

### Query 탭 (AS-IS, 변경 없음)
```
┌─ ~250px ──┬─ flex-1 (editor + results) ─┬─ 200px (toggle) ─┐
│ FileTree  │  SQL Editor + Results        │  Schema Panel    │
│ (queries) │                              │  (optional)      │
└───────────┴──────────────────────────────┴──────────────────┘
```

### Console 탭 (신규)
```
┌─ 40px ─┬─ 240px (toggle) ─┬─ flex-1 (main) ──────────────────┐
│        │                   │                                   │
│  Nav   │   Side Panel      │   Multi-Tab Content Area          │
│  Bar   │   (collapsible)   │                                   │
│        │                   │   min-width: 400px                │
│  icons │   Object Browser  ├───────────────────────────────────┤
│  only  │   or DBA Panel    │                                   │
│        │   or Monitor      │   Bottom Output Panel             │
│        │   or Data Ops     │   (resizable, 100~50vh)           │
│        │                   │                                   │
│ 40px   │   240px           │   flex-1                          │
└────────┴───────────────────┴───────────────────────────────────┘

Console minimum width: 40 + 240 + 400 = 680px
Side panel collapsed: 40 + 0 + 400 = 440px
```

---

## 15. Keyboard Shortcuts

### Console 탭 전용 단축키

| Shortcut | Action |
|----------|--------|
| `⌘K` | Global Search (Console 내 오브젝트 검색) |
| `⌘W` | Close current Console tab |
| `⌘S` | Save current editor (Function/Trigger 등) |
| `⌘1~4` | Switch Nav panel (Objects, DBA, Monitor, Data) |
| `⌘B` | Toggle side panel visibility |
| `⌘J` | Toggle bottom output panel |
| `Esc` | Close modal / search |

### Query 탭 기존 단축키 (변경 없음)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Execute query |
| `⌘S` | Save query |

---

## 16. Implementation Plan

> Query 탭은 수정하지 않음. Console은 완전히 새로운 feature로 구현.

### Phase 0: Console 인프라
1. `src/renderer/features/console-browser/` 디렉토리 생성
2. ConsoleBrowserPage 라우팅 추가 (`/db/console/admin`)
3. LiveConsoleLayout에 "Console" 탭 추가
4. consoleBrowserStore (Zustand) — activeNav, openTabs, activeTabId
5. Multi-Tab 시스템 구현 (tabStore: id, type, label, icon, closable, dirty)
6. Nav Bar + Side Panel 토글 구현
7. Bottom Output Panel (결과/메시지)

### Phase 1: Object Browser + CRUD
1. Object Browser 패널 (SchemaPanel 참고하되 신규 구현)
2. Table Detail 탭 (Columns, Constraints, Indexes, Statistics, DDL)
3. Function/Procedure 에디터 탭 (CodeMirror + 파라미터 폼)
4. Trigger 에디터 탭 (PG 2-step workflow / MySQL inline)
5. Sequence Detail 탭
6. Event 에디터 탭 (MySQL/MariaDB)
7. PG 전용: Materialized View, Extension, Type, Domain, Policy

### Phase 2: DBA
1. DBA 패널 (유저/역할/권한 트리)
2. User Management 탭 (CRUD + 상세)
3. Privilege Matrix 탭 (체크박스 그리드)
4. Variable/Parameter 뷰어 탭 (검색/필터/인라인 편집)
5. Database/Schema 관리

### Phase 3: Monitor
1. Monitor 패널 (세션/통계 바로가기)
2. Active Sessions 탭 (자동 새로고침 + Kill)
3. EXPLAIN Visualizer 탭 (JSON → 트리)
4. Table/Index Statistics 탭
5. Lock Monitoring 탭
6. Server Status 탭

### Phase 4: Data Ops + Utility
1. Data Ops 패널
2. Export Wizard (CSV/JSON/SQL, 3-step)
3. Import Wizard (파일 업로드 + 컬럼 매핑)
4. SQL Dump/Restore (CLI wrapper)
5. Global Search (⌘K)

### Console 자체 SQL 실행 (Phase 0에서 함께)
- Bottom Output Panel에 SQL Preview 탭 추가
- Console 내 DDL/DML 생성 → 미리보기 → 실행 흐름
- "Edit in Query Tab" 버튼 (선택적 이동만 지원)

---

## 17. Error States & Edge Cases UI

> Console의 모든 화면에서 발생 가능한 에러와 엣지 케이스에 대한 UI 처리 표준.

### 17.1 연결 상태 관리

#### 연결 끊김 감지
Console은 연결 상태를 상시 감시하며, 끊김 시 즉각 UI에 반영.

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Connection Lost                                     [Dismiss] │
│                                                                  │
│  Connection to "production-db" was lost.                         │
│  Last connected: 10:30:15                                        │
│                                                                  │
│  [🔄 Reconnect]   [🔌 Go to Connections]                         │
└──────────────────────────────────────────────────────────────────┘
```

#### 상태 표시 위치
```
┌────┬──────────────────────────────────────────────────────────────┐
│ N  │  Console               [🟢 Connected: prod-db (PG 15.4)]    │ ← 정상
│ A  │  Console               [🔴 Disconnected: prod-db]  [🔄]     │ ← 끊김
│ V  │  Console               [🟡 Reconnecting... (3/5)]           │ ← 재연결 시도
└────┴──────────────────────────────────────────────────────────────┘
```

#### 연결 끊김 시 UI 동작
| 상태 | 동작 |
|------|------|
| Object Browser | 트리 유지 (캐시), 항목 클릭 시 재연결 시도 → 실패 시 에러 토스트 |
| 열린 탭 (Table Detail 등) | 내용 유지 (캐시), 상단에 `⚠ Stale data` 배너 표시 |
| DBA / Monitor | 전체 화면 → 연결 필요 안내 화면으로 교체 |
| Data Ops (진행 중) | 진행 바 멈춤 + 에러 메시지 + Resume/Cancel 선택 |
| Bottom Output | 마지막 메시지에 `❌ Connection lost` 추가 |

#### Stale Data 배너 (탭 내 표시)
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Data may be outdated — connection lost at 10:30:15             │
│   [🔄 Refresh when reconnected]  [Dismiss]                       │
├──────────────────────────────────────────────────────────────────┤
│ (기존 탭 내용 그대로 표시 — opacity 변경 없이 배너만 추가)          │
└──────────────────────────────────────────────────────────────────┘
```

#### 자동 재연결 정책
- 끊김 감지 즉시 1회 재연결 시도
- 실패 시 5초 간격으로 최대 5회 재시도 (backoff 없음, 사용자 대기 고려)
- 5회 실패 후 정지 → 수동 재연결 버튼만 표시
- 재연결 성공 시: Toast `✅ Reconnected to prod-db` + 활성 뷰 자동 새로고침

---

### 17.2 대규모 스키마 로딩 (테이블 500+)

#### 초기 로딩 — 점진적 표시
```
┌────────────────────────┐
│ OBJECTS                │
├────────────────────────┤
│ 🔍 Search objects...   │
├────────────────────────┤
│ ▸ 🗂 Tables (...)      │  ← 카운트 로딩 중: "..." 표시
│ ▸ 👁 Views (...)       │
│ ▸ ⚡ Functions (...)    │
│ ▸ ...                  │
├────────────────────────┤
│ ⏳ Loading schema...    │  ← 하단 인디케이터
│ ████████░░░░ 67%        │
└────────────────────────┘
```

#### 로딩 전략
| 단계 | 내용 | 타이밍 |
|------|------|--------|
| 1. 카테고리 카운트 | `SELECT count(*) FROM information_schema...` | 즉시 |
| 2. 오브젝트 목록 | 이름만 조회 (type, name) | 카운트 완료 후 |
| 3. 상세 메타데이터 | 컬럼/제약조건 등 | 항목 클릭(on-demand) 시 |

- 트리는 **이름만** 먼저 표시 (단계 2 완료 즉시)
- 컬럼 등 상세는 **트리 확장 시** lazy fetch
- 카테고리 접기/펼치기는 로딩 없이 즉각 반응

#### 가상화 (Virtualization)
- 카테고리 내 항목이 **100개 초과** 시 가상 스크롤 적용
- 표시 영역 + 위아래 20개 버퍼만 렌더
- 빠른 스크롤 시 placeholder (회색 바) 후 실제 항목으로 교체

```
│ ▾ 🗂 Tables (523)       │
│   ├ accounts            │  ← 실제 렌더
│   ├ addresses            │
│   ├ audit_logs           │
│   ├ ████████████████     │  ← placeholder (가상화 영역)
│   ├ ████████████████     │
│   ├ ████████████████     │
│   ...                    │
│   └ zones               │
└──────────────────────────┘
```

#### 검색 최적화 (대규모)
- 500+ 오브젝트 시 검색 입력 debounce: 300ms (기본 200ms → 증가)
- 결과는 **최대 50개**까지만 표시 + "N more results..." 링크
- 검색은 클라이언트 사이드 필터 (이미 로드된 목록 기준)

---

### 17.3 권한 부족 시 UI 처리

#### 벤더별 권한 에러 패턴
| 벤더 | 에러 예시 |
|------|----------|
| PG | `ERROR: permission denied for relation users` |
| MySQL | `ERROR 1044 (42000): Access denied for user 'app'@'%' to database 'admin'` |
| SQLite | N/A (파일 접근 권한만 해당) |

#### DBA 패널 — 권한 없음
```
┌──────────────────────────────────────────────────────────────────┐
│ 👤 DBA                                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │    🔒 Insufficient Privileges                               │ │
│  │                                                             │ │
│  │    Current user "app_user" does not have permission         │ │
│  │    to access DBA features.                                  │ │
│  │                                                             │ │
│  │    Required: SUPERUSER or pg_read_all_stats role            │ │
│  │                                                             │ │
│  │    [📋 Copy Required GRANT SQL]                              │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Object Browser — 부분 권한
특정 오브젝트만 접근 불가한 경우, 해당 항목에 잠금 표시:

```
│ ▾ 🗂 Tables (42)        │
│   ├ users               │
│   ├ orders              │
│   ├ 🔒 secret_config    │  ← 권한 없는 테이블 (회색 + 잠금)
│   ├ products            │
```

- 🔒 항목 클릭 시: 에러 토스트 `"Permission denied: SELECT on secret_config"`
- 🔒 항목 우클릭: 컨텍스트 메뉴에 `Copy Name`만 표시 (나머지 비활성)

#### Monitor — 부분 권한
```
┌──────────────────────────┐
│ MONITOR                  │
├──────────────────────────┤
│ ▸ 🖥 Active Sessions      │
│ ▸ 🔒 Locks               │  ← 권한 필요 (회색)
│ ▸ 📊 Table Statistics      │
│ ▸ 📈 Index Statistics      │
│ ▸ 🔒 Top SQL              │  ← 권한 필요 (회색)
│ ▸ 🖧 Server Status         │
└──────────────────────────┘
```

#### 권한 검사 타이밍
- **패널 활성화 시**: 해당 패널에 필요한 권한을 일괄 체크 (1회)
- **결과 캐시**: 세션 동안 유지 (Refresh 시 재검사)
- **항목별 검사 안 함**: 성능상 카테고리 단위로만 권한 체크

---

### 17.4 빈 상태 (Empty State)

#### Object Browser — 오브젝트 없음
```
┌────────────────────────┐
│ OBJECTS                │
├────────────────────────┤
│ 🔍 Search objects...   │
├────────────────────────┤
│                        │
│  📭 No objects found    │
│                        │
│  This database has no  │
│  tables, views, or     │
│  other objects yet.    │
│                        │
│  [+ Create Table]      │
│  [📜 Run SQL in Query] │
│                        │
└────────────────────────┘
```

#### 검색 결과 없음
```
┌────────────────────────┐
│ 🔍 xyzabc              │
├────────────────────────┤
│                        │
│  🔍 No results for     │
│     "xyzabc"           │
│                        │
│  Try a different       │
│  search term.          │
│                        │
└────────────────────────┘
```

#### Monitor — 세션 없음
```
┌──────────────────────────────────────────────────────────────────┐
│ 🖥 Active Sessions          [Auto-refresh: 5s ▾] [⏸ Pause]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                  🟢 All clear                                     │
│                  No active sessions right now.                    │
│                                                                  │
│                  Auto-refreshing every 5s                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 17.5 위험 작업 확인 (Destructive Actions)

#### DROP 확인 다이얼로그
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Drop Table                                           [×]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Are you sure you want to drop table "users"?                    │
│                                                                  │
│  ⚠ This action cannot be undone.                                 │
│  • 12,450 rows will be permanently deleted                       │
│  • 3 foreign keys reference this table                           │
│  • 2 triggers will be removed                                    │
│                                                                  │
│  ── Generated SQL ──                                             │
│  DROP TABLE public.users CASCADE;                                │
│                                                                  │
│  Type "users" to confirm:                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│                              [Cancel]  [🗑 Drop] (disabled)      │
│                                        ↑ 이름 정확히 입력해야 활성화 │
└──────────────────────────────────────────────────────────────────┘
```

#### Kill Session 확인
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Terminate Session                                    [×]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Terminate session PID 1235?                                     │
│                                                                  │
│  User: app_user                                                  │
│  Database: mydb                                                  │
│  State: idle in transaction (45s)                                │
│  Query: UPDATE orders SET status = 'shipped'...                  │
│                                                                  │
│  [Cancel Query Only]   [💀 Terminate Session]                    │
│  ↑ PG: pg_cancel_backend  ↑ PG: pg_terminate_backend            │
│    MySQL: KILL QUERY        MySQL: KILL CONNECTION               │
└──────────────────────────────────────────────────────────────────┘
```

#### VACUUM FULL / TRUNCATE 경고
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ VACUUM FULL                                          [×]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VACUUM FULL requires an exclusive lock on "orders".             │
│  This will block ALL reads and writes until complete.            │
│                                                                  │
│  Table size: 892 MB                                              │
│  Estimated time: 2-5 minutes                                     │
│                                                                  │
│  💡 Consider VACUUM (without FULL) for non-blocking cleanup.     │
│                                                                  │
│                    [Cancel]  [VACUUM (safe)]  [⚠ VACUUM FULL]    │
└──────────────────────────────────────────────────────────────────┘
```

#### 위험도별 확인 수준

| 위험도 | 예시 | 확인 방식 |
|--------|------|----------|
| 🔴 Critical | DROP TABLE/DB, TRUNCATE, Kill Session | 이름 타이핑 확인 |
| 🟡 Warning | VACUUM FULL, DROP INDEX, Variable 변경 | 확인 다이얼로그 |
| 🟢 Safe | VACUUM, ANALYZE, EXPLAIN, Refresh | 확인 없이 실행 |

---

### 17.6 Long-Running Operation UI

#### 진행 상태 표시 (Data Ops, DDL 등)
```
┌──────────────────────────────────────────────────────────────────┐
│ ⏳ Operation in Progress                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Exporting "orders" (1.2M rows)                                  │
│                                                                  │
│  ████████████████████░░░░░░░░░░  67%                             │
│  800,000 / 1,200,000 rows                                        │
│  Elapsed: 1m 23s  ·  Remaining: ~42s                             │
│                                                                  │
│  [Cancel]                                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### 타임아웃 처리
- 쿼리 실행: 기본 30초 타임아웃 (Settings에서 조절 가능)
- 스키마 로딩: 기본 15초 타임아웃
- 타임아웃 발생 시:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⏱ Operation Timed Out                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Schema loading exceeded 15s timeout.                            │
│  This may indicate a slow connection or large schema.            │
│                                                                  │
│  [🔄 Retry with 60s timeout]  [⚙ Adjust timeout in Settings]    │
└──────────────────────────────────────────────────────────────────┘
```

---

### 17.7 에러 메시지 표준

#### Toast Notification (일반 에러)
```
┌─────────────────────────────────────────────────┐
│ ❌ Failed to load table "users"                  │  ← 2-line max
│    Connection refused (ECONNREFUSED)             │
│                                     [Details ▸]  │
└──────────────────────────────────────────────────┘
  ↑ 우측 하단, 5초 후 자동 사라짐 (에러는 10초)
```

#### Bottom Output Panel (상세 에러)
`[Details ▸]` 클릭 시 Bottom Output > Messages 탭에 상세 표시:

```
── Messages Tab ──
[10:30:15] ❌ ERROR: Failed to load table "users"
           Connection: prod-db (postgresql://10.0.0.5:5432/mydb)
           Error: ECONNREFUSED - Connection refused
           Hint: Check if the database server is running and accessible.

[10:30:10] ✅ Schema loaded successfully (42 tables, 8 views)
```

#### 에러 메시지 규칙
| 규칙 | 설명 |
|------|------|
| 사용자 친화적 | DB 원문 에러를 그대로 노출하되, 한 줄 요약 추가 |
| 액션 제시 | 가능하면 해결 방법 힌트 포함 |
| 내부 정보 숨김 | 서버 IP/포트는 연결 이름으로 대체 가능 (Settings 옵션) |
| 복사 가능 | 에러 메시지 전체를 클립보드 복사 버튼 제공 |

---

### 17.8 SQLite 파일 잠금 엣지 케이스

> SQLite는 파일 기반이므로 다른 프로세스가 DB 파일을 점유할 수 있음.

#### 파일 잠금 에러
```
┌──────────────────────────────────────────────────────────────────┐
│ 🔒 Database Locked                                     [Dismiss] │
│                                                                  │
│  The database file is locked by another process.                 │
│  File: ~/data/app.db                                             │
│                                                                  │
│  This usually means another application is writing               │
│  to the database. Operations will retry automatically.           │
│                                                                  │
│  [🔄 Retry Now]   [📁 Open in Finder]                            │
└──────────────────────────────────────────────────────────────────┘
```

#### SQLite WAL 모드 상태
```
┌────────────────────────┐
│ ── DB Info ──          │
│ 📄 File: ~/data/app.db │
│ 📏 Size: 24.3 MB       │
│ 🔖 SQLite 3.45.0       │
│ 📐 Page Size: 4096     │
│ 📊 Page Count: 6,225   │
│ 🔄 Journal: WAL        │  ← WAL/DELETE/TRUNCATE 등
│ 🔒 Lock: None          │  ← None/Shared/Exclusive
└────────────────────────┘
```

---

### 17.9 Console Settings (⚙)

> Nav Bar 하단 Settings 아이콘 클릭 시 표시.

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚙ Console Settings                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── General ──                                                   │
│  Query Timeout:        [30  ] seconds                            │
│  Schema Load Timeout:  [15  ] seconds                            │
│  Auto-refresh Interval:[5   ] seconds (Monitor)                  │
│                                                                  │
│  ── Connection ──                                                │
│  Auto-reconnect:       [✓] Enabled                               │
│  Max Reconnect Attempts: [5  ]                                   │
│  Hide Server IP in Errors: [ ]                                   │
│                                                                  │
│  ── Display ──                                                   │
│  Tree Virtualization:  [✓] Enable for 100+ items                │
│  Search Debounce:      [200 ] ms                                 │
│  Confirm Destructive:  [✓] Always (recommended)                  │
│                                                                  │
│                                          [Reset Defaults] [Save] │
└──────────────────────────────────────────────────────────────────┘
```
