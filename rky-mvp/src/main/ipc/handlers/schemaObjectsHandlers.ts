import { ipcMain } from 'electron';
import { CHANNELS } from '~/shared/ipc/channels';
import { schemaObjectsService } from '#/services';
import { querySafetyService } from '#/services';
import type { TSchemaObjectType } from '~/shared/types/db';

export function registerSchemaObjectsHandlers() {
  ipcMain.handle(CHANNELS.SCHEMA_OBJECTS_FETCH, async (_event, args: { connectionId: string; objectTypes?: TSchemaObjectType[] }) => {
    try {
      const data = await schemaObjectsService.fetchObjects(args.connectionId, args.objectTypes);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });

  ipcMain.handle(CHANNELS.SCHEMA_OBJECT_DDL, async (_event, args: { connectionId: string; objectType: TSchemaObjectType; objectName: string }) => {
    try {
      const ddl = await schemaObjectsService.fetchObjectDdl(args.connectionId, args.objectType, args.objectName);
      return { success: true, data: { ddl } };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });

  // Object Browser
  ipcMain.handle(CHANNELS.OB_TABLE_STATISTICS, async (_event, args: { connectionId: string; tableName: string }) => {
    try {
      const data = await schemaObjectsService.fetchTableStatistics(args.connectionId, args.tableName);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });

  ipcMain.handle(CHANNELS.OB_SQLITE_PRAGMA, async (_event, args: { connectionId: string; tableName: string }) => {
    try {
      const data = await schemaObjectsService.fetchSqlitePragma(args.connectionId, args.tableName);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });

  ipcMain.handle(CHANNELS.OB_SQLITE_DB_INFO, async (_event, args: { connectionId: string }) => {
    try {
      const data = await schemaObjectsService.fetchSqliteDbInfo(args.connectionId);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });

  ipcMain.handle(CHANNELS.QUERY_CLASSIFY_SAFETY, async (_event, args: { sql: string }) => {
    try {
      const data = querySafetyService.classify(args.sql);
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message };
    }
  });
}
