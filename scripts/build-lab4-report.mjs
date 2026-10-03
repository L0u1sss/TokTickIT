import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireClient = createRequire(path.join(repoRoot, 'client', 'package.json'));
const { chromium } = requireClient('@playwright/test');
const options = process.argv.slice(2);
const value = (name, fallback) => options.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dataPath = path.resolve(repoRoot, value('data', 'docs/lab-04/report-data.json'));
const outputPath = path.resolve(repoRoot, value('output', 'docs/lab-04/SE-Lab4-67070507212.pdf'));
const finalRequested = options.includes('--final');
const artifactDir = path.join(repoRoot, 'artifacts', 'lab-04', 'issue-61');
const escapeHtml = (input) => String(input ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const digest = (input) => createHash('sha256').update(input).digest('hex');
const imageRecords = [];
const linkRecords = [];
const verificationNames = [
  'server-lint', 'client-lint', 'prisma-validate', 'server-build', 'client-build',
  'server-regression', 'client-regression', 'dashboard-performance', 'actions-e2e',
  'resolution-e2e', 'dashboards-e2e', 'authentication-e2e', 'administrator-e2e',
  'staff-queue-e2e', 'staff-workflow-e2e', 'communications-e2e', 'responsive-e2e',
  'ui-hardening-e2e', 'requester-regression-e2e',
];
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim();

async function checkFinal(data) {
  const checks = data.verification?.commands;
  const failures = [];
  if (data.status !== 'final-main') failures.push('status must be final-main');
  if (data.branch !== 'main') failures.push('branch must be main');
  if (!/^[a-f0-9]{40}$/i.test(data.sha ?? '') || data.sha !== data.mainSha) failures.push('sha must equal the full final mainSha');
  if (data.verification?.branch !== 'main' || data.verification?.sha !== data.sha) failures.push('verification must identify this main branch and SHA');
  if (data.verification?.allPassed !== true) failures.push('verification.allPassed must be true');
  if (data.verification?.sourceUnchangedDuringRun !== true) failures.push('verification.sourceUnchangedDuringRun must be true');
  if (!Array.isArray(checks) || checks.length === 0 || checks.some((check) => check.status !== 'PASS')) failures.push('every recorded verification command must have status PASS');
  if (git(['branch', '--show-current']) !== 'main' || git(['rev-parse', 'HEAD']) !== data.sha || git(['rev-parse', 'origin/main']) !== data.sha) failures.push('current checkout must be main at the exact origin/main SHA');
  const manifestName = data.verification?.manifest;
  if (typeof manifestName !== 'string' || !manifestName || path.isAbsolute(manifestName)) failures.push('verification.manifest must identify the actual repo-relative final-main runner manifest');
  else {
    const manifestPath = path.resolve(repoRoot, manifestName);
    const relative = path.relative(repoRoot, manifestPath);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) failures.push('verification.manifest must stay within the repository');
    else {
      try {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        if (manifest.issue !== 61 || manifest.evidenceScope !== 'final-main' || manifest.requireMain !== true || manifest.branch !== 'main' || manifest.baselineCommit !== data.sha || manifest.allChecksPassed !== true || manifest.sourceUnchangedDuringRun !== true) failures.push('actual runner manifest must be a passing, unchanged Issue 61 final-main run for this SHA');
        const results = manifest.results;
        if (!Array.isArray(results) || results.length !== verificationNames.length || verificationNames.some((name) => results.filter((result) => result.name === name && result.status === 'PASS' && result.exitCode === 0).length !== 1)) failures.push('actual runner manifest must contain exactly the 19 required checks, each passing once');
        const sourcePaths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'server', 'client', 'scripts', '.github']).split('\0').filter(Boolean).sort();
        const currentHashes = {};
        for (const sourcePath of sourcePaths) currentHashes[sourcePath] = digest(await readFile(path.join(repoRoot, sourcePath)));
        if (!manifest.sourceHashes || Object.keys(manifest.sourceHashes).length !== sourcePaths.length || sourcePaths.some((sourcePath) => currentHashes[sourcePath] !== manifest.sourceHashes[sourcePath])) failures.push('current server/client/scripts/.github sources must exactly match the actual runner manifest hashes');
      } catch (error) { failures.push(`cannot validate actual runner manifest: ${error.message}`); }
    }
  }
  if (failures.length) throw new Error(`Final PDF rejected: ${failures.join('; ')}. Build a draft without --final while final main is pending.`);
}

function paragraphMarkup(paragraph) {
  // Raw HTML is opt-in and must originate in reviewed repository report data.
  if (paragraph && typeof paragraph === 'object' && paragraph.trusted === true && typeof paragraph.html === 'string') return `<p>${paragraph.html}</p>`;
  const text = paragraph && typeof paragraph === 'object' ? paragraph.text : paragraph;
  return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function linksMarkup(links = []) {
  if (!Array.isArray(links)) throw new Error('Section links must be an array.');
  if (!links.length) return '';
  return `<div class="link-grid">${links.map((link) => {
    let parsed;
    try { parsed = new URL(link.url); } catch { throw new Error(`Invalid report link: ${link.url}`); }
    if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error(`Unsupported report link protocol: ${link.url}`);
    linkRecords.push({ label: String(link.label ?? link.url), url: String(link.url) });
    return `<div class="link-card"><a class="label" href="${escapeHtml(link.url)}">${escapeHtml(link.label ?? link.url)}</a><a class="url" href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a></div>`;
  }).join('')}</div>`;
}

function tableMarkup(table) {
  if (!table) return '';
  if (!Array.isArray(table.headers) || !Array.isArray(table.rows)) throw new Error('Report table requires headers and rows arrays.');
  const cells = (values, element) => values.map((cell) => `<${element}>${escapeHtml(cell)}</${element}>`).join('');
  return `<table><thead><tr>${cells(table.headers, 'th')}</tr></thead><tbody>${table.rows.map((row) => {
    if (!Array.isArray(row) || row.length !== table.headers.length) throw new Error('Every report table row must match the header column count.');
    return `<tr>${cells(row, 'td')}</tr>`;
  }).join('')}</tbody></table>`;
}

function pngDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  return null;
}

async function loadImage(item) {
  if (!item || typeof item.path !== 'string') throw new Error('Every report image requires a repo-relative path.');
  const fullPath = path.resolve(repoRoot, item.path);
  const relative = path.relative(repoRoot, fullPath);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error(`Report image must remain inside the repository: ${item.path}`);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext];
  if (!mime) throw new Error(`Unsupported report image format: ${item.path}`);
  const bytes = await readFile(fullPath);
  const dimensions = pngDimensions(bytes);
  let crop;
  if (item.crop !== undefined) {
    if (!dimensions) throw new Error(`Image crop requires readable PNG dimensions: ${item.path}`);
    const rectangle = item.crop;
    if (!rectangle || !['x', 'y', 'width', 'height'].every((key) => Number.isInteger(rectangle[key])) || rectangle.x < 0 || rectangle.y < 0 || rectangle.width <= 0 || rectangle.height <= 0 || rectangle.x + rectangle.width > dimensions.width || rectangle.y + rectangle.height > dimensions.height) throw new Error(`Image crop must be a positive integer pixel rectangle within the original PNG: ${item.path}`);
    crop = { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height };
  }
  const record = { path: relative.replaceAll(path.sep, '/'), sha256: digest(bytes), bytes: bytes.length, ...dimensions, ...(crop ? { crop } : {}) };
  imageRecords.push(record);
  const displayDimensions = crop ?? dimensions;
  return { ...record, caption: crop ? `Screenshot excerpt · ${item.caption ?? ''}` : item.caption ?? '', dataUrl: `data:${mime};base64,${bytes.toString('base64')}`, landscape: displayDimensions ? displayDimensions.width / displayDimensions.height >= 1.2 : false };
}

function figureMarkup(item, paired) {
  let image;
  if (item.crop) {
    // Clip the original screenshot in HTML/CSS; its pixel data and SHA remain intact.
    const scale = Math.min(180 / item.crop.width, (paired ? 87 : 185) / item.crop.height);
    const mm = (pixels) => `${(pixels * scale).toFixed(5)}mm`;
    image = `<div class="image-crop" style="width:${mm(item.crop.width)};height:${mm(item.crop.height)}"><img src="${item.dataUrl}" alt="${escapeHtml(item.caption || item.path)}" style="width:${mm(item.width)};height:${mm(item.height)};left:${mm(-item.crop.x)};top:${mm(-item.crop.y)}"></div>`;
  } else image = `<img src="${item.dataUrl}" alt="${escapeHtml(item.caption || item.path)}">`;
  const cropLabel = item.crop ? ` · excerpt x=${item.crop.x}, y=${item.crop.y}, ${item.crop.width}×${item.crop.height} pixels` : '';
  return `<figure>${image}<figcaption>${escapeHtml(item.caption)}<span class="image-path">${escapeHtml(item.path)}${escapeHtml(cropLabel)}</span></figcaption></figure>`;
}

async function evidenceMarkup(images, sectionIndex) {
  if (!Array.isArray(images)) throw new Error('Section images must be an array.');
  const loaded = [];
  for (const item of images) loaded.push(await loadImage(item));
  const pages = [];
  for (let i = 0; i < loaded.length; i += 1) {
    const group = [loaded[i]];
    if (loaded[i].landscape && loaded[i + 1]?.landscape) group.push(loaded[++i]);
    pages.push(`<div class="evidence-page ${group.length === 2 ? 'paired' : ''}"><h2>Part ${sectionIndex + 1} · Visual evidence</h2><p class="evidence-source">Screenshots retain their original aspect ratio. Focused excerpts are identified with crop coordinates and original source paths.</p>${group.map((item) => figureMarkup(item, group.length === 2)).join('')}</div>`);
  }
  return pages.join('');
}

async function fontMarkup() {
  const windowsDir = process.env.WINDIR || 'C:\\Windows';
  const pairs = [
    [path.join(windowsDir, 'Fonts', 'tahoma.ttf'), path.join(windowsDir, 'Fonts', 'tahomabd.ttf')],
    ['/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf'],
    ['/usr/share/fonts/truetype/noto/NotoSansThaiLooped-Regular.ttf', '/usr/share/fonts/truetype/noto/NotoSansThaiLooped-Bold.ttf'],
  ];
  for (const [regular, bold] of pairs) {
    try {
      const normalBytes = await readFile(regular);
      const boldBytes = await readFile(bold);
      return { css: `@font-face { font-family: "Report Thai"; src: url(data:font/ttf;base64,${normalBytes.toString('base64')}) format("truetype"); font-weight: 400; }\n@font-face { font-family: "Report Thai"; src: url(data:font/ttf;base64,${boldBytes.toString('base64')}) format("truetype"); font-weight: 700; }`, family: path.basename(regular), sha256: [digest(normalBytes), digest(boldBytes)] };
    } catch { /* Try the next installed Thai font family. */ }
  }
  return { css: '', family: 'system Tahoma / Noto Sans Thai fallback', sha256: [] };
}

function inspectPdf(output) {
  try {
    const script = 'import json,sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); links=[str(a.get_object().get("/A",{}).get("/URI")) for p in r.pages for a in p.get("/Annots",[]) if a.get_object().get("/A",{}).get("/URI")]; print(json.dumps({"pageCount":len(r.pages),"pdfLinkCount":len(links),"pdfUrls":sorted(set(links))}))';
    return JSON.parse(execFileSync('python', ['-c', script, output], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim());
  } catch {
    return { pageCount: null, pdfLinkCount: null, inspectionNote: 'Run independent PDF validation to record page count and clickable link annotations.' };
  }
}

async function main() {
  for (const option of options) {
    if (option !== '--final' && !option.startsWith('--data=') && !option.startsWith('--output=')) throw new Error(`Unknown option: ${option}`);
  }
  let dataBytes;
  try { dataBytes = await readFile(dataPath); } catch (error) {
    throw new Error(`Report data is missing or unreadable at ${dataPath}. Provide docs/lab-04/report-data.json or --data=<path>. ${error.code ?? ''}`);
  }
  const data = JSON.parse(dataBytes.toString('utf8'));
  if (!Array.isArray(data.sections) || data.sections.length !== 9) throw new Error('Lab 4 report data must contain exactly nine sections in Answer Part 1–9 order.');
  if (finalRequested) await checkFinal(data);
  const label = finalRequested ? 'Final main — verified release' : 'Release candidate — final main pending';
  const meta = `<div class="document-meta"><p class="project">TokTickIT · Lab 4</p><p class="identity">${escapeHtml(data.author ?? 'PHALAT AMACHAYAPHA')} · ${escapeHtml(data.studentId ?? '67070507212')}</p><span class="release-state ${finalRequested ? 'final' : ''}">${escapeHtml(label)}</span><div class="snapshot"><span>Branch: ${escapeHtml(data.branch ?? 'pending')}</span><span>Prepared: ${escapeHtml(data.generatedAt ?? new Date().toISOString())}</span><span>Report source: <code>${escapeHtml(data.sha ?? 'pending')}</code></span><span>Final main: <code>${escapeHtml(data.mainSha ?? 'pending')}</code></span></div></div>`;
  const sections = [];
  for (let i = 0; i < data.sections.length; i += 1) {
    const section = data.sections[i];
    const title = String(section.title ?? '').replace(/^Answer Part\s*\d+\s*[:·—-]?\s*/i, '');
    if (!title) throw new Error(`Section ${i + 1} requires a descriptive title.`);
    if (!Array.isArray(section.paragraphs ?? [])) throw new Error(`Section ${i + 1} paragraphs must be an array.`);
    sections.push(`<section class="report-section">${i === 0 ? meta : ''}<h1><span class="part-number">Answer Part ${i + 1}</span>${escapeHtml(title)}</h1>${(section.paragraphs ?? []).map(paragraphMarkup).join('')}${linksMarkup(section.links)}${tableMarkup(section.table)}${await evidenceMarkup(section.images ?? [], i)}</section>`);
  }
  const templatePath = path.join(repoRoot, 'docs', 'lab-04', 'report-template.html');
  const templateBytes = await readFile(templatePath);
  const fonts = await fontMarkup();
  const html = templateBytes.toString('utf8').replace('{{documentTitle}}', escapeHtml(`TokTickIT Lab 4 — ${data.studentId ?? '67070507212'}`)).replace('{{fontFaces}}', fonts.css).replace('{{body}}', sections.join('\n'));
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(path.join(artifactDir, 'report.html'), html);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())); });
    const imageFailures = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || !image.naturalWidth).map((image) => image.alt));
    if (imageFailures.length) throw new Error(`Report images did not decode: ${imageFailures.join(', ')}`);
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: `<div style="font-family:Arial,sans-serif;font-size:8px;color:#52675e;width:100%;padding:0 14mm;display:flex;justify-content:space-between;"><span>${escapeHtml(label)} · ${escapeHtml(data.studentId ?? '67070507212')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`, margin: { top: '14mm', right: '14mm', bottom: '17mm', left: '14mm' }, tagged: true, outline: true });
  } finally { await browser.close(); }
  const outputBytes = await readFile(outputPath);
  const manifest = { generatedAt: new Date().toISOString(), status: finalRequested ? 'final-main' : 'release-candidate', label, branch: data.branch ?? null, sha: data.sha ?? null, mainSha: data.mainSha ?? null, data: { path: path.relative(repoRoot, dataPath).replaceAll(path.sep, '/'), sha256: digest(dataBytes) }, template: { path: 'docs/lab-04/report-template.html', sha256: digest(templateBytes) }, font: fonts.family, fontSha256: fonts.sha256, output: { path: path.relative(repoRoot, outputPath).replaceAll(path.sep, '/'), bytes: (await stat(outputPath)).size, sha256: digest(outputBytes) }, images: imageRecords, links: linkRecords, ...inspectPdf(outputPath) };
  await writeFile(path.join(artifactDir, 'pdf-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built ${manifest.status} PDF: ${outputPath}`);
  console.log(`Pages: ${manifest.pageCount ?? 'pending independent validation'}; images: ${imageRecords.length}; distinct source links: ${new Set(linkRecords.map((link) => link.url)).size}`);
  console.log(`Manifest: ${path.join(artifactDir, 'pdf-manifest.json')}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
