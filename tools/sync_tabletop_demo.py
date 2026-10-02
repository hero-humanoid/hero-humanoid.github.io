"""Copy a verified Tabletop Lab static build into the project website.

Run from any directory with --delivery pointing to the directory containing
BUILD.json and the packager's static/ output. Build records stay outside the
website. Runtime assets are preserved; native traces and scene patch history
are excluded, and the entry HTML gets the website theme links.

Designed by Runpei Dong.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil


SITE = Path(__file__).resolve().parents[1]
THEME_FILES = ("static/css/tabletop-theme.css", "static/js/tabletop-embed.js")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_public_asset(path):
    return path.name not in {"BUILD.json", "INTEGRATION.json", ".DS_Store"} and not path.name.endswith(".native_trace.json")


def copy_asset(path, target, relative):
    if relative.parts[0] == "sceneassets" and relative.suffix == ".json":
        data = json.loads(path.read_text())
        if isinstance(data, dict):
            history = {key for key in data if key.startswith("postExport") and key.endswith("Patch")}
            if relative.name == "manifest.json":
                history.update({"sourceSha256", "metadataPatches"} & data.keys())
            if history:
                for key in history:
                    del data[key]
                target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
                return
    shutil.copy2(path, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delivery", type=Path, required=True)
    parser.add_argument("--records-dir", type=Path,
                        default=Path.home() / ".local/state/hero-homepage-demo" / SITE.name,
                        help="Local build records directory; must be outside the website.")
    args = parser.parse_args()
    delivery = args.delivery.resolve()
    records = args.records_dir.expanduser().resolve()
    if records.is_relative_to(SITE.resolve()):
        parser.error("--records-dir must be outside the website directory.")
    source = delivery / "static"
    build = json.loads((delivery / "BUILD.json").read_text())
    source_files = sorted(p for p in source.rglob("*") if p.is_file() and is_public_asset(p))
    if not source_files or not (source / "index.html").is_file():
        raise SystemExit("Missing verified static build.")
    oversized = [str(p.relative_to(source)) for p in source_files if p.stat().st_size >= 100 * 1024**2]
    if oversized:
        raise SystemExit(f"Files exceed GitHub's per-file limit: {oversized}")
    destination = SITE / "demo"
    receipt = records / "INTEGRATION.json"
    legacy_receipt = destination / "INTEGRATION.json"
    has_legacy = legacy_receipt.is_file()
    if destination.exists() and not receipt.is_file() and not has_legacy:
        raise SystemExit("Refusing to overwrite an unrecognized demo directory.")
    previous = json.loads(receipt.read_text()) if receipt.exists() else {}
    legacy = json.loads(legacy_receipt.read_text()) if has_legacy else {}
    previous_files = {**legacy.get("sourceFiles", {}), **previous.get("sourceFiles", {})}
    records.mkdir(parents=True, exist_ok=True)
    if has_legacy:
        # Preserve the old public records before removing them from the website.
        archive = records / "legacy"
        archive.mkdir(exist_ok=True)
        for name in ("BUILD.json", "INTEGRATION.json"):
            old = destination / name
            if old.is_file():
                shutil.copy2(old, archive / name)
    destination.mkdir(exist_ok=True)
    source_hashes = {}
    for path in source_files:
        relative = path.relative_to(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        copy_asset(path, target, relative)
        source_hashes[relative.as_posix()] = digest(path)
    # Remove only obsolete files explicitly owned by a previous generated build.
    for name in previous_files:
        if name not in source_hashes:
            target = (destination / name).resolve()
            if target.is_relative_to(destination.resolve()) and target.is_file():
                target.unlink()
    index = destination / "index.html"
    html = index.read_text()
    html = html.replace("<title>Tabletop Lab · Interactive Grasping Demo</title>",
                        "<title>HERO · Interactive Tabletop Demo</title>")
    theme = ""
    if 'href="../static/css/tabletop-theme.css"' not in html:
        theme += '  <link rel="stylesheet" href="../static/css/tabletop-theme.css">\n'
    if 'src="../static/js/tabletop-embed.js"' not in html:
        theme += '  <script src="../static/js/tabletop-embed.js"></script>\n'
    html = html.replace("</head>", theme + "</head>")
    index.write_text(html)
    shutil.copy2(delivery / "BUILD.json", records / "BUILD.json")
    receipt.write_text(json.dumps({
        "schema": "hero_homepage_tabletop_v2",
        "standalone": build["standalone"],
        "policyManifest": build["policyManifest"],
        "sourceFiles": source_hashes,
        "deployedFiles": {name: digest(destination / name) for name in source_hashes},
        "deployedIndexSha256": digest(index),
        "themeFiles": {name: digest(SITE / name) for name in THEME_FILES},
        "note": "Native traces and scene patch history are excluded. Runtime models, policies and simulation parameters are preserved; index.html includes the website theme.",
    }, indent=2) + "\n")
    if has_legacy:
        if legacy_receipt.is_file():
            legacy_receipt.unlink()
        legacy_build = destination / "BUILD.json"
        if legacy_build.is_file():
            legacy_build.unlink()
    print(f"Copied {len(source_files)} files to {destination}")
    print(f"Build records: {records}")


if __name__ == "__main__":
    main()
