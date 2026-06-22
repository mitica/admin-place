# admin-place

Structured administrative geography data — **country → admin division → locality**,
modelled on [GeoNames](https://www.geonames.org/) with **variable depth** (different
countries have different numbers of admin levels).

The data lives as plain JSON committed to this repo, so it can be consumed by
importing the files, fetching them from GitHub raw URLs, or cloning the repo. The
TypeScript tooling in [`src/`](src/) generates and validates that data from a
pluggable source.

> No npm package is published (yet). This repo is the data plus the tooling that
> builds it.

## Data

Everything published lives under [`data/`](data/).

| Entity         | File(s)                              | Shape                           |
| -------------- | ------------------------------------ | ------------------------------- |
| Country        | `data/countries.json`                | `{ id, name }`                  |
| Admin division | `data/admin/{CC}/{level}.json`       | `{ id, name, level, parentId }` |
| Locality       | `data/localities/{CC}/{adm1Id}.json` | `{ id, name, parentId }`        |

- **ids:** countries use ISO 3166-1 alpha-2 (`US`); admin divisions use
  dot-concatenated GeoNames codes (`US.CA`, `US.CA.037`); localities use the
  GeoNames `geonameId` (as a string).
- **`level`** is the admin depth (1 = ADM1 … 5 = ADM5). A country with only one
  admin level just has no `2.json`.
- **`parentId`** links each record to its parent: an ADM1 points at its country
  (`US`), deeper divisions point at their parent division (`US.CA`), and a
  locality points at its deepest parent division (or its country).
- Admin divisions are sharded per country **and per level**; localities are
  grouped by their **ADM1 ancestor** (a locality attached directly to a country
  lands in `data/localities/{CC}/{CC}.json`).

### Example

```jsonc
// data/countries.json
[{ "id": "US", "name": "United States" }]

// data/admin/US/1.json
[{ "id": "US.CA", "name": "California", "level": 1, "parentId": "US" }]

// data/admin/US/2.json
[{ "id": "US.CA.037", "name": "Los Angeles County", "level": 2, "parentId": "US.CA" }]

// data/localities/US/US.CA.json
[{ "id": "5368361", "name": "Los Angeles", "parentId": "US.CA.037" }]
```

Output is deterministic — records are sorted by `id` and keys are sorted, so
re-running the generator produces clean, minimal git diffs.

## Tooling

| Command          | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `pnpm generate`  | Build `data/` from the configured `Source` (defaults to the bundled sample). |
| `pnpm validate`  | Validate committed `data/` against the schemas and referential integrity.    |
| `pnpm test`      | Run the test suite.                                                          |
| `pnpm typecheck` | Type-check without emitting.                                                 |
| `pnpm format`    | Format the source with Prettier (`data/` is excluded).                       |

### Adding a real data source

Implement the [`Source`](src/sources/source.ts) interface and pass it to
`generate()`:

```ts
interface Source {
  countries(): Promise<Country[]>;
  adminDivisions(countryCode: string): Promise<AdminDivision[]>; // all levels
  localities(countryCode: string): Promise<Locality[]>;
}
```

See [`src/sources/sample.ts`](src/sources/sample.ts) for a worked example.

### Extending the schema

Entity shapes are Zod schemas in [`src/schemas/`](src/schemas/) — the single
source of truth. Add a field there (e.g. `lat`, `population`) and the TypeScript
types, generator validation, and validator all follow.

## Requirements

Node ≥ 22 and pnpm.

```sh
pnpm install
pnpm generate && pnpm validate && pnpm test
```
