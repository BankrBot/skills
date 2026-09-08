// Bounded local file I/O. Errors never include file contents, paths or raw OS messages.
import fs from "node:fs";
import { dirname } from "node:path";

export class LocalFileError extends Error {
  constructor(code, bytes) {
    super(`local_file_${code}`);
    this.code = code;
    if (Number.isSafeInteger(bytes)) this.bytes = bytes;
  }
}
const fail = (code, bytes) => { throw new LocalFileError(code, bytes); };
const sameObject = (a, b) => a.dev === b.dev && a.ino === b.ino && a.mode === b.mode;
const sameSnapshot = (a, b) => sameObject(a, b) && a.size === b.size &&
  a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs && a.nlink === b.nlink;
// A POSIX mode check, matching the secret-response reader. It does not inspect
// extended ACLs or establish secrecy from another process running as this user.
const checkPrivateMode = (metadata, required) => {
  if (required && (metadata.mode & 0o077) !== 0) fail("permissions");
};
const flags = () => {
  // Without these primitives a replacement FIFO can block before fstat, or a
  // final-component symlink can redirect the read. No silent platform fallback.
  const c = fs.constants;
  if (!Number.isInteger(c.O_NOFOLLOW) || !c.O_NOFOLLOW ||
      !Number.isInteger(c.O_NONBLOCK) || !c.O_NONBLOCK) fail("unsupported");
  return c.O_NOFOLLOW | c.O_NONBLOCK;
};
function readBounded(fd, cap, ops) {
  const buffer = Buffer.alloc(cap + 1);
  let size = 0;
  while (size < buffer.length) {
    const n = ops.readSync(fd, buffer, size, buffer.length - size, size);
    if (!Number.isInteger(n) || n < 0 || n > buffer.length - size) fail("read");
    if (n === 0) break;
    size += n;
  }
  if (size > cap) fail("too_large", size);
  return buffer.subarray(0, size);
}

/** Test-only callers may inject syscall faults; production uses Node's fs. */
export function readFileCapped(path, cap, { requirePrivate = false, ops = fs } = {}) {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 1024 * 1024) fail("limit");
  let fd = null, failure, bytes;
  try {
    const before = ops.lstatSync(path);
    if (before.isSymbolicLink()) fail("symlink");
    if (!before.isFile()) fail("not_regular");
    checkPrivateMode(before, requirePrivate);
    if (before.size > cap) fail("too_large", before.size);
    fd = ops.openSync(path, fs.constants.O_RDONLY | flags());
    const opened = ops.fstatSync(fd);
    checkPrivateMode(opened, requirePrivate);
    if (!opened.isFile() || !sameSnapshot(before, opened)) fail("changed");
    bytes = readBounded(fd, cap, ops);
    const after = ops.fstatSync(fd), named = ops.lstatSync(path);
    checkPrivateMode(after, requirePrivate);
    checkPrivateMode(named, requirePrivate);
    if (bytes.length !== opened.size || !sameSnapshot(opened, after) ||
        !sameSnapshot(opened, named)) fail("changed");
  } catch (error) {
    failure = error instanceof LocalFileError ? error : new LocalFileError("read");
  } finally {
    if (fd !== null) {
      try { ops.closeSync(fd); } catch { failure ??= new LocalFileError("close"); }
    }
  }
  if (failure) throw failure;
  return bytes;
}

/**
 * Create once, verify through the opened descriptor, then sync file and parent.
 * Failed files are retained for explicit recovery: check-then-unlink cannot
 * safely remove only our inode when another process controls the directory.
 * Path checks detect observed movement; this is not an atomic directory lease.
 * Checked fsync is OS synchronization, not a universal power-loss guarantee
 * (macOS offers the stronger F_FULLFSYNC separately from Node's fsync API).
 */
export function writeNewVerifiedFile(path, bytes, { aliases = [], ops = fs } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 2 * 1024 * 1024) fail("limit");
  let fd = null, parentFd = null, failure;
  const checkPaths = (file, parent) => {
    if (!sameObject(parent, ops.lstatSync(dirname(path)))) fail("moved");
    if (!sameSnapshot(file, ops.lstatSync(path))) fail("moved");
    for (const alias of aliases) {
      if (!sameSnapshot(file, ops.statSync(alias))) fail("moved");
    }
  };
  try {
    const nofollow = flags();
    if (!Number.isInteger(fs.constants.O_DIRECTORY) || !fs.constants.O_DIRECTORY) fail("unsupported");
    parentFd = ops.openSync(dirname(path), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | nofollow);
    const parent = ops.fstatSync(parentFd);
    if (!parent.isDirectory()) fail("moved");
    try {
      fd = ops.openSync(path, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | nofollow, 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") fail("exists");
      throw error;
    }
    const created = ops.fstatSync(fd);
    if (!created.isFile() || created.nlink !== 1) fail("verify");
    let offset = 0;
    while (offset < bytes.length) {
      const n = ops.writeSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!Number.isInteger(n) || n <= 0 || n > bytes.length - offset) fail("write");
      offset += n;
    }
    try { ops.fchmodSync(fd, 0o600); } catch { fail("mode"); }
    const written = ops.fstatSync(fd);
    if (!written.isFile() || written.dev !== created.dev || written.ino !== created.ino ||
        written.nlink !== 1 || (written.mode & 0o7777) !== 0o600 || written.size !== bytes.length) fail("verify");
    if (!readBounded(fd, bytes.length || 1, ops).equals(bytes) ||
        !sameSnapshot(written, ops.fstatSync(fd))) fail("verify");
    checkPaths(written, parent);
    try { ops.fsyncSync(fd); ops.fsyncSync(parentFd); } catch { fail("sync"); }
    if (!sameSnapshot(written, ops.fstatSync(fd))) fail("verify");
    checkPaths(written, parent);
  } catch (error) {
    failure = error instanceof LocalFileError ? error : new LocalFileError("write");
  } finally {
    for (const handle of [fd, parentFd]) {
      if (handle !== null) {
        try { ops.closeSync(handle); } catch { failure ??= new LocalFileError("close"); }
      }
    }
  }
  if (failure) throw failure;
}
