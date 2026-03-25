import { useState } from 'react';
import { Zap, ChevronRight, ChevronDown } from 'lucide-react';
import { ExplainPlanView } from './ExplainPlanView';
import type { IExplainResult, TDbType } from '~/shared/types/db';

interface ExplainSummaryBannerProps {
  summary: string;
  explainResult?: IExplainResult;
  dbType?: TDbType;
}

export function ExplainSummaryBanner({ summary, explainResult, dbType }: ExplainSummaryBannerProps) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;

  const canExpand = !!explainResult && !!dbType;

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => canExpand && setExpanded(!expanded)}
        className={`flex w-full items-center gap-1.5 bg-muted/30 px-3 py-1 ${canExpand ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      >
        <Zap className="size-3 shrink-0 text-amber-500" />
        <span className="truncate text-xs text-muted-foreground">{summary}</span>
        {canExpand && (
          <span className="ml-auto shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>
      {expanded && explainResult && dbType && (
        <div className="max-h-[50vh] overflow-auto border-t border-border/50">
          <ExplainPlanView result={explainResult} dbType={dbType} />
        </div>
      )}
    </div>
  );
}
