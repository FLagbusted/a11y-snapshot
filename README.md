# a11y-snapshot

A small command-line scanner that checks the key pages of a Shopify store against the
automated WCAG 2.2 A/AA rules in [axe-core](https://github.com/dequelabs/axe-core) and
writes a plain-English HTML report a store owner can read.

For each store it:

- confirms the store runs on Shopify (public `/products.json` feed)
- scans the home page, `/collections/all`, one product page and the cart in headless Chromium
- looks for an accessibility statement at the usual paths and detects common overlay widgets
- groups the failures by rule, sorts them by severity, and explains who each one affects and how it is usually fixed in a Shopify theme
- writes `report.html` and `report.json` per store, plus a `summary.csv` for the whole batch

## Example

`demo-store/` holds a fictional storefront in two versions. The scanner reports
**29 failing elements across 10 issue types** on `before/` and **0** on `after/`.
The reports are in `demo-reports/`.

## Usage

```bash
npm install
npx playwright install chromium

node scan.js https://some-store.com https://another-store.com
node scan.js --file prospects.csv          # CSV with columns brand,url
BRAND="Demo" node scan.js --pages http://localhost:8765/before/index.html
./run.sh prospects.csv                     # install + scan + zip in one step
```

Environment variables: `OUT_DIR`, `PROVIDER_NAME`, `PROVIDER_EMAIL`, `CHROMIUM_PATH`, `BRAND`.

## Limits

Automated rules catch only part of WCAG failures. Keyboard flow, screen-reader flow,
checkout and content quality need manual testing. Reports are technical findings, not
legal advice or a compliance certificate. The scanner loads four public pages like a normal
browser: no crawling and no form submission.

## License

MIT
