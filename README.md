# CarbonCreditAudit — Frontend

Single-page Next.js frontend for the CarbonCreditAudit GenLayer Intelligent
Contract. No backend, no database: every displayed state is read live from
the contract on GenLayer Studio.

- Contract: [`0xa726dD7561504C142355434601333c49D8643e8F`](https://explorer-studio.genlayer.com/address/0xa726dD7561504C142355434601333c49D8643e8F)
- Chain: GenLayer Studio, chain ID 61999, RPC `https://studio.genlayer.com/api`
- Contract repo: https://github.com/wallechj/genlayer-carbon-credit-audit

## What it does

- **Verify (no wallet needed):** reads all projects and challenges from the
  contract on page load — claimed vs verified credits, vintage, methodology,
  registry/report links, and for each challenge the title, credits affected,
  claimed severity, verdict, ruled severity, ruling summary, the on-chain
  evidence note, and the challenger's evidence URL.
- **Rules:** the assessment rules in plain language (corroboration
  requirement, unretrievable registry, duplicate vs repeat-of-rejected,
  severity invariant, deterministic credit math, close/reopen).
- **Act (MetaMask on Studio 61999):** create a project, submit a challenge,
  assess a challenge, close/reopen a project. After each write the page
  shows the transaction hash, waits for FINALIZED, then re-reads the state.
  ACCEPTED is never presented as final.
- **Evidence:** links to the contract repo, the explorer page, test_flow.md,
  README.md, and the four fixture files.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Environment variables

Copy `.env.example` to `.env.local` if you want to change the defaults
(all values are public — there are no keys or secrets):

| Variable | Default |
| --- | --- |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | `https://studio.genlayer.com/api` |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | `61999` |
| `NEXT_PUBLIC_GENLAYER_CHAIN_NAME` | `GenLayer Studio` |
| `NEXT_PUBLIC_GENLAYER_SYMBOL` | `GEN` |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xa726dD7561504C142355434601333c49D8643e8F` |

## Wallet setup

Use MetaMask on the GenLayer Studio network (chain ID 61999, RPC
`https://studio.genlayer.com/api`). The Connect button switches to that
chain automatically and offers to add the network if it is missing.

## Verified on-chain state (read back 2026-11-18)

- 2 projects, 6 challenges.
- Project 0 "Delta Mangrove Restoration": claimed 10,000, verified 9,000,
  methodology VM0047, vintage 2024, status open.
- Project 1 "Phantom Forest Project": claimed 5,000, verified 5,000, dead
  registry URL, status open.
- Challenge 0: valid/critical — 1,000 credits double-counted (serials
  9001–10000 under both CM-2024-118 and CM-2023-077).
- Challenges 1–5: invalid, severity none (wrong-site additionality claim,
  vintage valid through 31 Dec 2030, duplicate of accepted challenge 0,
  repeat of rejected challenge 1 judged on its own grounding, dead
  registry).

## Files

- `app/page.tsx` — the single page (header, overview, verify, rules, act,
  evidence)
- `app/layout.tsx` — page shell and metadata
- `lib/carbonCreditAudit.ts` — genlayer-js bridge: all contract reads and
  writes, with `waitFinalized()` after every write
- `next.config.mjs`, `tsconfig.json` — Next.js / TypeScript config
- `.env.example` — public environment defaults
