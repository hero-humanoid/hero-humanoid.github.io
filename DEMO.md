# Interactive demo

Try [HERO in your browser](https://hero-humanoid.github.io/#interactive-demo) with desktop Chrome or Edge. Physics and policy inference run locally.

1. Click **Launch interactive demo**, or **Open in new tab**.
2. Choose a table and place objects in the top view.
3. Select an object, then click **Pick & place** to move it to the tray.

Use **Reset** to restore the layout. Dex3 is the default hand; Inspire Hand is experimental.

## Local preview

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/#interactive-demo> or the [full demo](demo/index.html). The demo needs an HTTP server to load its assets.

## Hosting

Serve this repository as a static website, including the `demo/` assets. GitHub Pages works without a simulation server or GPU.

See [third-party notices](demo/THIRD_PARTY_NOTICES.txt) for asset and runtime licenses.
