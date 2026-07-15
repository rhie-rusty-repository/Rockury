import { Routes, Route, Navigate } from 'react-router';
import { ROUTES } from '@/shared/config/constants';
import { AppLayout } from '../layouts/AppLayout';
import { DbLayout } from '../layouts/DbLayout';
import { SchemaStudioLayout } from '../layouts/SchemaStudioLayout';
import { LiveConsoleLayout } from '../layouts/LiveConsoleLayout';
import { DbOverviewPage } from '@/pages/db-overview';
import { DbPackagePage } from '@/pages/db-package';
import { DbConnectionPage } from '@/pages/db-connection';
import { StudioDiagramPage, ConsoleDiagramPage } from '@/pages/db-diagram';
import { StudioDdlPage } from '@/pages/db-ddl';
import { StudioSeedPage } from '@/pages/db-seed';
import { DbMockingPage } from '@/pages/db-mocking';
import { DbDocumentingPage } from '@/pages/db-documenting';
import { DbValidationPage } from '@/pages/db-validation';
import { DataBrowserPage } from '@/pages/db-data';
import { QueryBrowserPage } from '@/pages/db-query';
import { ObjectBrowserPage } from '@/pages/db-object-browser';
import { DbReferencePage } from '@/pages/db-reference';
import { PlaceholderPage } from '@/pages/placeholder';
import { NotFoundPage } from '@/pages/not-found';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Root redirect to DB Overview */}
        <Route index element={<Navigate to={ROUTES.DB.OVERVIEW} replace />} />

        {/* DB Service */}
        <Route path="db" element={<DbLayout />}>
          <Route index element={<Navigate to={ROUTES.DB.OVERVIEW} replace />} />
          <Route path="overview" element={<DbOverviewPage />} />
          <Route path="package" element={<DbPackagePage />} />

          {/* Schema Studio */}
          <Route path="studio" element={<SchemaStudioLayout />}>
            <Route index element={<Navigate to={ROUTES.DB.SCHEMA_STUDIO.DIAGRAM} replace />} />
            <Route path="diagram" element={<StudioDiagramPage />} />
            <Route path="ddl" element={<StudioDdlPage />} />
            <Route path="seed" element={<StudioSeedPage />} />
            <Route path="mocking" element={<DbMockingPage />} />
            <Route path="documenting" element={<DbDocumentingPage />} />
            <Route path="validation" element={<DbValidationPage />} />
          </Route>

          {/* Live Console */}
          <Route path="console" element={<LiveConsoleLayout />}>
            <Route index element={<Navigate to={ROUTES.DB.LIVE_CONSOLE.CONNECTION} replace />} />
            <Route path="connection" element={<DbConnectionPage />} />
            <Route path="diagram" element={<ConsoleDiagramPage />} />
            <Route path="data" element={<DataBrowserPage />} />
            <Route path="query" element={<QueryBrowserPage />} />
            <Route path="object" element={<ObjectBrowserPage />} />
          </Route>

          {/* Reference */}
          <Route path="reference" element={<DbReferencePage />} />
        </Route>

        {/* Placeholder Services */}
        <Route path="api" element={<PlaceholderPage service="API" />} />
        <Route path="code" element={<PlaceholderPage service="Code" />} />
        <Route path="infra" element={<PlaceholderPage service="Infra" />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
