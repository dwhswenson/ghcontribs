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

Repository and owner areas use square-root contribution weighting by default.
Package consumers can choose built-in weighting independently at each level:

```ts
const visualization = mountContributionEcosystem(element, {
  dataUrl: '/contributions/index.json',
  ownerContributionWeighting: 'log',
  repositoryContributionWeighting: 'sqrt',
})

visualization.setOwnerContributionWeighting('asinh')
visualization.setRepositoryContributionWeighting('linear')
```

The built-in choices are `linear`, `sqrt`, `log`, and `asinh`. A custom
function can be supplied instead; it receives a filtered contribution count
and must return a finite, non-negative weight:

```ts
visualization.setRepositoryContributionWeighting(
  (count) => Math.cbrt(count),
)
```
