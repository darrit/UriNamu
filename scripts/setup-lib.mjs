import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

export const WEEK = 7 * 24 * 60 * 60 * 1000;
export function releaseTime(value) {
  if (!value) throw new Error('Missing publication date');
  // Date-only metadata cannot prove the time: use the end of that UTC day.
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value);
  if (!Number.isFinite(time)) throw new Error(`Invalid publication date: ${value}`);
  return time;
}
export function eligible(date, now = Date.now()) { return releaseTime(date) < now - WEEK; }
export function mature(date, now = Date.now()) {
  if (!eligible(date, now)) throw new Error(`Release too recent: ${date}; required: older than seven days`);
}
export function stable(version) { return /^\d+\.\d+\.\d+$/.test(version); }
export function compare(a, b) {
  const x = a.replace(/^v/, '').split('.').map(Number), y = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
export function keepInstalled(installed, selected) {
  return typeof installed === 'string' && stable(installed) && compare(installed, selected) >= 0;
}
// Deliberately reject unknown range syntax instead of guessing compatibility.
export function satisfies(version, range) {
  return range.split('||').some(branch => branch.trim().split(/\s+/).every(term => {
    if (term === '*') return true;
    const match = term.match(/^(>=|<=|>|<|\^|~|=)?(\d+\.\d+\.\d+)$/);
    if (!match) return false;
    const [, op = '=', base] = match, c = compare(version, base);
    if (op === '^') return c >= 0 && version.split('.')[0] === base.split('.')[0];
    if (op === '~') return c >= 0 && version.split('.').slice(0, 2).join('.') === base.split('.').slice(0, 2).join('.');
    return op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : c === 0;
  }));
}
export function parsePlist(xml) {
  const tokens = xml.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, '').match(/<[^>]+>|[^<]+/g) || [];
  let i = 0;
  const blank = () => { while (tokens[i]?.trim() === '') i++; };
  const decode = value => value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (_, v) => v[0] === '#' ? String.fromCodePoint(v[1] === 'x' ? parseInt(v.slice(2), 16) : +v.slice(1)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[v]);
  function value() {
    blank(); const tag = tokens[i++];
    if (/^<true\s*\/>$/.test(tag)) return true;
    if (/^<false\s*\/>$/.test(tag)) return false;
    if (/^<dict\s*\/>$/.test(tag)) return {};
    if (/^<array\s*\/>$/.test(tag)) return [];
    if (tag === '<dict>') {
      const obj = Object.create(null); blank();
      while (tokens[i] !== '</dict>') { const key = value(); if (typeof key !== 'string') throw new Error('Invalid plist key'); obj[key] = value(); blank(); }
      i++; return obj;
    }
    if (tag === '<array>') { const items = []; blank(); while (tokens[i] !== '</array>') { items.push(value()); blank(); } i++; return items; }
    const scalar = tag?.match(/^<(key|string|date|data|integer|real)(\s*\/?)>$/);
    if (!scalar) throw new Error(`Unsupported plist element: ${tag}`);
    if (scalar[2].includes('/')) return '';
    let text = ''; while (tokens[i] && tokens[i] !== `</${scalar[1]}>`) { if (tokens[i].startsWith('<')) throw new Error('Invalid plist scalar'); text += tokens[i++]; }
    if (!tokens[i++]) throw new Error('Incomplete plist');
    return ['integer', 'real'].includes(scalar[1]) ? Number(text) : decode(text).trim();
  }
  blank(); if (!tokens[i++]?.startsWith('<plist')) throw new Error('Not an XML plist catalog');
  const result = value(); blank(); if (tokens[i++] !== '</plist>') throw new Error('Invalid plist closing tag');
  return result;
}
export function latest(rows, major, now) {
  const result = rows.filter(r => stable(r.version) && +r.version.split('.')[0] === +major && eligible(r.published, now))
    .sort((a, b) => compare(b.version, a.version))[0];
  if (!result) throw new Error(`No mature stable release for major version ${major}`);
  return result;
}
export function verify(data, expected, algorithm = 'sha256') {
  const actual = createHash(algorithm).update(data).digest('hex');
  if (!expected || actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${algorithm}-checksum mismatch`);
}
// Apple's catalog Digest is the xar checksum of the compressed table of contents,
// not a hash of the package bytes. Member archived-checksums bind the payload.
export async function verifyApplePackage(file, digestHex, expectedSize, filename) {
  const expected = digestHex?.toLowerCase() ?? '';
  const fail = message => { throw new Error(`${message}: ${filename}`); };
  const fh = await open(file, 'r');
  try {
    const stat = await fh.stat();
    if (!Number.isSafeInteger(expectedSize) || stat.size !== expectedSize) fail('Apple package size mismatch');
    const header = Buffer.alloc(28);
    await readExact(fh, header, 0, fail);
    if (header.toString('latin1', 0, 4) !== 'xar!') fail('Apple package is not a xar archive');
    const headerSize = header.readUInt16BE(4);
    const tocLength = Number(header.readBigUInt64BE(8));
    if (headerSize < 28 || !Number.isSafeInteger(tocLength) || tocLength < 1 || tocLength > 32 * 1024 * 1024) fail('Apple package has an invalid xar header');
    const toc = Buffer.alloc(tocLength);
    await readExact(fh, toc, headerSize, fail);
    let xml;
    try { xml = inflateSync(toc).toString('utf8'); } catch { fail('Apple package TOC could not be read'); }
    const checksum = xml.match(/<checksum style="(sha1|sha256|sha512)">\s*<offset>(\d+)<\/offset>\s*<size>(\d+)<\/size>\s*<\/checksum>/);
    if (!checksum) fail('Apple package is missing a xar checksum');
    const [, style, offsetText, sizeText] = checksum;
    const offset = Number(offsetText), size = Number(sizeText);
    const actual = createHash(style).update(toc).digest();
    const heap = headerSize + tocLength;
    if (actual.length !== size || heap + offset + size > stat.size) fail(`${style}-checksum mismatch`);
    const embedded = Buffer.alloc(size);
    await readExact(fh, embedded, heap + offset, fail);
    if (embedded.toString('hex') !== actual.toString('hex') || actual.toString('hex') !== expected) fail(`${style}-checksum mismatch`);
    const members = [...xml.matchAll(/<data>([\s\S]*?)<\/data>/g)];
    if (!members.length) fail('Apple package has no archived files');
    for (const member of members) {
      const body = member[1];
      const memberOffset = Number(body.match(/<offset>(\d+)<\/offset>/)?.[1]);
      // Apple stores the heap byte count in length. size is the extracted length and is larger for bzip2 members.
      const archivedLength = Number(body.match(/<length>(\d+)<\/length>/)?.[1]);
      const memberSize = Number.isSafeInteger(archivedLength) ? archivedLength : Number(body.match(/<size>(\d+)<\/size>/)?.[1]);
      const archived = body.match(/<archived-checksum style="(sha1|sha256|sha512)">\s*([a-fA-F0-9\s]+)\s*<\/archived-checksum>/);
      if (!Number.isSafeInteger(memberOffset) || !Number.isSafeInteger(memberSize) || memberSize < 0 || !archived) fail('archived-checksum mismatch');
      const algorithm = archived[1].toLowerCase();
      const recorded = archived[2].replace(/\s/g, '').toLowerCase();
      if (recorded.length !== createHash(algorithm).digest().length * 2 || heap + memberOffset + memberSize > stat.size) fail('archived-checksum mismatch');
      const hash = createHash(algorithm);
      let position = heap + memberOffset, left = memberSize;
      const buf = Buffer.alloc(Math.min(Math.max(left, 1), 1024 * 1024));
      while (left) {
        const n = Math.min(buf.length, left);
        const { bytesRead } = await fh.read(buf, 0, n, position);
        if (bytesRead !== n) fail('archived-checksum mismatch');
        hash.update(buf.subarray(0, bytesRead));
        position += bytesRead; left -= bytesRead;
      }
      if (hash.digest('hex') !== recorded) fail('archived-checksum mismatch');
    }
  } finally { await fh.close(); }
}
async function readExact(fh, buffer, position, fail) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await fh.read(buffer, offset, buffer.length - offset, position + offset);
    if (!bytesRead) fail('Apple package is truncated');
    offset += bytesRead;
  }
}
export function visualStudioReleases(html) {
  const marker = html.indexOf('id="fixed-version-bootstrappers"');
  if (marker < 0) throw new Error('Microsoft fixed-version release table not found');
  const table = html.slice(marker).split('</table>')[0];
  return [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].flatMap(row => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    if (cells.length !== 5 || cells[0].replace(/<[^>]+>/g, '').trim() !== 'Current') return [];
    const url = cells[3].match(/href="(https:\/\/download\.visualstudio\.microsoft\.com\/[^" ]+\/vs_BuildTools\.exe)"/i)?.[1];
    const version = cells[1].match(/\d+\.\d+\.\d+/)?.[0];
    const date = new Date(cells[2].replace(/<[^>]+>/g, '').trim() + ' 00:00:00 UTC');
    if (!url || !version || !Number.isFinite(+date)) return [];
    return [{ version, published: date.toISOString().slice(0, 10), url, build: cells[4].replace(/<[^>]+>/g, '').trim() }];
  });
}
// Snapshot pins name every package in a fresh install. On a machine that already has
// newer libraries, installing those exact older versions can force apt to remove the desktop.
export function partitionSnapshotPins(pins, installed, compare) {
  const install = [], keep = [];
  for (const pin of pins) {
    const current = installed.get(pin.name);
    if (!current) install.push({ name: pin.name, version: pin.version });
    else {
      const order = compare(current, pin.version);
      if (order > 0) keep.push({ name: pin.name, installed: current, snapshot: pin.version });
      else if (order < 0) install.push({ name: pin.name, version: pin.version });
    }
  }
  return { install, keep };
}
export function parseExactDependencyConflicts(text) {
  const conflicts = [];
  const patterns = [
    /^\s*(\S+?)(?::\w+)?\s+:\s+Depends:\s+(\S+?)(?::\w+)?\s+\(= ([^)]+)\)\s+but\s+(\S+)\s+is(?: to be)? installed/gm,
    /^\s*(\S+?)(?::\w+)?\s+:\s+Hängt ab von:\s+(\S+?)(?::\w+)?\s+\(= ([^)]+)\)\s+aber\s+(\S+)\s+soll installiert werden/gm,
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) conflicts.push({ package: match[1], dependency: match[2], required: match[3], actual: match[4] });
  return conflicts;
}
export function parsePackageRecords(text) {
  return text.split(/\n\n+/).flatMap(stanza => {
    const name = stanza.match(/^Package: (\S+)/m)?.[1], version = stanza.match(/^Version: (\S+)/m)?.[1];
    if (!name || !version) return [];
    return [{ name, version, depends: stanza.match(/^Depends: (.*)$/m)?.[1] ?? '' }];
  });
}
export function companionVersion(records, dependency, actual) {
  const needle = `${dependency} (= ${actual})`;
  const matches = records.filter(record => record.depends.includes(needle));
  return matches.find(record => record.version === actual)?.version ?? matches[0]?.version;
}
export function applyCompanionPins(install, conflicts, recordsByPackage, kept) {
  const keptVersions = new Map(kept.map(item => [item.name, item.installed]));
  const next = install.map(item => ({ ...item }));
  let changed = false;
  for (const conflict of conflicts) {
    if (keptVersions.get(conflict.dependency) !== conflict.actual) continue;
    const version = companionVersion(recordsByPackage.get(conflict.package) ?? [], conflict.dependency, conflict.actual);
    if (!version) continue;
    const pin = next.find(item => item.name === conflict.package);
    if (!pin || pin.version === version) continue;
    pin.version = version;
    pin.companionOf = conflict.dependency;
    changed = true;
  }
  return { install: next, changed };
}
export async function pool(items, action, count = 6) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (next < items.length) { const index = next++; await action(items[index], index); }
  }));
}
