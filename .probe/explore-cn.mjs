/* Is there any machine-readable, citable source for Chinese broadcast frequencies?
 * China has no FCC-equivalent open database, so try Wikidata's structured claims. */

const SPARQL = 'https://query.wikidata.org/sparql';

const q = `
SELECT ?s ?sLabel ?freq ?placeLabel WHERE {
  ?s wdt:P31/wdt:P279* wd:Q14350 .
  ?s wdt:P17 wd:Q148 .
  ?s wdt:P2144 ?freq .
  OPTIONAL { ?s wdt:P131 ?place . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,zh-cn,en". }
}
LIMIT 400`;

const res = await fetch(`${SPARQL}?query=${encodeURIComponent(q)}&format=json`, {
  headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'airwaves-dev/1.0 (frequency reference)' }
});
console.log('HTTP', res.status);
if (!res.ok) {
  console.log((await res.text()).slice(0, 400));
  process.exit(0);
}
const j = await res.json();
const rows = j.results.bindings;
console.log(`${rows.length} Chinese radio stations with a frequency claim\n`);
for (const r of rows.slice(0, 30)) {
  console.log(`  ${(r.freq ? r.freq.value : '?').padEnd(10)} ${(r.sLabel ? r.sLabel.value : '').slice(0, 34).padEnd(36)} ${r.placeLabel ? r.placeLabel.value : '—'}`);
}

const withPlace = rows.filter(r => r.placeLabel).length;
console.log(`\nwith a place: ${withPlace}/${rows.length}`);
