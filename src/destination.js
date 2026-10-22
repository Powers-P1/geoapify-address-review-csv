import { lstat, stat, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Probe the actual directory, not just access flags: ACL/read-only failures must
// be discovered before spending API calls. Final writes still use exclusive wx.
export async function preflightDestinations(paths) {
  for (const path of paths) {
    try { await lstat(path); }
    catch (e) { if (e.code === 'ENOENT') continue; throw new Error('Cannot check output destination'); }
    throw new Error('Output already exists; choose a new output filename');
  }
  for (const parent of new Set(paths.map(dirname))) {
    try {
      if (!(await stat(parent)).isDirectory()) throw new Error();
      const probe = join(parent, `.address-review-probe-${randomUUID()}`);
      const handle = await open(probe, 'wx');
      try { await handle.writeFile('destination preflight\n'); }
      finally {
        try { await handle.close(); }
        finally { await unlink(probe); }
      }
    } catch { throw new Error('Output parent must exist and be a writable directory'); }
  }
}
