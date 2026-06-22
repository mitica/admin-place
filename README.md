# admin-place

Structured administrative geography data — **country → admin division → locality**,
modelled on [GeoNames](https://www.geonames.org/) with **variable depth** (different
countries have different numbers of admin levels).

The data lives as plain JSON committed to this repo, so it can be consumed by importing
the files, fetching them from GitHub raw URLs, or cloning the repo. The TypeScript tooling
in [`src/`](src/) downloads GeoNames dumps and generates and validates that data.

> No npm package is published (yet). This repo is the data plus the tooling that builds it.

## Data

Everything published lives under [`data/`](data/).

| Entity         | File(s)                              | Always present                                                                |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| Country        | `data/countries.json`                | `id`, `name`                                                                  |
| Admin division | `data/admin/{CC}/{level}.json`       | `id`, `name`, `geonameId`, `featureClass`, `featureCode`, `level`, `parentId` |
| Locality       | `data/localities/{CC}/{adm1Id}.json` | `id`, `name`, `geonameId`, `featureClass`, `featureCode`, `parentId`          |

**Optional fields** (on admin divisions and localities): `population`, `lat`, `lng`
(populated from the GeoNames dump when available), and `wikidataId`, `names` (by language),
`wikipediaTitles` (by language) — these last three are part of the schema but are **not yet
populated** (they await a later enrichment phase). Countries also carry optional `geonameId`
and `population`.

- **ids:** countries use ISO 3166-1 alpha-2 (`US`); admin divisions use dot-concatenated
  GeoNames codes (`US.CA`, `US.CA.037`); localities use the GeoNames `geonameId` (a string).
- **`level`** is the admin depth (1 = ADM1 … 5 = ADM5). A country with only one admin level
  just has no `2.json`.
- **`parentId`** links each record to its parent: an ADM1 points at its country (`US`),
  deeper divisions at their parent division (`US.CA`), and a locality at its deepest existing
  parent division (or its country).
- Admin divisions are sharded per country **and per level**; localities are grouped by their
  **ADM1 ancestor** (a locality attached directly to a country lands in
  `data/localities/{CC}/{CC}.json`).
- Only populated places with **population > 0** are included as localities.

### Example

```jsonc
// data/countries.json
[{ "geonameId": "3041565", "id": "AD", "name": "Andorra", "population": 77006 }]

// data/admin/AD/1.json
[{ "featureClass": "A", "featureCode": "ADM1", "geonameId": "3041203",
   "id": "AD.02", "lat": 42.58333, "level": 1, "lng": 1.65833,
   "name": "Canillo", "parentId": "AD", "population": 5067 }]

// data/localities/AD/AD.07.json
[{ "featureClass": "P", "featureCode": "PPL", "geonameId": "3039181",
   "id": "3039181", "lat": 42.49454, "lng": 1.49897,
   "name": "Santa Coloma", "parentId": "AD.07", "population": 3236 }]
```

Output is deterministic — records are sorted by `id` and keys are sorted — so re-running the
generator produces clean, minimal git diffs.

## Tooling

| Command               | What it does                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm generate <CC>…` | Download those countries from GeoNames and (re)generate **only** their subtrees, upserting `countries.json`. E.g. `pnpm generate US RO`. |
| `pnpm generate`       | Full rebuild from the bundled sample source (no network) — handy for a smoke test.                                                       |
| `pnpm validate`       | Validate committed `data/` against the schemas and referential integrity.                                                                |
| `pnpm test`           | Run the test suite (no network — uses in-code fixtures).                                                                                 |
| `pnpm typecheck`      | Type-check without emitting.                                                                                                             |
| `pnpm format`         | Format the source with Prettier (`data/` is excluded).                                                                                   |

### Data source: GeoNames

`pnpm generate <CC>` uses [`GeoNamesSource`](src/sources/geonames/source.ts), which:

1. Downloads the per-country dump `https://download.geonames.org/export/dump/{CC}.zip` and
   `countryInfo.txt`, **cached** under `.cache/` with a 30-day TTL (override the location with
   `ADMIN_PLACE_CACHE_DIR`).
2. Parses the tab-separated geoname table, splitting it into admin divisions (feature class
   `A`, codes `ADM1`–`ADM5`) and populated places (class `P`, population > 0).
3. Attaches each place to the deepest admin division that actually exists (falling back to the
   country), then writes the deterministic JSON.

No external API calls are made; `wikidataId` / multilingual `names` / `wikipediaTitles` are
deferred to a future enrichment pass (they require the global `alternateNamesV2` dump).

### Adding another data source

Implement the [`Source`](src/sources/source.ts) interface and pass it to `generate()`:

```ts
interface Source {
  countries(): Promise<Country[]>;
  adminDivisions(countryCode: string): Promise<AdminDivision[]>; // all levels
  localities(countryCode: string): Promise<Locality[]>;
}
```

See [`src/sources/geonames/`](src/sources/geonames/) for the GeoNames implementation and
[`src/sources/sample.ts`](src/sources/sample.ts) for a minimal in-memory one.

### Extending the schema

Entity shapes are Zod schemas in [`src/schemas/`](src/schemas/) — the single source of truth.
The shared fields live in [`base.ts`](src/schemas/base.ts); add a field there (or to an
entity) and the TypeScript types, generator validation, and validator all follow.

## Requirements

Node ≥ 22 and pnpm.

```sh
pnpm install
pnpm generate AD          # generate a small country from GeoNames
pnpm validate && pnpm test
```
