import { useState, useCallback, useRef } from 'react';
import { queryApi } from '@/features/query-execution/api/queryApi';
import { queryBrowserApi } from '../api/queryBrowserApi';
import { isDdl } from '../lib/ddlDetection';
import type { IQueryResult, IExplainResult, TDbType } from '~/shared/types/db';

interface TxState {
  txId: string;
  dmlType: string;
  affectedRows: number;
}

export function useQueryExecution(connectionId: string, dbType?: TDbType) {
  const [result, setResult] = useState<IQueryResult | null>(null);
  const [explainResult, setExplainResult] = useState<IExplainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txState, setTxState] = useState<TxState | null>(null);
  const [isDdlWarning, setIsDdlWarning] = useState(false);
  const [isExplainOnly, setIsExplainOnly] = useState(false);

  // Generation counter to discard stale EXPLAIN results from previous runs
  const genRef = useRef(0);

  const execute = useCallback(async (sql: string) => {
    const gen = ++genRef.current;
    setError(null);
    setResult(null);
    setExplainResult(null);
    setTxState(null);
    setIsDdlWarning(false);
    setIsExplainOnly(false);
    setIsLoading(true);

    try {
      // Step 1: EXPLAIN ANALYZE (fire-and-forget, non-blocking)
      if (dbType) {
        queryApi
          .explainAnalyze({ connectionId, sql, dbType })
          .then((res) => {
            // Discard if a newer execution has started
            if (gen !== genRef.current) return;
            if (res.success && res.data) setExplainResult(res.data);
          })
          .catch(() => {});
      }

      // Step 2: Actual query execution (existing logic unchanged)
      if (isDdl(sql)) {
        const res = await queryApi.execute({ connectionId, sql });
        if (!res.success) throw new Error((res as any).error ?? 'DDL execution failed');
        setResult(res.data ?? null);
        setIsDdlWarning(true);
        return;
      }

      const trimmed = sql.replace(/^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, '').trim();
      const isDml = /^(INSERT|UPDATE|DELETE)\s/i.test(trimmed);

      if (isDml) {
        const beginRes = await queryBrowserApi.txBegin(connectionId);
        if (!beginRes.success) throw new Error(beginRes.error ?? 'Failed to begin transaction');
        const txId = beginRes.data!.txId;

        const execRes = await queryBrowserApi.txExecute(txId, sql);
        if (!execRes.success) {
          await queryBrowserApi.txRollback(txId).catch(() => {});
          throw new Error(execRes.error ?? 'DML execution failed');
        }

        const dmlType = trimmed.split(/\s/)[0].toUpperCase();
        setTxState({ txId, dmlType, affectedRows: execRes.data?.affectedRows ?? 0 });
        setResult(execRes.data ?? null);
      } else {
        const res = await queryApi.execute({ connectionId, sql });
        if (!res.success) throw new Error((res as any).error ?? 'Query failed');
        setResult(res.data ?? null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, dbType]);

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

  const confirm = useCallback(async () => {
    if (!txState) return;
    try {
      const res = await queryBrowserApi.txCommit(txState.txId);
      if (!res.success) throw new Error(res.error ?? 'Commit failed');
      setTxState(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [txState]);

  const rollback = useCallback(async () => {
    if (!txState) return;
    try {
      const res = await queryBrowserApi.txRollback(txState.txId);
      if (!res.success) throw new Error(res.error ?? 'Rollback failed');
      setTxState(null);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [txState]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    result, explainResult, error, isLoading, txState, isDdlWarning,
    isExplainOnly,
    execute, explain, confirm, rollback, dismissError,
  };
}
