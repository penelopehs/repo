# Sales Billing Calculator

A React + Vite application for enterprise billing and CRM workflows.

## What changed

- Added `vitest` for unit testing
- Added sample utility tests for `src/utils/format.ts`
- Added GitHub Actions CI workflow for lint/build/test/coverage
- Added a project `README.md`

## Local setup

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start Vite development server
- `npm run build` — build production assets
- `npm run preview` — preview production build locally
- `npm run lint` — run ESLint
- `npm run format` — run Prettier
- `npm run test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode
- `npm run coverage` — run tests with coverage report

## Notes

The repo now includes a GitHub Actions workflow at `.github/workflows/ci.yml` to validate changes on push and pull request to `main`.
