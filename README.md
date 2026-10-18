# Marble Skill Taxonomy

An open, structured taxonomy of **what children learn** across the primary/elementary years — decomposed into fine-grained "micro-topics", wired into a prerequisite graph, and aligned to national curriculum standards. Produced by [Marble](https://withmarble.com).

> **Version:** `v1` · **Topics:** 1,590 · **Prerequisite edges:** 3,221 · **Subjects:** 8

## See it

![The taxonomy as a rotating 3D graph: every dot a micro-topic, colored by subject, wired by prerequisites](media/curriculum-viz.gif)

Every dot is a micro-topic, colored by subject; height is age; each thread is a prerequisite ([full-quality video](media/curriculum-viz.mp4)). Explore it interactively at [withmarble.com/curriculum](https://withmarble.com/curriculum) — tap any concept to trace everything a learner must master before it.

Prefer to run it yourself? A bundled, offline-capable node-graph viewer of the same data lives in [`viewer/`](viewer/) — see [Node graph viewer](#node-graph-viewer).


## What this is

Most curriculum data is either a flat list of standards or locked inside a product. This dataset is a **connected graph of learning**:

- **1,590 micro-topics** — a single, teachable idea (e.g. *"Building sentences"*, *"Apparent brightness of stars"*), each with a plain-language description, mastery **evidence** criteria, a type (conceptual / procedural / representational / language / meta), a subject + domain, and an approximate age range.
- **3,221 prerequisite dependencies** — a directed acyclic graph: *"topic X depends on prerequisite Y"*, each edge tagged `hard`/`soft` and carrying a one-line **reason**.
- **Curriculum alignment** — each micro-topic links to the standards it was distilled from (NGSS, Common Core, the UK National Curriculum, and more).
- **Domain clusters** — 183 parent-friendly one-paragraph summaries per (subject, domain, age band).

### Subjects

| Subject | Topics |
|---|---:|
| Science | 547 |
| Mathematics | 503 |
| English | 286 |
| History | 90 |
| Personal & Social Development | 88 |
| Life Skills | 37 |
| Computing | 21 |
| Learning to Learn | 18 |

## Files

All data lives in [`data/`](data/) as UTF-8 JSON. See [`schema/`](schema/) for JSON Schemas and [`manifest.json`](data/manifest.json) for counts + SHA-256 checksums.

| File | What it holds |
|---|---|
| [`data/topics.json`](data/topics.json) | The micro-topics (graph **nodes**). |
| [`data/dependencies.json`](data/dependencies.json) | Prerequisite **edges** (`topicId` depends on `prerequisiteId`). |
| [`data/curriculum-standards.json`](data/curriculum-standards.json) | The source curriculum standards, grouped by curriculum. |
| [`data/clusters.json`](data/clusters.json) | Parent-friendly domain summaries. |
| [`data/manifest.json`](data/manifest.json) | Counts, per-subject breakdown, per-file checksums. |

### A topic

```json
{
  "id": "mt_N8CpN1EJrP",
  "type": "CONCEPTUAL",
  "subject": "English",
  "domain": "Grammar & Punctuation",
  "name": "Building sentences",
  "description": "Understand that words combine to make sentences — a sentence expresses a complete thought…",
  "ageRangeStart": 4,
  "ageRangeEnd": 6,
  "centrality": 0.257,
  "evidence": [
    "Distinguish between complete sentences and fragments",
    "Compose a complete sentence with a subject and verb"
  ],
  "assessmentPrompt": "If {{name}} says something like \"The dog\", can they tell you that's not a complete sentence…?",
  "standards": ["ccss-ela:L.K.1f", "uk-nc-2013:Eng.App2.Y1.Sent.1"]
}
```

- `id` — stable identifier (`mt_…`), referenced by dependencies and by neighbours.
- `standards` — keys into `curriculum-standards.json` (`"<curriculum-slug>:<code>"`).
- `assessmentPrompt` — a natural-language check for the idea. Contains a `{{name}}` placeholder (the child's name); substitute or strip before display.

### A dependency

```json
{ "topicId": "mt__00ZSLnB7p", "prerequisiteId": "mt_VBl1T1sFCM", "strength": "hard",
  "reason": "Must understand vibrations make sound before finding volume patterns" }
```

`topicId` **depends on** `prerequisiteId`. Reverse the edge to get "unlocks".

## Using it

Pure data — no runtime, no dependencies. Load the JSON and go.

```js
import topics from './data/topics.json' with { type: 'json' };
import deps from './data/dependencies.json' with { type: 'json' };

const byId = new Map(topics.topics.map(t => [t.id, t]));
const prereqs = deps.dependencies
  .filter(d => d.topicId === 'mt_N8CpN1EJrP')
  .map(d => byId.get(d.prerequisiteId).name);
```

Validate structure + referential integrity:

```bash
node scripts/validate.mjs
```

Or via npm:

```bash
npm run validate            # structural + referential-integrity check
npm run build:graph-data    # bundle data/*.json -> viewer/data.js
npm run serve:viewer        # serve the viewer at http://localhost:8123/
```

## Node graph viewer

An interactive prerequisite graph over all 1,590 topics lives in [`viewer/`](viewer/) — a self-contained static page (vanilla JS + Canvas 2D, zero runtime dependencies, also works when opened directly via `file://`):

```bash
node scripts/build-graph-data.mjs   # bundle data/*.json -> viewer/data.js
node scripts/serve-viewer.mjs       # serve at http://localhost:8123/
```

Then open <http://localhost:8123/>.

| File | What it holds |
|---|---|
| [`viewer/index.html`](viewer/index.html) | Page shell, layout and styles. |
| [`viewer/app.js`](viewer/app.js) | Graph engine: Barnes-Hut force layout, rendering, search, filters, bilingual panel. |
| [`viewer/data.js`](viewer/data.js) | **Generated** bundle of all data (nodes, edges, referenced standards, clusters). |
| [`scripts/build-graph-data.mjs`](scripts/build-graph-data.mjs) | Regenerates `viewer/data.js` from `data/`. |
| [`scripts/serve-viewer.mjs`](scripts/serve-viewer.mjs) | Tiny zero-dependency static server. |

> `viewer/data.js` is generated — edit `scripts/build-graph-data.mjs` and re-run it instead of hand-editing the bundle.

**What you can do**

- **Explore the graph** — nodes are topics (colored by subject, sized by centrality); edges are dependencies (solid = `hard`, dashed = `soft`). Pan, zoom, and watch the force layout settle.
- **Search** — match against name, domain, subject or description; Enter jumps to the first hit.
- **Filter** — toggle subjects and node types in the sidebar; the graph and edge counts update live.
- **Inspect any topic** — click a node for its description, mastery evidence, assessment prompt, prerequisites / unlocks (clickable to walk the chain), aligned standards and cluster summary. Selecting a node also highlights its full ancestor chain in the graph.
- **Bilingual panel** — subjects, types, all 54 domains and the 7 curricula ship with a built-in Chinese glossary; long-form text (title, description, evidence, assessment prompt, standards, cluster summary) is translated on demand and cached in `localStorage`. Toggle it in the header; with no network it silently falls back to English-only.
- **Layout controls** — reset view, age layering (height encodes age, mirroring the 3D visualisation above), soft-edge visibility, force layout on/off, and drag-to-pin individual nodes.

## License

This dataset is **multi-licensed** — read this before you use or redistribute it.

| Layer | License |
|---|---|
| **The database** — the collection, structure, IDs, topic↔topic and topic↔standard relationships | [**ODbL 1.0**](LICENSE) — free for research **and** commercial use, **attribution** required, **share-alike** (derivative *databases* must stay open under ODbL). |
| **The textual content Marble authored** — topic `description`/`name`/`evidence`/`assessmentPrompt`, dependency `reason`s, cluster `summary`s | [**CC BY-SA 4.0**](LICENSE-CONTENT) — same spirit: attribution + share-alike. |
| **`curriculum-standards.json`** — extracted from third-party frameworks | **Not** Marble's to relicense. Each source is under **its own upstream license** — see [**PROVENANCE.md**](PROVENANCE.md). |

**Why share-alike + still commercial-friendly:** ODbL distinguishes a *derivative database* (extend/modify the taxonomy → must stay open) from a *produced work* (use it inside a product, model, or app → stays yours). So you can build a commercial product on this without open-sourcing your product; you only owe back improvements to the *taxonomy itself*.

### Attribution

Any use must credit:

> Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) · https://withmarble.com · licensed under ODbL 1.0 (database) and CC BY-SA 4.0 (content).

Plus the upstream notices in [PROVENANCE.md](PROVENANCE.md) for any curriculum standards you use. See [CITATION.cff](CITATION.cff) for a formal citation.

## What's *not* here

Deliberately excluded from this release: semantic embeddings (derived, recomputable) and any per-child / user data (never published). See [CHANGELOG.md](CHANGELOG.md).
