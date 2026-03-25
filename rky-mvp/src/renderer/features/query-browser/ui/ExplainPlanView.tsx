// src/renderer/features/query-browser/ui/ExplainPlanView.tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
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
        <div className={depth > 0 ? 'ml-5 border-l border-border pl-4' : ''}>
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
