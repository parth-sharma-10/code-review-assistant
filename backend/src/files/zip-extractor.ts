import * as yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';
import {
  classify,
  decodeText,
  extensionOf,
  LIMITS,
  mimeTypeOf,
  safeEntryPath,
  SkipReason,
} from './ingest-policy';

export interface ExtractedFile {
  path: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  content: string;
}

export interface SkippedEntry {
  path: string;
  reason: SkipReason;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  skipped: SkippedEntry[];
}

/** The archive as a whole is unacceptable. Mapped to HTTP 400 by the caller. */
export class ZipRejectedError extends Error {}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * Reads a ZIP entirely in memory. Nothing is ever written to disk or executed; the output is
 * text rows destined for the database. Entry sizes are checked against the *declared* sizes
 * before decompression, and yauzl (validateEntrySizes) aborts if the real stream exceeds them,
 * which is what defeats zip bombs that lie in their headers.
 */
export async function extractZip(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await openZip(buffer);
  try {
    if (zip.entryCount > LIMITS.maxEntries) {
      throw new ZipRejectedError(`Archive has more than ${LIMITS.maxEntries} entries`);
    }
    const { files, skipped } = await readEntries(zip);
    const root = commonRoot(files);
    const strip = (p: string) => (root && p.startsWith(root) ? p.slice(root.length) : p);
    return {
      files: files.map((f) => ({ ...f, path: strip(f.path) })),
      skipped: skipped.map((s) => ({ ...s, path: strip(s.path) })),
    };
  } finally {
    zip.close();
  }
}

async function readEntries(zip: ZipFile): Promise<ExtractionResult> {
  const byPath = new Map<string, ExtractedFile>();
  const skipped: SkippedEntry[] = [];
  let totalBytes = 0;

  for await (const entry of iterateEntries(zip)) {
    if (entry.fileName.endsWith('/')) continue; // directory entry

    const filePath = safeEntryPath(entry.fileName);
    if (filePath === null) {
      throw new ZipRejectedError(
        `Archive contains an unsafe path: ${entry.fileName.slice(0, 200)}`,
      );
    }
    if (isSymlink(entry)) {
      skipped.push({ path: filePath, reason: 'symlink' });
      continue;
    }
    const reason = classify(filePath, entry.uncompressedSize);
    if (reason) {
      skipped.push({ path: filePath, reason });
      continue;
    }

    totalBytes += entry.uncompressedSize;
    if (totalBytes > LIMITS.maxTotalBytes) {
      throw new ZipRejectedError(
        `Archive expands to more than ${LIMITS.maxTotalBytes / 1024 / 1024} MB of source`,
      );
    }
    if (byPath.size >= LIMITS.maxStoredFiles && !byPath.has(filePath)) {
      throw new ZipRejectedError(`Archive has more than ${LIMITS.maxStoredFiles} source files`);
    }

    const content = decodeText(await readEntry(zip, entry));
    if (content === null) {
      skipped.push({ path: filePath, reason: 'binary' });
      continue;
    }
    const name = filePath.slice(filePath.lastIndexOf('/') + 1);
    const extension = extensionOf(name);
    byPath.set(filePath, {
      path: filePath,
      name,
      extension,
      mimeType: mimeTypeOf(extension),
      size: Buffer.byteLength(content),
      content,
    });
  }
  return { files: [...byPath.values()], skipped };
}

/** GitHub "Download ZIP" wraps everything in `repo-main/`; returns that prefix if all files share it. */
function commonRoot(files: ExtractedFile[]): string | null {
  if (files.length === 0 || !files[0].path.includes('/')) return null;
  const root = `${files[0].path.split('/')[0]}/`;
  return files.every((f) => f.path.startsWith(root)) ? root : null;
}

function isSymlink(entry: Entry): boolean {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & S_IFMT) === S_IFLNK;
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) reject(new ZipRejectedError(`Invalid ZIP archive: ${err?.message}`));
      else resolve(zip);
    });
  });
}

async function* iterateEntries(zip: ZipFile): AsyncGenerator<Entry> {
  while (true) {
    const entry = await new Promise<Entry | null>((resolve, reject) => {
      const onEntry = (e: Entry) => done(() => resolve(e));
      const onEnd = () => done(() => resolve(null));
      const onError = (err: Error) =>
        done(() => reject(new ZipRejectedError(`Invalid ZIP archive: ${err.message}`)));
      const done = (fn: () => void) => {
        zip.off('entry', onEntry).off('end', onEnd).off('error', onError);
        fn();
      };
      zip.once('entry', onEntry).once('end', onEnd).once('error', onError);
      zip.readEntry();
    });
    if (!entry) return;
    yield entry;
  }
}

function readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(new ZipRejectedError(`Could not read ${entry.fileName}: ${err?.message}`));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', (e) => reject(new ZipRejectedError(`Corrupt entry: ${e.message}`)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}
