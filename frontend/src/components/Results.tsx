import { CARRIER_LABELS, formatDate, formatDays, formatPct, formatUsd } from "@/lib/format";
import type { Carrier, Comparison } from "@/lib/types";
import { SourceBadge } from "./DemoBanner";

export function SummaryCards({ c }: { c: Comparison }) {
  const byCarrier = (k: Carrier) => c.ranking.find((r) => r.carrier === k)!;
  const cheapest = byCarrier(c.cheapest);
  const fastest = byCarrier(c.fastest);
  const balance = byCarrier(c.bestBalance);
  const base = `Base: ${c.n} tarifas`;

  return (
    <section aria-label="Resumen de la comparación" className="stat-grid">
      <article className="stat">
        <h3 className="stat__label">Más económica</h3>
        <p className="stat__value">{CARRIER_LABELS[c.cheapest]}</p>
        <p className="stat__detail">{formatUsd(cheapest.totalUsd)} en total</p>
        <p className="stat__n">{base}</p>
      </article>
      <article className="stat">
        <h3 className="stat__label">Más rápida</h3>
        <p className="stat__value">{CARRIER_LABELS[c.fastest]}</p>
        <p className="stat__detail">
          {formatDays(fastest.transitDays)} de tránsito
          {fastest.deltaUsd > 0 && ` · ${formatUsd(fastest.deltaUsd)} más`}
        </p>
        <p className="stat__n">{base}</p>
      </article>
      <article className="stat">
        <h3 className="stat__label">Mejor equilibrio</h3>
        <p className="stat__value">{CARRIER_LABELS[c.bestBalance]}</p>
        <p className="stat__detail">
          Puntaje {balance.balanceScore.toFixed(2)} (70 % costo, 30 % tránsito; menor es mejor)
        </p>
        <p className="stat__n">{base}</p>
      </article>
      <article className="stat">
        <h3 className="stat__label">Dispersión</h3>
        <p className="stat__value">{formatUsd(c.spread.usd)}</p>
        <p className="stat__detail">
          {formatPct(c.spread.pct)} entre la más cara y la más barata · promedio {formatUsd(c.averageUsd)}
        </p>
        <p className="stat__n">{base}</p>
      </article>
    </section>
  );
}

export function RankingTable({ c }: { c: Comparison }) {
  const max = Math.max(...c.ranking.map((r) => r.totalUsd));
  return (
    <section className="card" aria-labelledby="ranking-title">
      <div className="card__head">
        <div>
          <h2 className="card__title" id="ranking-title">
            Ranking por costo total
          </h2>
          <p className="card__sub">Ordenado de menor a mayor. La diferencia se calcula frente a la más barata.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="table">
          <caption className="sr-only">Ranking de navieras por costo total, con tránsito y vigencia</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Naviera</th>
              <th scope="col" className="bar-cell">
                Total
              </th>
              <th scope="col" className="num">
                Diferencia
              </th>
              <th scope="col" className="num">
                Tránsito
              </th>
              <th scope="col">Vigencia</th>
              <th scope="col">Origen del dato</th>
            </tr>
          </thead>
          <tbody>
            {c.ranking.map((r) => (
              <tr key={r.carrier}>
                <td>{r.rank}</td>
                <th scope="row">{CARRIER_LABELS[r.carrier]}</th>
                <td className="bar-cell">
                  <span className={r.rank === 1 ? "cell-best" : undefined}>{formatUsd(r.totalUsd)}</span>
                  <div className="bar" aria-hidden="true">
                    <span className={r.rank === 1 ? "bar--best" : undefined} style={{ width: `${(r.totalUsd / max) * 100}%` }} />
                  </div>
                </td>
                <td className="num">
                  {r.deltaUsd === 0 ? (
                    <span className="badge badge--best">Más económica</span>
                  ) : (
                    <>
                      +{formatUsd(r.deltaUsd)} <span className="muted">({formatPct(r.deltaPct)})</span>
                    </>
                  )}
                </td>
                <td className="num">{formatDays(r.transitDays)}</td>
                <td>
                  {formatDate(r.validFrom)} – {formatDate(r.validTo)}
                </td>
                <td>
                  <SourceBadge source={r.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BreakdownTable({ c }: { c: Comparison }) {
  const carriers = c.ranking.map((r) => r.carrier);
  return (
    <section className="card" aria-labelledby="breakdown-title">
      <div>
        <h2 className="card__title" id="breakdown-title">
          Desglose por componente
        </h2>
        <p className="card__sub">Flete base y cada recargo, en USD. Resaltado, el valor más bajo de cada fila.</p>
      </div>
      <div className="table-scroll">
        <table className="table">
          <caption className="sr-only">Desglose de flete base y recargos por naviera</caption>
          <thead>
            <tr>
              <th scope="col">Componente</th>
              {carriers.map((k) => (
                <th scope="col" className="num" key={k}>
                  {CARRIER_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.breakdown.map((row) => {
              const values = carriers.map((k) => row.byCarrier[k]).filter((v): v is number => v !== undefined);
              const min = Math.min(...values);
              const hasSpread = values.length > 1 && Math.max(...values) !== min;
              return (
                <tr key={row.code}>
                  <th scope="row">{row.name}</th>
                  {carriers.map((k) => {
                    const v = row.byCarrier[k];
                    return (
                      <td className={`num ${hasSpread && v === min ? "cell-best" : ""}`} key={k}>
                        {v === undefined ? <span className="muted">—</span> : formatUsd(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {c.ranking.map((r) => (
                <td className="num" key={r.carrier}>
                  {formatUsd(r.totalUsd)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function InsightsPanel({ insights }: { insights: string[] }) {
  return (
    <section className="card" aria-labelledby="insights-title">
      <h2 className="card__title" id="insights-title">
        Lectura del análisis
      </h2>
      <ul className="insights">
        {insights.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </section>
  );
}
