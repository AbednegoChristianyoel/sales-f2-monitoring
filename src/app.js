(function () {
  const { useEffect, useMemo, useState } = React;

  const VIEW_CONFIG = [
    { id: "marketing", label: "Marketing Team", field: "Divisi Marketing" },
    {
      id: "sales",
      label: "Sales Team",
      field: "DIVISI",
      transform: salesTeamName,
      order: [
        "TRADING - OMEGA NEW",
        "TRADING - VIBRANT",
        "SERVICES - KAM",
        "SERVICES - HOSPINET",
        "CENTURY (Mall & Online)",
        "ALPRO",
        "PELAPAK INTERNAL",
        "SELISIH",
      ],
    },
    { id: "brand", label: "Group Brand", field: "Group Brand" },
    { id: "prodesc", label: "Prodesc", field: "Prodesc" },
  ];

  const MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES",
  ];

  const EMBEDDED_ROWS = Array.isArray(window.SALES_F2_DATA) ? window.SALES_F2_DATA : [];
  const STORAGE_KEY = "sales-f2-monitoring-v10";
  const TARGET_KEY = "sales-f2-targets-v1";

  function salesTeamName(value) {
    const code = String(value || "").trim().toUpperCase();
    const mapping = {
      OMG1: "TRADING - OMEGA NEW",
      VBR: "TRADING - VIBRANT",
      KAM: "SERVICES - KAM",
      KAM1: "SERVICES - KAM",
      KAM2: "SERVICES - KAM",
      KAM3: "SERVICES - KAM",
      HPH1: "SERVICES - HOSPINET",
      HPH3: "SERVICES - HOSPINET",
      CENTURY: "CENTURY (Mall & Online)",
      "CENTURY ONLINE": "CENTURY (Mall & Online)",
      ALPRO: "ALPRO",
      "PELAPAK INTERNAL": "PELAPAK INTERNAL",
      "(BLANK)": "SELISIH",
    };
    return mapping[code] || "SELISIH";
  }

  function numeric(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const clean = String(value).replace(/[^\d.-]/g, "");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function findMonthColumns(rows) {
    const keys = new Set();
    rows.forEach((row) => Object.keys(row).forEach((key) => /^\d{6}$/.test(key) && keys.add(key)));
    return Array.from(keys).sort();
  }

  function monthLabel(period) {
    const year = period.slice(0, 4);
    const month = Number(period.slice(4, 6));
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  function monthKey(year, month) {
    return `${year}${String(month).padStart(2, "0")}`;
  }

  function periodParts(period) {
    return { year: Number(period.slice(0, 4)), month: Number(period.slice(4, 6)) };
  }

  function sumMonths(sourceRows, year, fromMonth, toMonth) {
    let total = 0;
    for (let m = fromMonth; m <= toMonth; m += 1) {
      const key = monthKey(year, m);
      total += sourceRows.reduce((sum, row) => sum + numeric(row[key]), 0);
    }
    return total;
  }

  function avgWindow(sourceRows, period, offsetStart, offsetEnd) {
    const { year, month } = periodParts(period);
    let total = 0;
    let count = 0;
    for (let offset = offsetStart; offset <= offsetEnd; offset += 1) {
      const date = new Date(year, month - 1 - offset, 1);
      const key = monthKey(date.getFullYear(), date.getMonth() + 1);
      total += sourceRows.reduce((sum, row) => sum + numeric(row[key]), 0);
      count += 1;
    }
    return count ? total / count : 0;
  }

  function pct(value, base) {
    if (!base) return null;
    return value / base;
  }

  function formatNumber(value) {
    return Math.round(value || 0).toLocaleString("id-ID");
  }

  function formatPct(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "#DIV/0!";
    return `${(value * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  function classify(value, goodDirection = "positive") {
    if (value === null || value === undefined || !Number.isFinite(value)) return "muted";
    const good = goodDirection === "positive" ? value >= 0 : value <= 0;
    return good ? "positive" : "negative";
  }

  function safeLoad(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeRow(row) {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      const trimmedKey = String(key).trim();
      normalized[trimmedKey] = /^\d{6}$/.test(trimmedKey) ? numeric(value) : value;
    });
    return normalized;
  }

  function buildRows(dataRows, view, period, targets) {
    const grouped = new Map();
    const includedRows = [];
    dataRows.forEach((row) => {
      const rawName = String(row[view.field] || "").trim();
      const name = view.transform ? view.transform(rawName) : rawName || "Unassigned";
      if (!name) return;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(row);
      includedRows.push(row);
    });

    const { year, month } = periodParts(period);
    const totalTy = sumMonths(includedRows, year, 1, month);
    const totalLy = sumMonths(includedRows, year - 1, 1, month);

    const rows = Array.from(grouped.entries()).map(([name, sourceRows]) => {
      const targetKey = `${view.id}:${period}:${name}`;
      const ytdTy = sumMonths(sourceRows, year, 1, month);
      const ytdLy = sumMonths(sourceRows, year - 1, 1, month);
      const target = targets[targetKey] ?? Math.round(ytdTy * 1.12);
      const avgLy = month ? ytdLy / month : 0;
      const avgTy = month ? ytdTy / month : 0;
      const avgB01 = avgWindow(sourceRows, period, 0, 1);
      const avgB25 = avgWindow(sourceRows, period, 2, 5);
      const avgB02 = avgWindow(sourceRows, period, 0, 2);
      const avgB35 = avgWindow(sourceRows, period, 3, 5);

      return {
        name,
        target,
        ytdTy,
        ach: pct(ytdTy, target),
        gapTarget: ytdTy - target,
        ytdLy,
        gapGrowthZero: ytdTy - ytdLy,
        avgLy,
        avgTy,
        avgB01,
        avgB25,
        avgB02,
        avgB35,
        growthYtd: pct(ytdTy - ytdLy, ytdLy),
        growth24: pct(avgB01 - avgB25, avgB25),
        growth33: pct(avgB02 - avgB35, avgB35),
        contLy: pct(ytdLy, totalLy),
        contTy: pct(ytdTy, totalTy),
        targetKey,
      };
    });

    if (view.order) {
      const orderMap = new Map(view.order.map((name, index) => [name, index]));
      rows.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999) || b.ytdTy - a.ytdTy);
    } else {
      rows.sort((a, b) => b.ytdTy - a.ytdTy);
    }
    const totalTarget = rows.reduce((sum, row) => sum + row.target, 0);
    const total = {
      name: "TOTAL",
      target: totalTarget,
      ytdTy: totalTy,
      ach: pct(totalTy, totalTarget),
      gapTarget: totalTy - totalTarget,
      ytdLy: totalLy,
      gapGrowthZero: totalTy - totalLy,
      avgLy: month ? totalLy / month : 0,
      avgTy: month ? totalTy / month : 0,
      avgB01: avgWindow(includedRows, period, 0, 1),
      avgB25: avgWindow(includedRows, period, 2, 5),
      avgB02: avgWindow(includedRows, period, 0, 2),
      avgB35: avgWindow(includedRows, period, 3, 5),
      growthYtd: pct(totalTy - totalLy, totalLy),
      growth24: pct(avgWindow(includedRows, period, 0, 1) - avgWindow(includedRows, period, 2, 5), avgWindow(includedRows, period, 2, 5)),
      growth33: pct(avgWindow(includedRows, period, 0, 2) - avgWindow(includedRows, period, 3, 5), avgWindow(includedRows, period, 3, 5)),
      contLy: 1,
      contTy: 1,
      total: true,
    };

    return { rows, total };
  }

  function App() {
    const [dataRows, setDataRows] = useState(() => safeLoad(STORAGE_KEY, EMBEDDED_ROWS));
    const [targets, setTargets] = useState(() => safeLoad(TARGET_KEY, {}));
    const [activeViewId, setActiveViewId] = useState("marketing");
    const [status, setStatus] = useState(`${EMBEDDED_ROWS.length.toLocaleString("id-ID")} rows loaded from Sales F2.xlsx.`);
    const monthColumns = useMemo(() => findMonthColumns(dataRows), [dataRows]);
    const [period, setPeriod] = useState("");

    useEffect(() => {
      if (!period && monthColumns.length) setPeriod(monthColumns[monthColumns.length - 1]);
      if (period && monthColumns.length && !monthColumns.includes(period)) setPeriod(monthColumns[monthColumns.length - 1]);
    }, [monthColumns, period]);

    useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(dataRows)), [dataRows]);
    useEffect(() => localStorage.setItem(TARGET_KEY, JSON.stringify(targets)), [targets]);

    const activeView = VIEW_CONFIG.find((view) => view.id === activeViewId);
    const { rows, total } = useMemo(() => {
      if (!period) return { rows: [], total: null };
      return buildRows(dataRows, activeView, period, targets);
    }, [dataRows, activeView, period, targets]);

    function onUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const workbook = XLSX.read(new Uint8Array(loadEvent.target.result), { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const parsed = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeRow);
          setDataRows(parsed);
          setStatus(`${file.name} imported: ${parsed.length.toLocaleString("id-ID")} rows from ${workbook.SheetNames[0]}.`);
        } catch (error) {
          setStatus(`Import failed: ${error.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function updateTarget(key, value) {
      setTargets((current) => ({ ...current, [key]: numeric(value) }));
    }

    const summary = total || {};
    const selectedLabel = period ? monthLabel(period) : "";
    const displayRows = total ? [...rows, total] : rows;

    return React.createElement(
      "main",
      { className: "app-shell" },
      React.createElement(
        "section",
        { className: "toolbar" },
        React.createElement(
          "div",
          null,
          React.createElement("p", { className: "eyebrow" }, "Sales performance monitoring"),
          React.createElement("h1", null, "Sales F2 Dashboard"),
          React.createElement("p", { className: "subtitle" }, "Upload Excel sales data, choose a period, and review target, achievement, growth, averages, and contribution by team or product view.")
        ),
        React.createElement(
          "div",
          { className: "actions" },
          React.createElement("label", { className: "upload-button" }, "Upload Excel", React.createElement("input", { type: "file", accept: ".xlsx,.xls", onChange: onUpload })),
          React.createElement(
            "select",
            { value: period, onChange: (event) => setPeriod(event.target.value), "aria-label": "Select period" },
            monthColumns.map((column) => React.createElement("option", { key: column, value: column }, monthLabel(column)))
          )
        )
      ),
      React.createElement(
        "section",
        { className: "summary-grid" },
        React.createElement(SummaryCard, { label: `Target YTD ${selectedLabel}`, value: formatNumber(summary.target), tone: "target" }),
        React.createElement(SummaryCard, { label: `Actual YTD ${selectedLabel}`, value: formatNumber(summary.ytdTy), tone: "actual" }),
        React.createElement(SummaryCard, { label: "ACH (%)", value: formatPct(summary.ach), tone: classify((summary.ach || 0) - 1) }),
        React.createElement(SummaryCard, { label: "Gap to Target", value: formatNumber(summary.gapTarget), tone: classify(summary.gapTarget) }),
        React.createElement(SummaryCard, { label: "Growth YTD", value: formatPct(summary.growthYtd), tone: classify(summary.growthYtd) })
      ),
      React.createElement(
        "section",
        { className: "panel" },
        React.createElement(
          "div",
          { className: "panel-header" },
          React.createElement(
            "div",
            { className: "tabs", role: "tablist" },
            VIEW_CONFIG.map((view) =>
              React.createElement("button", { key: view.id, className: view.id === activeViewId ? "active" : "", onClick: () => setActiveViewId(view.id) }, view.label)
            )
          ),
          React.createElement("span", { className: "status" }, status)
        ),
        React.createElement(
          "div",
          { className: "table-wrap" },
          React.createElement(
            "table",
            null,
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement("th", { rowSpan: 2, className: "sticky-col name-col" }, activeView.label),
                React.createElement("th", { colSpan: 4, className: "group target-head" }, "To Target"),
                React.createElement("th", { colSpan: 3, className: "group growth-head" }, "Growth Per YTD"),
                React.createElement("th", { colSpan: 9, className: "group average-head" }, "Growth Per Average"),
                React.createElement("th", { colSpan: 2, className: "group cont-head" }, "Contribution")
              ),
              React.createElement(
                "tr",
                null,
                [
                  `Target YTD ${selectedLabel}`,
                  `Actual YTD ${selectedLabel}`,
                  "ACH (%)",
                  "Gap to Target",
                  `YTD ${MONTH_NAMES[Number(period.slice(4, 6)) - 1]} '${String(Number(period.slice(0, 4)) - 1).slice(2)} (LY)`,
                  `YTD ${MONTH_NAMES[Number(period.slice(4, 6)) - 1]} '${period.slice(2, 4)} (TY)`,
                  "Gap to GRW 0%",
                  `AVG YTD ${MONTH_NAMES[Number(period.slice(4, 6)) - 1]} ${Number(period.slice(0, 4)) - 1}`,
                  `AVG YTD ${MONTH_NAMES[Number(period.slice(4, 6)) - 1]} ${period.slice(0, 4)}`,
                  "AVG B0 - B1 (2)",
                  "AVG B2 - B5 (4)",
                  "AVG B0 - B2 (3)",
                  "AVG B3 - B5 (3)",
                  "GRW YTD",
                  "GRW 2-4",
                  "GRW 3-3",
                  `CONT ${Number(period.slice(0, 4)) - 1}`,
                  `CONT ${period.slice(0, 4)}`,
                ].map((label) => React.createElement("th", { key: label }, label))
              )
            ),
            React.createElement(
              "tbody",
              null,
              displayRows.map((row) => React.createElement(DataRow, { key: row.total ? "total" : row.targetKey, row, updateTarget }))
            )
          )
        )
      )
    );
  }

  function SummaryCard({ label, value, tone }) {
    return React.createElement("article", { className: `summary-card ${tone || ""}` }, React.createElement("span", null, label), React.createElement("strong", null, value));
  }

  function DataRow({ row, updateTarget }) {
    const numberCells = [
      row.ytdTy,
      row.ach,
      row.gapTarget,
      row.ytdLy,
      row.ytdTy,
      row.gapGrowthZero,
      row.avgLy,
      row.avgTy,
      row.avgB01,
      row.avgB25,
      row.avgB02,
      row.avgB35,
      row.growthYtd,
      row.growth24,
      row.growth33,
      row.contLy,
      row.contTy,
    ];

    return React.createElement(
      "tr",
      { className: row.total ? "total-row" : "" },
      React.createElement("td", { className: "sticky-col name-cell", title: row.name }, row.name),
      React.createElement(
        "td",
        { className: "editable-cell" },
        row.total
          ? formatNumber(row.target)
          : React.createElement("input", { value: Math.round(row.target), onChange: (event) => updateTarget(row.targetKey, event.target.value), "aria-label": `Target for ${row.name}` })
      ),
      numberCells.map((value, index) => {
        const percentIndexes = new Set([1, 12, 13, 14, 15, 16]);
        const className = index === 1 ? classify((value || 0) - 1) : index >= 12 ? classify(value) : index === 2 || index === 5 ? classify(value) : "";
        return React.createElement("td", { key: index, className }, percentIndexes.has(index) ? formatPct(value) : formatNumber(value));
      })
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
})();
