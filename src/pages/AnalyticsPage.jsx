import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, ComposedChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { money, fmtPct, monthLabel, toneWord, toneColor, pctChange } from "../utils/format";
import { billHistoryEntries } from "../utils/bills";
import {
  monthlyBillTotals, cardMonthlySpend, seriesStats, yearOverYearKey,
  excludeFutureMonths, windowMonths, monthlyIncomeVsSpending, categorySpendBreakdown,
} from "../utils/analytics";
import { COLOR_BOTTLE, COLOR_BRASS } from "../utils/constants";
import { PageHeader, Panel, Stat, Empty, Pill } from "../components/ui/Primitives";

const RANGES = [
  { id: 6, label: "6mo" },
  { id: 12, label: "12mo" },
  { id: 24, label: "24mo" },
  { id: "all", label: "All" },
];

export default function AnalyticsPage({ data, catalog }) {
  const [drillMode, setDrillMode] = useState("bill"); // 'bill' | 'card'
  const [selectedId, setSelectedId] = useState(null);
  const [rangeMonths, setRangeMonths] = useState(12);

  // "Full" here means the whole recorded history minus any not-yet-elapsed
  // month (see excludeFutureMonths) — used for stats that need to look
  // further back than the chosen display window, like year-over-year.
  // "Windowed" is what's actually charted/tabled.
  const globalFull = useMemo(() => excludeFutureMonths(monthlyBillTotals(data)), [data]);
  const globalSeries = useMemo(() => windowMonths(globalFull, rangeMonths), [globalFull, rangeMonths]);
  const globalStats = useMemo(() => seriesStats(globalFull), [globalFull]);

  const billOptions = useMemo(
    () =>
      data.bills
        .filter((b) => (b.frequency || "recurring") !== "onetime")
        .map((b) => {
          const full = excludeFutureMonths(billHistoryEntries(b, data));
          return { id: b.id, label: b.name, full, windowed: windowMonths(full, rangeMonths) };
        })
        .filter((o) => o.full.length > 0),
    [data, rangeMonths]
  );
  const cardOptions = useMemo(
    () =>
      data.cards
        .map((c) => {
          const full = excludeFutureMonths(cardMonthlySpend(c, data));
          return { id: c.id, label: c.name, full, windowed: windowMonths(full, rangeMonths) };
        })
        .filter((o) => o.full.length > 0),
    [data, rangeMonths]
  );
  const options = drillMode === "bill" ? billOptions : cardOptions;

  useEffect(() => {
    if (!options.some((o) => o.id === selectedId)) setSelectedId(options[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillMode, data]);

  const selected = options.find((o) => o.id === selectedId);
  const selectedStats = selected ? seriesStats(selected.full) : null;

  const incomeVsSpending = useMemo(() => monthlyIncomeVsSpending(data, rangeMonths), [data, rangeMonths]);
  const incomeTotal = incomeVsSpending.reduce((s, e) => s + e.income, 0);
  const spendingTotal = incomeVsSpending.reduce((s, e) => s + e.spending, 0);

  const categoryBreakdown = useMemo(() => categorySpendBreakdown(data, catalog, rangeMonths), [data, catalog, rangeMonths]);

  const rangeSelector = (
    <div className="segmented">
      {RANGES.map((r) => (
        <button key={r.id} className={"segment" + (rangeMonths === r.id ? " active" : "")} onClick={() => setRangeMonths(r.id)}>{r.label}</button>
      ))}
    </div>
  );

  if (globalFull.length === 0) {
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
      <PageHeader title="Analytics" subtitle="How your bills and spending change over time" action={rangeSelector} />

      <div className="stat-row">
        <Stat label="Latest month, all bills" value={money(globalStats.latest.amount)} tone="ink" />
        <Stat label="Month over month" value={fmtPct(globalStats.mom)} tone={toneWord(globalStats.mom)} />
        <Stat label="Year over year" value={globalStats.yoy != null ? fmtPct(globalStats.yoy) : "not enough data yet"} tone={toneWord(globalStats.yoy)} />
      </div>

      <Panel title="All bills combined" right={<span className="muted-text">total recorded bills, by month paid</span>}>
        {globalSeries.length === 0 ? (
          <Empty text="No bills paid in this range yet. Try a wider range." />
        ) : (
          <>
            <TrendChart series={globalSeries} color={COLOR_BOTTLE} />
            <TrendTable series={globalSeries} />
          </>
        )}
      </Panel>

      <Panel
        title="Income vs. spending"
        right={<span className="muted-text">{money(incomeTotal)} in · {money(spendingTotal)} out</span>}
      >
        {incomeVsSpending.length === 0 ? (
          <Empty text="No transactions in this range yet." />
        ) : (
          <>
            <IncomeVsSpendingChart series={incomeVsSpending} />
            <IncomeVsSpendingTable series={incomeVsSpending} />
          </>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Income counts deposits logged to a bank account or debit card — paychecks, cash gigs, and the like.
          Paying down a credit card isn't counted as income. Spending counts every charge — bills, layaway
          payments, and manual purchases — on cash, debit, or credit alike.
        </p>
      </Panel>

      <Panel
        title="Spending by category"
        right={<span className="muted-text">{money(categoryBreakdown.total)} total</span>}
      >
        {categoryBreakdown.rows.length === 0 ? (
          <Empty text="No charges in this range yet." />
        ) : (
          <>
            <CategoryBreakdownChart rows={categoryBreakdown.rows} />
            <CategoryBreakdownTable rows={categoryBreakdown.rows} total={categoryBreakdown.total} />
          </>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Assign categories to bills and transactions to sharpen this breakdown — uncategorized charges are
          grouped together. Categories are managed in the Admin Console.
        </p>
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
                {selected.windowed.length === 0 ? (
                  <Empty text="No data in this range yet. Try a wider range." />
                ) : (
                  <>
                    <TrendChart series={selected.windowed} color={COLOR_BRASS} />
                    <TrendTable series={selected.windowed} />
                  </>
                )}
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

function IncomeVsSpendingChart({ series }) {
  const chartData = series.map((e) => ({ label: monthLabel(e.key), income: e.income, spending: e.spending, net: e.net }));
  return (
    <div style={{ width: "100%", height: 220, marginBottom: 14 }}>
      <ResponsiveContainer>
        <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
            formatter={(v, name) => [money(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="var(--bottle)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="spending" name="Spending" fill="var(--rust)" radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="net" name="Net" stroke="var(--brass)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeVsSpendingTable({ series }) {
  return (
    <div className="ledger">
      {series.map((e) => (
        <div className="ledger-row" key={e.key}>
          <span className="col-name">{monthLabel(e.key)}</span>
          <span className="col-amount" style={{ width: 90, color: "var(--bottle)" }}>+{money(e.income)}</span>
          <span className="col-amount" style={{ width: 90, color: "var(--rust)" }}>−{money(e.spending)}</span>
          <span className="history-change" style={{ color: e.net >= 0 ? "var(--bottle)" : "var(--rust)" }}>
            {e.net >= 0 ? "+" : "−"}{money(Math.abs(e.net))} net
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdownChart({ rows }) {
  const top = rows.slice(0, 10);
  return (
    <div style={{ width: "100%", height: Math.max(140, top.length * 34), marginBottom: 14 }}>
      <ResponsiveContainer>
        <BarChart data={top} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12 }}
            formatter={(v) => [money(v), "Spent"]}
          />
          <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
            {top.map((row) => <Cell key={row.id} fill={row.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBreakdownTable({ rows, total }) {
  return (
    <div className="ledger">
      {rows.map((row) => (
        <div className="ledger-row" key={row.id}>
          <span className="dot" style={{ background: row.color }} />
          <span className="col-name">{row.id === "none" ? row.name : <Pill item={row} />}</span>
          <span className="col-amount">{money(row.amount)}</span>
          <span className="history-change">{total ? `${Math.round((row.amount / total) * 100)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}
