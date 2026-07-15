import type { IObjectTab } from '../model/objectBrowserStore';
import type { TDbType, ISchemaObjects } from '~/shared/types/db';
import { TableDetail } from './details/TableDetail';
import { ViewDetail } from './details/ViewDetail';
import { FunctionDetail } from './details/FunctionDetail';
import { TriggerDetail } from './details/TriggerDetail';
import { SequenceDetail } from './details/SequenceDetail';
import { EventDetail } from './details/EventDetail';
import { TypeDetail } from './details/TypeDetail';
import { ExtensionDetail } from './details/ExtensionDetail';
import { PolicyDetail } from './details/PolicyDetail';
import { DomainDetail } from './details/DomainDetail';
import { EmptyState } from './shared/EmptyState';

interface ObjectDetailRouterProps {
  tab: IObjectTab;
  connectionId: string;
  dbType: TDbType;
  schemaObjects: Partial<ISchemaObjects>;
}

export function ObjectDetailRouter({ tab, connectionId, dbType, schemaObjects }: ObjectDetailRouterProps) {
  switch (tab.type) {
    case 'table': {
      const table = schemaObjects.tables?.find((t) => t.name === tab.name && !t.isView);
      if (!table) return <EmptyState message={`Table "${tab.name}" not found`} />;
      return <TableDetail table={table} connectionId={connectionId} dbType={dbType} schemaObjects={schemaObjects} />;
    }

    case 'view': {
      const view = schemaObjects.views?.find((v) => v.name === tab.name && !v.isMaterialized);
      if (!view) return <EmptyState message={`View "${tab.name}" not found`} />;
      return <ViewDetail view={view} connectionId={connectionId} schemaObjects={schemaObjects} />;
    }

    case 'materialized_view': {
      const mv = schemaObjects.views?.find((v) => v.name === tab.name && v.isMaterialized);
      if (!mv) return <EmptyState message={`Materialized view "${tab.name}" not found`} />;
      return <ViewDetail view={mv} connectionId={connectionId} schemaObjects={schemaObjects} />;
    }

    case 'function': {
      const fn = schemaObjects.functions?.find((f) => f.name === tab.name);
      if (!fn) return <EmptyState message={`Function "${tab.name}" not found`} />;
      return <FunctionDetail routine={fn} connectionId={connectionId} />;
    }

    case 'procedure': {
      const proc = schemaObjects.procedures?.find((p) => p.name === tab.name);
      if (!proc) return <EmptyState message={`Procedure "${tab.name}" not found`} />;
      return <FunctionDetail routine={proc} connectionId={connectionId} />;
    }

    case 'trigger': {
      const trigger = schemaObjects.triggers?.find((t) => t.name === tab.name);
      if (!trigger) return <EmptyState message={`Trigger "${tab.name}" not found`} />;
      return <TriggerDetail trigger={trigger} connectionId={connectionId} />;
    }

    case 'sequence': {
      const seq = schemaObjects.sequences?.find((s) => s.name === tab.name);
      if (!seq) return <EmptyState message={`Sequence "${tab.name}" not found`} />;
      return <SequenceDetail sequence={seq} />;
    }

    case 'event': {
      const evt = schemaObjects.events?.find((e) => e.name === tab.name);
      if (!evt) return <EmptyState message={`Event "${tab.name}" not found`} />;
      return <EventDetail event={evt} connectionId={connectionId} />;
    }

    case 'type': {
      const ct = schemaObjects.types?.find((t) => t.name === tab.name);
      if (!ct) return <EmptyState message={`Type "${tab.name}" not found`} />;
      return <TypeDetail customType={ct} connectionId={connectionId} />;
    }

    case 'extension': {
      const ext = schemaObjects.extensions?.find((e) => e.name === tab.name);
      if (!ext) return <EmptyState message={`Extension "${tab.name}" not found`} />;
      return <ExtensionDetail extension={ext} connectionId={connectionId} />;
    }

    case 'policy': {
      const pol = schemaObjects.policies?.find((p) => p.name === tab.name);
      if (!pol) return <EmptyState message={`Policy "${tab.name}" not found`} />;
      return <PolicyDetail policy={pol} connectionId={connectionId} />;
    }

    case 'domain': {
      const dom = schemaObjects.types?.find((t) => t.name === tab.name && t.type === 'domain');
      if (!dom) return <EmptyState message={`Domain "${tab.name}" not found`} />;
      return <DomainDetail domain={dom} connectionId={connectionId} />;
    }

    default:
      return <EmptyState message="Unknown object type" />;
  }
}
