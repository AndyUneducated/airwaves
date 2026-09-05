# Airwaves

Curated radio frequencies worth listening to, organised by region, built for an analog handheld — specifically the **Yaesu VX-6R**.

The point is narrow: you arrive somewhere, you open the site, you find frequencies you can actually receive, and you program them. It works with no signal.

## What's covered

Twelve regions plus a nationwide set: SF Bay Area, San Jose & South Bay, Central Coast, Sierra Nevada, Los Angeles & Orange County, San Diego, Desert Southwest, Yellowstone & Tetons, New York Metro, Washington DC, and the Pacific Northwest.

Nine categories per region: aviation, weather, amateur, parks and public lands, marine, rail and transit, broadcast, public safety, and oddities such as satellites, HF time signals and travellers' information stations.

## The VX-6R constraint

The VX-6R receives continuously from 0.5 to 999 MHz in AM, NFM and WFM. It is an **analog** receiver, so it cannot decode P25, DMR or NXDN. Most large US police and fire departments have moved to digital trunked systems, which means they are permanently out of reach.

Rather than quietly omitting them, digital and encrypted systems are listed with a strikethrough and a "not receivable" note, so you know not to waste an evening hunting for them. New York is the notable exception — NYPD and FDNY have historically stayed on conventional analog UHF, which is why that region has the richest public-safety listening on the site.

## Confidence tags

Every entry is tagged, because frequency data rots and pretending otherwise is worse than useless.

| Tag | Meaning |
| --- | --- |
| Standard | A national FCC or ITU allocation. Will not change. |
| Stable | Long-established and rarely changes. |
| Verify | Believed correct but locally variable — confirm before relying on it. |

Amateur repeaters change tone and offset more often than anything else here, so each region links out to RepeaterBook for the relevant counties.

## Features

- **Bilingual** — English and 中文, toggled in the header, remembered between visits.
- **Near me** — browser geolocation picks the closest region.
- **CHIRP export** — download a region as a CHIRP-compatible CSV and program the radio in one shot. Digital entries and anything outside 0.5–999 MHz are filtered out automatically.
- **Offline** — a service worker precaches every region on first load, so the site works in airplane mode. Installable as a PWA.
- **Tap to copy** — any row copies its frequency.
- Keyboard: `/` focuses search, `Esc` clears it.

## Development

No build step and no dependencies. It is static HTML, one CSS file, one JS file, and JSON.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

A service worker requires `http://localhost` or HTTPS — opening `index.html` from the filesystem will work but without offline caching.

### Adding a region

1. Add an entry to `data/regions.json` with an `id`, bilingual names, and a `lat`/`lon` centroid for the "near me" search.
2. Create `data/r/<id>.json` with an `intro`, `introz` and a `stations` array.
3. Add the new file's path to `SHELL` in `sw.js` and bump `V` so clients pick up the change.

### Station fields

| Field | Meaning |
| --- | --- |
| `f` | Frequency in MHz. Use `0` for an entry that exists only to say "you cannot receive this". |
| `n` / `z` | Name in English / Chinese. |
| `c` | Category id from `regions.json`. |
| `m` | Mode: `AM`, `NFM`, `WFM`, or `P25` / `Encrypted` for unreceivable entries. |
| `t` | CTCSS tone in Hz. |
| `o` | Repeater offset, e.g. `−0.600`. |
| `dig` | `true` marks it as digital or encrypted, and excludes it from CSV export. |
| `conf` | `std`, `high` or `check`. |
| `a` | Sub-heading that groups nearby rows. |
| `d` / `dz` | Description in English / Chinese. |

### Icons

`node scripts/make-icons.mjs` regenerates the PNGs from a hand-written rasteriser, so there is nothing to install.

## Legal

Receiving these transmissions is legal in most of the United States, though a few states restrict scanner use in a moving vehicle. Transmitting is a different matter: operate only within the privileges of your licence, and stay off public safety, aviation and marine channels except in a genuine emergency.
