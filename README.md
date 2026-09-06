# Airwaves

Curated radio frequencies worth listening to, organised by region, built for an analog handheld — specifically the **Yaesu VX-6R**.

The point is narrow: you arrive somewhere, you open the site, you find frequencies you can actually receive, and you program them. It works with no signal.

## What's covered

Navigation is split into three tabs.

**United States** — twenty regions: a nationwide set plus SF Bay Area, San Jose & South Bay, Central Coast, Sierra Nevada, Los Angeles & Orange County, San Diego, Desert Southwest, Utah Canyon Country, Colorado Rockies, Texas Triangle, Chicago & Great Lakes, Boston & New England, New York Metro, Washington DC, Florida & Space Coast, Yellowstone & Tetons, Pacific Northwest, Alaska and Hawai‘i.

**China** — nine regions: a nationwide set covering the band plan and the licence-free channels, plus Beijing & the capital region, Shanghai & the Yangtze Delta, Qingdao & the Shandong coast, Chengdu & Chongqing, the Greater Bay Area, the Western Plateau, the Northwest, and the Northeast. The divisions follow how radio actually behaves rather than provincial boundaries — the plateau and the northwest are grouped by terrain and road corridor because that is what determines what you can hear.

**Private Link** — recommended clean, quiet channels for talking to your own group, with a separate page per country because the answer is genuinely different in each.

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

## Features

- **Bilingual** — English and 中文, toggled in the header, remembered between visits.
- **Country tabs** — a segmented control switches between the United States, China and the private-link pages; region chips below it filter to the selected country.
- **Near me** — browser geolocation picks the closest region across both countries and switches tab automatically.
- **CHIRP export** — download a region as a CHIRP-compatible CSV and program the radio in one shot. Digital entries, "avoid" entries and anything outside 0.5–999 MHz are filtered out automatically, and the tuning step is set to 5 or 12.5 kHz per channel as appropriate.
- **Offline** — a service worker precaches every region on first load, so the site works in airplane mode. Installable as a PWA.
- **Tap to copy** — any row copies its frequency.
- Keyboard: `/` focuses search, `Esc` clears it.
- URLs are shareable: `#/us/bay-area`, `#/cn/shanghai`, `#/link/link-us`. A bare `#/bay-area` still resolves.

## Development

No build step and no dependencies. It is static HTML, one CSS file, one JS file, and JSON.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

A service worker requires `http://localhost` or HTTPS — opening `index.html` from the filesystem will work but without offline caching.

One gotcha when developing: because the service worker is cache-first, reusing a port that another project's service worker has claimed will serve you that project instead. Pick a port you have not used elsewhere, or unregister the old worker.

### Adding a region

1. Add an entry to `data/regions.json` with an `id`, a `scope` (`us`, `cn` or `link`), bilingual names, and a `lat`/`lon` centroid for the "near me" search.
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
| `d` / `dz` | Description in English / Chinese. |

A region file may also carry `warn` / `warnz`, shown as a highlighted notice above the list. This is where the licensing and equipment-approval caveats live for the Chinese regions.

### Icons

`node scripts/make-icons.mjs` regenerates the PNGs from a hand-written rasteriser, so there is nothing to install.

## Legal

**United States.** Receiving is legal in most states, though a few restrict scanner use in a moving vehicle. Transmitting needs an FCC licence, and you must stay inside its privileges. Note that the VX-6R is certified for the amateur service only, so transmitting on FRS, GMRS or MURS with it is not permitted even though it can tune those frequencies.

**China.** Receiving is not generally restricted, but forwarding or publishing the content of other people's communications can be an offence. Transmitting requires a Chinese 业余电台操作证书 and station licence — a foreign licence is not automatically valid — and every transmitter used in the country needs SRRC 型号核准, which a US-market VX-6R does not have. The licence-free 公众对讲机 band at 409.7500–409.9875 MHz is open to anyone with type-approved equipment, but sits outside the VX-6R's transmit range, so treat the radio as a receiver in China. Hong Kong and Macau are separate jurisdictions with their own licensing.

**Everywhere.** Stay off public safety, aviation and marine channels except in a genuine emergency.
