"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeZip = makeZip;
exports.makeZipWithRawName = makeZipWithRawName;
exports.makeLyingZipBomb = makeLyingZipBomb;
const yazl_1 = require("yazl");
function makeZip(entries) {
    const zip = new yazl_1.ZipFile();
    for (const e of entries) {
        zip.addBuffer(Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content), e.name, {
            mode: e.mode,
        });
    }
    zip.end();
    return new Promise((resolve, reject) => {
        const chunks = [];
        zip.outputStream.on('data', (c) => chunks.push(c));
        zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
        zip.outputStream.on('error', reject);
    });
}
async function makeZipWithRawName(rawName, content = 'x') {
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
async function makeLyingZipBomb(realBytes, declaredBytes = 100) {
    const buf = await makeZip([{ name: 'bomb.txt', content: Buffer.alloc(realBytes, 'a') }]);
    const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buf.writeUInt32LE(declaredBytes, central + 24);
    const local = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    buf.writeUInt32LE(declaredBytes, local + 22);
    return buf;
}
//# sourceMappingURL=zip-helpers.js.map