# Architecture

This describes the shape of the project rather than its details. Anything written here should
still be true after a redesign of the interface or a rewrite of the rendering; the specifics
of any one function belong in the code, where they cannot drift out of date.

## The one constraint that explains everything

The site is hosted on GitHub Pages. There is **no backend, no build step, and no database**.
Every decision below follows from that.

```mermaid
graph LR
  A["No backend<br/>GitHub Pages"] --> B["Data is static JSON<br/>committed to the repo"]
  A --> C["Anything derived is<br/>computed in the browser"]
  A --> D["Anything expensive is<br/>precomputed by a script"]
  B --> E["Works offline<br/>service worker"]
  C --> E
  D --> B
```

If a feature needs a server, it cannot exist. If it needs a lookup table, the table is
generated ahead of time by a script and committed. If it needs arithmetic — distances,
sunrise, antenna lengths, wavelengths, repeater inputs — the browser does it, which means it
keeps working in airplane mode.

## Runtime layout

Five files do the work. There is no framework, no bundler and no runtime dependency.

| File | Responsibility |
| --- | --- |
| `index.html` | The shell: header, search, region strip, and the placeholders the app replaces. |
| `assets/app.js` | All behaviour, in one IIFE. Routing, rendering, state, i18n, audio, live data. |
| `assets/styles.css` | All styling, hand written, with the design tokens at the top. |
| `sw.js` | Cache-first service worker. `V` is the cache version and must be bumped on release. |
| `data/*.json` | The content. See [Data model](#data-model). |

### How a page gets drawn

```mermaid
sequenceDiagram
  participant U as User
  participant A as app.js
  participant SW as Service worker
  participant D as data/*.json

  U->>A: open #/us/bay-area?pro=1
  A->>A: restore language, mode, position from localStorage
  A->>SW: fetch data/regions.json
  SW->>D: cache first, network fallback
  D-->>A: scopes, regions, categories, legends
  A->>SW: fetch data/r/bay-area.json
  D-->>A: stations
  A->>A: replace placeholders with intro, right-now panel, rail, list
  A-->>U: interactive
```

### Why the placeholders are markup

The skeleton lives in `index.html`, not in `app.js`, and this is load bearing. People use
this outdoors, one handed, and a page that jumps as you reach for it is worse than a slow
one — so the first paint has to be the final shape.

A script cannot guarantee that. First paint happens when the browser draws the parsed HTML,
which on a cold load is *before* `app.js` executes; injected placeholders arrive after it and
the page drops by the height of everything above the list. On a fast warm load the script
wins the race and the bug hides, which is exactly why it survived: it only appeared on the
first visit, on desktop, and never on the phone the site was tested on.

Two consequences follow:

- **`index.html` owns the placeholder markup.** `app.js` leaves the first set alone and only
  builds skeletons for later region switches.
- **A small inline script in `<head>` settles mode and country before anything is drawn**,
  because those decide the shape — pro mode has the right-now panel, and China has one fewer
  live reading. CSS sizes the placeholders off the resulting attributes. This repeats a few
  lines that `app.js` owns, so a test asserts the two agree.

What cannot be reserved honestly is anything whose height depends on data not yet fetched.
The intro is prose from the region file and runs from 208 to 493 pixels across the regions
and both languages, so the placeholder holds the median for its width: the typical region
does not move at all and the outliers move about half as far. A per-region note is left
unreserved entirely, because holding space for it would leave a permanent gap on the regions
that do not carry one.

### Remembering the shape

The median is a poor guess in one case that turns out to be the common one. A URL with no
`#/region` in it restores the last region you read, and the right-now panel only exists for
a region with a centre — nationwide sets and the link pages have none. Reserving a panel that
never arrives dropped the list by half a screen, which measured 0.29 on the landing page.

So the shape is not guessed twice. `app.js` records what it actually drew, and the inline
script reserves it on the next load:

```mermaid
flowchart LR
  A[render a region] --> B[measure intro height<br/>and whether a panel appeared]
  B --> C[(localStorage<br/>aw.shape)]
  C --> D{next load:<br/>same region, mode, language?}
  D -- yes --> E[reserve that exact shape]
  D -- no --> F[fall back to the medians]
```

Only the last region is kept, because that is the one a bare URL will restore. The panel bit
is reused even when the width has changed, since whether a region has a centre does not
depend on the viewport; the intro height is not, since prose rewraps. With nothing remembered
at all, a landing page reserves the nationwide intro for its country — 225 px in the US
against 493 px in China on a phone — and no panel, because both countries open on a
nationwide set.

This is memory, not prediction, so it is self-correcting: a stale height costs one small
shift and is then right again.

Measure this over a throttled connection. On localhost the data arrives before the first
paint, every shift is attributed to the initial render and the number reads zero no matter
what the placeholders do — the phone pages that measured 0 locally measured 0.15 over the
real network.

## Data model

```mermaid
erDiagram
  REGIONS_JSON ||--o{ SCOPE : "declares"
  REGIONS_JSON ||--o{ CATEGORY : "declares"
  REGIONS_JSON ||--o{ REGION : "declares"
  REGIONS_JSON ||--|| ODDS_LEGEND : "declares"
  REGION ||--|| REGION_FILE : "data/r/<id>.json"
  REGION_FILE ||--o{ STATION : "contains"
  STATION }o--o| PLACE : "ref to places.json"
```

`data/regions.json` is the index: which countries exist, which regions belong to them, the
category list, and the legends for odds and confidence. Each region has its own file under
`data/r/`, holding an intro and a flat array of stations. `data/places.json` is a generated
lookup from ICAO code to coordinates, so an entry can say where its transmitter is without
carrying a copy of the airport database.

A station is deliberately flat — no nesting, no references except `ref`. It is edited by hand
far more often than it is read by a program, and a shape you can scan in a text editor is
worth more than a normalised one.

### A region is a point, not an area

`regions.json` gives each region a single `lat`/`lon`. Nothing in the system stores a
boundary, and that is not a simplification waiting to be fixed — it is the honest shape of
the data. Everything local is gathered by distance from that point:

| Radius | What it decides |
| --- | --- |
| 150 km | How far `import-air.mjs` reaches for airports |
| 120 km | How far `import-bcast.mjs` reaches for broadcast transmitters |
| 110 km | How far `import-wx.mjs` reaches for weather transmitters |
| nearest | Which region "near me" jumps to, and how the region strip is ordered |

So a region is only ever as large as that circle, whatever its name implies, and a name that
implies more is a bug rather than a rounding error. A region once called the Texas Triangle
sat in the empty middle of Dallas, Houston, San Antonio and Austin: 255 km from the first,
226 km from the last, and in possession of the frequencies of none of them. It is now
Houston, centred downtown, and Dallas is its own region.

Two consequences follow, and both are deliberate:

- **Regions may not tile a country.** There is no obligation to cover the gaps between them,
  and inventing a region to fill one would produce a page with nothing local on it.
- **Regions may overlap.** SF Bay Area and San Jose are 70 km apart and share airports. That
  is correct: someone in Palo Alto can hear both, and which page they open should not change
  what they are told is on the air.

### Provenance

Entries come from four places, and an entry knows which.

| `src` | Origin | Written by |
| --- | --- | --- |
| absent | Hand written, usually with prose | A person |
| `oa` | ourairports airport frequency database | `scripts/import-air.mjs` |
| `fcc` | FCC FM and AM licensing queries | `scripts/import-bcast.mjs` |
| `nwr` | NOAA Weather Radio county coverage list | `scripts/import-wx.mjs` |

This field is what makes the importers safe to re-run. Each one strips the lines carrying its
own marker before regenerating, so it is idempotent and a rule change replaces its output
instead of stacking a second copy on top. It also means a hand-written entry can never be
destroyed by a generator, which is the failure that would matter.

## Build-time scripts

```mermaid
graph TD
  OA["ourairports.com<br/>airports + frequencies CSV"] --> IA[import-air.mjs]
  FCC["FCC fmq / amq<br/>licensing queries"] --> IB[import-bcast.mjs]
  CCL["NWS county coverage list<br/>NWR transmitters"] --> IW[import-wx.mjs]
  IA --> R["data/r/*.json"]
  IB --> R
  IW --> R
  R --> MO[make-odds.mjs]
  MO --> R
  R --> MP[make-places.mjs]
  OA --> MP
  MP --> P["data/places.json"]
  NE["Natural Earth 10m<br/>coast + admin-1"] --> IG[import-geo.mjs]
  P --> IG
  IG --> G["data/geo/*.json"]
```

The order matters: importers first, then `make-odds.mjs` to score whatever is now there, then
`make-places.mjs` if any new `ref` appeared, then `import-geo.mjs`, which frames each region's
outline around the sites `make-places.mjs` just resolved. All of them write into the repo and
none of them run in the browser.

Every generator holds to the same three rules, learned the hard way:

1. **Edit lines, do not re-serialise.** The data files are hand formatted. Round-tripping them
   through `JSON.stringify` loses the trailing zeros on frequencies and the blank lines that
   group categories, and turns a one-field change into an unreviewable diff.
2. **Refuse to write something broken.** After splicing text into JSON, parse it back and check
   the station count is what was intended. Fail loudly rather than commit a corrupt file.
3. **Be idempotent.** Find and replace your own previous output.

## Curation, and why the importers are deliberately small

Upstream has 30,000 airport frequencies and 9,000 licensed US broadcast stations. Importing
freely would bury the site: aviation alone reaches 56% of all entries at a natural setting.
So each importer is capped, and the caps are the feature.

| Rule | Why |
| --- | --- |
| A transmitter belongs to the region it is **nearest** | Ranking by significance inside a radius gave the Central Coast San Jose and San Francisco, 130 and 170 km away and already covered where they belong, while Monterey lost its slot |
| A handful of sites per region, a handful of positions per site | What you want from an unfamiliar airport is the weather loop, the tower, the ground. Not all eleven positions |
| One frequency per position per site | Beijing Capital publishes three tower frequencies by runway; that produced three identical rows |
| Broadcast quotas split public / commercial / AM | Sorting purely by power yields twelve commercial giants and no news, college or community radio |
| Never shadow an existing entry | Matched on frequency, on callsign, and on the site-and-position pair, so prose and local knowledge always win |
| Standard numbers listed once | 121.900 is ground control at half the fields in a metro area; repeating it stacks ticks on one spot of the spectrum rail |

## Odds

The one derived quantity in the data, and the only one with an opinion in it. It answers
"if I tune here, will I hear anything?" by folding three inputs into three levels.

```mermaid
graph TD
  S[Station] --> Dig{"Decodable?"}
  Dig -->|"digital or encrypted"| N["no value<br/>a bar would be a lie"]
  Dig -->|yes| C{"Continuous carrier?<br/>weather radio, ATIS,<br/>a licensed broadcaster"}
  C -->|yes| P{"Wide coverage?"}
  P -->|yes| T3["3 — always on"]
  P -->|"sub-kilowatt"| T2
  C -->|no| B{"Worked position?<br/>tower, port, VTS,<br/>maintained repeater"}
  B -->|yes| T2["2 — usually something"]
  B -->|no| T1["1 — long shot"]
  V["Given as a range<br/>to sweep"] --> T1
```

Two properties are worth preserving through any rewrite. First, confidence is an *input* to
the odds rather than a second badge beside them, because a frequency nobody is sure of cannot
honestly be a sure thing. Second, the rules live in one script, not in the data, so they can
be explained, argued with and re-run; `oddsFix` exists for the cases where a rule is wrong
about one entry, and using it should stay rare enough to be noticeable.

## Modes

Simple and Pro are not a feature flag. They answer different questions, and a control belongs
to whichever question it serves.

| | Simple | Pro |
| --- | --- | --- |
| Tapping a row | Copies the frequency | Opens the detail panel; copy moves inside it |
| Under each entry | Nothing | Distance, bearing, amateur band — only when there is something to say |
| Odds indicator | Bars | Bars and the word |
| Spectrum rail | Tap to jump | A tuning knob: continuous sweep, detents, hiss, clicks |
| Above the list | Intro | Intro and the right-now panel |
| Network | None | Three live readings, each cached, each optional |

Pro is chosen deliberately: it is remembered, and `?pro=1` or `?pro=0` forces it so a view can
be shared. Simple remains the design centre — outdoors, one hand, bright sun, no signal.

## Satellites

The constraint that shapes this feature is the same one as everywhere else: there is no
server. Pass predictions cannot be computed anywhere but on the phone, which rules out
calling a prediction API and means carrying an orbit propagator in the page.

```mermaid
flowchart TB
  A["GitHub Action, daily<br/>scripts/import-tle.mjs"] --> B["Celestrak<br/>group files"]
  B --> C["data/sat.json<br/>tle fields only"]
  C --> D["assets/sgp4.js<br/>runs on the phone"]
  E["hand-curated<br/>frequencies and notes"] --> C
  F["your position"] --> D
  D --> G["horizon crossings<br/>peak, azimuth, Doppler"]
  G --> H["Overhead panel"]
```

### Where the live panels sit

Right now, Overhead and Line of sight all answer the same question - what can I receive from
this spot, at this moment - so they are one section rather than three. The section is two
rows of cards: the readings on the first, Overhead and Line of sight on the second, each of
those carrying its own one-line answer and opening a full panel below when tapped.

Each row is its own grid and divides the full width between whatever it holds, because the
count varies — China has no weather alert reading, and a region with no plotted sites has no
map. One row of five left the two panel cards a fifth of the width each, too narrow for their
own labels; splitting the rows gives them half each and costs nothing on a phone, where
everything stacks anyway.

They used to be separate top-level sections under it, which cost twice. Both added a page
gutter on top of the one `#content` already applies, so they stood 15px narrower than every
other block; and neither had any margin against the panel above, so Overhead began on the
exact pixel Right now ended and read as though it had been pushed underneath it. Folding them
in removes both faults by construction: the section owns the gutter once, and the cards are
laid out by the same grid as their neighbours.

Closed by default matters for more than tidiness. Between them the two panels are roughly
780px tall, which is a screen and a half of a phone ahead of the frequency list, in answer to
a question the visit may not be asking. The two elements stay in the document when the panel
is hidden rather than being created on demand, so nothing else has to cope with them existing
only in pro mode.

### What is automated and what is not

The split is not arbitrary. Orbital elements are a fit to a short arc of tracking data: good
to about a kilometre for a day or two, and by a week out wrong enough to move a predicted pass
by minutes. That decays on its own and must be automated. Which satellites are worth tuning
does not decay, and cannot be automated, because the databases answer a different question.

| | Source | Refresh |
| --- | --- | --- |
| Orbital elements | Celestrak group files, by catalogue number for the rest | Daily, by Action |
| Frequencies, modes, tones | SatNOGS transmitter database, filtered by hand | Never; edited when something changes |
| Which satellites appear at all | Judgement, with the reasoning recorded in `data/sat.json` | Never |

SatNOGS tracks what a satellite has ever carried, not what is worth tuning. It lists 29
transmitters for the ISS, among them Soyuz suit channels and a Progress beacon from the
nineties, and it marks satellites alive whose missions have ended. Its frequencies also cannot
be taken on trust: it gives NOAA 19 as 137.932 MHz where the APT downlink was 137.100.

The instructive exclusion is the NOAA APT trio. NOAA 18, 19 and 15 were decommissioned in June
and August 2025 and APT is now transmitted by nothing, but Celestrak still publishes their
elements — so a tracker built on orbits alone will confidently predict passes for three silent
satellites. Orbital data says where something is, never whether it is transmitting. The suite
asserts those three catalogue numbers stay out, because they are exactly what a well-meaning
later change would add back.

### Scope of the propagator

`assets/sgp4.js` implements the near-Earth half of SGP4 against WGS-72 constants — WGS-72
because TLE mean elements are fitted with it, so feeding the model WGS-84 makes the answer
worse rather than more modern.

The deep-space half, SDP4, is absent. Anything needing it has a period of 225 minutes or more,
which means geosynchronous or Molniya, and nothing in that class is workable with a 5 W
handheld and a rubber duck. `init()` therefore reports such an element set as deep-space and
the caller drops it, rather than propagating it badly. Refusing is tested; so is the boundary.

### How it is known to be right

A wrong propagator does not look wrong. It returns a confident time and a confident bearing,
and the only way to discover the error is to be standing outside pointing at empty sky. So it
is not reviewed, it is measured, against two independent references:

| Check | Reference | Result |
| --- | --- | --- |
| Propagator arithmetic | Vallado's published `SGP4-VER.TLE` / `tcppver.out`, the fixtures every SGP4 implementation is validated against | 158 near-Earth state vectors agree to 7.3 × 10⁻⁹ km; all 24 deep-space cases correctly identified |
| The whole chain, including frame conversion | `wheretheiss.at`, a separate implementation using its own elements | ISS ground position agrees to 7.8 km, altitude to 0.5 km |

Seven microns is arithmetic precision, not physical accuracy — it says the terms are typed
correctly, nothing more. The 7.8 km is the meaningful number, and it is about one second of ISS
travel, which is clock and element skew rather than error. The fixtures are committed so the
check is hermetic and runs offline; `.probe/sgp4-fetch.mjs` records where they came from.

One fixture is worth knowing about. Catalogue number 28872 has a perigee 51 km below the
surface and is mid-re-entry. The reference propagates it for 50 minutes and only then fails, so
`init()` deliberately does not reject sub-surface perigees — matching that behaviour is what
lets the vectors be used unmodified. Whether an object has decayed is a question about the
data, and `scripts/import-tle.mjs` answers it there.

### Finding a pass

Elevation is sampled forward in one-minute steps, which must be shorter than the shortest
pass or a pass can be stepped straight over; the fastest of these satellites is above the
horizon for roughly eight minutes. A sign change brackets the horizon crossing, which is then
bisected. Peak elevation is found by ternary search, valid because elevation over a single
pass is unimodal.

Rotating TEME by Greenwich sidereal time alone gives PEF and skips polar motion. That is worth
tens of metres — far below what a hand-held compass can be pointed to, and below the error in
the elements themselves.

A constellation sharing one downlink is collapsed to its best pass: with the nine Tevel-2
satellites strung around one orbit, what matters is whether anything is up there, not which.

The panel does not appear until you share a position. Falling back to the region centre was
rejected: it would produce times that look authoritative and are wrong by however far away you
happen to be, and a confidently wrong timetable is worse than none.

## Line of sight

The map answers one question — which transmitter sites are geometrically in reach of a
handheld, and which are behind the curve of the Earth — using only coordinates already in
`data/places.json`. No tiles, no map library, no network.

### What the rings mean

```
site elevation from places.json
        │
        ├── + 10 m nominal mast
        │
        ▼
  4.12 · √h  ──┐
               ├── sum = how far the two can see each other
  4.12 · √2  ──┘
        ▲
        │
your height, a handheld held up
```

The coefficient 4.12 carries the standard 4/3 refraction factor: radio bends with the
atmosphere and so reaches about 15% further than the purely geometric 3.57 would give. The
suite checks it against the closed form it approximates — a tangent from height *h* to a
sphere of radius 4/3 R, or √(2kRh + h²) — and they agree to 0.06% up to 4 km.

Two honesty constraints shape the panel. Field elevation is not antenna height: `ourairports`
gives the ground, so the 10 m mast is an assumption and is stated as one. And this is the
horizon and nothing else — terrain is not modelled, which the panel says in as many words,
because the hill in front of you beats all of this arithmetic.

### Projection invariants

An equirectangular projection with longitude compressed by cos(latitude), which leaves two
properties the drawing depends on:

| Invariant | Why it matters | How it is held |
| --- | --- | --- |
| One kilometre is the same number of pixels in every direction | Otherwise the scale bar is true only horizontally and every horizon ring is a wrong ellipse | The panel's aspect is clamped for shape, and the *bounds* are then widened to match rather than the axes stretched. More empty margin is honest; misstated distance is not |
| One SVG unit is one CSS pixel | A fixed 1000-unit viewBox turned a 19 px label into 7 px on a phone | The width is measured at draw time and the map is redrawn when it changes |

Because the scale is isotropic, a horizon ring is a plain `<circle>`. That it stays one is the
cheapest possible regression test for the whole projection.

### Three views of one map

The strip under the map chooses what is drawn over the graticule. They answer different
questions and stacking them turns the picture into a thicket, so it is one at a time.

| View | Draws | Answers |
| --- | --- | --- |
| Reach | Lines to the sites inside your horizon | Which of these could I actually hear |
| Distance | Lines to every site, each labelled with how far | How far away is all of this |
| Land | Coastline and administrative borders under everything | Where am I, in ordinary terms |

Distance hangs its figure off the site's own code rather than writing it along the line.
Lines from one point to sites a few kilometres apart have their midpoints in almost the same
place, so labelled lines pile up exactly where the map is busiest. The codes already have
collision avoidance, so the figure inherits it.

### The outline, and why there was none for so long

The panel had no coastline for a long time, on the grounds that an invented one reads as
fact. That argument was against *inventing* a coastline, not against having one, and the
answer is survey data rather than a graticule and an apology.

It cannot come from a tile server: the site has no backend and is meant to work with no
signal. So `scripts/import-geo.mjs` cuts Natural Earth's 1:10m coastline and admin-1
boundary lines down to what each region's map can actually draw, and commits the result.

```mermaid
flowchart LR
  A["Natural Earth 10m<br/>coast + admin-1"] --> B["clip to the frame<br/>this region can draw"]
  B --> C["Douglas-Peucker<br/>at map resolution"]
  C --> D["round to 3 decimals"]
  D --> E["data/geo/{region}.json<br/>about 10 kB each"]
```

Clipping is what makes this possible at all. A world file is megabytes; a region's frame is a
few degrees across, and at 1:10m simplified to the resolution it is drawn at, each region is
about ten kilobytes. The whole set is 551 kB across fifty regions, and a visit fetches one
file of it.

They are **not** precached by the service worker. Precaching the set would put half a megabyte of
scenery into every install for a layer most visits never open. Instead the file is fetched
the first time the view is chosen and kept by the worker from then on; offline with nothing
cached, the map says so and draws what it always drew. That path asks the Cache API directly
rather than firing a request that can only fail, so a working offline session logs nothing.

### What is still deliberately absent

No satellite imagery, and no street map. Both are tile servers: they cannot be committed and
they cannot work offline, so adding them would mean a map that is blank in exactly the
conditions this site is built for.

Airport codes are placed by hand rather than left to the browser, which will happily stack
four of them into one smudge; the bay has airports a few kilometres apart. Each label tries
four positions around its dot, and one that would land on a label already placed, or run off
the panel, is dropped — its dot and tooltip remain. Sites in reach are offered a position
first, since they are the answer to the question the panel asks.

Like the pass list, the map waits for a position. Without one it could still draw the sites
and their horizons, but not the one thing it is for; and a panel this tall arriving on its own
after the data loads shoves the tuning rail and the whole list down the page.

## Skins

A skin is a token override and nothing else. Every colour in the stylesheet resolves through a
custom property on `:root`, so `html[data-skin="glare"]` restates those properties and no rule,
component or script needs to know that skins exist.

Three of the tokens are held as bare RGB triples — `--ac-g`, `--wn-g`, `--t-t`, `--t-o` — rather
than colours, because each is used at a dozen different alphas for borders and glows. A triple
is overridden once; a colour would have to be overridden at every alpha it appears in.

```mermaid
flowchart LR
  A["inline script in head<br/>reads aw.skin"] --> B["data-skin on html"]
  B --> C["token block in root"]
  C --> D["every rule, unchanged"]
  E["settings popover"] --> F["applySkin"]
  F --> B
  F --> G["theme-color meta<br/>so the notch matches"]
```

The skin is resolved in the inline head script alongside mode and scope, for the same reason:
it repaints every surface on the page, so deciding it after first paint would show a dark screen
to someone who chose the light one.

The risk this design carries is a hardcoded colour left behind in a rule, which then ignores the
skin. That is not hypothetical — the header kept `rgba(8, 9, 11, .82)` for its translucent
backdrop and stayed dark while the page around it went white. So the suite does not check the
tokens; it composites the real background of each surface through any translucent layers and
asserts that all of them sit on the light side in Sunlight and the dark side in the other two.

Contrast is measured the same way, per skin, over every node that draws its own text:

| Skin | Floor | Why that floor |
| --- | --- | --- |
| Sunlight | 4.5:1 | WCAG AA on every visible word. This is the entire purpose of the mode, so it is held to a standard rather than to a preference. Measures 4.92:1. |
| Panel, Battery | 2.9:1 | A regression floor, not a quality claim. The default theme uses muted greys for secondary labels at roughly 3.9:1 by choice; the floor exists so a token change cannot quietly make them worse. |

Nodes parked off-screen, such as the skip link, are excluded: they are never seen, so their
contrast is not a claim about the skin. Chips are excluded from the surface check for the
opposite reason — a selected chip is accent-filled and so inverts against the page in both
skins, which is the design.

The background under a word is resolved by hit-testing the paint stack at its centre, not by
walking up its ancestors. The two differ whenever something paints between a node and its
parent: the selected segment of the display picker sits on a sliding highlight that is a
sibling, so an ancestor walk reads it as dark text on the dark strip behind, when what is
actually on screen is light text on accent.

The picker itself is a three-segment strip rather than three rows, because the skin is one
choice with three positions, whereas keep-screen-on below it is genuinely on or off; the two
shapes now say which is which. The count of segments lives in `--n` and the selected index in
`--i`, both written from the same list the buttons are built from, so the highlight cannot come
to rest under a label that is not the checked one. The popover is rebuilt on every open for the
same class of reason: patching each indicator at each site that can change it is how the ticked
skin came to disagree with the applied one.

Keep-screen-on wraps the Screen Wake Lock API. The lock is dropped whenever the page is hidden,
so it is retaken on `visibilitychange`, and it is not requested at all on a background tab
because the request is rejected outright there. A refused lock leaves the switch off: showing it
on would promise a screen that then sleeps anyway, which is worse than not offering it. Both
paths are tested — the working one against a stubbed lock, since headless Chromium exposes the
API but refuses the request, and the refusing one against the real browser.

The brief also asked for an ambient light sensor to switch to Sunlight automatically. That is
not built. `AmbientLightSensor` is behind a flag in Chromium and absent everywhere else, so it
would be dead code in every browser that reaches this site.

## Offline

```mermaid
graph LR
  REQ[Request] --> SWC{"In cache?"}
  SWC -->|yes| HIT["Serve it"]
  SWC -->|no| NET["Network"]
  NET -->|ok| STORE["Serve and store"]
  NET -->|fails| FALL["Shell for navigations,<br/>error for the rest"]
  HIT --> REV["Revalidate in<br/>the background"]
```

Cache-first, because the content changes rarely and being usable with no signal is the point.
The region file list is derived from `regions.json` at install time, so adding a region needs
no change to `sw.js` beyond bumping `V`. Live readings cache separately in `localStorage` with
their own expiry, and show their last known value labelled as stale rather than vanishing.

The cost of cache-first is that clients keep the old version until `V` changes. **Bumping `V`
is part of releasing**, not an optimisation.

### Every fetch has a deadline

Being offline is the easy case. The worker answers from cache, `navigator.onLine` is false so
the external readings do not even try, and a request that does escape is rejected immediately.
The case that actually strands the interface is a connection that accepts a request and then
goes nowhere - a captive portal, or one bar of signal - where a plain `fetch()` never settles
and whatever placeholder is on screen stays there for as long as the tab is open.

So every request goes through one helper that aborts after a deadline, and each caller has an
answer ready for the rejection:

| Request | Deadline | What is shown instead |
| --- | --- | --- |
| `data/regions.json` | 10s | The page says the data could not be loaded |
| `data/r/{id}.json` | 10s | An empty region rather than a skeleton that never resolves |
| `data/places.json` | 10s | Distances are simply absent; nothing else changes |
| `data/sat.json` | 7s | The Overhead card says the orbits are unavailable and stops offering to open |
| NOAA space weather, NWS alerts | 7s | Last known reading marked stale, or "Needs a connection" |

A card with nothing behind it drops its chevron and its `role`, because a control that opens an
empty panel is worse than no control.

## Tests

`.probe/suite.mjs` drives a real browser through Playwright. It is grouped, and a group name
on the command line runs only that group. It serves the project itself on an OS-assigned
port, so a run needs nothing started first and two runs cannot collide.

The suite deliberately asserts *behaviour and physics* rather than markup, because markup is
what changes in a redesign:

| Group | What it holds the code to |
| --- | --- |
| `regions` | Every region in both modes renders, with no blank frequencies or empty headings |
| `detail` | The panel tells the truth per service — no airband channel steps on a medium-wave station |
| `odds` | A continuous loop reads three bars, a calling channel reads one, undecodable reads none |
| `hiss` | The tuning hiss is audible across a whole sweep, and detents leave air between them |
| `wheel` | Sweeping tunes continuously, does not select text, does not scroll the page |
| `now` | The live panel works online, falls back offline, and is honest about which |
| `geo` | Distances appear only where a real transmitter site is known |
| `perf` | The page does not jump on load — phone and desktop, landing and deep link, remembered mode and remembered shape, and over a throttled connection |
| `layout` | The header survives a 280 px screen in both languages |
| `skin` | Each skin repaints every surface, holds its contrast floor, and the wake lock is taken and released for real |
| `sgp4` | The propagator matches the official verification vectors, and refuses deep space rather than approximating it |
| `sky` | Passes are chronological, never below 10 degrees, never shown without a position - and the decommissioned NOAA birds stay out of the data |
| `map` | The horizon matches closed-form geometry, one scale holds in every direction, and no label overlaps another or runs off the panel |

Four of these exist because of bugs that measurement found and inspection did not: the hiss
was 26 dB down and silenced across the busiest part of the band; the right-now cards sized
themselves to their text and shoved the spectrum rail down the page after load; the whole page
dropped by a third of a screen on a cold desktop load; and the header kept a hardcoded colour
for its translucent backdrop, so it stayed dark while the page around it turned white. All four
looked fine to read, and each needed something to composite the actual pixels and compare them;
the layout one stayed invisible until the suite was made to measure a viewport and a URL it had
never tried. When changing the knob, the panel, a skin or the first paint, measure it —
and measure it somewhere other than where it already passes.

## What is not here, on purpose

- **No framework.** The whole interface is a list, a rail and a header. A framework would
  be more code than the application.
- **No bundler.** Two script tags, plus a dozen inline lines that must beat the first paint.
  The payload is 182 KB of code.
- **No map tiles.** A third-party tile server is a network dependency and a privacy leak on a
  site whose selling point is neither.
- **No analytics.** Nothing is sent anywhere except the three live readings, one of which
  carries a deliberately rounded position.
