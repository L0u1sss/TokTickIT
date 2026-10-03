import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertFinalOutput, recheckFinalReport, validateFinalReport, verificationNames } from '../lab4-report-provenance.mjs';

const helperPath = fileURLToPath(new URL('../lab4-report-provenance.mjs', import.meta.url));
const manifestRelative = 'artifacts/lab-04/issue-61/final-main/verification.json';
const imageRelative = 'artifacts/lab-04/screenshots/fixture.png';
const docRelative = 'docs/lab-04/source-notes.md';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function git(repoRoot, ...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim();
}

// Each test uses a disposable repository and invented evidence. These manifests
// exercise validation only: they never run or represent real release checks.
async function fixture(t) {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'toktickit-final-report-test-')));
  t.after(async () => {
    const cleanupRoot = await realpath(temporaryRoot);
    const temporaryParent = await realpath(os.tmpdir());
    assert.equal(path.dirname(cleanupRoot), temporaryParent, 'cleanup must stay in the unique temporary directory');
    assert.match(path.basename(cleanupRoot), /^toktickit-final-report-test-/);
    await rm(cleanupRoot, { recursive: true, force: true });
  });
  const repoRoot = path.join(temporaryRoot, 'repo');
  await mkdir(repoRoot);
  const put = async (relative, value) => {
    const destination = path.join(repoRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, value);
    return destination;
  };
  const data = {
    status: 'final-main',
    author: 'Synthetic regression fixture',
    studentId: 'fixture',
    verification: { manifest: manifestRelative },
    sections: Array.from({ length: 9 }, (_, index) => ({
      title: `Fixture Part ${index + 1}`,
      paragraphs: ['Synthetic test content; not release evidence.'],
      ...(index === 0 ? {
        images: [{ path: imageRelative, caption: 'Synthetic fixture image' }],
        links: [{ label: 'Reviewed source notes', url: `https://github.com/L0u1sss/TokTickIT/blob/main/${docRelative}` }],
      } : {}),
    })),
  };
  const dataPath = await put('docs/lab-04/report-data.json', `${JSON.stringify(data, null, 2)}\n`);
  const templatePath = await put('docs/lab-04/report-template.html', '<html><body>{{body}}</body></html>\n');
  await put(imageRelative, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEnkAAAAASUVORK5CYII=', 'base64'));
  await put(docRelative, '# Synthetic reviewed source\n');
  await put('README.md', '# Synthetic fixture repository\n');
  await put('server/fixture.mjs', 'export const syntheticServer = true;\n');
  await put('client/fixture.mjs', 'export const syntheticClient = true;\n');
  await put('scripts/fixture.mjs', 'export const syntheticScript = true;\n');
  await put('scripts/lab4-report-provenance.mjs', await readFile(helperPath));
  await put('.github/workflows/fixture.yml', 'name: Synthetic fixture\n');
  await put('.gitignore', 'artifacts/lab-04/issue-61/final-main*/\nartifacts/lab-04/issue-61/final-exports/\ndocs/lab-04/ignored-data.json\n');
  git(repoRoot, 'init', '--initial-branch=main');
  git(repoRoot, 'config', 'user.name', 'Regression Fixture');
  git(repoRoot, 'config', 'user.email', 'fixture@example.invalid');
  git(repoRoot, 'config', 'core.autocrlf', 'false');
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '--quiet', '-m', 'Commit reviewed synthetic report inputs');
  const head = git(repoRoot, 'rev-parse', 'HEAD');
  git(repoRoot, 'update-ref', 'refs/remotes/origin/main', head);
  const sourcePaths = git(repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', 'server', 'client', 'scripts', '.github').split('\0').filter(Boolean).sort();
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (relative) => [relative, sha256(await readFile(path.join(repoRoot, relative)))])));
  const manifest = {
    fixtureOnly: 'Synthetic checks for regression testing; never real release evidence.',
    issue: 61,
    runId: 'final-main',
    branch: 'main',
    baselineCommit: head,
    baselineStatus: '',
    evidenceScope: 'final-main',
    requireMain: true,
    sourceHashes,
    sourceUnchangedDuringRun: true,
    allChecksPassed: true,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:01:00.000Z',
    results: verificationNames.map((name) => ({ name, status: 'PASS', exitCode: 0, log: `${name}.txt` })),
  };
  const verificationPath = await put(manifestRelative, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    temporaryRoot, repoRoot, dataPath, templatePath, verificationPath, data, manifest, head, put,
    options: { repoRoot, dataPath, templatePath, verificationPath },
    saveManifest: async () => writeFile(verificationPath, `${JSON.stringify(manifest, null, 2)}\n`),
  };
}

async function rejectsInput(action, reason) {
  await assert.rejects(action, (error) => {
    assert.match(error.message, reason, 'the rejection must identify the invalid report input');
    assert.doesNotMatch(error.message, /branch must be main|current checkout must be main|sha must equal the full final mainSha/i, 'valid fixture checkout must not fail because report metadata lacks a self-referential commit SHA');
    return true;
  });
}

test('clean committed report inputs derive final metadata from a post-commit manifest', async (t) => {
  const f = await fixture(t);
  assert.equal(git(f.repoRoot, 'status', '--porcelain'), '');
  assert.equal(f.data.sha, undefined);
  assert.equal(f.data.mainSha, undefined);
  assert.equal(f.data.verification.sha, undefined);
  assert.equal(git(f.repoRoot, 'check-ignore', manifestRelative), manifestRelative);
  const record = await validateFinalReport(f.options);
  assert.equal(record.data.branch, 'main');
  assert.equal(record.data.sha, f.head);
  assert.equal(record.data.mainSha, f.head);
  assert.equal(record.data.verification.sha, f.head);
  assert.equal(record.data.verification.allPassed, true);
  assert.equal(record.provenance.mainSha, f.head);
  assert.deepEqual(record.provenance.verification, {
    path: manifestRelative,
    sha256: sha256(await readFile(f.verificationPath)),
  });
  for (const relative of ['docs/lab-04/report-data.json', 'docs/lab-04/report-template.html', imageRelative, docRelative]) {
    const input = record.provenance.reportInputs.find((entry) => entry.path === relative);
    assert.ok(input, `provenance must include reviewed input ${relative}`);
    assert.match(input.gitBlob, /^[a-f0-9]{40}$/);
    assert.equal(input.sha256, sha256(await readFile(path.join(f.repoRoot, relative))));
  }
  assert.deepEqual(record.snapshot.verification, record.provenance.verification);
  const rechecked = await recheckFinalReport(f.options, record.snapshot);
  assert.equal(rechecked.data.sha, f.head);
  assert.deepEqual(rechecked.snapshot, record.snapshot);
});

test('accepts an alternate committed in-repository report data path', async (t) => {
  const f = await fixture(t);
  const alternate = await f.put('docs/lab-04/reviewed-alternate-data.json', `${JSON.stringify({
    ...f.data,
    author: 'Alternate reviewed content',
    branch: 'stale-candidate-branch',
    sha: 'stale-candidate-metadata',
    mainSha: 'stale-candidate-metadata',
  }, null, 2)}\n`);
  git(f.repoRoot, 'add', path.relative(f.repoRoot, alternate));
  git(f.repoRoot, 'commit', '--quiet', '-m', 'Review alternate synthetic report data');
  const finalHead = git(f.repoRoot, 'rev-parse', 'HEAD');
  git(f.repoRoot, 'update-ref', 'refs/remotes/origin/main', finalHead);
  f.manifest.baselineCommit = finalHead;
  await f.saveManifest();
  const record = await validateFinalReport({ ...f.options, dataPath: alternate });
  assert.equal(record.data.author, 'Alternate reviewed content');
  assert.equal(record.data.branch, 'main');
  assert.equal(record.data.sha, finalHead);
  assert.equal(record.data.mainSha, finalHead);
  assert.equal(record.data.verification.sha, finalHead);
  assert.ok(record.provenance.reportInputs.some((input) => input.path === 'docs/lab-04/reviewed-alternate-data.json'));
});

test('rejects changed report data hidden from git status by assume-unchanged', async (t) => {
  const f = await fixture(t);
  const relative = path.relative(f.repoRoot, f.dataPath);
  git(f.repoRoot, 'update-index', '--assume-unchanged', relative);
  await writeFile(f.dataPath, `${await readFile(f.dataPath, 'utf8')}\n`);
  assert.equal(git(f.repoRoot, 'status', '--porcelain', '--', relative), '', 'the test must exercise a dirty file hidden from the status check');
  await rejectsInput(() => validateFinalReport(f.options), /report data does not match the committed final-main file/i);
});

for (const input of ['data', 'template']) {
  for (const staged of [false, true]) {
    test(`rejects ${staged ? 'staged' : 'unstaged'} edits to reviewed ${input}`, async (t) => {
      const f = await fixture(t);
      const target = input === 'data' ? f.dataPath : f.templatePath;
      await writeFile(target, `${await readFile(target, 'utf8')}\n`);
      if (staged) git(f.repoRoot, 'add', path.relative(f.repoRoot, target));
      await rejectsInput(() => validateFinalReport(f.options), new RegExp(`${input}|report-${input}`, 'i'));
    });
  }
}

test('rejects report data outside the repository even when checkout and manifest are valid', async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.temporaryRoot, 'outside-data.json');
  await writeFile(outside, await readFile(f.dataPath));
  await rejectsInput(() => validateFinalReport({ ...f.options, dataPath: outside }), /data.*(repository|outside|escape|inside)|outside.*data/i);
});

for (const ignored of [false, true]) {
  test(`rejects internal ${ignored ? 'ignored' : 'untracked'} report data`, async (t) => {
    const f = await fixture(t);
    const relative = `docs/lab-04/${ignored ? 'ignored' : 'untracked'}-data.json`;
    const unreviewed = await f.put(relative, await readFile(f.dataPath));
    await rejectsInput(() => validateFinalReport({ ...f.options, dataPath: unreviewed }), /data.*(tracked|committed|reviewed)|(?:tracked|committed|reviewed).*data/i);
  });
}

test('rejects modified referenced screenshot bytes', async (t) => {
  const f = await fixture(t);
  await f.put(imageRelative, Buffer.from('modified synthetic screenshot'));
  await rejectsInput(() => validateFinalReport(f.options), /image|screenshot|fixture\.png/i);
});

test('rejects modified report documents beyond the explicit data, template, and images', async (t) => {
  const f = await fixture(t);
  await f.put(docRelative, '# Changed source documentation\n');
  await rejectsInput(() => validateFinalReport(f.options), /source-notes|document|report-producing docs|report.*source|report.*input/i);
});

test('rejects report data symlinks that resolve outside the repository', async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.temporaryRoot, 'external-symlink-data.json');
  await writeFile(outside, await readFile(f.dataPath));
  const linked = path.join(f.repoRoot, 'docs', 'lab-04', 'linked-data.json');
  try {
    await symlink(outside, linked, 'file');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Windows account cannot create file symlinks; realpath containment remains covered by external-path validation.');
      return;
    }
    throw error;
  }
  await rejectsInput(() => validateFinalReport({ ...f.options, dataPath: linked }), /data.*(repository|outside|escape|inside|symlink)|outside.*data/i);
});

test('recheck rejects changed report inputs after the initial gate', async (t) => {
  for (const input of ['data', 'template', 'image']) {
    await t.test(input, async (subtest) => {
      const f = await fixture(subtest);
      const record = await validateFinalReport(f.options);
      const target = input === 'data' ? f.dataPath : input === 'template' ? f.templatePath : path.join(f.repoRoot, imageRelative);
      await writeFile(target, `${await readFile(target)}\nchanged after validation`);
      await rejectsInput(() => recheckFinalReport(f.options, record.snapshot), new RegExp(`${input}|changed|snapshot|fixture\\.png`, 'i'));
    });
  }
});

test('recheck rejects a replaced passing manifest after the initial gate', async (t) => {
  const f = await fixture(t);
  const record = await validateFinalReport(f.options);
  f.manifest.fixtureOnly += ' This replacement also claims to pass.';
  await f.saveManifest();
  await rejectsInput(() => recheckFinalReport(f.options, record.snapshot), /manifest|verification|changed|snapshot/i);
});

test('rejects a main checkout that differs from origin/main', async (t) => {
  const f = await fixture(t);
  git(f.repoRoot, 'commit', '--allow-empty', '--quiet', '-m', 'Synthetic main now differs from remote');
  await assert.rejects(() => validateFinalReport(f.options), /origin\/main|HEAD|checkout|main.*SHA/i);
});

test('rejects partial or stale final verification despite a passing flag', async (t) => {
  for (const failure of ['missing-check', 'stale-source']) {
    await t.test(failure, async (subtest) => {
      const f = await fixture(subtest);
      if (failure === 'missing-check') f.manifest.results.pop();
      else f.manifest.sourceHashes['server/fixture.mjs'] = '0'.repeat(64);
      await f.saveManifest();
      await assert.rejects(() => validateFinalReport(f.options), failure === 'missing-check' ? /19|required.*check|every.*check/i : /source|hash/i);
    });
  }
});

test('accepts generated PDF and sidecars in an ignored final-exports directory', async (t) => {
  const f = await fixture(t);
  const record = await validateFinalReport(f.options);
  const outputPath = path.join(f.repoRoot, 'artifacts', 'lab-04', 'issue-61', 'final-exports', f.head, 'report.pdf');
  await assert.doesNotReject(() => assertFinalOutput({ repoRoot: f.repoRoot, outputPath }, record.snapshot));
  assert.equal(git(f.repoRoot, 'status', '--porcelain'), '');
});

test('rejects outputs that would overwrite reviewed data or the final verification manifest', async (t) => {
  for (const target of ['reviewed-data', 'verification']) {
    await t.test(target, async (subtest) => {
      const f = await fixture(subtest);
      const record = await validateFinalReport(f.options);
      const outputPath = target === 'reviewed-data' ? f.dataPath : f.verificationPath;
      const originalDigest = sha256(await readFile(outputPath));
      await assert.rejects(() => assertFinalOutput({ repoRoot: f.repoRoot, outputPath }, record.snapshot), /output.*final-exports.*cannot overwrite|overwrite reviewed inputs or verification/i);
      assert.equal(sha256(await readFile(outputPath)), originalDigest);
    });
  }
});

test('rejects a final PDF path reserved for its generated sidecars', async (t) => {
  for (const reserved of ['report.html', 'pdf-manifest.json']) {
    await t.test(reserved, async (subtest) => {
      const f = await fixture(subtest);
      const record = await validateFinalReport(f.options);
      const outputPath = path.join(f.repoRoot, 'artifacts', 'lab-04', 'issue-61', 'final-exports', f.head, reserved);
      await assert.rejects(() => assertFinalOutput({ repoRoot: f.repoRoot, outputPath }, record.snapshot), /final PDF output cannot overwrite its HTML or manifest sidecars/i);
    });
  }
});

test('rejects a forced tracked sidecar even inside final-exports', async (t) => {
  const f = await fixture(t);
  const outputRelative = 'artifacts/lab-04/issue-61/final-exports/synthetic-export/report.pdf';
  const sidecarRelative = 'artifacts/lab-04/issue-61/final-exports/synthetic-export/pdf-manifest.json';
  await f.put(sidecarRelative, '{"fixtureOnly":"Synthetic tracked sidecar"}\n');
  git(f.repoRoot, 'add', '--force', sidecarRelative);
  git(f.repoRoot, 'commit', '--quiet', '-m', 'Track synthetic export sidecar to exercise rejection');
  const finalHead = git(f.repoRoot, 'rev-parse', 'HEAD');
  git(f.repoRoot, 'update-ref', 'refs/remotes/origin/main', finalHead);
  f.manifest.baselineCommit = finalHead;
  await f.saveManifest();
  const record = await validateFinalReport(f.options);
  await assert.rejects(() => assertFinalOutput({ repoRoot: f.repoRoot, outputPath: path.join(f.repoRoot, outputRelative) }, record.snapshot), /ignored and untracked/i);
});

test('rejects an export directory redirected outside the repository by a symlink or junction', async (t) => {
  const f = await fixture(t);
  const record = await validateFinalReport(f.options);
  const outside = path.join(f.temporaryRoot, 'outside-export');
  await mkdir(outside);
  const linked = path.join(f.repoRoot, 'artifacts', 'lab-04', 'issue-61', 'final-exports', f.head);
  await mkdir(path.dirname(linked), { recursive: true });
  try {
    await symlink(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Windows account cannot create a directory symlink or junction.');
      return;
    }
    throw error;
  }
  await assert.rejects(() => assertFinalOutput({ repoRoot: f.repoRoot, outputPath: path.join(linked, 'report.pdf') }, record.snapshot), /output.*symlink or junction/i);
});
