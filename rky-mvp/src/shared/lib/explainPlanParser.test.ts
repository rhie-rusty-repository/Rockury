import { describe, it, expect } from 'vitest';
import { parsePlanNodes } from './explainPlanParser';
import type { IExplainResult } from '~/shared/types/db';

describe('parsePlanNodes', () => {
  it('parses PostgreSQL simple plan', () => {
    const result: IExplainResult = {
      planRows: [{ 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'api_keys',
        'Startup Cost': 0,
        'Total Cost': 10.8,
        'Plan Rows': 80,
        'Plan Width': 983,
        'Parallel Aware': false,
        'Async Capable': false,
      }}] }],
      summary: 'Seq Scan on api_keys',
      rawJson: { 'QUERY PLAN': [{ Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'api_keys',
        'Startup Cost': 0,
        'Total Cost': 10.8,
        'Plan Rows': 80,
        'Plan Width': 983,
        'Parallel Aware': false,
        'Async Capable': false,
      }}] },
    };

    const nodes = parsePlanNodes(result, 'postgresql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('Seq Scan');
    expect(nodes[0].relationName).toBe('api_keys');
    expect(nodes[0].children).toHaveLength(0);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.value).toBe(10.8);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.highlight).toBe(true);
    expect(nodes[0].properties.find(p => p.key === 'Total Cost')?.description).toBe('전체 실행 예상 비용 (상대 단위)');
  });

  it('parses PostgreSQL nested plan (Hash Join)', () => {
    const nestedPlan = {
      'Node Type': 'Hash Join',
      'Hash Cond': '(u.id = o.user_id)',
      'Total Cost': 35.2,
      'Plan Rows': 120,
      'Plan Width': 100,
      'Startup Cost': 0,
      Plans: [
        { 'Node Type': 'Seq Scan', 'Relation Name': 'users', 'Total Cost': 12.5, 'Plan Rows': 50, 'Plan Width': 50, 'Startup Cost': 0 },
        { 'Node Type': 'Hash', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0,
          Plans: [
            { 'Node Type': 'Index Scan', 'Relation Name': 'orders', 'Total Cost': 18.3, 'Plan Rows': 200, 'Plan Width': 50, 'Startup Cost': 0 },
          ],
        },
      ],
    };

    const result: IExplainResult = {
      planRows: [{ 'QUERY PLAN': [{ Plan: nestedPlan }] }],
      summary: 'Hash Join',
      rawJson: { 'QUERY PLAN': [{ Plan: nestedPlan }] },
    };

    const nodes = parsePlanNodes(result, 'postgresql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('Hash Join');
    expect(nodes[0].children).toHaveLength(2);
    expect(nodes[0].children[0].nodeType).toBe('Seq Scan');
    expect(nodes[0].children[1].nodeType).toBe('Hash');
    expect(nodes[0].children[1].children).toHaveLength(1);
    expect(nodes[0].children[1].children[0].nodeType).toBe('Index Scan');
  });

  it('parses MySQL plan', () => {
    const mysqlJson = JSON.stringify({
      query_block: {
        select_id: 1,
        cost_info: { query_cost: '1.00' },
        table: {
          table_name: 'users',
          access_type: 'ALL',
          rows_examined_per_scan: 100,
          rows_produced_per_join: 100,
          filtered: '100.00',
          cost_info: { read_cost: '0.75', eval_cost: '10.00', prefix_cost: '1.00' },
        },
      },
    });
    const result: IExplainResult = {
      planRows: [{ EXPLAIN: mysqlJson }],
      summary: 'ALL on users',
      rawJson: { EXPLAIN: mysqlJson },
    };

    const nodes = parsePlanNodes(result, 'mysql');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeType).toBe('ALL');
    expect(nodes[0].relationName).toBe('users');
    expect(nodes[0].properties.find(p => p.key === 'rows_examined_per_scan')?.value).toBe(100);
  });

  it('parses SQLite plan from planRows', () => {
    const result: IExplainResult = {
      planRows: [
        { id: 0, parent: 0, notused: 0, detail: 'SCAN api_keys' },
        { id: 0, parent: 0, notused: 0, detail: 'SEARCH users USING INDEX idx_email' },
      ],
      summary: 'SCAN api_keys → SEARCH users',
    };

    const nodes = parsePlanNodes(result, 'sqlite');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].nodeType).toBe('SCAN api_keys');
    expect(nodes[0].children).toHaveLength(0);
  });

  it('returns empty array for empty result', () => {
    const result: IExplainResult = { planRows: [], summary: '' };
    expect(parsePlanNodes(result, 'postgresql')).toEqual([]);
  });

  it('returns empty array on parse error', () => {
    const result: IExplainResult = { planRows: [{ garbage: 'data' }], summary: '', rawJson: { garbage: true } };
    expect(parsePlanNodes(result, 'postgresql')).toEqual([]);
  });
});
