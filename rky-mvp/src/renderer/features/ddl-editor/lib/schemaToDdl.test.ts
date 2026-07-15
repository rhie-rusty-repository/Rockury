import { describe, it, expect } from 'vitest';
import { schemaToDdl } from './schemaToDdl';
import type { ITable } from '~/shared/types/db';

function makeTable(columns: ITable['columns']): ITable {
  return {
    id: 'tbl-users',
    name: 'users',
    comment: '',
    columns,
    constraints: [],
  };
}

describe('schemaToDdl', () => {
  it('keeps SQL expression defaults unquoted for MySQL', () => {
    const table = makeTable([
      {
        id: 'col-created-at',
        name: 'created_at',
        dataType: 'DATETIME',
        keyTypes: [],
        defaultValue: 'CURRENT_TIMESTAMP()',
        nullable: false,
        comment: '',
        reference: null,
        constraints: [],
        ordinalPosition: 1,
      },
    ]);

    const ddl = schemaToDdl([table], 'mysql');
    expect(ddl).toContain('`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP()');
  });

  it('keeps nextval expression defaults unquoted for PostgreSQL', () => {
    const table = makeTable([
      {
        id: 'col-id',
        name: 'id',
        dataType: 'int4',
        keyTypes: ['PK'],
        defaultValue: "nextval('users_id_seq'::regclass)",
        nullable: false,
        comment: '',
        reference: null,
        constraints: [],
        ordinalPosition: 1,
      },
    ]);

    const ddl = schemaToDdl([table], 'postgresql');
    expect(ddl).toContain(`"id" int4 NOT NULL DEFAULT nextval('users_id_seq'::regclass)`);
  });

  it('adds AUTO_INCREMENT for MySQL auto-increment columns', () => {
    const table = makeTable([
      {
        id: 'col-id',
        name: 'id',
        dataType: 'INT',
        keyTypes: ['PK'],
        isAutoIncrement: true,
        defaultValue: null,
        nullable: false,
        comment: '',
        reference: null,
        constraints: [],
        ordinalPosition: 1,
      },
    ]);

    const ddl = schemaToDdl([table], 'mysql');
    expect(ddl).toContain('`id` INT NOT NULL AUTO_INCREMENT');
  });

  it('keeps composite foreign keys as a single FK constraint', () => {
    const table: ITable = {
      id: 'tbl-child',
      name: 'child',
      comment: '',
      columns: [
        {
          id: 'c1',
          name: 'biz_site_code',
          dataType: 'char(7)',
          keyTypes: ['FK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: { table: 'parent', column: 'biz_site_code' },
          constraints: [],
          ordinalPosition: 1,
        },
        {
          id: 'c2',
          name: 'measured_date',
          dataType: 'date',
          keyTypes: ['FK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: { table: 'parent', column: 'measured_date' },
          constraints: [],
          ordinalPosition: 2,
        },
      ],
      constraints: [
        {
          type: 'FK',
          name: 'fk_child_parent',
          columns: ['biz_site_code', 'measured_date'],
          reference: {
            table: 'parent',
            column: 'biz_site_code, measured_date',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        },
      ],
    };

    const ddl = schemaToDdl([table], 'mysql');
    expect(ddl).toContain(
      'CONSTRAINT `fk_child_parent` FOREIGN KEY (`biz_site_code`, `measured_date`) REFERENCES `parent` (`biz_site_code`, `measured_date`) ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(ddl).not.toContain('CONSTRAINT `fk_child_biz_site_code`');
    expect(ddl).not.toContain('CONSTRAINT `fk_child_measured_date`');
  });

  it('falls back missing referenced columns in composite FK to source column names', () => {
    const table: ITable = {
      id: 'tbl-child',
      name: 'child',
      comment: '',
      columns: [
        {
          id: 'c1',
          name: 'biz_site_code',
          dataType: 'char(7)',
          keyTypes: ['FK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: { table: 'parent', column: 'biz_site_code' },
          constraints: [],
          ordinalPosition: 1,
        },
        {
          id: 'c2',
          name: 'measured_date',
          dataType: 'date',
          keyTypes: ['FK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: { table: 'parent', column: 'measured_date' },
          constraints: [],
          ordinalPosition: 2,
        },
      ],
      constraints: [
        {
          type: 'FK',
          name: 'fk_child_parent_partial_ref',
          columns: ['biz_site_code', 'measured_date'],
          reference: {
            table: 'parent',
            column: 'biz_site_code',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        },
      ],
    };

    const ddl = schemaToDdl([table], 'mysql');
    expect(ddl).toContain(
      'CONSTRAINT `fk_child_parent_partial_ref` FOREIGN KEY (`biz_site_code`, `measured_date`) REFERENCES `parent` (`biz_site_code`, `measured_date`) ON DELETE CASCADE ON UPDATE CASCADE',
    );
  });

  it('uses SERIAL family for PostgreSQL auto-increment columns', () => {
    const table = makeTable([
      {
        id: 'col-id',
        name: 'id',
        dataType: 'BIGINT',
        keyTypes: ['PK'],
        isAutoIncrement: true,
        defaultValue: null,
        nullable: false,
        comment: '',
        reference: null,
        constraints: [],
        ordinalPosition: 1,
      },
    ]);

    const ddl = schemaToDdl([table], 'postgresql');
    expect(ddl).toContain('"id" BIGSERIAL');
    // SERIAL implies NOT NULL — should not be duplicated
    expect(ddl).not.toContain('BIGSERIAL NOT NULL');
  });

  it('emits CREATE INDEX for IDX constraints', () => {
    const table: ITable = {
      id: 'tbl-cards',
      name: 'cards',
      comment: '',
      columns: [
        {
          id: 'c1',
          name: 'id',
          dataType: 'BIGINT',
          keyTypes: ['PK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: null,
          constraints: [],
          ordinalPosition: 1,
        },
        {
          id: 'c2',
          name: 'tcgplayer_id',
          dataType: 'BIGINT',
          keyTypes: [],
          defaultValue: null,
          nullable: true,
          comment: '',
          reference: null,
          constraints: [],
          ordinalPosition: 2,
        },
      ],
      constraints: [
        { type: 'IDX', name: 'idx_cards_tcgplayer_id', columns: ['tcgplayer_id'] },
      ],
    };

    const ddl = schemaToDdl([table], 'postgresql');
    expect(ddl).toContain('CREATE INDEX "idx_cards_tcgplayer_id" ON "cards" ("tcgplayer_id");');
  });

  it('orders tables so referenced table is created first', () => {
    const parent: ITable = {
      id: 't-parent',
      name: 'parent',
      comment: '',
      columns: [
        {
          id: 'p1',
          name: 'id',
          dataType: 'int',
          keyTypes: ['PK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: null,
          constraints: [],
          ordinalPosition: 1,
        },
      ],
      constraints: [],
    };
    const child: ITable = {
      id: 't-child',
      name: 'child',
      comment: '',
      columns: [
        {
          id: 'c1',
          name: 'id',
          dataType: 'int',
          keyTypes: ['PK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: null,
          constraints: [],
          ordinalPosition: 1,
        },
        {
          id: 'c2',
          name: 'parent_id',
          dataType: 'int',
          keyTypes: ['FK'],
          defaultValue: null,
          nullable: false,
          comment: '',
          reference: { table: 'parent', column: 'id' },
          constraints: [],
          ordinalPosition: 2,
        },
      ],
      constraints: [],
    };

    const ddl = schemaToDdl([child, parent], 'mysql');
    const parentPos = ddl.indexOf('CREATE TABLE `parent`');
    const childPos = ddl.indexOf('CREATE TABLE `child`');
    expect(parentPos).toBeGreaterThanOrEqual(0);
    expect(childPos).toBeGreaterThanOrEqual(0);
    expect(parentPos).toBeLessThan(childPos);
  });
});
