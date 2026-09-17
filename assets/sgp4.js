/* SGP4 — orbit propagation, near-Earth only.
 *
 * Follows Vallado's "Revisiting Spacetrack Report #3" (2006) and the reference sgp4unit.cpp,
 * using WGS-72 constants because SGP4 is defined against them: TLE mean elements are fitted
 * with WGS-72, so feeding it WGS-84 makes the answer worse, not more modern.
 *
 * The deep-space half (SDP4, for orbits of 225 minutes or longer) is deliberately absent.
 * Everything a handheld can actually work is low Earth orbit; the objects that need SDP4 are
 * geosynchronous or Molniya, far out of reach of a 5 W radio and a rubber duck antenna. So
 * init() reports a satellite as deep-space instead of propagating it badly, and the caller
 * drops it. See docs/ARCHITECTURE.md.
 *
 * Verified against the official SGP4-VER.TLE / tcppver.out vectors - see .probe/suite.mjs
 * group "sgp4", which holds every near-Earth case to 0.1 mm.
 */
(() => {
  'use strict';

  const PI = Math.PI, TWOPI = 2 * PI, DEG = PI / 180, X2O3 = 2 / 3;

  // WGS-72, as SGP4 requires.
  const RE = 6378.135;                       // equatorial radius, km
  const MU = 398600.8;                       // km^3/s^2
  const XKE = 60 / Math.sqrt(RE * RE * RE / MU);
  const J2 = 0.001082616, J3 = -0.00000253881, J4 = -0.00000165597;
  const J3OJ2 = J3 / J2;
  const VKMPERSEC = RE * XKE / 60;
  // Guard for the inclination = 180 deg singularity, as in the reference.
  const TINY = 1.5e-12;

  const fmod = (a, b) => a - Math.floor(a / b) * b;

  /* ---------- time ---------- */

  function jday(y, mon, d, h, mi, s) {
    return 367 * y
      - Math.floor(7 * (y + Math.floor((mon + 9) / 12)) * 0.25)
      + Math.floor(275 * mon / 9)
      + d + 1721013.5
      + ((s / 60 + mi) / 60 + h) / 24;
  }

  // Greenwich mean sidereal time, radians, from a UT1 Julian date.
  function gstime(jdut1) {
    const t = (jdut1 - 2451545) / 36525;
    let x = -6.2e-6 * t * t * t + 0.093104 * t * t
      + (876600 * 3600 + 8640184.812866) * t + 67310.54841;
    x = fmod(x * DEG / 240, TWOPI);
    return x < 0 ? x + TWOPI : x;
  }

  /* ---------- element sets ---------- */

  // Parse the two lines into the elements sgp4init wants, in radians and minutes.
  function parse(l1, l2) {
    const num = (l, a, b) => parseFloat(l.substring(a, b));
    const yr = parseInt(l1.substring(18, 20), 10);
    const year = yr < 57 ? yr + 2000 : yr + 1900;
    const days = num(l1, 20, 32);

    // The exponential fields are packed: a five-digit mantissa with an implied decimal
    // point in front of it, then a signed one-digit exponent.
    const packed = s => {
      const m = s.trim();
      if (!m || /^[+-]?0+$/.test(m)) return 0;
      const sign = m[0] === '-' ? -1 : 1;
      const body = m.replace(/^[+-]/, '');
      const e = body.slice(-2);
      return sign * parseFloat('0.' + body.slice(0, -2)) * Math.pow(10, parseInt(e, 10));
    };

    return {
      satnum: l1.substring(2, 7).trim(),
      jdsatepoch: jday(year, 1, 1, 0, 0, 0) + days - 1,
      bstar: packed(l1.substring(53, 61)),
      inclo: num(l2, 8, 16) * DEG,
      nodeo: num(l2, 17, 25) * DEG,
      ecco: parseFloat('0.' + l2.substring(26, 33).trim()),
      argpo: num(l2, 34, 42) * DEG,
      mo: num(l2, 43, 51) * DEG,
      // Revolutions per day to radians per minute.
      no_kozai: num(l2, 52, 63) * TWOPI / 1440
    };
  }

  /* ---------- initialisation ---------- */

  function init(el) {
    const s = Object.assign({ deepspace: false, error: 0 }, el);

    const eccsq = s.ecco * s.ecco;
    const omeosq = 1 - eccsq;
    const rteosq = Math.sqrt(omeosq);
    const cosio = Math.cos(s.inclo), cosio2 = cosio * cosio;
    const sinio = Math.sin(s.inclo);

    // Recover the un-Kozai'd mean motion: a TLE carries a Brouwer mean motion that already
    // has the J2 secular effect folded in, and SGP4 needs it taken back out.
    const ak = Math.pow(XKE / s.no_kozai, X2O3);
    const d1 = 0.75 * J2 * (3 * cosio2 - 1) / (rteosq * omeosq);
    let del = d1 / (ak * ak);
    const adel = ak * (1 - del * del - del * (1 / 3 + 134 * del * del / 81));
    del = d1 / (adel * adel);
    const no = s.no_kozai / (1 + del);
    s.no = no;

    const ao = Math.pow(XKE / no, X2O3);
    const po = ao * omeosq;
    const con42 = 1 - 5 * cosio2;
    const con41 = -con42 - cosio2 - cosio2;
    const posq = po * po;
    const rp = ao * (1 - s.ecco);

    s.gsto = gstime(s.jdsatepoch);
    s.con41 = con41;
    s.x1mth2 = 1 - cosio2;
    s.x7thm1 = 7 * cosio2 - 1;

    if (TWOPI / no >= 225) { s.deepspace = true; return s; }

    // Perigee is not checked here even though it can come out below the surface. The
    // reference propagates such an element set until it genuinely breaks down, and
    // matching that is what lets the verification vectors be used as-is. Whether an object
    // has decayed is a question about the data, and is answered in scripts/import-tle.mjs.
    s.perigee = (rp - 1) * RE;

    // Below 220 km the drag terms are dropped, as in the reference.
    s.isimp = rp < (220 / RE + 1);

    let sfour = 78 / RE + 1;
    let qzms24 = Math.pow((120 - 78) / RE, 4);
    const perige = (rp - 1) * RE;
    if (perige < 156) {
      sfour = perige < 98 ? 20 : perige - 78;
      qzms24 = Math.pow((120 - sfour) / RE, 4);
      sfour = sfour / RE + 1;
    }

    const pinvsq = 1 / posq;
    const tsi = 1 / (ao - sfour);
    s.eta = ao * s.ecco * tsi;
    const etasq = s.eta * s.eta;
    const eeta = s.ecco * s.eta;
    const psisq = Math.abs(1 - etasq);
    const coef = qzms24 * Math.pow(tsi, 4);
    const coef1 = coef / Math.pow(psisq, 3.5);
    const cc2 = coef1 * no * (ao * (1 + 1.5 * etasq + eeta * (4 + etasq))
      + 0.375 * J2 * tsi / psisq * con41 * (8 + 3 * etasq * (8 + etasq)));

    s.cc1 = s.bstar * cc2;
    const cc3 = s.ecco > 1e-4 ? -2 * coef * tsi * J3OJ2 * no * sinio / s.ecco : 0;
    s.cc4 = 2 * no * coef1 * ao * omeosq * (
      s.eta * (2 + 0.5 * etasq) + s.ecco * (0.5 + 2 * etasq)
      - J2 * tsi / (ao * psisq) * (
        -3 * con41 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta))
        + 0.75 * s.x1mth2 * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * s.argpo)));
    s.cc5 = 2 * coef1 * ao * omeosq * (1 + 2.75 * (etasq + eeta) + eeta * etasq);

    const cosio4 = cosio2 * cosio2;
    const temp1 = 1.5 * J2 * pinvsq * no;
    const temp2 = 0.5 * temp1 * J2 * pinvsq;
    const temp3 = -0.46875 * J4 * pinvsq * pinvsq * no;

    s.mdot = no + 0.5 * temp1 * rteosq * con41
      + 0.0625 * temp2 * rteosq * (13 - 78 * cosio2 + 137 * cosio4);
    s.argpdot = -0.5 * temp1 * con42
      + 0.0625 * temp2 * (7 - 114 * cosio2 + 395 * cosio4)
      + temp3 * (3 - 36 * cosio2 + 49 * cosio4);
    const xhdot1 = -temp1 * cosio;
    s.nodedot = xhdot1
      + (0.5 * temp2 * (4 - 19 * cosio2) + 2 * temp3 * (3 - 7 * cosio2)) * cosio;

    s.omgcof = s.bstar * cc3 * Math.cos(s.argpo);
    s.xmcof = s.ecco > 1e-4 ? -X2O3 * coef * s.bstar / eeta : 0;
    s.nodecf = 3.5 * omeosq * xhdot1 * s.cc1;
    s.t2cof = 1.5 * s.cc1;
    s.xlcof = Math.abs(cosio + 1) > TINY
      ? -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / (1 + cosio)
      : -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / TINY;
    s.aycof = -0.5 * J3OJ2 * sinio;
    const dm = 1 + s.eta * Math.cos(s.mo);
    s.delmo = dm * dm * dm;
    s.sinmao = Math.sin(s.mo);

    if (!s.isimp) {
      const cc1sq = s.cc1 * s.cc1;
      s.d2 = 4 * ao * tsi * cc1sq;
      const temp = s.d2 * tsi * s.cc1 / 3;
      s.d3 = (17 * ao + sfour) * temp;
      s.d4 = 0.5 * temp * ao * tsi * (221 * ao + 31 * sfour) * s.cc1;
      s.t3cof = s.d2 + 2 * cc1sq;
      s.t4cof = 0.25 * (3 * s.d3 + s.cc1 * (12 * s.d2 + 10 * cc1sq));
      s.t5cof = 0.2 * (3 * s.d4 + 12 * s.cc1 * s.d3 + 6 * s.d2 * s.d2
        + 15 * cc1sq * (2 * s.d2 + cc1sq));
    } else {
      s.d2 = s.d3 = s.d4 = s.t3cof = s.t4cof = s.t5cof = 0;
    }
    return s;
  }

  /* ---------- propagation ---------- */

  // Position and velocity in TEME, km and km/s, at t minutes from the element epoch.
  function propagate(s, t) {
    if (s.deepspace || s.error) return null;

    const xmdf = s.mo + s.mdot * t;
    const argpdf = s.argpo + s.argpdot * t;
    const nodedf = s.nodeo + s.nodedot * t;
    let argpm = argpdf, mm = xmdf;
    const t2 = t * t;
    let nodem = nodedf + s.nodecf * t2;
    let tempa = 1 - s.cc1 * t;
    let tempe = s.bstar * s.cc4 * t;
    let templ = s.t2cof * t2;

    if (!s.isimp) {
      const delomg = s.omgcof * t;
      const dm = 1 + s.eta * Math.cos(xmdf);
      const delm = s.xmcof * (dm * dm * dm - s.delmo);
      const temp = delomg + delm;
      mm = xmdf + temp;
      argpm = argpdf - temp;
      const t3 = t2 * t, t4 = t3 * t;
      tempa = tempa - s.d2 * t2 - s.d3 * t3 - s.d4 * t4;
      tempe = tempe + s.bstar * s.cc5 * (Math.sin(mm) - s.sinmao);
      templ = templ + s.t3cof * t3 + t4 * (s.t4cof + t * s.t5cof);
    }

    let nm = s.no;
    let em = s.ecco;
    const inclm = s.inclo;
    if (nm <= 0) return null;

    const am = Math.pow(XKE / nm, X2O3) * tempa * tempa;
    nm = XKE / Math.pow(am, 1.5);
    em = em - tempe;
    if (em >= 1 || em < -0.001) return null;
    if (em < 1e-6) em = 1e-6;

    mm = mm + s.no * templ;
    let xlm = mm + argpm + nodem;
    nodem = fmod(nodem, TWOPI);
    argpm = fmod(argpm, TWOPI);
    xlm = fmod(xlm, TWOPI);
    mm = fmod(xlm - argpm - nodem, TWOPI);

    const sinip = Math.sin(inclm), cosip = Math.cos(inclm);

    // Long period periodics.
    const axnl = em * Math.cos(argpm);
    let temp = 1 / (am * (1 - em * em));
    const aynl = em * Math.sin(argpm) + temp * s.aycof;
    const xl = mm + argpm + nodem + temp * s.xlcof * axnl;

    // Kepler's equation, by the reference's damped Newton iteration.
    const u = fmod(xl - nodem, TWOPI);
    let eo1 = u, tem5 = 9999.9, ktr = 1, sineo1 = 0, coseo1 = 0;
    while (Math.abs(tem5) >= 1e-12 && ktr <= 10) {
      sineo1 = Math.sin(eo1);
      coseo1 = Math.cos(eo1);
      tem5 = 1 - coseo1 * axnl - sineo1 * aynl;
      tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
      if (Math.abs(tem5) >= 0.95) tem5 = tem5 > 0 ? 0.95 : -0.95;
      eo1 += tem5;
      ktr++;
    }

    const ecose = axnl * coseo1 + aynl * sineo1;
    const esine = axnl * sineo1 - aynl * coseo1;
    const el2 = axnl * axnl + aynl * aynl;
    const pl = am * (1 - el2);
    if (pl < 0) return null;

    const rl = am * (1 - ecose);
    const rdotl = Math.sqrt(am) * esine / rl;
    const rvdotl = Math.sqrt(pl) / rl;
    const betal = Math.sqrt(1 - el2);
    temp = esine / (1 + betal);
    const sinu = am / rl * (sineo1 - aynl - axnl * temp);
    const cosu = am / rl * (coseo1 - axnl + aynl * temp);
    let su = Math.atan2(sinu, cosu);
    const sin2u = 2 * sinu * cosu;
    const cos2u = 1 - 2 * sinu * sinu;
    temp = 1 / pl;
    const temp1 = 0.5 * J2 * temp;
    const temp2 = temp1 * temp;

    // Short period periodics.
    const mrt = rl * (1 - 1.5 * temp2 * betal * s.con41) + 0.5 * temp1 * s.x1mth2 * cos2u;
    su = su - 0.25 * temp2 * s.x7thm1 * sin2u;
    const xnode = nodem + 1.5 * temp2 * cosip * sin2u;
    const xinc = inclm + 1.5 * temp2 * cosip * sinip * cos2u;
    const mvt = rdotl - nm * temp1 * s.x1mth2 * sin2u / XKE;
    const rvdot = rvdotl + nm * temp1 * (s.x1mth2 * cos2u + 1.5 * s.con41) / XKE;

    // Orientation vectors.
    const sinsu = Math.sin(su), cossu = Math.cos(su);
    const snod = Math.sin(xnode), cnod = Math.cos(xnode);
    const sini = Math.sin(xinc), cosi = Math.cos(xinc);
    const xmx = -snod * cosi, xmy = cnod * cosi;
    const ux = xmx * sinsu + cnod * cossu;
    const uy = xmy * sinsu + snod * cossu;
    const uz = sini * sinsu;
    const vx = xmx * cossu - cnod * sinsu;
    const vy = xmy * cossu - snod * sinsu;
    const vz = sini * cossu;

    return {
      r: [mrt * ux * RE, mrt * uy * RE, mrt * uz * RE],
      v: [(mvt * ux + rvdot * vx) * VKMPERSEC,
          (mvt * uy + rvdot * vy) * VKMPERSEC,
          (mvt * uz + rvdot * vz) * VKMPERSEC]
    };
  }

  /* ---------- observer geometry ---------- */

  // TEME position and velocity to look angles from a point on the ground. Rotating TEME by
  // GMST alone gives PEF and skips polar motion, which is tens of metres - far below the
  // pointing accuracy of a hand-held compass, and below the error in the elements themselves.
  function look(s, t, jd, lat, lon, altKm) {
    const p = propagate(s, t);
    if (!p) return null;

    const gmst = gstime(jd);
    const [x, y, z] = p.r;
    const c = Math.cos(gmst), sn = Math.sin(gmst);
    const xe = x * c + y * sn, ye = -x * sn + y * c, ze = z;

    // Observer in the same frame, on the WGS-84 ellipsoid.
    const f = 1 / 298.257223563, a = 6378.137;
    const la = lat * DEG, lo = lon * DEG;
    const sl = Math.sin(la);
    const cc = 1 / Math.sqrt(1 - (2 * f - f * f) * sl * sl);
    const rx = (a * cc + altKm) * Math.cos(la) * Math.cos(lo);
    const ry = (a * cc + altKm) * Math.cos(la) * Math.sin(lo);
    const rz = (a * cc * (1 - (2 * f - f * f)) + altKm) * sl;

    const dx = xe - rx, dy = ye - ry, dz = ze - rz;
    const sla = Math.sin(la), cla = Math.cos(la);
    const slo = Math.sin(lo), clo = Math.cos(lo);
    const south = sla * clo * dx + sla * slo * dy - cla * dz;
    const east = -slo * dx + clo * dy;
    const up = cla * clo * dx + cla * slo * dy + sla * dz;

    const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let az = Math.atan2(-east, south) / DEG + 180;
    if (az >= 360) az -= 360;

    // Range rate, for Doppler. Positive while the satellite is receding.
    const vr = (p.v[0] * (xe - rx) + p.v[1] * (ye - ry) + p.v[2] * (ze - rz)) / range;

    return {
      az,
      el: Math.asin(up / range) / DEG,
      range,
      rangeRate: vr,
      altitude: Math.sqrt(xe * xe + ye * ye + ze * ze) - a
    };
  }

  window.SGP4 = { parse, init, propagate, look, gstime, jday, RE };
})();
