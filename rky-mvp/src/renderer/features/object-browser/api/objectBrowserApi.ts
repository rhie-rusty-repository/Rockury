import { getElectronApi } from '@/shared/api/electronApi';
import type { TSchemaObjectType } from '~/shared/types/db';

const api = getElectronApi();

export const objectBrowserApi = {
  fetchObjects: (args: { connectionId: string; objectTypes?: TSchemaObjectType[] }) =>
    api.SCHEMA_OBJECTS_FETCH(args),

  fetchDdl: (args: { connectionId: string; objectType: TSchemaObjectType; objectName: string }) =>
    api.SCHEMA_OBJECT_DDL(args),

  fetchTableStatistics: (args: { connectionId: string; tableName: string }) =>
    api.OB_TABLE_STATISTICS(args),

  fetchSqlitePragma: (args: { connectionId: string; tableName: string }) =>
    api.OB_SQLITE_PRAGMA(args),

  fetchSqliteDbInfo: (args: { connectionId: string }) =>
    api.OB_SQLITE_DB_INFO(args),
};
