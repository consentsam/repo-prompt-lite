/**
 * Cursor “postEdit” hook — prints an approximate token count
 * for every file that changed in the last git commit/edit.
 * Uses only Node std-lib + @dqbd/tiktoken.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { encoding_for_model } from '@dqbd/tiktoken';

export default async function () {
  // 1. Get list of modified/added files compared to HEAD
  const out = execSync('git diff --name-only').toString().trim();
  if (!out) return; // nothing changed

  const files = out.split('\n');
  const enc = encoding_for_model('gpt-4o-mini');
  let total = 0;

  for (const file of files) {
    // skip deleted files / directories
    if (!existsSync(file) || statSync(file).isDirectory()) continue;

    const content = readFileSync(file, 'utf8');
    total += enc.encode(content).length;
  }

  console.log(`[Cursor] ~${total.toLocaleString()} tokens in changed files`);
}