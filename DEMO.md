# Interactive tabletop demo

The homepage launches the real Tabletop Lab application after a click. Desktop
uses an embedded view with independently scrolling controls; small screens open
the full demo page. Expanding or compacting the embed preserves the current
simulation. **Close** ends that session. Homepage videos that were playing are
paused while the embedded demo is open and restored on close.
The presentation shows motion progress and the final result; numerical lift,
distance, contact, and tray-status readouts are hidden.

Targets are chosen from **Object to pick**; there is no language input or policy
selector. Visible branding is **HERO**. The three-step guide and additional tips
are in `index.html`. Homepage styling
and lifecycle code are scoped in `static/css/interactive-demo.css` and
`static/js/interactive-demo.js`. The app's HERO theme and read-only loading/size
messages are in `static/css/tabletop-theme.css` and
`static/js/tabletop-embed.js`. These files do not modify the controller, physics,
policy inputs, collision rules, or success criteria.

## Local preview

From this repository:

```sh
python3 -m http.server 8772 --bind 127.0.0.1
```

Open `http://127.0.0.1:8772/index.html#interactive-demo`. The full demo is at
`http://127.0.0.1:8772/demo/index.html`.

The multi-file demo needs an HTTP server; opening its HTML directly as a local
file cannot fetch its runtime assets. The simulation project's separately
packaged `Tabletop_Lab.html` remains the double-clickable offline option.

## Updating the simulator

Build, package, and verify the application in `ihumanoid_plus` first. Then run:

```sh
python3 tools/sync_tabletop_demo.py
```

An alternate delivery location can be supplied with `--delivery`. The script
copies the verified `static/` output into `demo/` and adds only the website
theme/script links to its entry HTML. It retains `THIRD_PARTY_NOTICES.txt` and
copies the original build provenance into `demo/BUILD.json`.
`demo/INTEGRATION.json` records every original deployed-file hash, the modified
entry hash, theme hashes, and the standalone artifact identity. Updating the
theme also requires rerunning this script to refresh the provenance.

The included release uses **HERO PIN4 NOLOREF model_44000** (internal policy
identifier `hero_plus`), with Replan and GA enabled. Dex3 is the default hand;
Inspire Hand is an experimental option. It contains no SONIC assets or policy
switching. Dex3's normal closure threshold is 15 mm, with a bounded stagnation
fallback up to 30 mm. The fitted shoulder/trunk planning shells allow 3 mm of
overlap. This package does not include the later 6 mm measured self-overlap
tolerance. Confirmed other-object obstruction can produce the English terminal
failure explanation.

The synchronized standalone artifact has SHA-256
`a0b42c0d30b013c20a27e2e59f9f7be5f1647b25be3150fb3b00f2070bdddab3`.
Its controller matches `ihumanoid_plus` commit `e3518bc`; `demo/BUILD.json`
records the packaged source hashes. Sync the packaged `static/` directory;
the simulator repository's current working tree may contain later experiments.

## Dex3 benchmark results

The merged recovery results retrieved on 2026-09-29 use **truth odometry**,
the same HERO 44K weights and randomized Workbench placements. These totals
combine the baseline G benchmark with targeted reruns of its 70 Side and
17 Top Down self-clearance stops. Already-landed baseline trials are counted
only once. They are not a fresh rerun of every trial with the delivered package.

| 3 mm package | Ever landed in tray | Completed return | Full grasp/place/return cycle |
| --- | ---: | ---: | ---: |
| Side, 1,200 trials | 800 (66.7%) | 1,043 (86.9%) | 610 (50.8%) |
| Top Down, 900 trials | 355 (39.4%) | 786 (87.3%) | 320 (35.6%) |

Ever landed means the released object physically landed at least partly in the
tray at some point; it does not require a verified grasp or completed return.
Full cycle additionally requires a verified grasp, a completed return, and
final stable tray support for at least 0.8 seconds with tray contact and no
hand contact.
The public demo uses **leg odometry**, so these truth-odometry figures do not
establish its success rate. Side and Top Down use different object sets and
should not be pooled as an overall rate. Two resumed Side records retain
landing evidence but have unavailable completion data; they count as landed
and not returned.

The separate 6 mm experiment also lands 800/1,200 Side and 355/900 Top Down,
with full-cycle counts of 611 and 323. Those completion figures do not describe
this 3 mm package. Source: the simulator delivery's
`validation/shell_overlap_recovery_20260928/RECOVERY.md` and `VALIDATION.md`.

## Static hosting

Commit the homepage changes, theme files, preview image, and `demo/` directory
through the project's normal release process. GitHub Pages can serve the files
directly: no simulation server, CUDA, COOP, or COEP headers are required. All
robot inference and physics run in the visitor's browser. HERO loads only when
the demo starts.

Every deployed file is below GitHub's 100 MiB per-file limit. Keep the larger
single-file HTML and delivery ZIP out of the website repository. As with any
client-side demo, its JavaScript and downloaded policy assets are public.
