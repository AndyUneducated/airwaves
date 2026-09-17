// Fetch the official SGP4 verification fixtures.
//
// These are the vectors published with Vallado's "Revisiting Spacetrack Report #3" and are
// what every SGP4 implementation is validated against. They are committed to the repository
// so `npm test` stays hermetic and works offline; this script exists to record where they
// came from and to re-fetch them if they ever need refreshing.
import { mkdirSync, writeFileSync } from 'node:fs';

const SRC = 'https://raw.githubusercontent.com/brandon-rhodes/python-sgp4/master/sgp4/';
mkdirSync('.probe/sgp4-ver', { recursive: true });

for (const f of ['SGP4-VER.TLE', 'tcppver.out']) {
  const r = await fetch(SRC + f);
  if (!r.ok) throw new Error(f + ': HTTP ' + r.status);
  const txt = await r.text();
  writeFileSync('.probe/sgp4-ver/' + f, txt);
  console.log('  ' + f + '  ' + txt.length + ' bytes');
}
