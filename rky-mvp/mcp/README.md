# rky-schema MCP server

Exposes the **rockury (rky) Schema Studio** virtual diagrams to an external
agent (e.g. the `pic-card-mvp-pipe` project's Claude agent) so it can **create**
and **analyze** database schemas through tool calls.

It reads and writes the same `rockury.db` the desktop app uses, so:

- schemas the agent creates **appear in the app** (refresh Schema Studio), and
- schemas you design in the app can be **read back and analyzed** by the agent.

## Why it's safe for the app

- DB access uses Node's built-in **`node:sqlite`** — **no native module**. It
  never conflicts with the app's Electron-ABI `better-sqlite3` build.
- The SDK is installed in an **isolated `mcp/node_modules`** (pure JS). The
  app's root `node_modules` is untouched.
- Purely additive: no changes to `src/`.

## Requirements

- Node.js **≥ 22.5** (uses `node:sqlite`; developed/tested on Node 24).
- The rockury app must have run at least once so `rockury.db` exists.

## Install

```bash
cd mcp
npm install
```

## Register it in another project (Claude Code)

Add a `.mcp.json` at that project's root (already done for
`pic-card-mvp-pipe/sandbox`):

```json
{
  "mcpServers": {
    "rky-schema": {
      "command": "node",
      "args": [
        "--disable-warning=ExperimentalWarning",
        "/Users/rhiemh/workspace-me/__archive__/rockury-stale/rky-mvp/mcp/server.mjs"
      ]
    }
  }
}
```

Then in that project, approve the server when Claude Code prompts, or run
`/mcp` to check its status. Verify with `claude mcp list`.

### DB location override

By default the server finds `rockury.db` at the OS-standard Electron userData
path (macOS: `~/Library/Application Support/rockury/rockury.db`). Override with:

```json
"env": { "ROCKURY_DB_PATH": "/absolute/path/to/rockury.db" }
```

## Tools

| Tool | Purpose |
|------|---------|
| `list_diagrams` | List diagrams (id, name, version, table count). Find e.g. `PICCARD`. |
| `get_diagram` | Read a diagram by `id` or `name` → full table model + generated DDL. Use to analyze. |
| `create_diagram` | Create a diagram from `tables` (structured) or `ddl`. |
| `update_diagram` | Replace tables (via `tables` or `ddl`) and/or patch name/version/description. |
| `generate_ddl` | Structured tables → CREATE TABLE DDL (no DB write). |
| `parse_ddl` | CREATE TABLE DDL → structured tables (no DB write). |

### Structured table shape

`create_diagram` / `update_diagram` / `generate_ddl` accept a friendly shape:

```jsonc
{
  "name": "card",
  "comment": "A TCG card",
  "columns": [
    { "name": "id",     "type": "BIGINT",       "pk": true },
    { "name": "tcg_id", "type": "VARCHAR(64)",  "unique": true, "nullable": false },
    { "name": "set_id", "type": "BIGINT",
      "references": { "table": "card_set", "column": "id", "onDelete": "SET NULL" } },
    { "name": "captured_at", "type": "TIMESTAMPTZ", "nullable": false, "default": "now()" }
  ]
}
```

Column fields: `name`, `type` (required); optional `pk`, `nullable` (default
true, false for PK), `unique`, `autoIncrement`, `default`, `comment`,
`references { table, column, onDelete?, onUpdate? }`.

Table-level fields (for composite/extra objects):

```jsonc
{
  "name": "tcg_card_prices",
  "columns": [ /* ... */ ],
  "primaryKey": ["card_id", "printing"],          // composite PK (overrides per-column pk)
  "uniques":    [["card_id", "printing"]],         // UNIQUE (single or composite)
  "indexes":    [["card_id"]],                      // non-unique CREATE INDEX (FK/join cols)
  "checks":     ["market_price >= 0"]              // CHECK constraints
}
```

Generated DDL now emits: `SERIAL`/`BIGSERIAL` (pg) · `AUTO_INCREMENT` (mysql) ·
`AUTOINCREMENT` (sqlite) for `autoIncrement` columns; table-level `PRIMARY KEY`,
`UNIQUE` (incl. composite), `FOREIGN KEY`, `CHECK`; `CREATE INDEX`; and
`COMMENT ON TABLE/COLUMN` (pg) from `comment` fields.

`dbType` (on DDL tools / `get_diagram`) is one of `postgresql` (default),
`mysql`, `mariadb`, `sqlite` — it only affects identifier quoting in DDL.

## Example agent prompts (from the pic-card project)

- "List the diagrams in rky and show me the DDL for `PICCARD`."
- "Design a schema for the TCG + PriceCharting data we collected and create it in
  rky as `PICCARD` with tables card, card_set, price, grade."
- "Read the `PICCARD` diagram and review it for missing indexes and FK gaps."

## Notes / limitations

- Writes go straight to `rockury.db`. The running app won't live-refresh — reopen
  or switch diagrams in Schema Studio to see agent changes.
- Concurrent writes: `busy_timeout` is set to 5s. Avoid editing the exact same
  diagram in the app and via the agent simultaneously.
- `create_diagram` also seeds an initial version row so the app's version dropdown
  is populated. `update_diagram` replaces `tables_json` in place (no new version).
