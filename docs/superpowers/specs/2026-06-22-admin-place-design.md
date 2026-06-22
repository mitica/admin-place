# admin-place — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Purpose

`admin-place` is a repository that stores and exposes structured administrative
geography data in a simple, fast-to-read format. It holds a three-level
hierarchy — **country → region → locality** — as committed JSON files, plus the
TypeScript tooling that generates and validates those files.

The data files are the product: they are committed to git and directly
accessible via GitHub raw URLs. The owner periodically runs the generator,
reviews the diff, and commits the updated data.

There is **no published npm package** at this stage. The repo is a single,
private (unpublished) Node.js project. Adding a published package on top of this
later is straightforward and intentionally deferred (YAGNI).

## Scope

**In scope**
- Canonical JSON data files for countries, regions, localities.
- A TypeScript generator that produces those files from a pluggable data source.
- A validator that checks committed data against schemas and referential integrity.
- A working sample source so the pipeline runs end-to-end out of the box.

**Out of scope (for now)**
- Publishing to npm or any other registry.
- Language-specific packages (Python, etc.).
- CSV / NDJSON output formats (JSON only).
- A real-world data source — the owner implements the `Source` interface later.

## Data model

The hierarchy maps to GIS administrative levels:

| Level | Entity | ID scheme | Example |
|-------|--------|-----------|---------|
| admin0 | Country | ISO 3166-1 alpha-2 | `"US"`, `"RO"` |
| admin1 | Region | ISO 3166-2 | `"US-CA"`, `"RO-B"` |
| admin2 | Locality | source / generated | provider-specific |

Every entity starts as exactly:

```ts
{ id: string; name: string }
```

**Parent relationships are encoded by file path, not duplicated inside records.**
Every record in `regions/US.json` belongs to country `US`; every record in
`localities/US/US-CA.json` belongs to region `US-CA`. This keeps files minimal
and avoids redundant parent keys.

**Extensibility:** entity shapes are defined as Zod schemas (see below). Adding a
field (e.g. `iso3`, `lat`, `population`) means editing one schema; the inferred
TypeScript type, the generator's validation, and the validator all pick it up.

## Repository structure

```
admin-place/
├─ package.json            private: true, type: module, ESM, Node 22
├─ tsconfig.json
├─ .gitignore .npmrc .prettierrc README.md
├─ data/                   ← THE product: canonical JSON, GitHub-accessible
│  ├─ countries.json       [{ id, name }, …] sorted by id
│  ├─ regions/
│  │  └─ {CC}.json          e.g. regions/US.json
│  └─ localities/
│     └─ {CC}/
│        └─ {REGION}.json   e.g. localities/US/US-CA.json
└─ src/                    ← the generator (tooling)
   ├─ schemas/             Zod schemas + inferred TS types (source of truth)
   │  ├─ country.ts
   │  ├─ region.ts
   │  ├─ locality.ts
   │  └─ index.ts
   ├─ sources/
   │  ├─ source.ts         the Source interface (the seam to implement later)
   │  └─ sample.ts         a tiny built-in source for end-to-end runs
   ├─ writers/
   │  └─ json-writer.ts    deterministic sharded JSON writer
   ├─ paths.ts             central definition of data dir + file paths
   ├─ generate.ts          orchestrator: source → validate → write
   └─ validate.ts          validates committed data/ (schema + referential integrity)
```

## Components

### `src/schemas/` — single source of truth
- One Zod schema per entity: `CountrySchema`, `RegionSchema`, `LocalitySchema`,
  each `{ id: string (non-empty), name: string (non-empty) }` to start.
- TypeScript types are `z.infer`-ed from the schemas, never hand-written.
- `index.ts` re-exports schemas and types.

### `src/sources/` — the data seam
- `source.ts` defines:
  ```ts
  interface Source {
    countries(): Promise<Country[]>;
    regions(countryCode: string): Promise<Region[]>;
    localities(countryCode: string, regionCode: string): Promise<Locality[]>;
  }
  ```
- `sample.ts` implements `Source` with 2–3 hardcoded countries, a few regions
  each, and a few localities, so `generate` produces real files immediately.
- The owner adds real sources later (e.g. `sources/geonames.ts`) implementing the
  same interface.

### `src/writers/json-writer.ts` — deterministic output
- Writes the sharded layout: `countries.json`, `regions/{CC}.json`,
  `localities/{CC}/{REGION}.json`.
- **Deterministic** so periodic re-runs yield minimal, reviewable git diffs:
  - records sorted by `id`,
  - stable object key order,
  - 2-space indentation,
  - trailing newline.
- Creates parent directories as needed.

### `src/paths.ts`
- Single place that resolves the repo-root `data/` directory and computes file
  paths for each entity/shard. Both `generate.ts` and `validate.ts` import from
  here so layout lives in exactly one place.

### `src/generate.ts` — orchestrator
- Selects a `Source` (defaults to the sample source).
- For each country: fetch countries → validate → write `countries.json`.
- For each country: fetch its regions → validate → write `regions/{CC}.json`.
- For each region: fetch its localities → validate → write
  `localities/{CC}/{REGION}.json`.
- Validates every record against the Zod schemas before writing; aborts on
  invalid data.
- Run via `pnpm generate` (`tsx src/generate.ts`).

### `src/validate.ts` — CI gate
- Reads the committed `data/` tree and checks:
  - every file parses as JSON and matches its Zod schema,
  - records are sorted by `id` and ids are unique within a file,
  - **referential integrity**: every `regions/{CC}.json` has a matching country
    in `countries.json`; every `localities/{CC}/{REGION}.json` corresponds to a
    region present in `regions/{CC}.json`.
- Exits non-zero on any failure. Run via `pnpm validate`.

## Tooling & DX

- **Runtime:** Node 22, ESM, `"type": "module"`.
- **Language:** TypeScript, run directly with `tsx` (no build step needed for the tooling).
- **Tests:** `vitest`, with seed tests for the schemas, the JSON writer
  (determinism), and the validator.
- **Formatting:** `prettier`.
- **Package manager:** `pnpm`.
- **Scripts (package.json):**
  - `generate` — run the generator (`tsx src/generate.ts`)
  - `validate` — validate committed data (`tsx src/validate.ts`)
  - `test` — `vitest run`
  - `typecheck` — `tsc --noEmit`
  - `format` — `prettier --write`

## Workflow (owner)

1. Implement / update a `Source`.
2. `pnpm generate` → writes/updates files under `data/`.
3. `pnpm validate && pnpm test` → confirm integrity.
4. Review the git diff, commit, push. Files are now live on GitHub.

## Success criteria

- A fresh clone, after `pnpm install`, can run `pnpm generate` and produce a
  valid `data/` tree from the sample source.
- `pnpm validate` passes on the generated data and fails on deliberately
  corrupted data.
- Re-running `pnpm generate` with unchanged source input produces a byte-identical
  `data/` tree (no spurious diffs).
- Adding a field to an entity requires editing only its Zod schema.

## Open questions / future

- Real data source(s) — owner-implemented later.
- Optional CSV/NDJSON outputs — deferred.
- Publishing one or more packages (JS, Python, …) — deferred; the layout leaves
  room to add this without restructuring `data/`.
