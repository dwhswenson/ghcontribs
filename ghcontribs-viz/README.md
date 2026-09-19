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

## Interaction

Hovering or focusing an owner or repository shows its filtered contribution
summary. Use Tab to move between visible items, Enter or Space to focus an
owner or open repository details. Activating a repository focuses its owner;
Escape or “Back to overview” closes details and returns to the overview. The detail panel follows the active contribution
type and month filters and caches successful loads.

Consumers can also control semantic owner focus without moving DOM focus:

```ts
visualization.focusOwner('ExampleOrg')
visualization.focusOwner(null)
visualization.selectRepository('ExampleOrg/example')
visualization.selectRepository(null)
```

Unknown owner and repository names are ignored.

## Filtering

The toolbar’s Filters button opens contribution-type checkboxes and a compact
dual-ended month track. In containers at least 48rem wide, the controls use a
right sidebar that also holds repository details, with filters above details.
In narrower containers, filters expand below the toolbar and details remain
below the visualization. The open state survives container-size changes.

The two month thumbs remain separately labeled native range inputs for keyboard
and assistive-technology use. All four types and the complete source month range
are selected initially. “All months” resets only the date range, and an empty
contribution-type selection is valid. The Filters button indicates when the
closed panel contains a non-default filter. Escape closes filters before it
performs the existing details or owner-focus action.

The public controller stays synchronized with those controls:

```ts
visualization.setContributionTypes(['pull_requests', 'reviews'])
visualization.setMonthRange({ from: '2024-01', through: '2025-12' })
```

These calls may be made before the index finishes loading. Filtering uses the
already-loaded index and cached repository details; it does not trigger new data
requests. Repository and owner positions animate to their newly weighted
geometry, but the current partition algorithm may move an item to a different
neighborhood when weights change substantially.

## Browser snapshots

Visual baselines are platform-specific because browser font metrics differ
between macOS development machines and the Linux CI runner. Refresh snapshots
with:

```bash
npm run test:browser:update
```

On macOS this updates the Darwin baselines locally. It always uses the matching
Playwright Docker image to update the Linux baselines used by CI, so Docker must
be running. The image version is read from `package-lock.json`, keeping baseline
generation and the installed Playwright version synchronized. Use
`npm run test:browser:update:current` only when intentionally updating the
current platform without refreshing the Linux CI baselines.
