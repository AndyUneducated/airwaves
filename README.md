# Airwaves

Curated radio frequencies worth listening to, organised by region, built for an analog handheld — specifically the **Yaesu VX-6R**.

<p>
  <img alt="entries" src="https://img.shields.io/badge/entries-1%2C537-5ef2a8">
  <img alt="regions" src="https://img.shields.io/badge/regions-31-5ef2a8">
  <img alt="categories" src="https://img.shields.io/badge/categories-10-5ef2a8">
  <img alt="languages" src="https://img.shields.io/badge/languages-English%20%2B%20Chinese-5ef2a8">
</p>

<p>
  <img alt="runtime dependencies" src="https://img.shields.io/badge/runtime%20dependencies-0-success">
  <img alt="build step" src="https://img.shields.io/badge/build%20step-none-success">
  <img alt="framework" src="https://img.shields.io/badge/framework-none-success">
  <img alt="javascript" src="https://img.shields.io/badge/JavaScript-ES2017-f7df1e?logo=javascript&logoColor=black">
  <img alt="css" src="https://img.shields.io/badge/CSS-hand%20written-1572b6?logo=css3&logoColor=white">
  <img alt="payload" src="https://img.shields.io/badge/payload-103%20KB%20code%20%2B%20479%20KB%20data-blue">
</p>

<p>
  <img alt="offline" src="https://img.shields.io/badge/offline-service%20worker-orange">
  <img alt="pwa" src="https://img.shields.io/badge/PWA-installable-5a0fc8">
  <img alt="hosting" src="https://img.shields.io/badge/hosting-GitHub%20Pages-222?logo=github">
  <img alt="backend" src="https://img.shields.io/badge/backend-none-lightgrey">
  <img alt="a11y" src="https://img.shields.io/badge/a11y-keyboard%20%2B%20ARIA-green">
</p>

<p>
  <img alt="data: FCC" src="https://img.shields.io/badge/data-FCC%20licensing-informational">
  <img alt="data: ourairports" src="https://img.shields.io/badge/data-ourairports-informational">
  <img alt="data: NOAA SWPC" src="https://img.shields.io/badge/live-NOAA%20SWPC-informational">
  <img alt="data: NWS" src="https://img.shields.io/badge/live-NWS%20alerts-informational">
</p>

<p>
  <img alt="tooling" src="https://img.shields.io/badge/scripts-Node%2018%2B%20ESM-339933?logo=nodedotjs&logoColor=white">
  <img alt="tests" src="https://img.shields.io/badge/tests-Playwright-2ead33?logo=playwright&logoColor=white">
  <img alt="checks" src="https://img.shields.io/badge/checks-115%20assertions-2ead33">
</p>

The point is narrow: you arrive somewhere, you open the site, you find frequencies you can actually receive, and you program them. It works with no signal.

For how it is put together, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## What's covered

You pick a country once in the header; everything below it is a region of that country.

**United States** — twenty regions: a nationwide set plus SF Bay Area, San Jose & South Bay, Central Coast, Sierra Nevada, Los Angeles & Orange County, San Diego, Desert Southwest, Utah Canyon Country, Colorado Rockies, Texas Triangle, Chicago & Great Lakes, Boston & New England, New York Metro, Washington DC, Florida & Space Coast, Yellowstone & Tetons, Pacific Northwest, Alaska and Hawai‘i.

**China** — nine regions: a nationwide set covering the band plan and the 409 MHz walkie-talkie channels, plus Beijing & the capital region, Shanghai & the Yangtze Delta, Qingdao & the Shandong coast, Chengdu & Chongqing, the Greater Bay Area, the Western Plateau, the Northwest, and the Northeast. The divisions follow how radio actually behaves rather than provincial boundaries — the plateau and the northwest are grouped by terrain and road corridor because that is what determines what you can hear.

**Private Link** — recommended clean, quiet channels for talking to your own group. It is the last entry in each country's region strip, set apart by a divider because it is a channel set rather than a place, and the answer is genuinely different in each country.

Ten categories: private link, aviation, weather, amateur, parks and public lands, marine, rail and transit, broadcast, public safety, and oddities such as satellites, HF time signals and travellers' information stations.

## The VX-6R constraint

The VX-6R receives continuously from 0.5 to 999 MHz in AM, NFM and WFM, and transmits on 144–148, 222–225 and 430–450 MHz. It is an **analog** receiver, so it cannot decode P25, DMR, NXDN or China's PDT. Most large US police and fire departments have moved to digital trunked systems; so has Chinese public security. Both are permanently out of reach.

Rather than quietly omitting them, digital and encrypted systems are listed with a strikethrough and a "not receivable" note, so you know not to waste an evening hunting for them. New York is the notable exception — NYPD and FDNY have historically stayed on conventional analog UHF, which is why that region has the richest public-safety listening on the site.

Two consequences worth knowing before you travel:

- **1.25 m is the radio's hidden advantage in America.** Almost no other handheld transmits on 222–225 MHz, so the band is close to empty. That makes it the cleanest place to run a private group — provided everyone you talk to also has a 1.25 m radio.
- **The US channel set is illegal in China and vice versa.** China allocates 144–146 and 430–440 MHz to amateurs, so every American 2 m simplex channel above 146.000 and everything at 446 MHz falls outside the band. 1.25 m is not an amateur band in China at all. Build two memory banks, not one.

## Odds of hearing something

A frequency list answers *what is on this channel*. It does not answer the question you actually have standing outside with a handheld: *if I dial this in, will I hear anything?* Those are different. A NOAA weather transmitter is a continuous carrier covering a whole region. A 2 m simplex calling frequency is silent unless somebody happens to be calling. Both are correct entries and they are not remotely equivalent to a listener.

So every entry carries one indicator, drawn as three bars, folding together the three things that decide it: how far the signal reaches, how much of the time it transmits at all, and whether the frequency itself is in doubt.

| Bars | Meaning | Typical |
| --- | --- | --- |
| 3 — Always on | A carrier is there essentially all the time, over a wide area, on a frequency that is not in doubt. | NOAA weather radio, a broadcast station, an airport ATIS loop |
| 2 — Usually something | Busy but intermittent. Expect to wait minutes rather than hours. | A working tower, a port, a maintained repeater |
| 1 — Long shot | Quiet, short-range, occasional, or worth confirming locally. Worth programming, not worth sitting on. | Simplex calling channels, a quiet airstrip's CTAF, satellites |
| none | Digital or encrypted, so the radio cannot decode it at all. | P25 and PDT systems |

Confidence lives *inside* this rather than beside it, because a frequency we are unsure of cannot honestly be called a sure thing however powerful the transmitter would be. The provenance and the confidence note are still recorded, and Pro mode shows them in an entry's detail panel, where they explain the bars instead of competing with them.

| `conf` | Meaning |
| --- | --- |
| `std` | A national or international allocation. Will not change. |
| `high` | Long-established and rarely changes. |
| `check` | Believed correct but locally variable — confirm before relying on it. |

Levels are derived by documented rules in `scripts/make-odds.mjs` rather than stamped on 1,500 entries by hand, so they can be explained and re-derived when the rules improve. An explicit `oddsFix` on an entry overrides them.

Chinese entries lean much harder on `check` than American ones, and deliberately so — see [Where the data comes from](#where-the-data-comes-from). Where a specific number could not be established with confidence, the entry gives the sub-band to sweep instead of guessing, which is also how you would actually find it in the field. Amateur repeaters change tone and offset more often than anything else here, so each region links out to RepeaterBook or CRAC.

## Where the data comes from

| Provenance | Entries | Source | Licence |
| --- | --- | --- | --- |
| Written for this guide | 865 | Band plans, published allocations, and local knowledge. Everything with prose attached. | — |
| `src: "oa"` | 377 | [ourairports.com](https://ourairports.com) airport frequency database | Public domain |
| `src: "fcc"` | 295 | FCC Media Bureau FM and AM licensing queries | Public domain (US government) |

Imports exist because the hand-written entries cover the places worth writing prose about and miss the dozen other towered fields within an hour's drive — often the better listening, since a training field with six aircraft in the pattern is busier than an international airport and far easier to follow. That is a coverage gap, not an editorial choice, and public data already answers it. Inventing those frequencies would be unforgivable; importing them is free and checkable.

What keeps it a curated guide rather than a directory dump: each region takes a small quota, the imports only keep the positions a listener actually wants, and nothing may shadow a hand-written entry. Both importers are idempotent — they strip their own previous output before regenerating — and they refuse to write a file that does not parse.

**China is thinner, and this is why.** There is no FCC equivalent: no open, machine-readable register of Chinese broadcast licences. Wikidata, the only structured candidate, holds frequency claims for four Chinese stations in total. Chinese regions therefore grew only where international data covers them — Beijing Capital, Daxing and Tianjin all publish their air traffic positions upstream — and sit at 261 entries against 1,276 for the United States. The alternative was to invent numbers, which would make the whole reference worthless.

## Two modes

The site opens in **Simple** mode: a frequency, a name, a short description, and nothing else in the way. That is the mode the whole thing is designed around — standing outside, one hand, bright sun, no signal. A tap copies a frequency.

**Pro** mode is the switch in the header, or the `P` key. It layers instruments on top for someone who is actually holding the radio:

- **A detail panel on every entry.** Tap a row and it opens in place — in the list, not in a sheet, because you are usually comparing two or three entries and a modal that covers the list makes you close it to do that. It carries the sentence behind the odds bars; which filter to select and the channel spacing for that service; for a repeater, the frequency you transmit on and its tone, which neither the radio nor any listing shows you; licensed power and licensee for a broadcaster; the transmitter's distance, bearing and site elevation; quarter and half wave antenna lengths; the CHIRP memory name; and where the entry came from. Copying moves in here so the row itself can open.
- **Right now.** A short panel above the list, answering whether this is a good moment to listen. Whether it is dark and how long until that changes, computed on the device — below 30 MHz darkness decides what you can hear, which is why so many entries in the data say "at night". The planetary K index and solar flux, for the same reason. And in the United States, any active National Weather Service alert, with the local NOAA weather frequency next to it; tap the card and the list jumps to it.
- **How far away it is.** Once you have tapped "Near me", entries tied to a known transmitter site show the distance and compass bearing from you — the difference between "there is a tower frequency" and "that tower is 7.7 km northwest, so of course you can hear it". Only entries with a real site say anything: an approach sector covering half a state, or a dial position shared by three transmitters, has no single place, and an invented number would be worse than silence. The position is kept on your device for six hours so the distances are simply there next time.
- The spectrum rail becomes a **tuning knob**. Drag it and the frequency sweeps continuously; listed entries are detents you can feel and hear, band edges give a heavier click, and the receiver hiss drops away as you settle onto something — so you can find an entry without looking at the screen. Release to jump to it. Arrow keys, `Home` and `End` step entry by entry, and the speaker icon mutes the sound for good.
- Each band on the rail is labelled with how many entries it holds.

Nothing plays audio until you actually touch the rail. The choice of mode is remembered, and `?pro=1` and `?pro=0` force one, which makes a Pro view shareable.

### What Pro talks to, and what it does not

Everything except the three live readings is worked out on the device, so Pro degrades to something still useful with no signal: distances, bands, antenna lengths, the tuning knob and the sunrise clock all keep working, and the live cards fall back to the last reading they saw, labelled as such.

The three that need a network are fetched by the browser directly, because a site on GitHub Pages has no backend to do it for them:

| Reading | Source | Cached for |
| --- | --- | --- |
| Planetary K index | `services.swpc.noaa.gov` | 30 minutes |
| Solar flux | `services.swpc.noaa.gov` | 6 hours |
| Active weather alerts | `api.weather.gov` | 10 minutes |

The alert lookup is the only thing that sends a position anywhere. It goes out rounded to two decimal places, roughly a kilometre, which costs nothing because alerts are issued for whole counties — and if you have not shared a position, it uses the centre of the region you are reading instead, so nothing about you leaves at all. The K index and flux are the same numbers for everybody and carry no position. Every request has a timeout, fails quietly, and is skipped entirely if you move to another region before it fires.

## Features

- **Bilingual** — English and Chinese, toggled in the header, remembered between visits.
- **Country as a setting** — a compact control in the header switches between the United States and China. It is chosen once and remembered, which leaves the chip strip below as the only place picker rather than two strips that look alike.
- **Spectrum ruler** — a log-scale rail above the list shows where the visible entries sit across 0.5–999 MHz, split into HF, VHF and UHF. Tap it to jump to the nearest entry; the ticks also show at a glance how busy each band is.
- **Near me** — browser geolocation picks the closest region across both countries and switches country automatically.
- **CHIRP export** — download a region as a CHIRP-compatible CSV and program the radio in one shot. Digital entries, "avoid" entries and anything outside 0.5–999 MHz are filtered out automatically, and the tuning step is set to 5 or 12.5 kHz per channel as appropriate.
- **Offline** — a service worker precaches every region on first load, so the site works in airplane mode. Installable as a PWA.
- **Tap to copy** — in Simple mode any row copies its frequency, with a flash and a short vibration to confirm it without you having to read the screen. In Pro mode the copy button lives in the entry's detail panel.
- Keyboard: `/` focuses search, `Esc` clears it or closes the country menu, `P` switches mode.
- URLs are shareable: `#/us/bay-area`, `#/cn/shanghai`, `#/us/link-us`. A bare `#/bay-area` still resolves, and `?pro=1` opens in Pro mode.

## Development

No build step and no runtime dependencies. It is static HTML, one CSS file, one JS file, and JSON. Any static server will do:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

The tests and the data importers are the only things that need packages, and they are dev dependencies — nothing in `devDependencies` reaches the published site:

```sh
npm install
npx playwright install chromium
```

A service worker requires `http://localhost` or HTTPS — opening `index.html` from the filesystem will work but without offline caching.

One gotcha when developing: because the service worker is cache-first, reusing a port that another project's service worker has claimed will serve you that project instead. Pick a port you have not used elsewhere, or unregister the old worker.

The build and test scripts are ES modules and need **Node 18 or newer** for global `fetch`.

### Adding a region

1. Add an entry to `data/regions.json` with an `id`, a `scope` (the country, `us` or `cn`), bilingual names, and a `lat`/`lon` centroid for the "near me" search. Add `"kind": "link"` for a private-link page, which moves it past a divider at the end of the strip. A region with a null `lat` is skipped by "near me".
2. Create `data/r/<id>.json` with an `intro`, `introz` and a `stations` array.
3. Run `node scripts/make-odds.mjs` to score the new entries.
4. Bump `V` in `sw.js` so clients pick up the change. The region file list is derived from `regions.json` at install time, so there is nothing to add by hand.

Station files are written by hand, one station per line, with frequencies keeping their trailing zeros as `122.900`. The scripts edit those lines in place rather than re-serialising the file, because `JSON.stringify` throws all of that away and turns a one-field change into a ten-thousand-line diff.

### Station fields

| Field | Meaning |
| --- | --- |
| `f` | Frequency in MHz. Use `0` for an entry that exists only to say "you cannot receive this". |
| `n` / `z` | Name in English / Chinese. |
| `c` | Category id from `regions.json`. |
| `m` | Mode: `AM`, `FM`, `NFM`, `WFM`, or `P25` / `PDT` / `Encrypted` for unreceivable entries. Amateur FM uses wide deviation, so `FM` rather than `NFM`. |
| `t` | CTCSS tone in Hz, or a DCS code. |
| `o` | Repeater offset, e.g. `−0.600`. |
| `dig` | `true` marks it as digital or encrypted, and excludes it from CSV export. |
| `avoid` | `true` marks a real frequency you should not work on — a calling channel, data segment or reserved band. Kept visible for monitoring, excluded from CSV export. |
| `conf` | `std`, `high` or `check`. |
| `odds` | `3`, `2` or `1`. Generated — do not edit by hand; use `oddsFix` to override. |
| `oddsFix` | Pins `odds` where local knowledge beats the rules. |
| `a` | Sub-heading that groups nearby rows. An imported entry reuses the exact wording an existing entry already uses for the same airport, or one field ends up under two headers. |
| `ref` | ICAO code of the airport this entry transmits from, e.g. `KSFO`. It is what lets Pro mode give a distance and bearing, so add it wherever an entry really does come from one field. |
| `kw` | Licensed power in kilowatts. Broadcast only; feeds the odds rules, since a sub-kilowatt campus station never stops transmitting but only covers a few kilometres. |
| `by` | Licence holder. |
| `tag` | Memory name used by the CHIRP export. |
| `src` | Provenance for generated entries: `oa` or `fcc`. Its absence means hand-written. Importers use it to find and replace their own previous output, so do not add it by hand. |
| `d` / `dz` | Description in English / Chinese. |

A region file may also carry `intro` / `introz`, shown above the list as the region's opening paragraph.

### Generated data

All of these are build-time steps, committed to the repo, because the site is static and must work offline. None of them run in the browser.

| Command | What it does |
| --- | --- |
| `node scripts/make-odds.mjs` | Scores every entry's `odds`. Run it after any data change. `--dry` reports without writing. |
| `node scripts/make-places.mjs` | Rebuilds `data/places.json`, the coordinates and elevation of every airport referenced by `ref`. |
| `node scripts/import-air.mjs` | Adds airport frequencies from ourairports. `--dry` to preview. |
| `node scripts/import-bcast.mjs` | Adds US broadcast stations from the FCC. `--dry` to preview. |
| `node scripts/make-icons.mjs` | Regenerates the PNG icons from a hand-written rasteriser, so there is nothing to install. |

### Tests

The suite drives a real browser with Playwright and checks behaviour rather than markup — that the hiss is audible across a sweep, that a region's entries all render, that offline still works, that the page does not jump on load. It serves the project itself on a port the OS picks, so there is nothing to start first.

```sh
npm test                           # everything
node .probe/suite.mjs detail odds  # named groups only
node .probe/suite.mjs shots        # write screenshots to .probe/
npm run live                       # smoke-test the published site
```

Two habits are worth keeping, because both caught bugs that reading the code did not. Measure where the user is, not where it is convenient: the layout-shift checks read zero on localhost and 0.15 over the real network, because data that arrives before the first paint hides the problem entirely. And measure the physical thing rather than the markup — the tuning hiss was 26 dB too quiet while every DOM assertion passed.

## Legal

**United States.** Receiving is legal in most states, though a few restrict scanner use in a moving vehicle. Transmitting needs an FCC licence, and you must stay inside its privileges. Note that the VX-6R is certified for the amateur service only, so transmitting on FRS, GMRS or MURS with it is not permitted even though it can tune those frequencies.

**China.** Receiving is not generally restricted, but forwarding or publishing the content of other people's communications can be an offence. Transmitting requires a Chinese amateur radio operator certificate and station licence — a foreign licence is not automatically valid — and every transmitter used in the country needs SRRC type approval, which a US-market VX-6R does not have. The licence-free public walkie-talkie band at 409.7500–409.9875 MHz is open to anyone with type-approved equipment, but sits outside the VX-6R's transmit range, so treat the radio as a receiver in China. Hong Kong and Macau are separate jurisdictions with their own licensing.

**Everywhere.** Stay off public safety, aviation and marine channels except in a genuine emergency.
