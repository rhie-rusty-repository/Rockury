import type { TDbType } from '~/shared/types/db';

const PG_FIELD_DESCRIPTIONS: Record<string, string> = {
  'Node Type': '실행 노드 유형 (Seq Scan, Index Scan, Hash Join 등)',
  'Relation Name': '스캔 대상 테이블 이름',
  'Alias': '쿼리에서 사용된 테이블 별칭',
  'Schema': '테이블이 속한 스키마',
  'Join Type': 'JOIN 유형 (Inner, Left, Right, Full)',
  'Parent Relationship': '부모 노드와의 관계 (Outer, Inner, Subquery)',
  'Parallel Aware': '병렬 실행 가능 여부',
  'Async Capable': '비동기 실행 가능 여부',
  'Startup Cost': '첫 번째 행 반환 전 초기 비용',
  'Total Cost': '전체 실행 예상 비용 (상대 단위)',
  'Plan Rows': '반환 예상 행 수',
  'Plan Width': '평균 행 크기 (bytes)',
  'Actual Startup Time': '실제 첫 행 반환까지 시간 (ms)',
  'Actual Total Time': '실제 전체 실행 시간 (ms)',
  'Actual Rows': '실제 반환 행 수',
  'Actual Loops': '실제 반복 실행 횟수',
  'Rows Removed by Filter': '필터 조건으로 제거된 행 수',
  'Filter': '행 필터 조건',
  'Index Cond': '인덱스 조건',
  'Hash Cond': '해시 조인 조건',
  'Merge Cond': '머지 조인 조건',
  'Recheck Cond': '비트맵 스캔 재확인 조건',
  'Index Name': '사용된 인덱스 이름',
  'Scan Direction': '스캔 방향 (Forward, Backward)',
  'Sort Key': '정렬 기준 컬럼',
  'Sort Method': '정렬 방법 (quicksort, top-N heapsort 등)',
  'Sort Space Used': '정렬에 사용된 메모리 (kB)',
  'Sort Space Type': '정렬 공간 유형 (Memory, Disk)',
  'Group Key': '그룹핑 기준 컬럼',
  'Strategy': '집계 전략 (Plain, Sorted, Hashed)',
  'Shared Hit Blocks': '공유 버퍼 캐시 히트 블록 수',
  'Shared Read Blocks': '디스크에서 읽은 공유 블록 수',
  'Shared Written Blocks': '디스크에 쓴 공유 블록 수',
  'Local Hit Blocks': '로컬 버퍼 캐시 히트 블록 수',
  'Local Read Blocks': '디스크에서 읽은 로컬 블록 수',
  'Temp Read Blocks': '임시 파일에서 읽은 블록 수',
  'Temp Written Blocks': '임시 파일에 쓴 블록 수',
  'Hash Buckets': '해시 버킷 수',
  'Hash Batches': '해시 배치 수 (1이면 메모리 내 처리)',
  'Peak Memory Usage': '최대 메모리 사용량 (kB)',
  'CTE Name': 'CTE(WITH절) 이름',
  'Subplan Name': '서브플랜 이름',
  'Output': '출력 컬럼 목록',
  'Workers Planned': '계획된 병렬 워커 수',
  'Workers Launched': '실제 시작된 병렬 워커 수',
};

const MYSQL_FIELD_DESCRIPTIONS: Record<string, string> = {
  'access_type': '테이블 접근 방법 (ALL, index, range, ref, eq_ref, const)',
  'table_name': '접근 대상 테이블',
  'key': '사용된 인덱스',
  'possible_keys': '사용 가능한 인덱스 목록',
  'key_length': '사용된 인덱스 키 길이 (bytes)',
  'rows_examined_per_scan': '스캔당 검사 행 수',
  'rows_produced_per_join': '조인당 생성 행 수',
  'filtered': '테이블 조건으로 필터링된 행 비율 (%)',
  'cost_info': '비용 정보',
  'query_cost': '쿼리 전체 예상 비용',
  'read_cost': '읽기 비용',
  'eval_cost': '평가 비용',
  'prefix_cost': '누적 비용',
  'used_columns': '사용된 컬럼 목록',
  'attached_condition': '적용된 WHERE 조건',
};

const SQLITE_FIELD_DESCRIPTIONS: Record<string, string> = {
  'id': '서브쿼리 번호 (0=메인 쿼리)',
  'parent': '부모 노드 ID',
  'notused': '미사용 필드',
  'detail': '실행 계획 상세 설명',
};

export const HIGHLIGHT_FIELDS = new Set(['Total Cost', 'Actual Total Time']);

export function getFieldDescription(key: string, dbType: TDbType): string {
  if (dbType === 'postgresql') return PG_FIELD_DESCRIPTIONS[key] ?? '';
  if (dbType === 'mysql' || dbType === 'mariadb') return MYSQL_FIELD_DESCRIPTIONS[key] ?? '';
  if (dbType === 'sqlite') return SQLITE_FIELD_DESCRIPTIONS[key] ?? '';
  return '';
}
