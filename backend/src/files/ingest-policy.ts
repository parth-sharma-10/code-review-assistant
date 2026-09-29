import * as path from 'node:path';

/** Hard limits for one upload. Exceeding an archive-level limit rejects the whole upload. */
export const LIMITS = {
  maxArchiveBytes: 20 * 1024 * 1024, // compressed upload size (enforced by multer)
  maxEntries: 20_000, // central-directory entries, including ones we skip
  maxStoredFiles: 2_000,
  maxFileBytes: 512 * 1024, // larger individual files are skipped, not rejected
  maxTotalBytes: 50 * 1024 * 1024, // sum of stored (uncompressed) file sizes
};

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  '.pytest_cache',
  '.mypy_cache',
  'target',
  '.gradle',
  '.idea',
  '.terraform',
  '__MACOSX',
]);

/** Files that commonly hold credentials. Never stored, so never shown or sent to an AI provider. */
const SECRET_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\..+$/i,
  /\.(pem|key|p12|pfx|jks|keystore|crt|cer|der|asc|gpg)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^\.(npmrc|pypirc|netrc|htpasswd|pgpass)$/i,
  /^credentials(\.json)?$/i,
  /^service[-_]?account.*\.json$/i,
  /\.tfstate(\.backup)?$/i,
];
const SAFE_ENV_TEMPLATES = /^\.env\.(example|sample|template|dist)$/i;

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'ico',
  'webp',
  'tiff',
  'psd',
  'pdf',
  'zip',
  'gz',
  'tgz',
  'tar',
  'rar',
  '7z',
  'jar',
  'war',
  'class',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'o',
  'a',
  'wasm',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp3',
  'mp4',
  'mov',
  'avi',
  'wav',
  'ogg',
  'webm',
  'sqlite',
  'db',
  'pyc',
  'pyo',
  'lockb',
  'dmg',
  'iso',
  'apk',
  'ipa',
]);

const NOISE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

export type SkipReason = 'ignored-directory' | 'secret' | 'binary' | 'too-large' | 'symlink';

/**
 * Normalises an archive entry name and guarantees it stays inside a virtual root.
 * Returns null for anything that could escape (absolute paths, drive letters, `..`, NUL bytes).
 *
 * yauzl already rejects most of these; this is an independent second layer that does not
 * depend on library behaviour, and it is what the unit tests exercise directly.
 */
export function safeEntryPath(rawName: string): string | null {
  if (rawName.length === 0 || rawName.length > 1024) return null;
  // Control characters (incl. NUL) have no place in a source path and confuse downstream tools.
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  if (/[\u0000-\u001f]/.test(rawName)) return null;
  const name = rawName.replace(/\\/g, '/');
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return null;

  const root = '/__upload_root__';
  const resolved = path.posix.resolve(root, name);
  if (!resolved.startsWith(`${root}/`)) return null;
  return resolved.slice(root.length + 1);
}

export function classify(filePath: string, size: number): SkipReason | null {
  const segments = filePath.split('/');
  const fileName = segments[segments.length - 1];
  if (segments.slice(0, -1).some((s) => IGNORED_DIRECTORIES.has(s))) return 'ignored-directory';
  if (NOISE_FILES.has(fileName)) return 'ignored-directory';
  if (!SAFE_ENV_TEMPLATES.test(fileName) && SECRET_FILE_PATTERNS.some((p) => p.test(fileName))) {
    return 'secret';
  }
  if (BINARY_EXTENSIONS.has(extensionOf(fileName))) return 'binary';
  if (size > LIMITS.maxFileBytes) return 'too-large';
  return null;
}

/** Decodes as UTF-8, or returns null if the bytes look binary (NUL byte or invalid UTF-8). */
export function decodeText(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

const MIME_TYPES: Record<string, string> = {
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  ts: 'text/typescript',
  json: 'application/json',
  md: 'text/markdown',
  html: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  sql: 'application/sql',
};

export function mimeTypeOf(extension: string): string {
  return MIME_TYPES[extension] ?? 'text/plain';
}
