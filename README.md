# Airwaves

Curated radio frequencies worth listening to, organised by region, built for an analog handheld — specifically the **Yaesu VX-6R**.

The point is narrow: you arrive somewhere, you open the site, you find frequencies you can actually receive, and you program them. It works with no signal.

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

## Confidence tags

Every entry is tagged, because frequency data rots and pretending otherwise is worse than useless.

| Tag | Meaning |
| --- | --- |
| Standard | A national or international allocation. Will not change. |
| Stable | Long-established and rarely changes. |
| Verify | Believed correct but locally variable — confirm before relying on it. |

Chinese entries lean much harder on **Verify** than American ones, and deliberately so. CAAC air traffic frequencies are published in the AIP rather than on hobbyist databases, and repeater details vary more by province than they do by US state. Where a specific number could not be established with confidence, the entry gives the sub-band to sweep instead of guessing — which is also how you would actually find it in the field.

Amateur repeaters change tone and offset more often than anything else here, so each region links out to RepeaterBook or CRAC.

## Two modes

The site opens in **Simple** mode: a frequency, a name, a short description, and nothing else in the way. That is the mode the whole thing is designed around — standing outside, one hand, bright sun, no signal.

**Pro** mode is the switch in the header, or the `P` key. It layers instruments on top for someone who is actually holding the radio:

- Under every entry, the amateur band the frequency falls in, the frequency you would transmit on to reach a repeater, and the quarter-wave antenna length.
- **How far away it is.** Once you have tapped "Near me", entries tied to a known transmitter site show the distance and compass bearing from you — the difference between "there is a tower frequency" and "that tower is 7.7 km northwest, so of course you can hear it". Only entries with a real site say anything: an approach sector covering half a state, or a dial position shared by three transmitters, has no single place, and an invented number would be worse than silence. The position is kept on your device for six hours so the distances are simply there next time, and never leaves it.
- The spectrum rail becomes a **tuning knob**. Drag it and the frequency sweeps continuously; listed entries are detents you can feel and hear, band edges give a heavier click, and the receiver hiss drops away as you settle onto something — so you can find an entry without looking at the screen. Release to jump to it. Arrow keys, `Home` and `End` step entry by entry, and the speaker icon mutes the sound for good.
- Each band on the rail is labelled with how many entries it holds.

All of it is computed in the browser, so Pro works offline exactly like the rest of the site. Nothing plays audio until you actually touch the rail.

The choice is remembered. `?pro=1` and `?pro=0` force a mode, which makes a Pro view shareable.

## Features

- **Bilingual** — English and 中文, toggled in the header, remembered between visits.
- **Country as a setting** — a compact control in the header switches between the United States and China. It is chosen once and remembered, which leaves the chip strip below as the only place picker rather than two strips that look alike.
- **Spectrum ruler** — a log-scale rail above the list shows where the visible entries sit across 0.5–999 MHz, split into HF, VHF and UHF. Tap it to jump to the nearest entry; the ticks also show at a glance how busy each band is.
- **Near me** — browser geolocation picks the closest region across both countries and switches country automatically.
- **CHIRP export** — download a region as a CHIRP-compatible CSV and program the radio in one shot. Digital entries, "avoid" entries and anything outside 0.5–999 MHz are filtered out automatically, and the tuning step is set to 5 or 12.5 kHz per channel as appropriate.
- **Offline** — a service worker precaches every region on first load, so the site works in airplane mode. Installable as a PWA.
- **Tap to copy** — any row copies its frequency, with a flash and a short vibration to confirm it without you having to read the screen.
- Keyboard: `/` focuses search, `Esc` clears it or closes the country menu, `P` switches mode.
- URLs are shareable: `#/us/bay-area`, `#/cn/shanghai`, `#/us/link-us`. A bare `#/bay-area` still resolves, and `?pro=1` opens in Pro mode.

## Development

No build step and no dependencies. It is static HTML, one CSS file, one JS file, and JSON.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

A service worker requires `http://localhost` or HTTPS — opening `index.html` from the filesystem will work but without offline caching.

One gotcha when developing: because the service worker is cache-first, reusing a port that another project's service worker has claimed will serve you that project instead. Pick a port you have not used elsewhere, or unregister the old worker.

### Adding a region

1. Add an entry to `data/regions.json` with an `id`, a `scope` (the country, `us` or `cn`), bilingual names, and a `lat`/`lon` centroid for the "near me" search. Add `"kind": "link"` for a private-link page, which moves it past a divider at the end of the strip. A region with a null `lat` is skipped by "near me".
2. Create `data/r/<id>.json` with an `intro`, `introz` and a `stations` array.
3. Bump `V` in `sw.js` so clients pick up the change. The region file list is derived from `regions.json` at install time, so there is nothing to add by hand.

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
| `a` | Sub-heading that groups nearby rows. |
| `ref` | ICAO code of the airport this entry transmits from, e.g. `KSFO`. It is what lets Pro mode give a distance and bearing, so add it wherever an entry really does come from one field. |
| `d` / `dz` | Description in English / Chinese. |

A region file may also carry `intro` / `introz`, shown above the list as the region's opening paragraph.

### Generated data

`data/places.json` holds the coordinates and elevation of every airport the station data refers to by `ref`. Regenerate it after adding a new `ref`:

```sh
node scripts/make-places.mjs
```

It reads the codes out of `data/r/*.json`, fetches the public-domain ourairports.com database, and keeps only what is referenced — a few kilobytes, committed to the repo. The site is static, so this is a build-time step, not a runtime lookup, and it works offline like everything else.

### Icons

`node scripts/make-icons.mjs` regenerates the PNGs from a hand-written rasteriser, so there is nothing to install.

## Legal

**United States.** Receiving is legal in most states, though a few restrict scanner use in a moving vehicle. Transmitting needs an FCC licence, and you must stay inside its privileges. Note that the VX-6R is certified for the amateur service only, so transmitting on FRS, GMRS or MURS with it is not permitted even though it can tune those frequencies.

**China.** Receiving is not generally restricted, but forwarding or publishing the content of other people's communications can be an offence. Transmitting requires a Chinese 业余电台操作证书 and station licence — a foreign licence is not automatically valid — and every transmitter used in the country needs SRRC 型号核准, which a US-market VX-6R does not have. The licence-free 公众对讲机 band at 409.7500–409.9875 MHz is open to anyone with type-approved equipment, but sits outside the VX-6R's transmit range, so treat the radio as a receiver in China. Hong Kong and Macau are separate jurisdictions with their own licensing.

**Everywhere.** Stay off public safety, aviation and marine channels except in a genuine emergency.
