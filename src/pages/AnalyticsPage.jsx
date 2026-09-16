import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { money, fmtPct, monthLabel, toneWord, toneColor, pctChange } from "../utils/format";
import { billHistoryEntries } from "../utils/bills";
import { monthlyBillTotals, cardMonthlySpend, seriesStats, yearOverYearKey } from "../utils/analytics";
import { COLOR_BOTTLE, COLOR_BRASS } from "../utils/constants";
import { PageHeader, Panel, Stat, Empty } from "../components/ui/Primitives";

export default function AnalyticsPage({ data }) {
  const [drillMode, setDrillMode] = useState("bill"); // 'bill' | 'card'
  const [selectedId, setSelectedId] = useState(null);

  const globalSeries = useMemo(() => monthlyBillTotals(data), [data]);
  const globalStats = useMemo(() => seriesStats(globalSeries), [globalSeries]);

  const billOptions = useMemo(
    () =>
      data.bills
        .filter((b) => (b.frequency || "recurring") !== "onetime")
        .map((b) => ({ id: b.id, label: b.name, series: billHistoryEntries(b, data) }))
        .filter((o) => o.series.length > 0),
    [data]
  );
  const cardOptions = useMemo(
    () =>
      data.cards
        .map((c) => ({ id: c.id, label: c.name, series: cardMonthlySpend(c, data) }))
        .filter((o) => o.series.length > 0),
    [data]
  );
  const options = drillMode === "bill" ? billOptions : cardOptions;

  useEffect(() => {
    if (!options.some((o) => o.id === selectedId)) setSelectedId(options[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillMode, data]);

  const selected = options.find((o) => o.id === selectedId);
  const selectedStats = selected ? seriesStats(selected.series) : null;

  if (globalSeries.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="How your bills and spending change over time" />
        <Panel title="Not enough data yet">
          <Empty text="Mark a few bills paid across a couple of months and your spending trends will show up here." />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How your bills and spending change over time" />

      <div className="stat-row">
        <Stat label="Latest month, all bills" value={money(globalStats.latest.amount)} tone="ink" />
        <Stat label="Month over month" value={fmtPct(globalStats.mom)} tone={toneWord(globalStats.mom)} />
        <Stat label="Year over year" value={globalStats.yoy != null ? fmtPct(globalStats.yoy) : "not enough data yet"} tone={toneWord(globalStats.yoy)} />
      </div>

      <Panel title="All bills combined" right={<span className="muted-text">total recorded bills, by month paid</span>}>
        <TrendChart series={globalSeries} color={COLOR_BOTTLE} />
        <TrendTable series={globalSeries} />
      </Panel>

      <Panel
        title="Drill into a bill or card"
        right={
          <div className="segmented">
            <button className={"segment" + (drillMode === "bill" ? " active" : "")} onClick={() => setDrillMode("bill")}>By bill</button>
            <button className={"segment" + (drillMode === "card" ? " active" : "")} onClick={() => setDrillMode("card")}>By card</button>
          </div>
        }
      >
        {options.length === 0 ? (
          <Empty text={drillMode === "bill" ? "No recurring bill has more than one recorded payment yet." : "No card has recorded charges yet."} />
        ) : (
          <>
            <div className="chip-row">
              {options.map((o) => (
                <button key={o.id} className={"chip" + (o.id === selectedId ? " active" : "")} onClick={() => setSelectedId(o.id)}>{o.label}</button>
              ))}
            </div>

            {selected && selectedStats && (
              <div className="drill-body">
                <div className="drill-stats">
                  <div><div className="figure-label">Average</div><div className="drill-figure">{money(selectedStats.avg)}</div></div>
                  <div><div className="figure-label">Lowest</div><div className="drill-figure">{money(selectedStats.min)}</div></div>
                  <div><div className="figure-label">Highest</div><div className="drill-figure">{money(selectedStats.max)}</div></div>
                  <div><div className="figure-label">Month over month</div><div className="drill-figure" style={{ color: toneColor(selectedStats.mom) }}>{fmtPct(selectedStats.mom)}</div></div>
                  <div><div className="figure-label">Year over year</div><div className="drill-figure" style={{ color: toneColor(selectedStats.yoy) }}>{selectedStats.yoy != null ? fmtPct(selectedStats.yoy) : "—"}</div></div>
                </div>
                <TrendChart series={selected.series} color={COLOR_BRASS} />
                <TrendTable series={selected.series} />
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function TrendChart({ series, color }) {
  const chartData = series.map((e) => ({ label: monthLabel(e.key), amount: e.amount }));
  return (
    <div style={{ width: "100%", height: 200, marginBottom: 14 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
            formatter={(v) => [money(v), "Amount"]}
          />
          <Bar dataKey="amount" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTable({ series }) {
  return (
    <div className="ledger">
      {series.map((e, idx) => {
        const prev = series[idx - 1];
        const mom = prev ? pctChange(e.amount, prev.amount) : null;
        const yoyEntry = series.find((h) => h.key === yearOverYearKey(e.key));
        const yoy = yoyEntry ? pctChange(e.amount, yoyEntry.amount) : null;
        return (
          <div className="ledger-row" key={e.key}>
            <span className="col-name">{monthLabel(e.key)}</span>
            <span className="col-amount" style={{ width: 90 }}>{money(e.amount)}</span>
            <span className="history-change" style={{ color: toneColor(mom) }}>{mom == null ? "first on record" : `${fmtPct(mom)} mo/mo`}</span>
            <span className="history-change" style={{ color: toneColor(yoy) }}>{yoy != null ? `${fmtPct(yoy)} yr/yr` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
