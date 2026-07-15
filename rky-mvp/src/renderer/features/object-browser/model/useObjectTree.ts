import { useQuery } from '@tanstack/react-query';
import { objectBrowserApi } from '../api/objectBrowserApi';
import type { TDbType, ISchemaObjects } from '~/shared/types/db';

const objectTreeKeys = {
  all: ['objectTree'] as const,
  byConnection: (connectionId: string) => [...objectTreeKeys.all, connectionId] as const,
};

export function useObjectTree(connectionId: string, _dbType: TDbType) {
  return useQuery({
    queryKey: objectTreeKeys.byConnection(connectionId),
    queryFn: async (): Promise<Partial<ISchemaObjects>> => {
      const result = await objectBrowserApi.fetchObjects({ connectionId });
      if (!result.success) throw new Error('Failed to fetch schema objects');
      return result.data;
    },
    enabled: !!connectionId,
    staleTime: 30_000,
  });
}
