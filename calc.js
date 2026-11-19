(function (root) {
  // Parameter 2026 (Stand: Nov. 2026)
  const P = {
    bbgKV: 69750, bbgRV: 101400,
    rv: 0.093, av: 0.013, kvBase: 0.073, kvReduced: 0.07, pvBase: 0.018,
    pvKinderlos: 0.006, pvKindAbschlag: 0.0025,
    wk: 1230, sa: 36, entlastung: 4260, entlastungExtra: 240,
    kfbHalf: 4878,
    soliFrei: 20350,
    midiLo: 603, midiHi: 2000, midiF: 0.6619,
    w1: 14071, w2: 34939, w3: 222260
  };

  // Einkommensteuer-Grundtarif § 32a EStG 2026
  function tarif(x) {
    x = Math.floor(x);
    if (x <= 12348) return 0;
    if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
    if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.1 * z + 2397) * z + 1034.87); }
    if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
    return Math.floor(0.45 * x - 19470.38);
  }

  // Lohnsteuer Klasse V/VI (Näherung nach Logik des amtlichen Programmablaufplans)
  function up56(v) {
    const d = 2 * (tarif(v * 1.25) - tarif(v * 0.75));
    return Math.max(d, v * 0.14);
  }
  
  function stkl56(zx) {
    zx = Math.floor(zx);
    let st;
    if (zx > P.w2) {
      st = up56(P.w2) + (Math.min(zx, P.w3) - P.w2) * 0.42;
      if (zx > P.w3) st += (zx - P.w3) * 0.45;
    } else {
      st = up56(zx);
      if (zx > P.w1) {
        const hoch = up56(P.w1) + (zx - P.w1) * 0.42;
        st = Math.min(st, hoch);
      }
    }
    return Math.floor(st);
  }

  function pvAN(kinder, u23) {
    let r = P.pvBase;
    if (kinder === 0 && !u23) r += P.pvKinderlos;
    if (kinder >= 2) r -= P.pvKindAbschlag * (Math.min(kinder, 5) - 1);
    return r;
  }

  // i: { gross (Jahr), stkl 1-6, kinder, kist (0 | 0.08 | 0.09), zusatz (% z.B. 2.9), u23 }
  function compute(i) {
    const G = i.gross, m = G / 12, st = i.stkl, kinder = i.kinder | 0;
    const zus = (isFinite(i.zusatz) ? i.zusatz : 2.9) / 100;

    if (m <= P.midiLo) {
      const rv = G * 0.036;
      return { mini: true, gross: G, lst: 0, soli: 0, kist: 0, rv, kv: 0, pv: 0, av: 0,
        net: G - rv, agSv: G * 0.30, zvE: 0 };
    }

    let BE = m, midi = false;
    if (m < P.midiHi) {
      midi = true;
      const F = P.midiF, lo = P.midiLo, hi = P.midiHi;
      BE = F * lo + (hi / (hi - lo) - (lo / (hi - lo)) * F) * (m - lo);
    }
    const bRV = Math.min(BE * 12, P.bbgRV), bKV = Math.min(BE * 12, P.bbgKV);
    const gRV = Math.min(G, P.bbgRV), gKV = Math.min(G, P.bbgKV);

    const rv = bRV * P.rv, av = bRV * P.av;
    const kv = bKV * (P.kvBase + zus / 2);
    const pv = bKV * pvAN(kinder, !!i.u23);
    const agSv = gRV * (P.rv + P.av) + gKV * (P.kvBase + zus / 2 + P.pvBase);

    const vorsorge = rv + av + bKV * (P.kvReduced + zus / 2) + pv;
    const wk = st === 6 ? 0 : P.wk;
    const sa = st === 3 ? 72 : 36;
    const entl = st === 2 && kinder >= 1 ? P.entlastung + P.entlastungExtra * (kinder - 1) : 0;
    const zvE = Math.max(0, Math.floor(G - wk - sa - vorsorge - entl));

    let lst;
    if (st === 3) lst = 2 * tarif(zvE / 2);
    else if (st === 5 || st === 6) lst = stkl56(zvE);
    else lst = tarif(zvE);

    // Basis für Soli und Kirchensteuer (mit Kinderfreibetrag)
    let kfb = 0;
    if (st === 2 || st === 3) kfb = kinder * 2 * P.kfbHalf;
    else if (st === 1 || st === 4) kfb = kinder * P.kfbHalf;
    let base;
    if (st === 5 || st === 6) base = lst;
    else if (st === 3) base = 2 * tarif(Math.max(0, zvE - kfb) / 2);
    else base = tarif(Math.max(0, zvE - kfb));

    const frei = st === 3 ? 2 * P.soliFrei : P.soliFrei;
    let soli = 0;
    if (base > frei) soli = Math.min(0.055 * base, 0.119 * (base - frei));
    const kist = (i.kist || 0) * base;

    const net = G - lst - soli - kist - rv - kv - pv - av;
    return { mini: false, midi, gross: G, lst, soli, kist, rv, kv, pv, av, net, agSv, zvE };
  }

  const api = { P, tarif, stkl56, compute };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BN = api;
})(typeof window !== 'undefined' ? window : globalThis);
