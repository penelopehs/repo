# Sales Billing CRM

Enterprise R&D tax credit and billing CRM built with React, Vite, and TanStack Router. Manage client pipelines, billing calculators, and document requests in a single workspace.

## Features

- **R&D Billing Calculator** — Multi-entity credit estimates and billing tables
- **Client Dashboard** — Lead pipeline, proposals, and engagement tracking
- **Document Requests** — Configure, review, and track client document workflows
- **Authentication-ready** — Client-side auth state with API service abstraction

## Tech Stack

- React 19 + TypeScript
- Vite 7
- TanStack Router & React Query
- Tailwind CSS 4 + shadcn/ui
- Zustand for client state

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 10+

## Installation

```bash
git clone <your-repo-url>
cd sales-billing-crm
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
npm run preview
```

Production assets are written to `dist/`.

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL for API requests | `/api` |

Only variables prefixed with `VITE_` are exposed to the browser. Never commit secrets to `.env`.

## Project Structure

```
src/
├── assets/       Static assets (images, icons)
├── components/   Reusable UI and feature components
├── hooks/        Custom React hooks
├── layouts/      App shell and layout wrappers
├── pages/        Route-level page components
├── routes/       TanStack Router file-based routes
├── services/     API and external service clients
├── store/        Zustand stores
├── types/        Shared TypeScript types
└── utils/        Helpers and formatters
```

## Deployment

### Vercel

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set build command to `npm run build` and output directory to `dist`.
4. Add environment variables from `.env.example` in the Vercel dashboard.

`vercel.json` includes SPA fallback rewrites for client-side routing.

### Netlify

1. Connect your GitHub repository in [Netlify](https://netlify.com).
2. Build command: `npm run build`
3. Publish directory: `dist`
4. `public/_redirects` handles SPA routing.

### GitHub Pages (static)

Build locally and deploy the `dist` folder. Ensure your host rewrites all routes to `index.html` for client-side routing.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## License

Private — all rights reserved unless otherwise specified.
