# UriNamu project site

GitHub Pages publishes this branch from its root. The landing page is `index.html`. The layout demo in `demo/` is built from `demo-source/` and the app's tree renderer.

To rebuild the demo, check out this branch at `.setup/github-pages` inside a UriNamu app checkout at version 0.10.1 or later with its locked npm dependencies installed. Run this from the app checkout.

```sh
node node_modules/vite/bin/vite.js build --config .setup/github-pages/demo-source/vite.config.ts
```

When the build changes, update the iframe's `v` query in `index.html` so browsers load the new preview. Commit the landing page, demo source and generated `demo/` together.
