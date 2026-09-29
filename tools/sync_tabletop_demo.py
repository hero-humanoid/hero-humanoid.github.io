"""Copy a verified Tabletop Lab static build into the project website.

Run from any directory. The optional --delivery points to the directory that
contains BUILD.json and the packager's static/ output. Simulation bundles and
assets are copied byte-for-byte; only the entry HTML gets website theme links.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil


SITE = Path(__file__).resolve().parents[1]
DEFAULT_DELIVERY = SITE.parent / "ihumanoid_plus/isaacsim/_local_data/interactive_client_delivery"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delivery", type=Path, default=DEFAULT_DELIVERY)
    args = parser.parse_args()
    delivery = args.delivery.resolve()
    source = delivery / "static"
    build = json.loads((delivery / "BUILD.json").read_text())
    source_files = sorted(p for p in source.rglob("*") if p.is_file())
    if not source_files or not (source / "index.html").is_file():
        raise SystemExit("Missing verified static build.")
    oversized = [str(p.relative_to(source)) for p in source_files if p.stat().st_size >= 100 * 1024**2]
    if oversized:
        raise SystemExit(f"Files exceed GitHub's per-file limit: {oversized}")
    destination = SITE / "demo"
    receipt = destination / "INTEGRATION.json"
    if destination.exists() and not receipt.is_file():
        raise SystemExit("Refusing to overwrite an unrecognized demo directory.")
    previous = json.loads(receipt.read_text()) if receipt.exists() else {}
    destination.mkdir(exist_ok=True)
    source_hashes = {}
    for path in source_files:
        relative = path.relative_to(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        source_hashes[relative.as_posix()] = digest(path)
    # Remove only obsolete files explicitly owned by a previous generated build.
    for name in previous.get("sourceFiles", {}):
        if name not in source_hashes:
            target = (destination / name).resolve()
            if target.is_relative_to(destination.resolve()) and target.is_file():
                target.unlink()
    index = destination / "index.html"
    html = index.read_text()
    html = html.replace("<title>Tabletop Lab · Interactive Grasping Demo</title>",
                        "<title>HERO · Interactive Tabletop Demo</title>")
    html = html.replace("</head>",
        '  <link rel="stylesheet" href="../static/css/tabletop-theme.css">\n'
        '  <script src="../static/js/tabletop-embed.js"></script>\n</head>')
    index.write_text(html)
    shutil.copy2(delivery / "BUILD.json", destination / "BUILD.json")
    receipt.write_text(json.dumps({
        "schema": "hero_homepage_tabletop_v1",
        "standalone": build["standalone"],
        "policyManifest": build["policyManifest"],
        "sourceFiles": source_hashes,
        "deployedIndexSha256": digest(index),
        "themeFiles": {name: digest(SITE / name) for name in [
            "static/css/tabletop-theme.css", "static/js/tabletop-embed.js"]},
        "note": "Only index.html differs from the verified static build. Theme and embedding do not change simulation code or assets.",
    }, indent=2) + "\n")
    print(f"Copied {len(source_files)} files to {destination}")
    print(f"HERO checkpoint: {build['policyManifest']['policies']['hero_plus'].get('checkpoint', 'see BUILD.json')}" if 'policies' in build['policyManifest'] else "Policy provenance: demo/BUILD.json")


if __name__ == "__main__":
    main()
