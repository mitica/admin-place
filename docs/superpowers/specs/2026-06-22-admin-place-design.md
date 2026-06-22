# admin-place — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Purpose

`admin-place` is a repository that stores and exposes structured administrative
geography data in a simple, fast-to-read format. It holds a **variable-depth**
administrative hierarchy modelled on GeoNames — country → ADM1 → ADM2 → … →
populated places (localities) — as committed JSON files, plus the TypeScript
tooling that generates and validates those files.

The data files are the product: they are committed to git and directly
accessible via GitHub raw URLs. The owner periodically runs the generator,
reviews the diff, and commits the updated data.

There is **no published npm package** at this stage. The repo is a single,
private (unpublished) Node.js project. Adding a published package on top of this
later is straightforward and intentionally deferred (YAGNI).

## Scope

**In scope**

- Canonical JSON data files for countries, admin divisions (any depth), localities.
- A TypeScript generator that produces those files from a pluggable data source.
- A validator that checks committed data against schemas and referential integrity.
- A working sample source so the pipeline runs end-to-end out of the box.

**Out of scope (for now)**

- Publishing to npm or any other registry.
- Language-specific packages (Python, etc.).
- CSV / NDJSON output formats (JSON only).
- A real-world data source — the owner implements the `Source` interface later.

## Data model

The hierarchy follows GeoNames and has **variable depth**: different countries
have different numbers of administrative levels.

| Entity        | What                       | ID scheme                      | Example                  |
| ------------- | -------------------------- | ------------------------------ | ------------------------ |
| Country       | nation (admin0)            | ISO 3166-1 alpha-2             | `"US"`, `"AD"`           |
| AdminDivision | any admin level ADM1..ADM5 | dot-concatenated GeoNames code | `"US.CA"`, `"US.CA.037"` |
| Locality      | populated place            | GeoNames geonameId (as string) | `"5368361"`              |

### Schemas (Zod = single source of truth)

```ts
Country       { id, name }
AdminDivision { id, name, level, parentId }   // level ∈ 1..5
Locality      { id, name, parentId }
```

- All ids are strings. Every record is validated against its Zod schema before
  it is written.
- `level` is the admin depth (1 = ADM1, …, 5 = ADM5). A country with only ADM1
  simply has no level-2 records/files.
- `parentId` makes the hierarchy explicit (path alone cannot express which ADM1
  an ADM2 belongs to):
  - An **ADM1** division's `parentId` is its **country id** (`"US"`).
  - A deeper division's `parentId` is its parent admin id (`"US.CA"`).
  - A **locality**'s `parentId` is its **deepest** parent admin division id, or
    the country id if it is attached directly to the country.

**Extensibility:** adding a field (e.g. `lat`, `population`, `iso2`) means
editing one Zod schema; the inferred TypeScript type, the generator's validation,
and the validator all pick it up.

## Repository structure

```
admin-place/
├─ package.json            private: true, type: module, ESM, Node 22
├─ tsconfig.json
├─ vitest.config.ts
├─ .gitignore .npmrc .prettierrc .prettierignore README.md
├─ data/                   ← THE product: canonical JSON, GitHub-accessible
│  ├─ countries.json       [{ id, name }, …] sorted by id
│  ├─ admin/
│  │  └─ {CC}/
│  │     ├─ 1.json          ADM1 divisions  [{ id, name, level, parentId }, …]
│  │     ├─ 2.json          ADM2 divisions
│  │     └─ …               up to 5.json
│  └─ localities/
│     └─ {CC}/
│        └─ {adm1Id}.json   populated places grouped by their ADM1 ancestor
└─ src/                    ← the generator (tooling)
   ├─ schemas/             Zod schemas + inferred TS types (source of truth)
   │  ├─ country.ts  admin.ts  locality.ts  index.ts
   ├─ sources/
   │  ├─ source.ts         the Source interface (the seam to implement later)
   │  └─ sample.ts         a tiny built-in source for end-to-end runs
   ├─ writers/
   │  └─ json-writer.ts    deterministic JSON writer
   ├─ paths.ts             central data-dir + file-path resolution
   ├─ hierarchy.ts         ADM1-ancestor resolution shared by generate + validate
   ├─ generate.ts          orchestrator: source → validate → write
   └─ validate.ts          validates committed data/ (schema + referential integrity)
```

### File layout rules

- **Countries:** a single `data/countries.json`.
- **Admin divisions:** sharded per country, per level — `data/admin/{CC}/{level}.json`.
- **Localities:** grouped by their **ADM1 ancestor** —
  `data/localities/{CC}/{adm1Id}.json` (e.g. `localities/US/US.CA.json`). The
  generator resolves the ancestor by walking `parentId` up the in-memory admin
  index. A locality attached directly to the country (no admin level) goes in
  `data/localities/{CC}/{CC}.json` (e.g. `localities/US/US.json`).
- Finer locality sharding (by ADM2) is easy to add later if a file gets too big;
  not done now (YAGNI).

## Components

### `src/schemas/` — single source of truth

- One Zod schema per entity; TypeScript types are `z.infer`-ed, never hand-written.
- Schemas reject unknown keys (strict), empty strings, and out-of-range levels.

### `src/sources/` — the data seam

- `source.ts` defines:
  ```ts
  interface Source {
    countries(): Promise<Country[]>;
    adminDivisions(countryCode: string): Promise<AdminDivision[]>; // all levels
    localities(countryCode: string): Promise<Locality[]>;
  }
  ```
- `sample.ts` implements `Source` with two countries: **US** (ADM1 states + ADM2
  counties + localities under ADM2) and **AD** (ADM1 parishes + localities under
  ADM1). This exercises variable depth end-to-end.
- The owner adds real sources later (e.g. `sources/geonames.ts`) implementing the
  same interface.

### `src/hierarchy.ts`

- `resolveAdm1AncestorId(record, index, countryId)`: walks `parentId` up to the
  level-1 ancestor, returning the ADM1 id used for locality sharding (or the
  country id when attached directly). Shared by the generator (to group) and the
  validator (to check filenames).

### `src/writers/json-writer.ts` — deterministic output

- Writes records to a file with **deterministic** bytes so periodic re-runs yield
  minimal, reviewable diffs: records sorted by `id` (codepoint order), object keys
  sorted recursively, 2-space indent, trailing newline. Creates parent dirs.

### `src/paths.ts`

- Single place that resolves the data directory (overridable via
  `ADMIN_PLACE_DATA_DIR`, used by tests) and computes every file path. Both
  `generate.ts` and `validate.ts` import from here so layout lives in one place.

### `src/generate.ts` — orchestrator

- Exposes `generate(source, options)` (testable) plus a thin CLI entry.
- Wipes the data directory for a clean, deterministic full regeneration (guarded:
  refuses to delete a path that is not the configured data dir).
- `countries()` → validate → write `countries.json`.
- Per country: `adminDivisions(cc)` → validate → write `admin/{CC}/{level}.json`
  per level; build an id→division index.
- Per country: `localities(cc)` → validate → resolve each one's ADM1 ancestor via
  the index → write the grouped `localities/{CC}/{adm1Id}.json` files.
- Aborts on any invalid record or unresolvable parent. Run via `pnpm generate`.

### `src/validate.ts` — CI gate

- Exposes `validateData(dataDir)` returning a list of problems, plus a CLI entry
  that prints them and exits non-zero on failure.
- Checks: every file parses and matches its Zod schema; ids unique and sorted per
  file; `level` matches the admin filename; **referential integrity** — each
  `parentId` resolves to a parent of the correct level in the same country, and
  every country referenced by an `admin/` or `localities/` directory exists in
  `countries.json`; each locality file's name equals the shared ADM1 ancestor of
  its records. Run via `pnpm validate`.

## Tooling & DX

- **Runtime:** Node 22, ESM, `"type": "module"`.
- **Language:** TypeScript, run directly with `tsx` (no build step).
- **Tests:** `vitest`, covering schemas, the writer's determinism, an end-to-end
  generate against a temp data dir, and validate (pass on good data, fail on
  corrupted data).
- **Formatting:** `prettier`; `data/` is excluded (the writer owns its format).
- **Package manager:** `pnpm`.
- **Scripts:** `generate`, `validate`, `test`, `typecheck`, `format`.

## Workflow (owner)

1. Implement / update a `Source`.
2. `pnpm generate` → writes/updates files under `data/`.
3. `pnpm validate && pnpm test` → confirm integrity.
4. Review the git diff, commit, push. Files are now live on GitHub.

## Success criteria

- A fresh clone, after `pnpm install`, can run `pnpm generate` and produce a
  valid `data/` tree from the sample source.
- `pnpm validate` passes on generated data and fails on deliberately corrupted data.
- Re-running `pnpm generate` with unchanged source input produces a byte-identical
  `data/` tree (no spurious diffs).
- Adding a field to an entity requires editing only its Zod schema.

## Open questions / future

- Real data source(s) — owner-implemented later.
- Optional CSV/NDJSON outputs — deferred.
- Finer locality sharding (by ADM2) — deferred until needed.
- Publishing one or more packages (JS, Python, …) — deferred; the layout leaves
  room to add this without restructuring `data/`.
