import { makeLyingZipBomb, makeZip, makeZipWithRawName } from '../../test/zip-helpers';
import { classify, LIMITS, safeEntryPath } from './ingest-policy';
import { extractZip, ZipRejectedError } from './zip-extractor';

describe('safeEntryPath (Zip Slip guard, independent of yauzl)', () => {
  it.each([
    ['src/app.ts', 'src/app.ts'],
    ['./src/app.ts', 'src/app.ts'],
    ['src/../lib/x.ts', 'lib/x.ts'],
    ['src\\win\\file.ts', 'src/win/file.ts'],
  ])('normalises %s -> %s', (raw, expected) => {
    expect(safeEntryPath(raw)).toBe(expected);
  });

  it.each([
    '../etc/passwd',
    '../../../../tmp/pwned',
    'src/../../escape.ts',
    '..\\..\\windows\\system32',
    '/etc/cron.d/job',
    'C:/Windows/evil.dll',
    'c:\\evil.dll',
    'src/\u0000hidden.ts',
    'bad\nname.ts',
    '..',
    '',
  ])('rejects %j', (raw) => {
    expect(safeEntryPath(raw)).toBeNull();
  });
});

describe('classify', () => {
  it.each([
    ['node_modules/x/index.js', 'ignored-directory'],
    ['pkg/.git/config', 'ignored-directory'],
    ['app/__pycache__/m.pyc', 'ignored-directory'],
    ['.env', 'secret'],
    ['config/.env.production', 'secret'],
    ['deploy/id_rsa', 'secret'],
    ['certs/server.pem', 'secret'],
    ['.npmrc', 'secret'],
    ['img/logo.png', 'binary'],
  ])('%s -> %s', (path, reason) => {
    expect(classify(path, 10)).toBe(reason);
  });

  it('keeps env templates and ordinary source', () => {
    expect(classify('.env.example', 10)).toBeNull();
    expect(classify('src/environment.ts', 10)).toBeNull();
  });

  it('skips files over the per-file limit', () => {
    expect(classify('src/huge.ts', LIMITS.maxFileBytes + 1)).toBe('too-large');
  });
});

describe('extractZip', () => {
  it('stores source, skips unwanted entries with a reason, and strips a shared root folder', async () => {
    const zip = await makeZip([
      { name: 'repo-main/src/index.ts', content: 'export const x = 1;\n' },
      { name: 'repo-main/README.md', content: '# Repo' },
      { name: 'repo-main/.env', content: 'SECRET=1' },
      { name: 'repo-main/node_modules/a/index.js', content: '' },
      { name: 'repo-main/data.bin', content: Buffer.from([1, 0, 2]) },
      { name: 'repo-main/link', content: '/etc/passwd', mode: 0o120777 },
    ]);
    const { files, skipped } = await extractZip(zip);

    expect(files.map((f) => f.path).sort()).toEqual(['README.md', 'src/index.ts']);
    expect(files.find((f) => f.path === 'src/index.ts')).toMatchObject({
      name: 'index.ts',
      extension: 'ts',
      content: 'export const x = 1;\n',
    });
    expect(skipped).toEqual(
      expect.arrayContaining([
        { path: '.env', reason: 'secret' },
        { path: 'node_modules/a/index.js', reason: 'ignored-directory' },
        { path: 'data.bin', reason: 'binary' },
        { path: 'link', reason: 'symlink' },
      ]),
    );
  });

  it.each(['../../../../tmp/x.txt', '/etc/cron.d/xx', '..\\..\\evil.bat', 'C:/Windows/evil.dll'])(
    'rejects the whole archive for a traversal entry %j',
    async (raw) => {
      const zip = await makeZipWithRawName(raw);
      await expect(extractZip(zip)).rejects.toBeInstanceOf(ZipRejectedError);
    },
  );

  it('rejects a zip bomb whose header under-declares the real size', async () => {
    const bomb = await makeLyingZipBomb(5 * 1024 * 1024);
    await expect(extractZip(bomb)).rejects.toThrow(ZipRejectedError);
  });

  it('rejects archives that expand beyond the total size limit', async () => {
    const chunk = 'a'.repeat(LIMITS.maxFileBytes - 1);
    const count = Math.ceil(LIMITS.maxTotalBytes / chunk.length) + 1;
    const zip = await makeZip(
      Array.from({ length: count }, (_, i) => ({ name: `f${i}.txt`, content: chunk })),
    );
    await expect(extractZip(zip)).rejects.toThrow(/expands to more than/);
  });

  it('rejects archives with too many source files', async () => {
    const zip = await makeZip(
      Array.from({ length: LIMITS.maxStoredFiles + 1 }, (_, i) => ({
        name: `f${i}.ts`,
        content: 'x',
      })),
    );
    await expect(extractZip(zip)).rejects.toThrow(/more than 2000 source files/);
  });

  it('rejects data that is not a zip', async () => {
    await expect(extractZip(Buffer.from('PK\x03\x04 but not really'))).rejects.toBeInstanceOf(
      ZipRejectedError,
    );
  });

  it('treats invalid UTF-8 as binary', async () => {
    const zip = await makeZip([
      { name: 'latin1.txt', content: Buffer.from([0x63, 0x61, 0x66, 0xe9]) },
    ]);
    const { files, skipped } = await extractZip(zip);
    expect(files).toHaveLength(0);
    expect(skipped).toEqual([{ path: 'latin1.txt', reason: 'binary' }]);
  });
});
