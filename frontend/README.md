# VulnChain Frontend

Modern React SPA for the VulnChain platform with dark cybersecurity theme.

## Setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. API requests are proxied to `http://localhost:4000`.

## Tech Stack

- **React 18** + **Vite** — Fast dev server and builds
- **Tailwind CSS** — Utility-first dark theme
- **Framer Motion** — Page transitions and animations
- **Recharts** — Analytics charts with dark theme
- **Lucide React** — Icon library
- **React Router v6** — Client-side routing

## Pages

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/app/dashboard` | Dashboard | Auth |
| `/app/cve` | CVE List | Auth |
| `/app/cve/new` | Submit CVE | CNA_MEMBER, RESEARCHER |
| `/app/cve/:id` | CVE Detail | Auth |
| `/app/governance` | Governance | Auth |
| `/app/governance/:id` | Proposal Detail | Auth |
| `/app/analytics` | Analytics | Auth |

## Build

```bash
npm run build   # Output in dist/
npm run preview # Preview production build
```
