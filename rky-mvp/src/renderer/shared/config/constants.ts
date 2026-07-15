export const ROUTES = {
  ROOT: '/',
  DB: {
    ROOT: '/db',
    OVERVIEW: '/db/overview',
    PACKAGE: '/db/package',
    SCHEMA_STUDIO: {
      ROOT: '/db/studio',
      DIAGRAM: '/db/studio/diagram',
      DDL: '/db/studio/ddl',
      SEED: '/db/studio/seed',
      MOCKING: '/db/studio/mocking',
      DOCUMENTING: '/db/studio/documenting',
      VALIDATION: '/db/studio/validation',
    },
    LIVE_CONSOLE: {
      ROOT: '/db/console',
      CONNECTION: '/db/console/connection',
      DIAGRAM: '/db/console/diagram',
      DATA: '/db/console/data',
      QUERY: '/db/console/query',
      OBJECT: '/db/console/object',
    },
    REFERENCE: '/db/reference',
  },
  API: '/api',
  CODE: '/code',
  INFRA: '/infra',
} as const;
