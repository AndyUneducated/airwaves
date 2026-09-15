/* What does the FCC actually give us per station, and can we tell news from music? */

const FM = 'https://transition.fcc.gov/fcc-bin/fmq?state=CA&serv=FM&list=4&size=9';
const AM = 'https://transition.fcc.gov/fcc-bin/amq?state=CA&list=4&size=9';

for (const [label, url] of [['FM', FM], ['AM', AM]]) {
  const txt = await (await fetch(url)).text();
  const rows = txt.split('\n').filter(l => l.includes('|'));
  console.log(`\n================ ${label}: ${rows.length} rows`);
  const cols = rows[0].split('|');
  cols.forEach((c, i) => console.log(`  [${String(i).padStart(2)}] ${JSON.stringify(c.trim()).slice(0, 60)}`));

  console.log(`\n  three more ${label} rows, trimmed:`);
  for (const r of rows.slice(1, 4)) {
    console.log('   ' + r.split('|').map(c => c.trim()).filter(Boolean).join(' ~ ').slice(0, 260));
  }

  // Which column distinguishes licensed from applications, and commercial from educational?
  const statuses = {}, services = {};
  for (const r of rows) {
    const c = r.split('|').map(x => x.trim());
    statuses[c[9]] = (statuses[c[9]] || 0) + 1;
    services[c[4]] = (services[c[4]] || 0) + 1;
  }
  console.log(`\n  col 9 values : ${JSON.stringify(statuses).slice(0, 200)}`);
  console.log(`  col 4 values : ${JSON.stringify(services).slice(0, 200)}`);
}
