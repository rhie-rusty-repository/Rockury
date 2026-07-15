import { useQuery } from '@tanstack/react-query';
import { objectBrowserApi } from '../api/objectBrowserApi';
import type { TSchemaObjectType, ITableStatistics, ISqlitePragmaResult, ISqliteDbInfo } from '~/shared/types/db';

const objectDetailKeys = {
  all: ['objectDetail'] as const,
  ddl: (connectionId: string, objectType: TSchemaObjectType, objectName: string) =>
    [...objectDetailKeys.all, 'ddl', connectionId, objectType, objectName] as const,
  statistics: (connectionId: string, tableName: string) =>
    [...objectDetailKeys.all, 'statistics', connectionId, tableName] as const,
  pragma: (connectionId: string, tableName: string) =>
    [...objectDetailKeys.all, 'pragma', connectionId, tableName] as const,
  dbInfo: (connectionId: string) =>
    [...objectDetailKeys.all, 'dbInfo', connectionId] as const,
};

export function useObjectDdl(connectionId: string, objectType: TSchemaObjectType, objectName: string) {
  return useQuery({
    queryKey: objectDetailKeys.ddl(connectionId, objectType, objectName),
    queryFn: async () => {
      const result = await objectBrowserApi.fetchDdl({ connectionId, objectType, objectName });
      if (!result.success) throw new Error('Failed to fetch DDL');
      return result.data.ddl;
    },
    enabled: !!connectionId && !!objectName,
    staleTime: 60_000,
  });
}

export function useTableStatistics(connectionId: string, tableName: string) {
  return useQuery<ITableStatistics>({
    queryKey: objectDetailKeys.statistics(connectionId, tableName),
    queryFn: async () => {
      const result = await objectBrowserApi.fetchTableStatistics({ connectionId, tableName });
      if (!result.success) throw new Error('Failed to fetch statistics');
      return result.data;
    },
    enabled: !!connectionId && !!tableName,
    staleTime: 30_000,
  });
}

export function useSqlitePragma(connectionId: string, tableName: string) {
  return useQuery<ISqlitePragmaResult>({
    queryKey: objectDetailKeys.pragma(connectionId, tableName),
    queryFn: async () => {
      const result = await objectBrowserApi.fetchSqlitePragma({ connectionId, tableName });
      if (!result.success) throw new Error('Failed to fetch PRAGMA');
      return result.data;
    },
    enabled: !!connectionId && !!tableName,
    staleTime: 60_000,
  });
}

export function useSqliteDbInfo(connectionId: string) {
  return useQuery<ISqliteDbInfo>({
    queryKey: objectDetailKeys.dbInfo(connectionId),
    queryFn: async () => {
      const result = await objectBrowserApi.fetchSqliteDbInfo({ connectionId });
      if (!result.success) throw new Error('Failed to fetch DB info');
      return result.data;
    },
    enabled: !!connectionId,
    staleTime: 60_000,
  });
}
