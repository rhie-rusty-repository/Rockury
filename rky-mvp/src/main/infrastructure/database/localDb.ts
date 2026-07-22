import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import { runMigrations } from './localDb.schema';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Local database not initialized. Call initLocalDb() first.');
  }
  return db;
}

export function initLocalDb(): Database.Database {
  if (db) return db;

  // rky-mvp는 전용 DB 파일을 사용한다. 같은 userData 디렉터리를 공유하는 별도
  // electron-vite "rockury" 빌드와 스키마가 호환되지 않아, rockury.db를 공유하면
  // 마이그레이션이 서로를 깨뜨린다. 파일명은 mcp/lib/dbPath.mjs와 반드시 일치.
  const dbPath = path.join(app.getPath('userData'), 'rockury-mvp.db');
  db = new Database(dbPath);

  runMigrations(db);

  return db;
}

export function closeLocalDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
