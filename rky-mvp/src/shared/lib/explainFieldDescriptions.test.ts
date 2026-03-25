import { describe, it, expect } from 'vitest';
import { getFieldDescription } from './explainFieldDescriptions';

describe('getFieldDescription', () => {
  it('returns PG description for known field', () => {
    expect(getFieldDescription('Total Cost', 'postgresql')).toBe('전체 실행 예상 비용 (상대 단위)');
  });
  it('returns MySQL description for known field', () => {
    expect(getFieldDescription('access_type', 'mysql')).toBe('테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)');
  });
  it('returns MariaDB description (shared with MySQL)', () => {
    expect(getFieldDescription('access_type', 'mariadb')).toBe('테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)');
  });
  it('returns SQLite description for known field', () => {
    expect(getFieldDescription('detail', 'sqlite')).toBe('실행 계획 상세 설명');
  });
  it('returns empty string for unknown field', () => {
    expect(getFieldDescription('SomeRandomKey', 'postgresql')).toBe('');
  });
});
