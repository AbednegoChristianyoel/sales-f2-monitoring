# Sales F2 Monitoring Dashboard

Static React dashboard for monitoring Sales F2 performance by Marketing Team, Sales Team, Group Brand, and Prodesc.

## Features

- Excel upload for `.xlsx` or `.xls` sales database updates.
- Period selector based on monthly columns like `202606`.
- Switchable monitoring tabs:
  - Marketing Team maps to `Divisi Marketing`
  - Sales Team maps to `DIVISI`
  - Group Brand maps to `Group Brand`
  - Prodesc maps to `Prodesc`
- Summary cards for Target, Actual, Achievement, Gap to Target, and Growth YTD.
- Table calculations for target achievement, YTD TY/LY, growth gap, moving averages, growth per average, and contribution.
- Editable targets saved in browser localStorage.

## Data Format

The upload expects a sheet like `Sales F2.xlsx`:

- Dimension columns: `Divisi Marketing`, `DIVISI`, `Group Brand`, `Prodesc`
- Monthly sales columns: `YYYYMM`, for example `202501`, `202502`, `202606`

Targets are not present in the sample workbook, so targets are edited directly in the dashboard.

## Run Locally

Open `index.html` in a browser. No backend is required.

## Free Deployment Options

This app is static, so it can be deployed for free on GitHub Pages, Netlify, Cloudflare Pages, or Vercel. GitHub Pages is the simplest when the code is in a GitHub repository: upload these files, then enable Pages from the repository settings.
