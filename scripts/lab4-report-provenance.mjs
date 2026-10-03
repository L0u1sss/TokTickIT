import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const verificationNames = [
  'server-lint', 'client-lint', 'prisma-validate', 'server-build', 'client-build',
  'server-regression', 'client-regression', 'dashboard-performance', 'actions-e2e',
  'resolution-e2e', 'dashboards-e2e', 'authentication-e2e', 'administrator-e2e',
  'staff-queue-e2e', 'staff-workflow-e2e', 'communications-e2e', 'responsive-e2e',
  'ui-hardening-e2e', 'requester-regression-e2e',
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const posix = value => value.split(path.sep).join('/');
// check-ignore accepts filenames and rejects the global literal pathspec magic.
const git = (root, args, encoding = 'utf8') => execFileSync('git', args[0] === 'check-ignore' ? args : ['--literal-pathspecs', ...args],
  { cwd: root, encoding, windowsHide: true });
const rejection = message => new Error(`Final PDF rejected: ${message}`);

async function contained(root, value, label) {
  if (typeof value !== 'string' || !value) throw rejection(`${label} requires an inside-repository path`);
  const file = path.resolve(root, value);
  const relative = path.relative(root, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw rejection(`${label} must stay inside the repository`);
  }
  const physical = await realpath(file).catch(() => { throw rejection(`${label} is missing: ${posix(relative)}`); });
  if (path.relative(file, physical)) throw rejection(`${label} cannot use a symlink or junction redirect`);
  return { file, relative: posix(relative) };
}

async function reviewedInput(root, value, label) {
  const input = await contained(root, value, label);
  const listing = git(root, ['ls-tree', '-z', 'HEAD', '--', input.relative]).toString();
  const entry = listing.split('\0').filter(Boolean).find(record => record.slice(record.indexOf('\t') + 1) === input.relative);
  if (!entry) throw rejection(`${label} must be tracked in the final-main commit: ${input.relative}`);
  const [mode, type, gitBlob] = entry.slice(0, entry.indexOf('\t')).split(' ');
  if (!['100644', '100755'].includes(mode) || type !== 'blob') throw rejection(`${label} must be a regular committed file`);
  if (git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', input.relative]).length) {
    throw rejection(`${label} has staged or uncommitted changes: ${input.relative}`);
  }
  // Git applies the path's clean filters, including CRLF normalization. Comparing
  // blobs also catches modified files hidden by assume-unchanged/skip-worktree.
  const currentBlob = git(root, ['hash-object', `--path=${input.relative}`, '--', input.file]).toString().trim();
  if (currentBlob !== gitBlob) throw rejection(`${label} does not match the committed final-main file: ${input.relative}`);
  const bytes = await readFile(input.file);
  return { ...input, bytes, record: { path: input.relative, gitBlob, sha256: digest(bytes) } };
}

/** Validate reviewed content separately from post-commit verification output. */
export async function validateFinalReport({ repoRoot, dataPath, templatePath, verificationPath }) {
  const root = await realpath(repoRoot);
  // Containment/tracked checks run before parsing data or accepting its metadata.
  const dataInput = await reviewedInput(root, dataPath, 'report data');
  const templateInput = await reviewedInput(root, templatePath, 'report template');
  const data = JSON.parse(dataInput.bytes.toString('utf8'));
  if (data.status !== 'final-main') throw rejection('reviewed report content must have status final-main; prepare and review it before final verification');
  if (!Array.isArray(data.sections) || data.sections.length !== 9) throw rejection('reviewed report content must contain nine sections');
  const sha = git(root, ['rev-parse', 'HEAD']).toString().trim();
  if (git(root, ['branch', '--show-current']).toString().trim() !== 'main' ||
      git(root, ['rev-parse', 'origin/main']).toString().trim() !== sha) {
    throw rejection('current checkout must be main at the exact origin/main SHA');
  }
  const manifestInput = await contained(root, verificationPath ?? data.verification?.manifest, 'verification manifest');
  if (!/^artifacts\/lab-04\/issue-61\/final-main[^/]*\/verification\.json$/.test(manifestInput.relative)) {
    throw rejection('verification manifest must be the generated Issue 61 final-main run, separate from reviewed report content');
  }
  const manifestBytes = await readFile(manifestInput.file);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.issue !== 61 || manifest.evidenceScope !== 'final-main' || manifest.requireMain !== true ||
      manifest.branch !== 'main' || manifest.baselineCommit !== sha || manifest.allChecksPassed !== true ||
      manifest.sourceUnchangedDuringRun !== true) {
    throw rejection('actual runner manifest must be a passing, unchanged Issue 61 final-main run for this SHA');
  }
  const results = manifest.results;
  if (!Array.isArray(results) || results.length !== verificationNames.length || verificationNames.some(name =>
    results.filter(result => result.name === name && result.status === 'PASS' && result.exitCode === 0).length !== 1)) {
    throw rejection('actual runner manifest must contain exactly the 19 required checks, each passing once');
  }
  const scopes = ['docs/lab-04', 'artifacts/lab-04/issue-61', 'server', 'client', 'scripts', '.github', '.gitignore', '.gitattributes'];
  if (git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...scopes]).length) {
    throw rejection('report-producing docs/evidence/scripts must be clean, including staged and untracked files');
  }
  const sourcePaths = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'server', 'client', 'scripts', '.github'])
    .toString().split('\0').filter(Boolean).sort();
  const sourceHashes = {};
  for (const file of sourcePaths) sourceHashes[file] = digest(await readFile(path.join(root, file)));
  if (!manifest.sourceHashes || Object.keys(manifest.sourceHashes).length !== sourcePaths.length ||
      sourcePaths.some(file => sourceHashes[file] !== manifest.sourceHashes[file])) {
    throw rejection('current runtime sources must exactly match the actual runner manifest hashes');
  }
  const inputs = new Map([[dataInput.relative, dataInput.record], [templateInput.relative, templateInput.record]]);
  // The linked specification/review/reflection documents are part of reviewed
  // report input, as are all concrete image bytes embedded by the renderer.
  const documents = git(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', 'docs/lab-04', '.gitignore', '.gitattributes'])
    .toString().split('\0').filter(Boolean);
  const images = data.sections.flatMap(section => (section.images ?? []).map(image => image.path));
  for (const file of new Set([...documents, ...images])) {
    const input = await reviewedInput(root, file, images.includes(file) ? 'report evidence' : 'report document');
    inputs.set(input.relative, input.record);
  }
  const reportInputs = [...inputs.values()].sort((left, right) => left.path.localeCompare(right.path));
  const verification = { path: manifestInput.relative, sha256: digest(manifestBytes) };
  const snapshot = { sha, reportInputs, verification, sourceHashes };
  // The actual checkout/manifest supplies metadata at build time. Requiring a
  // committed JSON file to contain its own commit SHA would be self-referential.
  const effectiveData = { ...data, branch: 'main', sha, mainSha: sha, generatedAt: manifest.finishedAt,
    verification: { manifest: manifestInput.relative, branch: 'main', sha, allPassed: true,
      sourceUnchangedDuringRun: true, commands: results.map(result => ({ id: result.name, status: result.status })) } };
  return { data: effectiveData, dataBytes: dataInput.bytes, templateBytes: templateInput.bytes,
    snapshot, provenance: { mainSha: sha, reportInputs, verification } };
}

export async function recheckFinalReport(options, snapshot) {
  const current = await validateFinalReport(options);
  if (JSON.stringify(current.snapshot) !== JSON.stringify(snapshot)) throw rejection('report inputs or verification changed during rendering');
  return current;
}

/** Keep generated PDFs/sidecars separate from every reviewed or verified input. */
export async function assertFinalOutput({ repoRoot, outputPath }, snapshot) {
  const root = await realpath(repoRoot);
  const output = path.resolve(root, outputPath);
  const protectedPaths = [...snapshot.reportInputs, snapshot.verification].map(input => path.resolve(root, input.path));
  const sidecars = [path.join(path.dirname(output), 'report.html'), path.join(path.dirname(output), 'pdf-manifest.json')];
  if (sidecars.some(file => path.relative(output, file) === '')) {
    throw rejection('final PDF output cannot overwrite its HTML or manifest sidecars');
  }
  for (const file of [output, ...sidecars]) {
    const relative = posix(path.relative(root, file));
    if (!relative.startsWith('artifacts/lab-04/issue-61/final-exports/') || path.isAbsolute(relative) ||
        protectedPaths.some(input => path.relative(input, file) === '')) {
      throw rejection('final output and sidecars must stay in final-exports and cannot overwrite reviewed inputs or verification');
    }
    // Follow the closest existing parent even when the export directory is new.
    // lstat also detects dangling redirects which realpath alone would miss.
    let existing = file;
    while (!(await lstat(existing).then(() => true, error => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }))) existing = path.dirname(existing);
    const physical = await realpath(existing).catch(() => { throw rejection('final output cannot use a dangling symlink or junction'); });
    if (path.relative(existing, physical)) throw rejection('final output cannot use a symlink or junction redirect');
    try { git(root, ['check-ignore', '-q', '--', relative]); }
    catch { throw rejection('final output must be ignored and untracked; keep generated files separate from reviewed inputs'); }
  }
}
