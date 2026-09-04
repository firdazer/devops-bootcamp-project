# AWS Cost Calculator

A free, static AWS cost estimator. Pick services, choose sizing, get a monthly estimate — no signup.

- EC2 compute (30+ instance types, On-Demand / Reserved / Spot)
- S3 storage (Standard / Intelligent / Glacier)
- EBS volumes (gp3, gp2, io2, st1, sc1)
- RDS databases (MySQL/Postgres-family instance types, Multi-AZ)
- Data transfer out
- Free Tier detection
- Region + currency selectors (USD / MYR)
- Shareable links (encodes all settings in the URL)

## Stack

- Vite + vanilla JS (no framework)
- Static site → deployable to GitHub Pages, S3+CloudFront, or any static host
- Zero backend, zero database

## Getting started

```bash
cd aws-cost-calculator
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
```

## Deploy

Pushes to `main` trigger the GitHub Actions workflow (`.github/workflows/cost-calculator-pages.yml`),
which builds and publishes to GitHub Pages. Enable Pages in your repo:
Settings → Pages → Source: GitHub Actions.

The workflow watches the `aws-cost-calculator/` directory only.

## Monetization notes

- Placed the `#about` and `#disclaimer` sections for future AdSense placement between content blocks.
- Add your AWS affiliate/referral link in the hero "Start Calculating" or footer once approved.
- Optional: Google Analytics / Plausible tag can be added to `index.html`.

## Cost to run

$0 (GitHub Pages). No servers to manage.

## Note

Pricing is indicative on-demand list pricing embedded in `src/pricing-data.js` (retrieved 2026).
Always confirm with the [AWS pricing page](https://aws.amazon.com/pricing/) before committing.