import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { LocalFileError, readFileCapped, writeNewVerifiedFile } from "../scripts/lib/local-files.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(join(tmpdir(), "voidly-files-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, path: join(dir, "document.json") };
}
const errorCode = (code) => (error) => error instanceof LocalFileError && error.code === code && !error.message.includes("SECRET");

test("bounded reader returns only unchanged regular bytes and refuses oversize, symlink and malformed caps", (t) => {
  const { dir, path } = fixture(t);
  fs.writeFileSync(path, "abc");
  assert.equal(readFileCapped(path, 3).toString(), "abc");
  assert.throws(() => readFileCapped(path, 2), errorCode("too_large"));
  const link = join(dir, "link");
  fs.symlinkSync(path, link);
  assert.throws(() => readFileCapped(link, 3), errorCode("symlink"));
  assert.throws(() => readFileCapped(dir, 3), errorCode("not_regular"));
  assert.throws(() => readFileCapped(path, Infinity), errorCode("limit"));
});

test("replacement after lstat never reads another inode or follows a symlink", (t) => {
  const { dir, path } = fixture(t);
  const other = join(dir, "other");
  for (const replacement of ["file", "symlink"]) {
    fs.writeFileSync(path, "old"); fs.writeFileSync(other, "new");
    let reads = 0, closes = 0;
    const ops = { ...fs,
      openSync(p, flags) {
        fs.unlinkSync(path);
        if (replacement === "file") fs.renameSync(other, path); else fs.symlinkSync(other, path);
        return fs.openSync(p, flags);
      },
      readSync(...args) { reads++; return fs.readSync(...args); },
      closeSync(fd) { closes++; fs.closeSync(fd); },
    };
    assert.throws(() => readFileCapped(path, 16, { ops }), LocalFileError);
    assert.equal(reads, 0);
    assert.equal(closes, replacement === "file" ? 1 : 0);
    fs.unlinkSync(path);
  }
});

test("a no-writer FIFO substituted during open is refused without blocking", (t) => {
  const { dir, path } = fixture(t);
  fs.writeFileSync(path, "old");
  const fifo = join(dir, "fifo");
  const made = spawnSync("/usr/bin/mkfifo", [fifo]);
  assert.equal(made.status, 0);
  let closes = 0;
  const ops = { ...fs,
    openSync(p, flags) { fs.unlinkSync(path); fs.renameSync(fifo, path); return fs.openSync(p, flags); },
    closeSync(fd) { closes++; fs.closeSync(fd); },
  };
  assert.throws(() => readFileCapped(path, 16, { ops }), errorCode("changed"));
  assert.equal(closes, 1);
});

test("growth after fstat is refused at cap+1 actual bytes, not the former stat size", (t) => {
  const { path } = fixture(t);
  fs.writeFileSync(path, "{}");
  let total = 0, reads = 0;
  const ops = { ...fs, readSync(...args) {
    if (reads++ === 0) fs.writeFileSync(path, "x".repeat(100000));
    const n = fs.readSync(...args); total += n; return n;
  }};
  assert.throws(() => readFileCapped(path, 65536, { ops }), errorCode("too_large"));
  assert.equal(total, 65537);
});

test("same-size rewriting or replacing a path during the read refuses, never parses mixed bytes", (t) => {
  const { path } = fixture(t);
  for (const change of ["rewrite", "replace"]) {
    fs.writeFileSync(path, "old");
    let changed = false;
    const ops = { ...fs, readSync(...args) {
      const n = fs.readSync(...args);
      if (!changed) {
        changed = true;
        if (change === "replace") fs.unlinkSync(path);
        fs.writeFileSync(path, "new");
        fs.utimesSync(path, new Date(0), new Date(0));
      }
      return n;
    }};
    assert.throws(() => readFileCapped(path, 16, { ops }), errorCode("changed"));
  }
});

test("read errors and close uncertainty are bounded failures with descriptors closed", (t) => {
  const { path } = fixture(t); fs.writeFileSync(path, "{}");
  let closed = 0;
  assert.throws(() => readFileCapped(path, 16, { ops: { ...fs,
    readSync() { throw new Error("SECRET"); },
    closeSync(fd) { closed++; fs.closeSync(fd); },
  }}), errorCode("read"));
  assert.equal(closed, 1);
  assert.throws(() => readFileCapped(path, 16, { ops: { ...fs,
    closeSync(fd) { fs.closeSync(fd); throw new Error("SECRET"); },
  }}), errorCode("close"));
});

test("writer completes partial BYTE writes including Unicode, verifies 0600, syncs both handles and closes", (t) => {
  const { path } = fixture(t);
  const bytes = Buffer.from(JSON.stringify({ brief: "inert 🚀 résumé" }));
  let writes = 0, synced = 0, closed = 0;
  writeNewVerifiedFile(path, bytes, { aliases: [path], ops: { ...fs,
    writeSync(fd, b, offset, size, position) { writes++; return fs.writeSync(fd, b, offset, Math.min(size, 3), position); },
    fsyncSync(fd) { synced++; fs.fsyncSync(fd); },
    closeSync(fd) { closed++; fs.closeSync(fd); },
  }});
  assert.ok(writes > 1);
  assert.equal(synced, 2); assert.equal(closed, 2);
  assert.deepEqual(fs.readFileSync(path), bytes);
  assert.equal(fs.statSync(path).mode & 0o777, 0o600);
});

test("writer never overwrites existing files or final symlinks", (t) => {
  const { dir, path } = fixture(t);
  const original = Buffer.from("original"); fs.writeFileSync(path, original);
  assert.throws(() => writeNewVerifiedFile(path, Buffer.from("new")), errorCode("exists"));
  const link = join(dir, "link"); fs.symlinkSync(path, link);
  assert.throws(() => writeNewVerifiedFile(link, Buffer.from("new")), errorCode("exists"));
  assert.deepEqual(fs.readFileSync(path), original);
});

test("zero progress and write failures are refusals; partial outputs are retained without success", (t) => {
  const { dir } = fixture(t);
  for (const behavior of ["zero", "throw"]) {
    const path = join(dir, behavior);
    let closes = 0;
    assert.throws(() => writeNewVerifiedFile(path, Buffer.from("inert"), { ops: { ...fs,
      writeSync() { if (behavior === "zero") return 0; throw new Error("SECRET"); },
      closeSync(fd) { closes++; fs.closeSync(fd); },
    }}), errorCode("write"));
    assert.equal(closes, 2); assert.ok(fs.existsSync(path));
  }
});

test("every output refuses mode, readback, file-sync, parent-sync and close failures", (t) => {
  const { dir } = fixture(t);
  for (const behavior of ["mode", "verify", "sync-file", "sync-parent", "close"]) {
    const path = join(dir, behavior); let syncs = 0, closes = 0;
    const ops = { ...fs,
      fchmodSync(fd, mode) { if (behavior === "mode") throw new Error("SECRET"); fs.fchmodSync(fd, mode); },
      readSync(fd, b, offset, size, position) { const n = fs.readSync(fd, b, offset, size, position); if (behavior === "verify" && n) b[offset] ^= 1; return n; },
      fsyncSync(fd) { syncs++; if (behavior === (syncs === 1 ? "sync-file" : "sync-parent")) throw new Error("SECRET"); fs.fsyncSync(fd); },
      closeSync(fd) { closes++; fs.closeSync(fd); if (behavior === "close") throw new Error("SECRET"); },
    };
    assert.throws(() => writeNewVerifiedFile(path, Buffer.from("inert"), { ops }), errorCode(behavior.startsWith("sync-") ? "sync" : behavior));
    assert.equal(closes, 2);
  }
});

test("path or alias replacement after writing refuses without deleting the replacement", (t) => {
  const { dir, path } = fixture(t);
  const alias = join(dir, "alias"); fs.symlinkSync(path, alias);
  const moved = join(dir, "moved");
  const ops = { ...fs, fchmodSync(fd, mode) {
    fs.fchmodSync(fd, mode); fs.renameSync(path, moved); fs.writeFileSync(path, "replacement");
  }};
  assert.throws(() => writeNewVerifiedFile(path, Buffer.from("inert"), { aliases: [alias], ops }), errorCode("moved"));
  assert.equal(fs.readFileSync(path, "utf8"), "replacement");
  assert.equal(fs.readFileSync(moved, "utf8"), "inert");
});

test("file mutation during synchronization prevents successful return", (t) => {
  const { path } = fixture(t);
  let changed = false;
  const ops = { ...fs, fsyncSync(fd) { fs.fsyncSync(fd); if (!changed) { changed = true; fs.writeFileSync(path, "other"); } }};
  assert.throws(() => writeNewVerifiedFile(path, Buffer.from("inert"), { ops }), errorCode("verify"));
});
