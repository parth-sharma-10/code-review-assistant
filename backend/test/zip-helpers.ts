import { ZipFile } from 'yazl';

export interface ZipEntrySpec {
  name: string;
  content: string | Buffer;
  mode?: number;
}

/** Builds a well-formed ZIP in memory. */
export function makeZip(entries: ZipEntrySpec[]): Promise<Buffer> {
  const zip = new ZipFile();
  for (const e of entries) {
    zip.addBuffer(Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content), e.name, {
      mode: e.mode,
    });
  }
  zip.end();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.outputStream.on('data', (c: Buffer) => chunks.push(c));
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on('error', reject);
  });
}

/**
 * yazl refuses to write malicious names, so write a same-length placeholder and patch the bytes
 * (local header and central directory). CRCs cover content only, so the archive stays valid.
 */
export async function makeZipWithRawName(rawName: string, content = 'x') {
  const placeholder = 'X'.repeat(Buffer.byteLength(rawName));
  const buf = await makeZip([{ name: placeholder, content }]);
  const from = Buffer.from(placeholder);
  const to = Buffer.from(rawName);
  let at = buf.indexOf(from);
  while (at !== -1) {
    to.copy(buf, at);
    at = buf.indexOf(from, at + 1);
  }
  return buf;
}

/**
 * A zip bomb that lies: the central directory declares a tiny uncompressed size for an entry
 * that really inflates to `realBytes`. Size checks on declared values alone would be fooled.
 */
export async function makeLyingZipBomb(realBytes: number, declaredBytes = 100) {
  const buf = await makeZip([{ name: 'bomb.txt', content: Buffer.alloc(realBytes, 'a') }]);
  const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  buf.writeUInt32LE(declaredBytes, central + 24); // uncompressed size field
  const local = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  buf.writeUInt32LE(declaredBytes, local + 22);
  return buf;
}
