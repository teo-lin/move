#!/usr/bin/env node
/**
 * Pull the app's CSV export over ADB and merge it into the health repo baseline.
 *
 *   npm run sync:csv                       # merge into the default baseline
 *   npm run sync:csv -- --dry-run          # show what would be added
 *   npm run sync:csv -- --from export.csv  # merge a local file instead of pulling
 *   npm run sync:csv -- --to other.csv     # different target
 *
 * Rows already in the target (identical Date/Workout/Completion/Duration) are kept once;
 * older rows that only exist in the target (e.g. from the original Kineto app) are preserved.
 * The result is sorted newest date first; rows sharing a date keep their existing order.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEVICE_PATH = '/sdcard/Download/move/back-exercises.csv';
const DEFAULT_TARGET = 'C:\\_____\\_CODE\\body\\baseline\\back-exercises.csv';
const HEADER = ['Date', 'Workout', 'Completion', 'Duration'];

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes('--dry-run');
const target = option('--to') ?? DEFAULT_TARGET;
let source = option('--from');

if (!source) {
  source = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'move-sync-')), 'back-exercises.csv');
  execFileSync('adb', ['pull', DEVICE_PATH, source], {
    stdio: 'inherit',
    env: {...process.env, MSYS_NO_PATHCONV: '1'},
  });
}

const incoming = readRows(source);
const existingText = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
const existing = existingText ? parseCsv(existingText).slice(1) : [];
const seen = new Set(existing.map(key));
const added = incoming.filter(row => {
  const k = key(row);
  if (seen.has(k)) {
    return false;
  }
  seen.add(k);
  return true;
});

console.log(`${incoming.length} rows on device, ${existing.length} in target, ${added.length} new.`);
for (const row of added) {
  console.log(`  + ${row.join(' | ')}`);
}
if (dryRun || added.length === 0) {
  process.exit(0);
}

// New rows go before existing rows of the same date; the sort is stable.
const merged = [...added, ...existing]
  .map((row, index) => ({row, index}))
  .sort((a, b) => b.row[0].localeCompare(a.row[0]) || a.index - b.index)
  .map(item => item.row);

const eol = existingText.includes('\r\n') ? '\r\n' : '\n';
const trailing = existingText === '' || /\r?\n$/.test(existingText) ? eol : '';
const output = [HEADER, ...merged].map(row => row.map(quote).join(',')).join(eol) + trailing;
fs.writeFileSync(target, output, 'utf8');
console.log(`Wrote ${merged.length} rows to ${target}`);

function readRows(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows[0] ?? [];
  if (HEADER.some((name, index) => header[index] !== name)) {
    throw new Error(`Unexpected header in ${file}: ${header.join(',')}`);
  }
  return rows.slice(1);
}

function key(row) {
  return row.slice(0, 4).join('\u0000');
}

function quote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, CRLF/LF). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}
