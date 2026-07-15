import type { LucideIcon } from 'lucide-react';
import {
  Table2,
  Eye,
  Layers,
  Zap,
  ScrollText,
  Timer,
  Hash,
  CalendarClock,
  Tag,
  Puzzle,
  Shield,
  Globe,
} from 'lucide-react';
import type { TDbType } from '~/shared/types/db';

// ─── Object Type for Object Browser ───
export type TObjectType =
  | 'table' | 'view' | 'materialized_view'
  | 'function' | 'procedure' | 'trigger'
  | 'sequence' | 'event' | 'type'
  | 'extension' | 'policy' | 'domain';

// ─── Table children that appear as sub-categories ───
export type TTableChildType = 'columns' | 'indexes' | 'triggers' | 'policies';

// ─── Category definition ───
export interface IObjectCategoryDef {
  type: TObjectType;
  label: string;
  icon: LucideIcon;
  emoji: string;
  /** Types that are "dependent" — shown under their parent table AND as top-level */
  isDependentOnTable?: boolean;
}

// ─── Vendor config ───
export interface IVendorObjectConfig {
  categories: IObjectCategoryDef[];
  tableChildren: TTableChildType[];
  hasSchemaFilter: boolean;
  showDbInfo?: boolean;
}

// ─── Category icon/emoji map ───
export const OBJECT_CATEGORY_META: Record<TObjectType, { icon: LucideIcon; emoji: string; label: string }> = {
  table:             { icon: Table2,        emoji: '\uD83D\uDDC2', label: 'Tables' },
  view:              { icon: Eye,           emoji: '\uD83D\uDC41', label: 'Views' },
  materialized_view: { icon: Layers,        emoji: '\uD83D\uDD2E', label: 'Materialized Views' },
  function:          { icon: Zap,           emoji: '\u26A1',       label: 'Functions' },
  procedure:         { icon: ScrollText,    emoji: '\uD83D\uDCDC', label: 'Procedures' },
  trigger:           { icon: Timer,         emoji: '\u23F0',       label: 'Triggers' },
  sequence:          { icon: Hash,          emoji: '\uD83D\uDD22', label: 'Sequences' },
  event:             { icon: CalendarClock, emoji: '\uD83D\uDCC5', label: 'Events' },
  type:              { icon: Tag,           emoji: '\uD83C\uDFF7', label: 'Types' },
  extension:         { icon: Puzzle,        emoji: '\uD83E\uDDE9', label: 'Extensions' },
  policy:            { icon: Shield,        emoji: '\uD83D\uDEE1', label: 'Policies' },
  domain:            { icon: Globe,         emoji: '\uD83C\uDF10', label: 'Domains' },
};

// ─── Vendor Registry ───
function cat(type: TObjectType, isDependentOnTable?: boolean): IObjectCategoryDef {
  const meta = OBJECT_CATEGORY_META[type];
  return { type, label: meta.label, icon: meta.icon, emoji: meta.emoji, isDependentOnTable };
}

export const vendorRegistry: Record<TDbType, IVendorObjectConfig> = {
  postgresql: {
    categories: [
      cat('table'),
      cat('view'),
      cat('materialized_view'),
      cat('function'),
      cat('procedure'),
      cat('trigger', true),
      cat('sequence'),
      cat('type'),
      cat('extension'),
      cat('policy', true),
      cat('domain'),
    ],
    tableChildren: ['columns', 'indexes', 'triggers', 'policies'],
    hasSchemaFilter: true,
  },
  mysql: {
    categories: [
      cat('table'),
      cat('view'),
      cat('function'),
      cat('procedure'),
      cat('trigger', true),
      cat('event'),
    ],
    tableChildren: ['columns', 'indexes', 'triggers'],
    hasSchemaFilter: false,
  },
  mariadb: {
    categories: [
      cat('table'),
      cat('view'),
      cat('function'),
      cat('procedure'),
      cat('trigger', true),
      cat('sequence'),
      cat('event'),
    ],
    tableChildren: ['columns', 'indexes', 'triggers'],
    hasSchemaFilter: false,
  },
  sqlite: {
    categories: [
      cat('table'),
      cat('view'),
      cat('trigger', true),
    ],
    tableChildren: ['columns', 'indexes', 'triggers'],
    hasSchemaFilter: false,
    showDbInfo: true,
  },
};
