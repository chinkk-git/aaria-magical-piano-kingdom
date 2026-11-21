#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--site", type=Path, default=Path("_site"))
ROOT = parser.parse_args().site
CHUNK = 4 * 1024 * 1024
files = []
OMR_PREFIXES = ("omr/", "models/", "lib/onnxruntime-web@1.30.0/")
OMR_FILES = {"omr-worker.js"}
for path in sorted(p for p in ROOT.rglob("*") if p.is_file() and p.name not in {"release2-install-manifest.json", ".nojekyll"}):
    relative = path.relative_to(ROOT).as_posix()
    if relative not in OMR_FILES and not relative.startswith(OMR_PREFIXES):
        continue
    chunks = []
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while block := stream.read(CHUNK):
            size += len(block)
            digest.update(block)
            chunks.append(hashlib.sha256(block).hexdigest())
    if size == 0:
        continue
    rel = "./" + path.relative_to(ROOT).as_posix()
    files.append({"path": rel, "bytes": size, "sha256": digest.hexdigest(), "chunkSize": CHUNK, "chunks": chunks})
manifest = {"schemaVersion": 1, "version": "r2-v1-" + hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()[:16],
            "totalBytes": sum(x["bytes"] for x in files), "files": files}
(ROOT / "release2-install-manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
print(f"Created verified installation manifest: {len(files)} files, {manifest['totalBytes']} bytes")
