const { useState, useMemo } = React;

const fmt = (d) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
const eur2 = fmt(2);
const pctF = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (v) => pctF.format(v * 100) + ' %';
const STKL = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function toNum(v, d) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : d;
}

function Field({ id, label, children, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function Form({ s, set }) {
  const monthly = s.per === 'm';
  const max = monthly ? 15000 : 180000;
  const step = monthly ? 50 : 600;

  const switchPer = (per) => {
    if (per === s.per) return;
    const cur = toNum(s.value, 0);
    set({ per, value: per === 'y' ? Math.round(cur * 12) : Math.round(cur / 12 / 50) * 50 });
  };

  return (
    <form className="card" onSubmit={(e) => e.preventDefault()} autoComplete="off">
      <h2>Angaben</h2>
      <div className="field">
        <span className="lbl" id="perlbl">Bruttogehalt pro</span>
        <div className="seg" role="radiogroup" aria-labelledby="perlbl">
          {[['m', 'Monat'], ['y', 'Jahr']].map(([v, t]) => (
            <React.Fragment key={v}>
              <input type="radio" name="per" id={'per-' + v} checked={s.per === v} onChange={() => switchPer(v)} />
              <label htmlFor={'per-' + v}>{t}</label>
            </React.Fragment>
          ))}
        </div>
      </div>

      <Field id="gross" label="Brutto in Euro">
        <input type="number" id="gross" inputMode="decimal" min="0" max="1000000" step={step}
          value={s.value} onChange={(e) => set({ value: e.target.value })} />
        <input type="range" min="0" max={max} step={step} aria-label="Brutto einstellen"
          value={Math.min(toNum(s.value, 0), max)} onChange={(e) => set({ value: e.target.value })} />
      </Field>

      <Field id="stkl" label="Steuerklasse">
        <select id="stkl" value={s.stkl} onChange={(e) => set({ stkl: +e.target.value })}>
          <option value="1">I – ledig, geschieden</option>
          <option value="2">II – alleinerziehend</option>
          <option value="3">III – verheiratet, höheres Einkommen</option>
          <option value="4">IV – verheiratet, ähnliches Einkommen</option>
          <option value="5">V – verheiratet, zu Klasse III</option>
          <option value="6">VI – zweites Arbeitsverhältnis</option>
        </select>
      </Field>

      <div className="row2 field">
        <div>
          <label htmlFor="kinder">Kinder</label>
          <select id="kinder" value={s.kinder} onChange={(e) => set({ kinder: +e.target.value })}>
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="kist">Kirchensteuer</label>
          <select id="kist" value={s.kist} onChange={(e) => set({ kist: +e.target.value })}>
            <option value="0">keine</option>
            <option value="0.09">9 % (NRW u. a.)</option>
            <option value="0.08">8 % (BY, BW)</option>
          </select>
        </div>
      </div>

      <Field id="zusatz" label="Zusatzbeitrag Krankenkasse (%)"
        hint="Ø 2026: 2,9 %. Den Satz deiner Kasse findest du auf deren Website.">
        <input type="number" id="zusatz" inputMode="decimal" min="0" max="6" step="0.1"
          value={s.zusatz} onChange={(e) => set({ zusatz: e.target.value })} />
      </Field>

      <div className="field">
        <label className="check" htmlFor="u23">
          <input type="checkbox" id="u23" checked={s.u23} onChange={(e) => set({ u23: e.target.checked })} />
          <span>Jünger als 23 Jahre (kein Pflegeversicherungs-Zuschlag für Kinderlose)</span>
        </label>
      </div>
    </form>
  );
}

function Summary({ r, inp }) {
  const segs = [
    { k: 'Netto', v: r.net, c: 'var(--c-net)' },
    { k: 'Lohnsteuer, Soli, Kirchensteuer', v: r.lst + r.soli + r.kist, c: 'var(--c-tax)' },
    { k: 'Rentenversicherung', v: r.rv, c: 'var(--c-rv)' },
    { k: 'Kranken- und Pflegeversicherung', v: r.kv + r.pv, c: 'var(--c-kv)' },
    { k: 'Arbeitslosenversicherung', v: r.av, c: 'var(--c-av)' },
  ].map((x) => ({ ...x, p: Math.max(0, x.v) / (r.gross || 1) }));

  let note = '';
  if (r.mini) note = 'Minijob (bis 603 € pro Monat): Der Arbeitgeber führt Pauschalabgaben ab, du zahlst 3,6 % Rentenversicherung, falls du dich nicht befreien lässt.';
  else if (r.midi) note = 'Übergangsbereich (Midijob): Deine Sozialabgaben werden aus einem reduzierten Entgelt berechnet, die Rentenansprüche bleiben aus dem vollen Brutto.';
  else if (inp.stkl === 2 && inp.kinder === 0) note = 'Steuerklasse II setzt mindestens ein Kind voraus. Ohne Kind entfällt der Entlastungsbetrag für Alleinerziehende.';

  return (
    <section className="card" aria-live="polite">
      <div className="hero">
        <div className="net">{eur2.format(r.net / 12)}<small>netto pro Monat</small></div>
        <div className="facts">
          Von <b>{eur2.format(r.gross / 12)}</b> brutto bleiben <b>{pct(r.gross ? r.net / r.gross : 0)}</b>.
          Abgaben gesamt: <b>{eur2.format((r.gross - r.net) / 12)}</b>
        </div>
      </div>
      <div className="bar" role="img" aria-label="Aufteilung des Bruttos">
        {segs.map((s) => (
          <span key={s.k} style={{ width: (s.p * 100).toFixed(2) + '%', background: s.c }} title={s.k + ': ' + pct(s.p)} />
        ))}
      </div>
      <div className="legend">
        {segs.map((s) => (
          <span key={s.k}><i style={{ background: s.c }} />{s.k} {pct(s.p)}</span>
        ))}
      </div>
      {note && <div className="notice">{note}</div>}
    </section>
  );
}

function Breakdown({ r }) {
  const g = r.gross || 1;
  const rows = [
    ['Bruttogehalt', r.gross, null],
    ['Lohnsteuer', -r.lst, 'var(--c-tax)'],
    ['Solidaritätszuschlag', -r.soli, 'var(--c-tax)'],
    ['Kirchensteuer', -r.kist, 'var(--c-tax)'],
    ['Rentenversicherung', -r.rv, 'var(--c-rv)'],
    ['Krankenversicherung', -r.kv, 'var(--c-kv)'],
    ['Pflegeversicherung', -r.pv, 'var(--c-kv)'],
    ['Arbeitslosenversicherung', -r.av, 'var(--c-av)'],
    ['Nettogehalt', r.net, null, true],
  ];
  return (
    <section className="card">
      <h2>Von Brutto zu Netto</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>Position</th><th>Monat</th><th>Jahr</th><th>Anteil</th></tr></thead>
          <tbody>
            {rows.map(([name, v, color, sum]) => {
              const sign = v < 0 ? '−' : '';
              const a = Math.abs(v);
              return (
                <tr key={name} className={sum ? 'sum' : undefined}>
                  <td>{color && <span className="sw" style={{ background: color }} />}{name}</td>
                  <td className="n">{sign}{eur2.format(a / 12)}</td>
                  <td className="n">{sign}{eur2.format(a)}</td>
                  <td className="p">{pct(a / g)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small">
        Zusätzlich zahlt der Arbeitgeber etwa {eur2.format(r.agSv / 12)} pro Monat an Sozialabgaben (ohne Umlagen).
        Seine Gesamtkosten liegen damit bei rund {eur2.format((r.gross + r.agSv) / 12)} pro Monat.
      </p>
    </section>
  );
}

function Compare({ inp }) {
  const rows = useMemo(() => [1, 2, 3, 4, 5, 6].map((k) => ({ k, r: BN.compute({ ...inp, stkl: k }) })), [inp]);
  return (
    <section className="card">
      <h2>Netto je Steuerklasse bei gleichem Brutto</h2>
      <div className="tbl">
        <table>
          <thead><tr><th>Steuerklasse</th><th>Lohnsteuer / Monat</th><th>Netto / Monat</th><th>Netto-Quote</th></tr></thead>
          <tbody>
            {rows.map(({ k, r }) => (
              <tr key={k} className={k === inp.stkl ? 'cur' : undefined}>
                <td>Klasse {STKL[k - 1]}</td>
                <td className="n">{eur2.format(r.lst / 12)}</td>
                <td className="n">{eur2.format(r.net / 12)}</td>
                <td className="p">{pct(r.gross ? r.net / r.gross : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">Die Klassen V und VI sind eine Näherung. Für die Wahl zwischen III/V und IV/IV zählt das gemeinsame Einkommen beider Partner, nicht nur dieses Gehalt.</p>
    </section>
  );
}

const W = 640, H = 280, L = 44, R = 16, T = 22, B = 34;
const X0 = 600, X1 = 15000, Y0 = 0.3, Y1 = 1.0;
const sx = (m) => L + ((m - X0) / (X1 - X0)) * (W - L - R);
const sy = (q) => T + (1 - (Math.min(Math.max(q, Y0), Y1) - Y0) / (Y1 - Y0)) * (H - T - B);

function Chart({ inp, cur }) {
  const { gross, ...rest } = inp;
  const key = JSON.stringify(rest);
  const points = useMemo(() => {
    const p = [];
    for (let m = 650; m <= X1; m += 50) {
      const r = BN.compute({ ...rest, gross: m * 12 });
      p.push(sx(m).toFixed(1) + ',' + sy(r.net / r.gross).toFixed(1));
    }
    return p.join(' ');
  }, [key]);

  const cm = cur.gross / 12;
  const showDot = cur.gross > 0 && cm >= 650 && cm <= X1;
  const cx = sx(cm), cy = sy(cur.gross ? cur.net / cur.gross : 0);
  const anchor = cx > W - 110 ? 'end' : 'start';
  const grid = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const xt = [2500, 5000, 7500, 10000, 12500, 15000];
  const limits = [[5812.5, 'KV/PV-Grenze', 'end'], [8450, 'RV/AV-Grenze', 'start']];

  return (
    <section className="card">
      <h2>Netto-Quote nach Gehaltshöhe</h2>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Netto-Quote in Abhängigkeit vom Bruttogehalt">
          {grid.map((q) => (
            <g key={q}>
              <line className="gl" x1={L} x2={W - R} y1={sy(q)} y2={sy(q)} />
              <text className="tx" x={L - 8} y={sy(q) + 4} textAnchor="end">{Math.round(q * 100)} %</text>
            </g>
          ))}
          {xt.map((t) => (
            <text key={t} className="tx" x={sx(t)} y={H - 12} textAnchor="middle">{new Intl.NumberFormat('de-DE').format(t)}</text>
          ))}
          <text className="tx" x={W - R} y={H} textAnchor="end">Brutto pro Monat in €</text>
          <line className="ax" x1={L} x2={W - R} y1={H - B} y2={H - B} />
          {limits.map(([v, t, a]) => (
            <g key={t}>
              <line className="ref" x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} />
              <text className="tx" x={sx(v) + (a === 'end' ? -5 : 5)} y={T + 2} textAnchor={a}>{t}</text>
            </g>
          ))}
          <polyline className="ln" points={points} />
          {showDot && (
            <g>
              <circle className="dot" cx={cx} cy={cy} r="5.5" />
              <text className="cur" x={anchor === 'end' ? cx - 10 : cx + 10} y={cy - 10} textAnchor={anchor}>{pct(cur.net / cur.gross)}</text>
            </g>
          )}
        </svg>
      </div>
      <p className="small">Mit deinen Einstellungen. Die gestrichelten Linien zeigen die Beitragsbemessungsgrenzen 2026: Kranken- und Pflegeversicherung bei 5.812,50 € pro Monat, Renten- und Arbeitslosenversicherung bei 8.450 €. Darüber steigen die Sozialabgaben nicht mehr, die Quote sinkt vor allem durch die Steuer.</p>
    </section>
  );
}

function Notes() {
  return (
    <section className="card">
      <h2>Annahmen und Quellen</h2>
      <ul className="notes">
        <li>Hochrechnung auf zwölf gleiche Monatsgehälter, ohne Sonderzahlungen, Freibeträge, Faktorverfahren und Kindergeld. Das Ergebnis ist ein Richtwert und ersetzt nicht die Gehaltsabrechnung oder den amtlichen Lohnsteuerrechner des BMF.</li>
        <li>Vorsorgepauschale vereinfacht aus den tatsächlichen Arbeitnehmerbeiträgen (Rente, Arbeitslosigkeit, Pflege, Kranken mit 7,0 % plus halbem Zusatzbeitrag). Arbeitnehmer-Pauschbetrag 1.230 €, Sonderausgaben-Pauschbetrag 36 € (Klasse III: 72 €).</li>
        <li>Zwischen 603,01 € und 2.000 € im Monat gilt der Übergangsbereich mit Faktor 0,6619, bis 603 € ein Minijob mit 3,6 % Rentenversicherungsanteil. Die Arbeitgeber-Umlagen U1, U2 und U3 sind nicht eingerechnet.</li>
        <li>Soli ab einer Einkommensteuer von 20.350 € (Klasse III: 40.700 €) mit Milderungszone. Kinderfreibeträge wirken nur auf Soli und Kirchensteuer, nicht auf die Lohnsteuer.</li>
        <li>Quellen: <a href="https://www.gesetze-im-internet.de/estg/__32a.html" target="_blank" rel="noopener">§ 32a EStG</a> (Grundfreibetrag 12.348 €), Sozialversicherungs-Rechengrößen 2026 (Beitragsbemessungsgrenzen 69.750 € und 101.400 €, Ø Zusatzbeitrag 2,9 %). Die Schwellenwerte der Klasse V/VI, der Soli-Grenze und der Kinderfreibeträge sind nicht gegen eine Primärquelle geprüft.</li>
      </ul>
    </section>
  );
}

function App() {
  const [s, setS] = useState({ per: 'm', value: 4500, stkl: 1, kinder: 0, kist: 0, zusatz: 2.9, u23: false });
  const set = (patch) => setS((p) => ({ ...p, ...patch }));

  const inp = useMemo(() => ({
    gross: Math.max(0, toNum(s.value, 0)) * (s.per === 'm' ? 12 : 1),
    stkl: s.stkl, kinder: s.kinder, kist: s.kist, zusatz: toNum(s.zusatz, 2.9), u23: s.u23,
  }), [s]);
  const r = useMemo(() => BN.compute(inp), [inp]);

  return (
    <div className="wrap">
      <header>
        <h1>Brutto-Netto-Rechner 2026</h1>
        <p className="lede">Was bleibt vom Gehalt übrig? Berechnung nach Einkommensteuertarif § 32a EStG, den Sozialversicherungswerten 2026 und dem Übergangsbereich für Midijobs.</p>
      </header>
      <div className="grid">
        <Form s={s} set={set} />
        <div className="stack">
          <Summary r={r} inp={inp} />
          <Breakdown r={r} />
        </div>
      </div>
      <Compare inp={inp} />
      <Chart inp={inp} cur={r} />
      <Notes />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
