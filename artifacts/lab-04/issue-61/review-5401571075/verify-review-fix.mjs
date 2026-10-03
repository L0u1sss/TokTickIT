import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evidenceRoot, '../../../..');
const run = (args) => spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
const paths = ['scripts/build-lab4-report.mjs', 'scripts/lab4-report-provenance.mjs',
  'scripts/tests/lab4-report-provenance.test.mjs', '.github/workflows/ci.yml', '.gitignore'];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async name =>
  [name, createHash('sha256').update(await readFile(path.join(repoRoot, name))).digest('hex')])));
const sourceBefore = await hashes();
const tests = run(['--test', '--test-reporter=tap', 'scripts/tests/lab4-report-provenance.test.mjs']);
const testLog = `${tests.stdout ?? ''}${tests.stderr ?? ''}`;
await writeFile(path.join(evidenceRoot, 'provenance-tests.txt'), testLog);
assert.equal(tests.status, 0, testLog);
const testCount = Number(testLog.match(/# tests (\d+)\b/)?.[1]);
assert.ok(testCount >= 28);
assert.match(testLog, new RegExp(`# pass ${testCount}\\b`));
assert.match(testLog, /# fail 0\b/);

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'toktickit-review71-cli-'));
const outsideData = path.join(temporaryRoot, 'external-data.json');
const cliResults = [];
try {
  await writeFile(outsideData, await readFile(path.join(repoRoot, 'docs/lab-04/report-data.json')));
  for (const [name, args, reason] of [
    ['external-data', ['--final', `--data=${outsideData}`], /report data must stay inside the repository/],
    ['candidate-final', ['--final'], /reviewed report content must have status final-main/],
  ]) {
    const result = run(['scripts/build-lab4-report.mjs', ...args]);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    await writeFile(path.join(evidenceRoot, `${name}-cli.txt`), output);
    assert.equal(result.status, 1, output);
    assert.match(output, reason);
    cliResults.push({ name, expectedRejection: true, exitCode: result.status, log: `${name}-cli.txt` });
  }
} finally {
  await unlink(outsideData);
  await rmdir(temporaryRoot);
}

const sourceHashes = await hashes();
assert.deepEqual(sourceHashes, sourceBefore, 'review-fix implementation must stay unchanged during verification');
const summary = { generatedAt: new Date().toISOString(), scope: 'local PR #71 review-fix worktree',
  baselineCommit: '07065bd2ca53d59b4b3e36978fecc9988138881f', releaseEvidence: false,
  regression: { command: 'node --test --test-reporter=tap scripts/tests/lab4-report-provenance.test.mjs',
    exitCode: tests.status, tests: testCount, passed: testCount, failed: 0, skipped: 0, log: 'provenance-tests.txt',
    fixtures: 'Disposable main repositories with invented verification manifests; not actual Lab 4 release runs.' },
  cliResults, sourceUnchangedDuringRun: true, sourceHashes };
await writeFile(path.join(evidenceRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Provenance regression: ${testCount}/${testCount} passed; actual CLI guards: 2/2 expected rejections.`);
