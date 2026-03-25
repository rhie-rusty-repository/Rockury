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

const PG_CHILD_KEYS = new Set(['Plans']);
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
