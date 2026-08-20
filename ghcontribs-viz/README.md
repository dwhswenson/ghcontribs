# ghcontribs visualization

This package contains the framework-independent GitHub contribution
visualization and its standalone development demo.

Run the demo against the repository's generated `dist-data` directory:

```bash
npm install
npm run dev
```

Set `GHCONTRIBS_VIZ_DATA_DIR` to serve a different organizer output directory.
For a separately hosted index, set `VITE_GHCONTRIBS_DATA_URL` to its URL. If no
local data directory exists, the application still builds and displays its
normal load-error state at runtime.
