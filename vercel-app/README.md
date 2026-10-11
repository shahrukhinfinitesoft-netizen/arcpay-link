# Vercel deployment

This deployment serves the existing ArcPay Link interface on Next.js. The page, layout, wallet modules and styles are imported from the main source, so there is no second payment implementation. Only invoice API paths are rewritten to the existing Cloudflare Worker; its D1 database, Arc verification, payment links and receipts remain authoritative. Wallet account access and transaction approval remain entirely in MetaMask.

## Vercel project settings

- Live deployment: https://arcpay-link-xi39.vercel.app.
- GitHub repository: `shahrukhinfinitesoft-netizen/arcpay-link`, branch `main`.
- Framework: Next.js.
- Root directory: `vercel-app`.
- Enable **Include source files outside of the Root Directory in the Build Step**.
- Install command (also configured in `vercel.json`): `cd .. && pnpm install --frozen-lockfile`.
- Build command (also configured in `vercel.json`): `npm run build`.
- Output directory: Next.js default (`.next`).
- Node.js: 24.x.
- No additional API keys or environment variables are required.

The fixed upstream is declared in `next.config.mjs`. This deployment remains dependent on the original Worker and D1 database. It is not a migration of storage to Vercel.

## Local verification

After installing dependencies at the repository root:

```sh
cd vercel-app
node ../node_modules/next/dist/bin/next build --webpack
node ../node_modules/next/dist/bin/next start
```

This uses the production invoice API and database. Do not submit test transactions or create requests inadvertently. A new hosting domain does not establish security or resolve MetaMask's classification of the original site. Any wallet warning must still be investigated; do not bypass it.

Validation: Next.js 16.3.4 production build and local homepage check passed. The external invoice rewrite appears in the build routing manifest. Local live API proxy verification was blocked by the execution workspace DNS restrictions. The actual Vercel homepage and paid-receipt API subsequently passed HTTP checks, and the real 1 USDC receipt matched its recorded hash, sender, recipient and block. This is a read-only receipt check, not a new end-to-end wallet payment test.
