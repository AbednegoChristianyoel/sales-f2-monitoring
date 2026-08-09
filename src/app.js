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
    { id: "brand", label: "Group Brand", field: "Group Brand", showMarketingColumn: true },
    { id: "prodesc", label: "Prodesc", field: "Prodesc", showMarketingColumn: true },
  ];

  const MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES",
  ];
  const PERIODS_2026 = MONTH_NAMES.map((_, index) => monthKey(2026, index + 1));

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

  function sumMonth(sourceRows, year, month) {
    const key = monthKey(year, month);
    return sourceRows.reduce((sum, row) => sum + numeric(row[key]), 0);
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
      const divisiMarketing = String(row["Divisi Marketing"] || "Unassigned").trim() || "Unassigned";
      const groupKey = view.showMarketingColumn ? `${divisiMarketing}|||${name}` : name;
      if (!name) return;
      if (!grouped.has(groupKey)) grouped.set(groupKey, { name, divisiMarketing, rows: [] });
      grouped.get(groupKey).rows.push(row);
      includedRows.push(row);
    });

    const { year, month } = periodParts(period);
    const totalTy = sumMonths(includedRows, year, 1, month);
    const totalLy = sumMonths(includedRows, year - 1, 1, month);

    const rows = Array.from(grouped.values()).map((group) => {
      const name = group.name;
      const sourceRows = group.rows;
      const targetKey = `${view.id}:${period}:${group.divisiMarketing}:${name}`;
      const ytdTy = sumMonths(sourceRows, year, 1, month);
      const ytdLy = sumMonths(sourceRows, year - 1, 1, month);
      const target = targets[targetKey] ?? Math.round(ytdTy * 1.12);
      const avgLy = month ? ytdLy / month : 0;
      const avgTy = month ? ytdTy / month : 0;
      const avgB01 = avgWindow(sourceRows, period, 0, 1);
      const avgB25 = avgWindow(sourceRows, period, 2, 5);
      const avgB02 = avgWindow(sourceRows, period, 0, 2);
      const avgB35 = avgWindow(sourceRows, period, 3, 5);
      const history2025 = MONTH_NAMES.map((_, index) => sumMonth(sourceRows, year - 1, index + 1));
      const actual2026 = MONTH_NAMES.map((_, index) => sumMonth(sourceRows, year, index + 1));

      return {
        name,
        divisiMarketing: group.divisiMarketing,
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
        history2025,
        actual2026,
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
      divisiMarketing: "TOTAL",
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
      history2025: MONTH_NAMES.map((_, index) => sumMonth(includedRows, year - 1, index + 1)),
      actual2026: MONTH_NAMES.map((_, index) => sumMonth(includedRows, year, index + 1)),
      total: true,
    };

    return { rows, total };
  }

  function getCellValue(row, key) {
    if (key.startsWith("history2025.")) return row.history2025[Number(key.split(".")[1])];
    if (key.startsWith("actual2026.")) return row.actual2026[Number(key.split(".")[1])];
    if (key === "actualYtd") return row.ytdTy;
    if (key === "ytdTyGrowth") return row.ytdTy;
    return row[key];
  }

  function sortRows(rows, sort) {
    if (!sort.key) return rows;
    return [...rows].sort((a, b) => {
      const aValue = getCellValue(a, sort.key);
      const bValue = getCellValue(b, sort.key);
      if (typeof aValue === "string" || typeof bValue === "string") {
        return sort.direction === "asc"
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }
      return sort.direction === "asc" ? numeric(aValue) - numeric(bValue) : numeric(bValue) - numeric(aValue);
    });
  }

  function buildTotalFromRows(rows, period) {
    const { year, month } = periodParts(period);
    const totalTarget = rows.reduce((sum, row) => sum + numeric(row.target), 0);
    const ytdTy = rows.reduce((sum, row) => sum + numeric(row.ytdTy), 0);
    const ytdLy = rows.reduce((sum, row) => sum + numeric(row.ytdLy), 0);
    const avgB01 = rows.reduce((sum, row) => sum + numeric(row.avgB01), 0);
    const avgB25 = rows.reduce((sum, row) => sum + numeric(row.avgB25), 0);
    const avgB02 = rows.reduce((sum, row) => sum + numeric(row.avgB02), 0);
    const avgB35 = rows.reduce((sum, row) => sum + numeric(row.avgB35), 0);
    return {
      name: "TOTAL",
      target: totalTarget,
      ytdTy,
      ach: pct(ytdTy, totalTarget),
      gapTarget: ytdTy - totalTarget,
      ytdLy,
      gapGrowthZero: ytdTy - ytdLy,
      avgLy: month ? ytdLy / month : 0,
      avgTy: month ? ytdTy / month : 0,
      avgB01,
      avgB25,
      avgB02,
      avgB35,
      growthYtd: pct(ytdTy - ytdLy, ytdLy),
      growth24: pct(avgB01 - avgB25, avgB25),
      growth33: pct(avgB02 - avgB35, avgB35),
      contLy: 1,
      contTy: 1,
      history2025: MONTH_NAMES.map((_, index) => rows.reduce((sum, row) => sum + numeric(row.history2025[index]), 0)),
      actual2026: MONTH_NAMES.map((_, index) => rows.reduce((sum, row) => sum + numeric(row.actual2026[index]), 0)),
      total: true,
    };
  }

  function getTableColumns(period, showHistory) {
    const month = Number(period.slice(4, 6));
    const year = Number(period.slice(0, 4));
    const columns = [
      { key: "target", label: `Target YTD ${monthLabel(period)}`, type: "number", editable: true },
      { key: "actualYtd", label: `Actual YTD ${monthLabel(period)}`, type: "number" },
      { key: "ach", label: "ACH (%)", type: "percent" },
      { key: "gapTarget", label: "Gap to Target", type: "number" },
      { key: "ytdLy", label: `YTD ${MONTH_NAMES[month - 1]} '${String(year - 1).slice(2)} (LY)`, type: "number" },
      { key: "ytdTyGrowth", label: `YTD ${MONTH_NAMES[month - 1]} '${String(year).slice(2)} (TY)`, type: "number" },
      { key: "gapGrowthZero", label: "Gap to GRW 0%", type: "number" },
      { key: "avgLy", label: `AVG YTD ${MONTH_NAMES[month - 1]} ${year - 1}`, type: "number" },
      { key: "avgTy", label: `AVG YTD ${MONTH_NAMES[month - 1]} ${year}`, type: "number" },
      { key: "avgB01", label: "AVG B0 - B1 (2)", type: "number" },
      { key: "avgB25", label: "AVG B2 - B5 (4)", type: "number" },
      { key: "avgB02", label: "AVG B0 - B2 (3)", type: "number" },
      { key: "avgB35", label: "AVG B3 - B5 (3)", type: "number" },
      { key: "growthYtd", label: "GRW YTD", type: "percent" },
      { key: "growth24", label: "GRW 2-4", type: "percent" },
      { key: "growth33", label: "GRW 3-3", type: "percent" },
      { key: "contLy", label: `CONT ${year - 1}`, type: "percent" },
      { key: "contTy", label: `CONT ${year}`, type: "percent" },
    ];

    if (showHistory) {
      MONTH_NAMES.forEach((name, index) => columns.push({ key: `history2025.${index}`, label: `${name} 2025`, type: "number", history: true }));
      MONTH_NAMES.forEach((name, index) => columns.push({ key: `actual2026.${index}`, label: `${name} 2026`, type: "number", history: true }));
    }

    return columns;
  }

  function App() {
    const [dataRows] = useState(() => EMBEDDED_ROWS);
    const [targets, setTargets] = useState(() => safeLoad(TARGET_KEY, {}));
    const [activeViewId, setActiveViewId] = useState("marketing");
    const [status] = useState(`${EMBEDDED_ROWS.length.toLocaleString("id-ID")} rows loaded from Sales F2.xlsx.`);
    const [period, setPeriod] = useState("202606");
    const [showHistory, setShowHistory] = useState(false);
    const [sort, setSort] = useState({ key: null, direction: "desc" });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [alertPeriod, setAlertPeriod] = useState(null);
    const pageSize = 11;

    useEffect(() => localStorage.setItem(TARGET_KEY, JSON.stringify(targets)), [targets]);

    const activeView = VIEW_CONFIG.find((view) => view.id === activeViewId);
    const { rows, total } = useMemo(() => {
      if (!period) return { rows: [], total: null };
      return buildRows(dataRows, activeView, period, targets);
    }, [dataRows, activeView, period, targets]);

    function updateTarget(key, value) {
      setTargets((current) => ({ ...current, [key]: numeric(value) }));
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filteredRows = useMemo(
      () =>
        normalizedSearch
          ? rows.filter((row) => `${row.divisiMarketing || ""} ${row.name}`.toLowerCase().includes(normalizedSearch))
          : rows,
      [rows, normalizedSearch]
    );
    const filteredTotal = useMemo(() => buildTotalFromRows(filteredRows, period), [filteredRows, period]);
    const summary = filteredTotal || {};
    const selectedLabel = period ? monthLabel(period) : "";
    const currentMonthActual = total ? total.actual2026[Number(period.slice(4, 6)) - 1] : 0;
    const sortedRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const displayRows = [...pagedRows, filteredTotal];
    const tableColumns = getTableColumns(period, showHistory);

    useEffect(() => {
      if (total && numeric(currentMonthActual) === 0) setAlertPeriod(period);
    }, [period, total, currentMonthActual]);

    useEffect(() => {
      setPage(1);
    }, [search, activeViewId, period, showHistory]);

    function onPeriodChange(value) {
      setPeriod(value);
    }

    function onSort(key) {
      setSort((current) => ({
        key,
        direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
      }));
    }

    function onPageInput(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      setPage(Math.min(totalPages, Math.max(1, parsed)));
    }

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
          React.createElement("p", { className: "subtitle" }, "Monitoring Target, Actual Sales, Achievement, Growth, Moving Average, dan Kontribusi Sales Pharos 2026")
        ),
        React.createElement(
          "div",
          { className: "actions" },
          React.createElement(
            "select",
            { value: period, onChange: (event) => onPeriodChange(event.target.value), "aria-label": "Select period" },
            PERIODS_2026.map((column) => React.createElement("option", { key: column, value: column }, monthLabel(column)))
          ),
          React.createElement(
            "label",
            { className: "toggle-control" },
            React.createElement("input", { type: "checkbox", checked: showHistory, onChange: (event) => setShowHistory(event.target.checked) }),
            React.createElement("span", null, "History Sales")
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
          { className: "table-tools" },
          React.createElement("input", {
            className: "search-input",
            value: search,
            onChange: (event) => setSearch(event.target.value),
            placeholder: "Search...",
            "aria-label": "Search table",
          }),
          React.createElement(
            "div",
            { className: "pager" },
            React.createElement("span", null, `${filteredRows.length.toLocaleString("id-ID")} Records`),
            React.createElement("button", { onClick: () => setPage((value) => Math.max(1, value - 1)), disabled: currentPage <= 1 }, "<"),
            React.createElement("span", null, "Page"),
            React.createElement("input", { value: currentPage, onChange: (event) => onPageInput(event.target.value), "aria-label": "Page number" }),
            React.createElement("span", null, `of ${totalPages.toLocaleString("id-ID")}`),
            React.createElement("button", { onClick: () => setPage((value) => Math.min(totalPages, value + 1)), disabled: currentPage >= totalPages }, ">")
          )
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
                activeView.showMarketingColumn &&
                  React.createElement(
                    "th",
                    { rowSpan: 2, className: "sticky-col divisi-col" },
                    React.createElement(SortButton, { column: { key: "divisiMarketing", label: "Divisi Marketing" }, sort, onSort })
                  ),
                React.createElement(
                  "th",
                  { rowSpan: 2, className: `sticky-col name-col ${activeView.showMarketingColumn ? "sticky-col-2" : ""}` },
                  React.createElement(SortButton, { column: { key: "name", label: activeView.label }, sort, onSort })
                ),
                React.createElement("th", { colSpan: 4, className: "group target-head" }, "To Target"),
                React.createElement("th", { colSpan: 3, className: "group growth-head" }, "Growth Per YTD"),
                React.createElement("th", { colSpan: 9, className: "group average-head" }, "Growth Per Average"),
                React.createElement("th", { colSpan: 2, className: "group cont-head" }, "Contribution"),
                showHistory && React.createElement("th", { colSpan: 12, className: "group history-head" }, "History Sales 2025"),
                showHistory && React.createElement("th", { colSpan: 12, className: "group actual-head" }, "Actual 2026")
              ),
              React.createElement(
                "tr",
                null,
                tableColumns.map((column) => React.createElement("th", { key: column.key, className: column.history ? "history-col" : "" }, React.createElement(SortButton, { column, sort, onSort })))
              )
            ),
            React.createElement(
              "tbody",
              null,
              displayRows.map((row) => React.createElement(DataRow, { key: row.total ? "total" : row.targetKey, row, columns: tableColumns, showMarketingColumn: activeView.showMarketingColumn, updateTarget }))
            )
          )
        )
      ),
      alertPeriod &&
        React.createElement(
          "div",
          { className: "modal-backdrop", role: "dialog", "aria-modal": "true" },
          React.createElement(
            "div",
            { className: "modal" },
            React.createElement("h2", null, "Sales Belum Tersedia"),
            React.createElement("p", null, `Sales bulan ${monthLabel(alertPeriod)} masih 0. Kemungkinan data belum ada atau belum closing.`),
            React.createElement("button", { onClick: () => setAlertPeriod(null) }, "OK")
          )
        )
    );
  }

  function SummaryCard({ label, value, tone }) {
    return React.createElement("article", { className: `summary-card ${tone || ""}` }, React.createElement("span", null, label), React.createElement("strong", null, value));
  }

  function SortButton({ column, sort, onSort }) {
    const active = sort.key === column.key;
    return React.createElement(
      "button",
      { className: `sort-button ${active ? "active" : ""}`, onClick: () => onSort(column.key), title: `Sort ${column.label}` },
      React.createElement("span", null, column.label),
      React.createElement("b", null, active ? (sort.direction === "asc" ? "ASC" : "DESC") : "SORT")
    );
  }

  function DataRow({ row, columns, showMarketingColumn, updateTarget }) {
    return React.createElement(
      "tr",
      { className: row.total ? "total-row" : "" },
      showMarketingColumn && React.createElement("td", { className: "sticky-col divisi-cell", title: row.divisiMarketing }, row.divisiMarketing),
      React.createElement("td", { className: `sticky-col name-cell ${showMarketingColumn ? "sticky-col-2" : ""}`, title: row.name }, row.total && showMarketingColumn ? "" : row.name),
      columns.map((column) => {
        const value = getCellValue(row, column.key);
        const tone = column.key === "ach" ? classify((value || 0) - 1) : column.type === "percent" || column.key.includes("gap") ? classify(value) : "";
        if (column.editable) {
          return React.createElement(
            "td",
            { key: column.key, className: "editable-cell" },
            row.total
              ? formatNumber(row.target)
              : React.createElement("input", { value: Math.round(row.target), onChange: (event) => updateTarget(row.targetKey, event.target.value), "aria-label": `Target for ${row.name}` })
          );
        }
        return React.createElement("td", { key: column.key, className: `${tone} ${column.history ? "history-col" : ""}` }, column.type === "percent" ? formatPct(value) : formatNumber(value));
      })
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
})();
