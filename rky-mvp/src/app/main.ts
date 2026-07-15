import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { BROWSER_WINDOWS } from './windows-config';
import { createWindow } from './windows';
import { registerAllHandlers } from '#/ipc';
import { initLocalDb, closeLocalDb } from '#/infrastructure';
import { transactionService } from '#/services';

// --- Freeze diagnostics (main-process event-loop watchdog) -----------------
// The window's close button going unresponsive means the MAIN event loop is
// blocked by synchronous work (heavy better-sqlite3 query, serializing a huge
// IPC payload, etc.). We can't tell which op from outside, so: track the
// in-flight IPC channel and log whenever the loop stalls past a threshold.
// Pure logging — no behavior change. Install BEFORE registerAllHandlers().
const inFlightIpc = new Set<string>();
const _origIpcHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = ((channel: string, listener: (...a: unknown[]) => unknown) =>
  _origIpcHandle(channel, async (event: unknown, ...args: unknown[]) => {
    inFlightIpc.add(channel);
    try {
      return await (listener as (...a: unknown[]) => unknown)(event, ...args);
    } finally {
      inFlightIpc.delete(channel);
    }
  })) as typeof ipcMain.handle;

const LOOP_TICK_MS = 500;
const STALL_MS = 300;
let _lastLoopTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const stall = now - _lastLoopTick - LOOP_TICK_MS;
  _lastLoopTick = now;
  if (stall > STALL_MS) {
    const busy = [...inFlightIpc].join(', ') || '(none — renderer/GC/native)';
    console.error(`[rky] main event loop stalled ~${stall}ms | in-flight IPC: ${busy}`);
  }
}, LOOP_TICK_MS);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Initialize local SQLite database
  initLocalDb();

  // Register all IPC handlers
  registerAllHandlers();

  // Start periodic cleanup of expired transactions
  transactionService.startCleanup();

  createWindow(BROWSER_WINDOWS.MAIN);
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create a window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(BROWSER_WINDOWS.MAIN);
  }
});

app.on('before-quit', async () => {
  await transactionService.cleanupAll();
  closeLocalDb();
});
