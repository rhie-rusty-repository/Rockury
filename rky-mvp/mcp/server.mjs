#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { listDiagrams, getDiagramById, getDiagramByName, createDiagram, updateDiagram } from './lib/store.mjs';
import { generateDdl, parseDdl } from './lib/ddl.mjs';
import { normalizeTables } from './lib/normalize.mjs';
import { resolveDbPath } from './lib/dbPath.mjs';

/**
 * rky-schema MCP server.
 *
 * Exposes the rockury (rky) Schema Studio's virtual diagrams to an external
 * agent so it can create and analyze database schemas. Reads/writes the same
 * rockury.db the desktop app uses, so anything created here appears in the app
 * (refresh Schema Studio to see it) and anything designed in the app can be read
 * back here.
 *
 * DB access uses Node's built-in node:sqlite — no native dependency, so it never
 * clashes with the app's Electron-ABI better-sqlite3 build.
 */

const DB_TYPES = ['postgresql', 'mysql', 'mariadb', 'sqlite'];

const columnSchema = {
  type: 'object',
  required: ['name', 'type'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    type: { type: 'string', description: 'SQL data type, e.g. BIGINT, VARCHAR(255), TIMESTAMPTZ, NUMERIC(12,2)' },
    pk: { type: 'boolean', description: 'Primary key (implies NOT NULL unless nullable is set)' },
    nullable: { type: 'boolean', description: 'Defaults to true, or false when pk is true' },
    unique: { type: 'boolean' },
    autoIncrement: { type: 'boolean' },
    default: { type: ['string', 'null'], description: "Default expression, e.g. now(), 0, 'active'" },
    comment: { type: 'string' },
    references: {
      type: 'object',
      description: 'Foreign key target',
      required: ['table', 'column'],
      additionalProperties: false,
      properties: {
        table: { type: 'string' },
        column: { type: 'string' },
        onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'] },
        onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'] },
      },
    },
  },
};

const tableSchema = {
  type: 'object',
  required: ['name', 'columns'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    comment: { type: 'string' },
    columns: { type: 'array', minItems: 1, items: columnSchema },
  },
};

const tablesArraySchema = {
  type: 'array',
  description: 'Tables in a friendly shape; normalized into the app diagram model',
  items: tableSchema,
};

const TOOLS = [
  {
    name: 'list_diagrams',
    description:
      'List virtual schema diagrams in rockury (rky) Schema Studio. Returns id, name, version, table count and timestamps. Use this to find an existing diagram (e.g. PICCARD) before reading or editing it.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        includeHidden: { type: 'boolean', description: 'Include hidden diagrams (default false)' },
      },
    },
  },
  {
    name: 'get_diagram',
    description:
      'Read a diagram by id or name. Returns its full table model (columns, keys, foreign keys) plus generated DDL. Use this to analyze an existing schema.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        name: { type: 'string', description: 'Exact diagram name; used when id is omitted' },
        dbType: { type: 'string', enum: DB_TYPES, description: 'Dialect for the generated DDL (default postgresql)' },
      },
    },
  },
  {
    name: 'create_diagram',
    description:
      'Create a new virtual diagram in Schema Studio. Provide the schema either as `tables` (structured) or `ddl` (CREATE TABLE statements). Appears in the app after refreshing Schema Studio.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        version: { type: 'string', description: 'Semver-ish label, default 1.0.0' },
        tables: tablesArraySchema,
        ddl: { type: 'string', description: 'CREATE TABLE DDL, parsed into tables (alternative to `tables`)' },
      },
    },
  },
  {
    name: 'update_diagram',
    description:
      'Update an existing diagram. `tables` or `ddl` REPLACE the full table set. name/version/description patch metadata only.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        tables: tablesArraySchema,
        ddl: { type: 'string' },
      },
    },
  },
  {
    name: 'generate_ddl',
    description: 'Generate CREATE TABLE DDL from a structured table set. Does not touch the database.',
    inputSchema: {
      type: 'object',
      required: ['tables'],
      additionalProperties: false,
      properties: {
        tables: tablesArraySchema,
        dbType: { type: 'string', enum: DB_TYPES, description: 'Default postgresql' },
      },
    },
  },
  {
    name: 'parse_ddl',
    description: 'Parse CREATE TABLE DDL into the structured table model (columns, PK/FK/UNIQUE). Does not touch the database.',
    inputSchema: {
      type: 'object',
      required: ['ddl'],
      additionalProperties: false,
      properties: {
        ddl: { type: 'string' },
      },
    },
  },
];

// Resolve tables from either structured `tables` or `ddl`.
function resolveTables(args) {
  if (Array.isArray(args.tables) && args.tables.length > 0) return normalizeTables(args.tables);
  if (typeof args.ddl === 'string' && args.ddl.trim()) return parseDdl(args.ddl);
  return null;
}

function summary(diagram) {
  return {
    id: diagram.id,
    name: diagram.name,
    version: diagram.version,
    description: diagram.description,
    tableCount: diagram.tables.length,
    tables: diagram.tables.map((t) => ({ name: t.name, columns: t.columns.length })),
    updatedAt: diagram.updatedAt,
  };
}

async function handleTool(name, args = {}) {
  switch (name) {
    case 'list_diagrams': {
      const diagrams = listDiagrams({ includeHidden: !!args.includeHidden });
      return diagrams.map((d) => ({
        id: d.id,
        name: d.name,
        version: d.version,
        tableCount: d.tables.length,
        updatedAt: d.updatedAt,
      }));
    }

    case 'get_diagram': {
      const diagram = args.id ? getDiagramById(args.id) : args.name ? getDiagramByName(args.name) : null;
      if (!diagram) throw new Error(`Diagram not found (id=${args.id ?? '-'}, name=${args.name ?? '-'})`);
      return {
        id: diagram.id,
        name: diagram.name,
        version: diagram.version,
        description: diagram.description,
        tables: diagram.tables,
        ddl: generateDdl(diagram.tables, args.dbType ?? 'postgresql'),
      };
    }

    case 'create_diagram': {
      const tables = resolveTables(args) ?? [];
      const diagram = createDiagram({
        name: args.name,
        description: args.description ?? '',
        version: args.version ?? '1.0.0',
        tables,
      });
      return { created: true, ...summary(diagram) };
    }

    case 'update_diagram': {
      const tables = resolveTables(args);
      const diagram = updateDiagram(args.id, {
        name: args.name,
        version: args.version,
        description: args.description,
        tables: tables ?? undefined,
      });
      return { updated: true, ...summary(diagram) };
    }

    case 'generate_ddl': {
      const tables = normalizeTables(args.tables);
      return { ddl: generateDdl(tables, args.dbType ?? 'postgresql') };
    }

    case 'parse_ddl': {
      return { tables: parseDdl(args.ddl) };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: 'rky-schema', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// Log to stderr only — stdout is reserved for the JSON-RPC protocol.
console.error(`[rky-schema] MCP server ready. DB: ${resolveDbPath()}`);
