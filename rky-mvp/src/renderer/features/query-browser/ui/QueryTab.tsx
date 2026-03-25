import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { Loader2, TableProperties } from 'lucide-react';
import { DataGrid, DataFooter } from '@/features/data-browser';
import { generateUuid } from '@/features/data-browser/lib/uuid';
import { useQueryTree } from '../model/useQueryTree';
import { useQueryExecution } from '../model/useQueryExecution';
import { useQueryBrowserStore } from '../model/queryBrowserStore';
import { useSchemaData } from '../model/useSchemaData';
import { queryBrowserApi } from '../api/queryBrowserApi';
import { FileTreePanel } from './FileTreePanel';
import { SqlEditorPanel, type SqlEditorPanelHandle } from './SqlEditorPanel';
import { DmlResultPanel } from './DmlResultPanel';
import { SchemaPanel } from './SchemaPanel';
import { TablePreviewModal } from './TablePreviewModal';
import { ExplainSummaryBanner } from './ExplainSummaryBanner';
import { ExplainPlanView } from './ExplainPlanView';
import { extractKeywords, replaceKeywords } from '../lib/keywords';
import type { TDbType } from '~/shared/types/db';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QueryTabProps {
  connectionId: string;
  dbType: TDbType;
}

interface QueryMeta {
  id: string;
  name: string;
  description: string;
  folderId: string | null;
  sortOrder: number;
}

const AUTO_SAVE_DELAY = 2000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QueryTab({ connectionId, dbType }: QueryTabProps) {
  const { selectedQueryId, setSelectedQueryId, schemaPanelOpen, setSchemaPanelOpen } = useQueryBrowserStore();
  const queryTree = useQueryTree(connectionId);
  const execution = useQueryExecution(connectionId, dbType);
  const { tables: schemaTables, isLoading: schemaLoading } = useSchemaData(connectionId);

  // Build schema map for SQL autocomplete: { tableName: ['col1', 'col2'] }
  const sqlSchema = useMemo(() => {
    if (schemaTables.length === 0) return undefined;
    const schema: Record<string, readonly string[]> = {};
    for (const t of schemaTables) {
      schema[t.name] = t.columns.map((c) => c.name);
    }
    return schema;
  }, [schemaTables]);

  const [loadedSql, setLoadedSql] = useState('');
  const [queryMeta, setQueryMeta] = useState<QueryMeta | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>([]);
  const [keywordValues, setKeywordValues] = useState<Record<string, string>>({});
  const [showKeywordError, setShowKeywordError] = useState(false);
  const [previewTableName, setPreviewTableName] = useState<string | null>(null);

  const editorRef = useRef<SqlEditorPanelHandle>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSqlRef = useRef('');

  /* -- Load query on selection -------------------------------------- */
  useEffect(() => {
    if (!selectedQueryId) {
      setQueryMeta(null);
      setLoadedSql('');
      lastSavedSqlRef.current = '';
      return;
    }

    let cancelled = false;
    queryBrowserApi.queryGet(selectedQueryId).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const q = res.data;
      setQueryMeta({
        id: q.id,
        name: q.name,
        description: q.description,
        folderId: q.folderId ?? null,
        sortOrder: q.sortOrder ?? 0,
      });
      setLoadedSql(q.sqlContent);
      lastSavedSqlRef.current = q.sqlContent;
      const kws = extractKeywords(q.sqlContent);
      setDetectedKeywords(kws);
      setKeywordValues((prev) => {
        const next: Record<string, string> = {};
        for (const kw of kws) next[kw] = prev[kw] ?? '';
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [selectedQueryId]);

  /* -- Auto-save SQL on inactivity ---------------------------------- */
  const saveCurrentSql = useCallback(
    (sql: string) => {
      if (!queryMeta || sql === lastSavedSqlRef.current) return;
      lastSavedSqlRef.current = sql;
      queryTree.saveQuery({
        id: queryMeta.id,
        connectionId,
        folderId: queryMeta.folderId,
        name: queryMeta.name,
        description: queryMeta.description,
        sqlContent: sql,
        sortOrder: queryMeta.sortOrder,
      });
    },
    [queryMeta, connectionId, queryTree],
  );

  const handleContentChange = useCallback(
    (value: string) => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => saveCurrentSql(value), AUTO_SAVE_DELAY);

      // Real-time keyword detection
      const kws = extractKeywords(value);
      setDetectedKeywords(kws);
      setShowKeywordError(false);
      // Preserve existing values, remove stale ones
      setKeywordValues((prev) => {
        const next: Record<string, string> = {};
        for (const kw of kws) next[kw] = prev[kw] ?? '';
        return next;
      });
    },
    [saveCurrentSql],
  );

  /* -- Description editing ------------------------------------------ */
  const handleDescriptionClick = useCallback(() => {
    if (!queryMeta) return;
    setDescriptionDraft(queryMeta.description);
    setIsEditingDescription(true);
  }, [queryMeta]);

  const handleDescriptionBlur = useCallback(() => {
    setIsEditingDescription(false);
    if (!queryMeta) return;
    const trimmed = descriptionDraft.trim();
    if (trimmed === queryMeta.description) return;
    const updated = { ...queryMeta, description: trimmed };
    setQueryMeta(updated);
    const currentSql = editorRef.current?.getValue() ?? '';
    queryTree.saveQuery({
      id: updated.id,
      connectionId,
      folderId: updated.folderId,
      name: updated.name,
      description: trimmed,
      sqlContent: currentSql,
      sortOrder: updated.sortOrder,
    });
  }, [queryMeta, descriptionDraft, connectionId, queryTree]);

  /* -- Run query ---------------------------------------------------- */
  const handleRun = useCallback((sql: string) => {
    if (!sql.trim()) return;
    saveCurrentSql(sql);

    if (detectedKeywords.length > 0) {
      const hasEmpty = detectedKeywords.some((kw) => !keywordValues[kw]?.trim());
      if (hasEmpty) {
        setShowKeywordError(true);
        return;
      }
      const resolvedSql = replaceKeywords(sql, keywordValues);
      setPage(0);
      execution.execute(resolvedSql);
    } else {
      setPage(0);
      execution.execute(sql);
    }
  }, [saveCurrentSql, execution, detectedKeywords, keywordValues]);

  const handleExplain = useCallback((sql: string) => {
    if (!sql.trim()) return;
    saveCurrentSql(sql);

    if (detectedKeywords.length > 0) {
      const hasEmpty = detectedKeywords.some((kw) => !keywordValues[kw]?.trim());
      if (hasEmpty) {
        setShowKeywordError(true);
        return;
      }
      const resolvedSql = replaceKeywords(sql, keywordValues);
      execution.explain(resolvedSql);
    } else {
      execution.explain(sql);
    }
  }, [saveCurrentSql, execution, detectedKeywords, keywordValues]);

  /* -- File tree callbacks ------------------------------------------ */
  const handleSelect = useCallback(
    (id: string) => {
      // Save current before switching
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const currentSql = editorRef.current?.getValue() ?? '';
      saveCurrentSql(currentSql);
      setSelectedQueryId(id);
      setColumnVisibility({});
      setPage(0);
    },
    [saveCurrentSql, setSelectedQueryId],
  );

  const handleCreateFolder = useCallback(
    (parentId: string | null) => {
      queryTree.saveFolder({
        id: generateUuid(),
        connectionId,
        parentId,
        name: 'New Folder',
        sortOrder: queryTree.folders.length,
      });
    },
    [queryTree, connectionId],
  );

  const handleCreateItem = useCallback(
    (folderId: string | null) => {
      const id = generateUuid();
      queryTree
        .saveQuery({
          id,
          connectionId,
          folderId,
          name: 'Untitled Query',
          description: '',
          sqlContent: '',
          sortOrder: queryTree.queries.length,
        })
        .then(() => setSelectedQueryId(id));
    },
    [queryTree, connectionId, setSelectedQueryId],
  );

  const handleRenameFolder = useCallback(
    (id: string, name: string) => {
      const folder = queryTree.folders.find((f) => f.id === id);
      if (!folder) return;
      queryTree.saveFolder({
        id,
        connectionId,
        parentId: folder.parentId,
        name,
        sortOrder: folder.sortOrder,
      });
    },
    [queryTree, connectionId],
  );

  const handleRenameItem = useCallback(
    (id: string, name: string) => {
      // Also update local meta if it is the selected query
      if (queryMeta && queryMeta.id === id) {
        const updated = { ...queryMeta, name };
        setQueryMeta(updated);
        const currentSql = editorRef.current?.getValue() ?? '';
        queryTree.saveQuery({
          id,
          connectionId,
          folderId: updated.folderId,
          name,
          description: updated.description,
          sqlContent: currentSql,
          sortOrder: updated.sortOrder,
        });
      } else {
        // Need to fetch the query data to preserve other fields
        queryBrowserApi.queryGet(id).then((res) => {
          if (!res.success || !res.data) return;
          const q = res.data;
          queryTree.saveQuery({
            id,
            connectionId,
            folderId: q.folderId,
            name,
            description: q.description,
            sqlContent: q.sqlContent,
            sortOrder: q.sortOrder ?? 0,
          });
        });
      }
    },
    [queryMeta, queryTree, connectionId],
  );

  const handleDeleteFolder = useCallback(
    (id: string) => {
      queryTree.deleteFolder(id);
    },
    [queryTree],
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      const res = await queryTree.deleteQuery(id);
      if (res.success && selectedQueryId === id) {
        setSelectedQueryId(null);
      }
      return res;
    },
    [queryTree, selectedQueryId, setSelectedQueryId],
  );

  const handleMove = useCallback(
    (moveItems: { id: string; folderId?: string | null; sortOrder: number }[]) => {
      queryTree.bulkMove(moveItems);
    },
    [queryTree],
  );

  const handleMoveFolder = useCallback(
    (folderId: string, newParentId: string | null) => {
      const folder = queryTree.folders.find((f) => f.id === folderId);
      if (!folder) return;
      queryTree.saveFolder({
        id: folderId,
        connectionId,
        parentId: newParentId,
        name: folder.name,
        sortOrder: folder.sortOrder,
      });
    },
    [queryTree, connectionId],
  );

  /* -- Schema insert ------------------------------------------------ */
  const handleSchemaInsert = useCallback(
    (text: string) => {
      editorRef.current?.insertText(text);
    },
    [],
  );

  /* -- Map tree items for FileTreePanel ----------------------------- */
  const treeItems = queryTree.queries.map((q) => ({
    id: q.id,
    name: q.name,
    folderId: q.folderId ?? null,
    sortOrder: q.sortOrder ?? 0,
    description: q.description,
  }));

  const treeFolders = queryTree.folders.map((f) => ({
    id: f.id,
    parentId: f.parentId ?? null,
    name: f.name,
    sortOrder: f.sortOrder ?? 0,
  }));

  /* -- Result display logic ----------------------------------------- */
  const hasSelectResult =
    execution.result && execution.result.columns && execution.result.columns.length > 0;

  return (
    <div className="flex h-full">
      {/* Left Panel: File Tree */}
      <FileTreePanel
        folders={treeFolders}
        items={treeItems}
        selectedId={selectedQueryId}
        onSelect={handleSelect}
        onCreateFolder={handleCreateFolder}
        onCreateItem={handleCreateItem}
        onRenameFolder={handleRenameFolder}
        onRenameItem={handleRenameItem}
        onDeleteFolder={handleDeleteFolder}
        onDeleteItem={handleDeleteItem}
        onMove={handleMove}
        onMoveFolder={handleMoveFolder}
        searchPlaceholder="Filter queries..."
        createItemLabel="New Query"
        itemIcon="query"
      />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {queryMeta ? (
          <>
            {/* Toolbar: filename + description + schema toggle */}
            <div className="flex shrink-0 flex-col border-b border-border px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{queryMeta.name}</span>
                {/* TODO: collection badges */}
                <button
                  type="button"
                  onClick={() => setSchemaPanelOpen(!schemaPanelOpen)}
                  className={`ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    schemaPanelOpen
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Toggle Schema Panel"
                >
                  <TableProperties className="size-3" />
                  Schema
                </button>
              </div>
              {isEditingDescription ? (
                <input
                  type="text"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDescriptionBlur();
                    if (e.key === 'Escape') setIsEditingDescription(false);
                  }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="mt-0.5 min-w-0 bg-transparent text-xs text-muted-foreground outline-none"
                  placeholder="Add description..."
                />
              ) : (
                <button
                  type="button"
                  onClick={handleDescriptionClick}
                  className="mt-0.5 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  {queryMeta.description || 'Add description...'}
                </button>
              )}
            </div>

            {/* Live keyword inputs — shown above editor when keywords detected */}
            {detectedKeywords.length > 0 && (
              <div className="border-b border-border bg-amber-500/5 px-3 py-1.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  <span>{detectedKeywords.length} keyword{detectedKeywords.length > 1 ? 's' : ''}</span>
                  {showKeywordError && (
                    <span className="text-destructive">— fill in all values to run</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {detectedKeywords.map((kw) => (
                    <div key={kw} className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-muted-foreground">{kw}</span>
                      <input
                        type="text"
                        value={keywordValues[kw] ?? ''}
                        onChange={(e) => {
                          setKeywordValues((prev) => ({ ...prev, [kw]: e.target.value }));
                          setShowKeywordError(false);
                        }}
                        placeholder="value"
                        className={`w-28 rounded border px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary ${
                          showKeywordError && !keywordValues[kw]?.trim()
                            ? 'border-destructive bg-destructive/5'
                            : 'border-border bg-background'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editor + Schema side-by-side */}
            <div className="flex min-h-0 flex-1">
              {/* Editor + Result column */}
              <div className="flex min-w-0 flex-1 flex-col">
                {/* SQL Editor — key forces remount on query switch */}
                <SqlEditorPanel
                  key={queryMeta.id}
                  ref={editorRef}
                  initialValue={loadedSql}
                  onContentChange={handleContentChange}
                  onRun={handleRun}
                  onExplain={handleExplain}
                  isLoading={execution.isLoading}
                  sqlSchema={sqlSchema}
                  dbType={dbType}
                />

                {/* Error Banner */}
                {execution.error && (
                  <div className="flex items-center gap-2 bg-destructive/10 px-3 py-2">
                    <span className="flex-1 text-xs text-destructive">{execution.error}</span>
                    <button
                      type="button"
                      onClick={execution.dismissError}
                      className="text-xs text-destructive underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* EXPLAIN ANALYZE summary banner */}
                {!execution.isExplainOnly && execution.explainResult?.summary && (
                  <ExplainSummaryBanner summary={execution.explainResult.summary} />
                )}

                {/* Result area */}
                {execution.txState ? (
                  <div className="p-3">
                    <DmlResultPanel
                      dmlType={execution.txState.dmlType}
                      affectedRows={execution.txState.affectedRows}
                      onConfirm={execution.confirm}
                      onRollback={execution.rollback}
                    />
                  </div>
                ) : execution.isDdlWarning ? (
                  <div className="p-3">
                    <DmlResultPanel
                      dmlType="DDL"
                      affectedRows={0}
                      isDdlWarning
                      onConfirm={() => {}}
                      onRollback={() => {}}
                    />
                  </div>
                ) : execution.isLoading ? (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    <span className="text-sm">Executing...</span>
                  </div>
                ) : execution.isExplainOnly && execution.explainResult ? (
                  <ExplainPlanView result={execution.explainResult} dbType={dbType} />
                ) : hasSelectResult ? (
                  <DataGrid
                    result={execution.result!}
                    pageOffset={page * pageSize}
                    orderBy={null}
                    onToggleSort={() => {}}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    canEdit={false}
                    pendingChanges={new Map()}
                    insertedRows={[]}
                    getRowKey={(row) => JSON.stringify(row)}
                    onCellSave={() => {}}
                    onRowContextMenu={() => {}}
                  />
                ) : null}

                {/* Footer */}
                {hasSelectResult && (
                  <DataFooter
                    rowCount={execution.result!.rowCount}
                    executionTimeMs={execution.result!.executionTimeMs}
                    page={page}
                    pageSize={pageSize}
                    isLoading={execution.isLoading}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </div>

              {/* Schema Sidebar */}
              {schemaPanelOpen && (
                <SchemaPanel
                  tables={schemaTables}
                  isLoading={schemaLoading}
                  onInsert={handleSchemaInsert}
                  onPreviewTable={setPreviewTableName}
                  onClose={() => setSchemaPanelOpen(false)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p className="text-sm">Select a query or create one</p>
          </div>
        )}
      </div>

      {/* Table data preview modal */}
      {previewTableName && (
        <TablePreviewModal
          open
          tableName={previewTableName}
          connectionId={connectionId}
          onClose={() => setPreviewTableName(null)}
        />
      )}
    </div>
  );
}
