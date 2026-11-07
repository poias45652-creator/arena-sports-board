"""Pack regional basketball assets from the preview's public directory."""

import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile


LEAGUES = ("nbl", "kbl")
LIMIT = 400_000
DESTINATION = Path(__file__).resolve().parents[1] / "data" / "regional-basketball"
PACK_NAME = re.compile(r"(?:nbl|kbl|shared)-(?:data|details|profiles|players|assets)-\d+-[0-9a-f]{16}\.pack")


def sources(public):
    """Map the application's relative URLs to their original files."""
    entries = {"data/leagues.json": public / "leagues.json"}
    for path in (public / "data").rglob("*"):
        if not path.is_file():
            continue
        key = path.relative_to(public).as_posix()
        if key in {"data/nba-reference.json", "data/wnba-reference.json"}:
            continue
        if key in entries:
            raise ValueError(f"Duplicate key: {key}")
        entries[key] = path
    for league in LEAGUES:
        for path in (public / "players" / league).rglob("*"):
            if path.is_file():
                entries[path.relative_to(public).as_posix()] = path
        for path in (public / "assets").glob(f"{league}-*"):
            if path.is_file():
                entries[path.relative_to(public).as_posix()] = path
    # An incomplete preview export must not replace a previously complete pack.
    required = {"data/context.json", "data/pregame.json"}
    for league in LEAGUES:
        required.update(f"data/{league}-{name}.json" for name in (
            "boxes", "detail-index", "extra-players", "fallback", "index", "players", "team-games"
        ))
        required.add(f"data/rankings-{league}.json")
        for prefix in (f"data/details/{league}/", f"data/profiles/{league}/",
                       f"players/{league}/", f"assets/{league}-"):
            if not any(key.startswith(prefix) for key in entries):
                raise ValueError(f"Missing source files: {prefix}")
    if missing := required.difference(entries):
        raise ValueError(f"Missing source files: {sorted(missing)}")
    return entries


def original(key, path):
    raw = path.read_bytes()
    if key == "data/leagues.json":
        catalog = json.loads(raw)
        regional = {league.upper(): catalog[league.upper()] for league in LEAGUES}
        return json.dumps(regional, ensure_ascii=False, separators=(",", ":")).encode()
    return raw


def group(key):
    parts = key.split("/")
    if parts[0] == "assets":
        return parts[1].split("-")[0] + "-assets"
    if parts[0] == "players":
        return parts[1] + "-players"
    if len(parts) > 2 and parts[1] in ("profiles", "details"):
        return parts[2] + "-" + parts[1]
    league = next((code for code in LEAGUES if code in Path(key).stem.split("-")), "shared")
    return league + "-data"


def encode(key, path):
    raw = original(key, path)
    if not key.endswith(".json"):
        return raw
    json.loads(raw)
    out = io.BytesIO()
    with gzip.GzipFile(filename="", fileobj=out, mode="wb", mtime=0, compresslevel=9) as stream:
        stream.write(raw)
    return out.getvalue()


def write_pack(folder, label, number, body, spans, index):
    digest = hashlib.sha256(body).hexdigest()[:16]
    name = f"{label}-{number:03d}-{digest}.pack"
    (folder / name).write_bytes(body)
    for key, start, size in spans:
        index[key] = [name, start, size]


def build(folder, entries):
    groups = defaultdict(list)
    for key in sorted(entries):
        groups[group(key)].append(key)
    index = {}
    for label, keys in sorted(groups.items()):
        body, spans, number = bytearray(), [], 1
        for key in keys:
            record = encode(key, entries[key])
            if len(record) > LIMIT or not record:
                raise ValueError(f"Record cannot fit into a pack: {key} ({len(record)} bytes)")
            if len(body) + len(record) > LIMIT:
                write_pack(folder, label, number, body, spans, index)
                body, spans, number = bytearray(), [], number + 1
            spans.append((key, len(body), len(record)))
            body.extend(record)
        write_pack(folder, label, number, body, spans, index)
    (folder / "index.json").write_text(json.dumps(index, sort_keys=True, separators=(",", ":")) + "\n",
                                       encoding="utf-8")


def verify(folder, entries):
    index = json.loads((folder / "index.json").read_bytes())
    if set(index) != set(entries):
        raise ValueError(f"Source/index mismatch: {sorted(set(index) ^ set(entries))}")
    members = defaultdict(list)
    for key, (name, offset, size) in index.items():
        if not PACK_NAME.fullmatch(name) or not name.startswith(group(key) + "-"):
            raise ValueError(f"Invalid pack name for {key}: {name}")
        members[name].append((offset, size, key))
    sizes = {}
    for name, spans in members.items():
        body = (folder / name).read_bytes()
        sizes[name] = len(body)
        digest = hashlib.sha256(body).hexdigest()[:16]
        if len(body) > LIMIT or not name.endswith(f"-{digest}.pack"):
            raise ValueError(f"Invalid pack size or digest: {name}")
        cursor = 0
        for start, size, key in sorted(spans):
            if start != cursor or size <= 0 or start + size > len(body):
                raise ValueError(f"Invalid byte range for {key}")
            record = body[start:start + size]
            raw = gzip.decompress(record) if key.endswith(".json") else record
            if raw != original(key, entries[key]):
                raise ValueError(f"Packed bytes differ from the source: {key}")
            cursor += size
        if cursor != len(body):
            raise ValueError(f"Unindexed trailing bytes: {name}")
    return sizes


def publish(staged, destination):
    destination.mkdir(parents=True, exist_ok=True)
    # Content-addressed packs are installed before atomically replacing the index.
    for path in sorted(staged.glob("*.pack")):
        target = destination / path.name
        if target.exists():
            if target.read_bytes() != path.read_bytes():
                raise ValueError(f"Pack name collision: {target}")
        else:
            path.replace(target)
    (staged / "index.json").replace(destination / "index.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("public", type=Path, help="Path to the preview's public directory")
    parser.add_argument("--output", type=Path, default=DESTINATION)
    parser.add_argument("--verify-only", action="store_true", help="Verify an existing index and its packs")
    args = parser.parse_args()
    entries = sources(args.public)
    if not args.verify_only:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=args.output.parent) as stage:
            folder = Path(stage)
            build(folder, entries)
            verify(folder, entries)
            publish(folder, args.output)
    sizes = verify(args.output, entries)
    print(f"Verified {len(entries)} assets in {len(sizes)} packs, {sum(sizes.values()):,} bytes; "
          f"largest pack {max(sizes.values()):,} bytes.")
    for label, count in sorted(Counter(map(group, entries)).items()):
        print(f"{label}: {count}")


if __name__ == "__main__":
    main()
