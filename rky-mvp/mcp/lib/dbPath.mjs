import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Resolve the path to rockury-mvp.db — the same file the Electron app opens via
 * app.getPath('userData'). Electron derives userData from the app name, which is
 * package.json `productName` ("rockury"). The DB filename is rky-mvp-specific to
 * avoid colliding with the separate electron-vite "rockury" build; it MUST match
 * src/main/infrastructure/database/localDb.ts.
 *
 * Override with ROCKURY_DB_PATH when the app stores data elsewhere.
 */
export function resolveDbPath() {
  if (process.env.ROCKURY_DB_PATH) return process.env.ROCKURY_DB_PATH;

  const appName = 'rockury';
  const home = os.homedir();

  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', appName, 'rockury-mvp.db');
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        appName,
        'rockury-mvp.db',
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
        appName,
        'rockury-mvp.db',
      );
  }
}

export function assertDbExists(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `rockury-mvp.db not found at "${dbPath}". Launch the rockury app once to create it, ` +
        `or set ROCKURY_DB_PATH to the correct location.`,
    );
  }
}
