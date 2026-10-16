# Money Hunter V1

A mobile-friendly, zero-spend opportunity monitor for Shahrukh. Reads official
public work feeds, scores fit, explains rejections, and queues candidates for
review. It never bids, submits, publishes, signs transactions or contacts people.
There are no paid AI API calls, subscriptions, databases or wallet keys.

## Actual setup status — 17 October 2026, Pakistan

- Superteam agent registered: **Shahrukh Money Hunter**, profile username
  `shahrukh-autonomous-74`.
- Agent API registration and authenticated discovery verified live.
- First scan: **32 unique listings, 0 shortlist candidates**. See
  [reports/latest.json](reports/latest.json) and [reports/first-scan.md](reports/first-scan.md).
- Code is on an isolated `money-hunter-v1` branch of the already connected
  `shahrukhinfinitesoft-netizen/arcpay-link` repository. This branch has its own
  complete project tree. Do not merge it into ArcPay's main branch.
- **Not deployed.** Vercel `POST /v11/projects` returned HTTP 403: the connected
  identity does not have permission to create this project. No project, running
  cron or live dashboard URL has been created. Deployment requires an authorized
  Vercel team connection. No CLI or CLI credentials were available for fallback.
- No opportunity entered. No money spent.

## What V1 does

1. Read Superteam's authenticated agent feed, including agent-only listings.
2. Cross-check the public feed; `HUMAN_ONLY` always fails eligibility.
3. Read TaskBounty, Taskmarket and MoltJobs public task feeds as fallback sources.
4. Score reward, difficulty, deadline, competition, skills, tools and likely
   submission quality. Every dimension and rejection is visible.
5. Show `REVIEW` candidates only after hard filters. A score is a heuristic,
   not a calibrated probability of winning. Unknown requirements remain checks.
6. Cache the latest scan using Vercel Runtime Cache for up to 48 hours. This is
   ephemeral, regional storage; a cache miss causes a fresh scan. No audit-history
   durability is promised. The key is project-prefixed for Hobby cache isolation.
7. Once deployed, scan daily at `0 5 * * *` (approximately 10–11am PKT on Hobby).
   Opening the dashboard triggers at most an hourly scan when cached data is old.

The runtime is a small Node.js scanner, not an unattended LLM worker. This keeps
V1 simple and avoids paid model calls. Actual submission production is a reviewed
working session with the assistant after a suitable opportunity exists. There is
no auto-application or automatic submission-generation capability in this build.

## Default filters

- Explicit agent eligibility required.
- Minimum $25 potential individual reward; a Superteam total prize pool is not
  silently treated as a single entrant's prize. For Taskmarket, net reward is an
  upper bound on the aggregate worker pool; splits may reduce actual payment.
- At least 24 hours remaining; no more than 30 existing entries.
- Up to 12 estimated working hours and at least $5/hour face-value reward before
  competition. Neither figure estimates expected earnings.
- No known entry fees, required deposits, paid pitches, staking, referrals,
  cold outreach, specialist hardware or advanced protocol/security work.
- Residence, payout route, required accounts, rights, exact entry costs, full
  brief and tools must be reviewed before work. Unknown means unverified.

These conservative thresholds can be edited in `lib/score.js`. Do not lower
eligibility or spending safeguards to force a shortlist. V1 cannot determine
every requirement from keywords; manual review is mandatory.

## Deploy on Vercel after access is available

Use a **new** project named `money-hunter-shahrukh`; do not alter ArcPay's project.
Deploy this branch's tree with Node.js 24, framework `Other`, install `npm ci`,
build `npm run build`, output directory `public`. If Git integration is enabled,
set this project's production branch to `money-hunter-v1` before production
deployment; importing the repository's default branch would select ArcPay.

Set encrypted server environment variables before deployment:

- `SUPERTEAM_API_KEY`: existing registered agent key, saved separately in the
  private setup file supplied to the owner. Do not register another agent.
- `CRON_SECRET`: randomly generated 32+ character secret, also in that file.

Use only a free plan/allowance. Do not add a credit card, upgrade, enable a paid
model, provision paid storage or buy credits without the owner's approval. Free
allowance compatibility does not guarantee unlimited usage. Verify actual plan
and limits before deploying.

After deployment, verify `/api/opportunities`, an unauthorized `/api/cron`
request returning 401, and one authorized cron call storing the scan. Verify
the schedule is active in Vercel. The owner can use the dashboard entirely from
a phone. There are no email/push notifications in V1.

## Local development and checks

```sh
npm ci
npm test
npm run build
# Set the two environment variables through your secure environment first.
npm run scan
npm run dev
```

Do not place real credentials in `.env.example`, source, reports or commits.
Secrets are server-only. Feed errors are displayed as unavailable, not zero work.
GET requests use a 12-second timeout; no write API is exposed by this monitor.
Scans use bounded pagination with explicit coverage notes and never fetch other
entrants' submissions for inspiration.

## Official references

- [Superteam agent instructions](https://superteam.fun/skill.md)
- [Superteam agent console](https://superteam.fun/earn/agents)
- [TaskBounty agent/payout rules](https://www.task-bounty.com/for-agents)
- [Taskmarket API](https://docs.taskmarket.dev/api/reference)
- [MoltJobs agent instructions](https://moltjobs.io/skill.md)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

A task listing, escrow reference, submission, acceptance and actual payout are
different stages. Report payment only with a confirmed payout receipt.
