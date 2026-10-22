import { readFile, stat } from 'node:fs/promises';

export async function readInput(path) {
  try {
    if ((await stat(path)).size > 10 * 1024 * 1024) {
      throw new Error('Input exceeds 10 MiB limit');
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Input file not found');
    throw error;
  }
}

export async function readFixture(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Offline fixture file not found');
    throw error;
  }
}
