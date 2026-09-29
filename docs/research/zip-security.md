# Decision: parse uploads in memory with yauzl, validate every path, bound every size

## Problem

The only way code enters the system is a user-supplied ZIP. Archives are a classic attack vector:

- **Zip Slip:** entry names such as `../../etc/cron.d/x` or `/abs/path` write outside the extraction
  directory.
- **Zip bombs:** small archives that inflate to huge sizes, sometimes with headers that under-declare
  the real size.
- **Symlink entries** pointing at sensitive host files.
- **Sheer volume:** hundreds of thousands of entries.
- **Secrets** the user did not mean to share (`.env`, keys), which the app would then display and send
  to an AI provider.

## Alternatives

| Option | Notes |
|---|---|
| Shell out to `unzip` | Executes a process on attacker input; path behaviour depends on the platform binary; hard to bound |
| `adm-zip` | Reads the whole archive eagerly; has had path-traversal advisories; no built-in size validation |
| `unzipper` (streaming) | Streams well, but relies on local headers, which can disagree with the central directory |
| **`yauzl`** | Reads the central directory; validates file names; `validateEntrySizes` on by default; lazy, one entry at a time |
| Extract to disk, then walk the tree | Needs temp-directory cleanup and a real destination to escape from |

## Evidence

- Snyk's Zip Slip research: the vulnerable pattern is an entry name "concatenated with the target
  directory … without being validated", and extraction code must perform "validation on the file paths
  in the archive". https://security.snyk.io/research/zip-slip-vulnerability
- yauzl README: `validateFileName` "returns … an error message" if the name "starts with "/" or
  /[A-Za-z]:\// or if it contains ".." path segments or "\\"". And "validateEntrySizes is the default
  and ensures that an entry's reported uncompressed size matches its actual uncompressed size."
  https://github.com/thejoshwolfe/yauzl
- yauzl 3.4 source (`node_modules/yauzl/index.js`, `validateFileName`) confirms the checks above run on
  every entry when `decodeStrings` is on (the default).

## Decision

1. **Nothing touches the disk.** Multer keeps the upload in memory (≤20 MB). yauzl reads from the
   buffer. Accepted entries become database rows. There is no destination directory to escape, and
   nothing is ever executed.
2. **The path check is still done,** because the guarantee should not depend on how rows are used
   later. `safeEntryPath` normalises backslashes; rejects absolute paths, drive letters, NUL and control
   characters; resolves the name against a virtual root with `path.posix.resolve`; and rejects anything
   that does not stay under it. yauzl's own validation runs first, so this is a second, independently
   unit-tested layer. An unsafe name rejects the **whole archive**, since it signals a crafted upload.
3. **Sizes are bounded before inflating,** using the declared sizes: 512 KB per file (larger files are
   skipped), 50 MB total (reject), 20,000 entries (reject), 2,000 stored files (reject). yauzl then
   aborts any stream that produces more bytes than declared, which defeats headers that lie. The test
   suite builds such a bomb by patching the size fields of a real archive.
4. **Content policy:**
   - Skip dependency and build directories (`node_modules`, `.git`, `dist`, `build`, `.next`,
     `__pycache__`, `venv`, `target`, ...).
   - Skip likely secret files (`.env*` except templates, key and certificate formats, `id_rsa*`,
     `.npmrc`, `.netrc`, `credentials.json`, `*.tfstate`, ...).
   - Skip binaries, by extension and by content: a NUL byte or invalid UTF-8, via
     `TextDecoder({ fatal: true })`.
   - Skip symlinks (Unix mode bits in the external attributes).
   - Every skip is reported back with its reason.
5. The archive is recognised by its **magic bytes**, not by the filename or `Content-Type`.

## Tradeoffs

- **Memory:** one upload can hold 20 MB compressed plus up to 512 KB per entry being inflated. That is
  fine for a single-instance assessment; a production system would stream to a scratch volume in a
  worker with per-user quotas.
- **Rejecting the whole archive** for one bad path is strict, but legitimate archives don't contain
  `..` entries.
- **The secret filter is name-based** and will miss secrets in ordinary-looking files. Content scanning
  (entropy or known key formats) would catch more, with false positives.
