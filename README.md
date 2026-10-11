# ArcPay Link

A link. A payment. A verifiable receipt.

ArcPay Link is a small, non-custodial USDC payment-link app for Arc mainnet. A requester connects a receiving wallet, enters an amount and optional note, and shares a link or QR code. The payer reviews the amount, recipient and USDC network fee in their wallet. A server verifies the successful on-chain transaction before marking the shared record **PAID**.

**Live app:** https://arcpay-link.faircalf64.chatgpt.site

**Public source:** https://github.com/shahrukhinfinitesoft-netizen/arcpay-link

**Mainnet payment test: pending.** The app is deployed and backend checks pass, but no wallet-approved USDC transfer has been completed or claimed. The transaction hash and receipt will be added after that test.

## What is included

- Amount + short note → persistent payment link and locally generated QR code.
- Browser-wallet connection (EIP-1193; MetaMask desktop or mobile wallet browser).
- Arc mainnet network selection and native USDC payment.
- Exact integer amount handling; up to six decimal places in requests.
- Shared payment status stored in Cloudflare D1; polling every seven seconds.
- Receipts with payer, recipient, amount, transaction hash, block, timestamp, fee and explorer link.
- Server-side verification and a button to recheck receipts against the RPC.
- Recovery using a transaction hash if the browser closes or a wallet replaces the transaction.

No platform fee, custody, private keys, token approvals, custom payment contract, subscriptions or dashboard.

## Arc integration

| Setting | Value |
| --- | --- |
| Network | Arc mainnet |
| Chain ID | 5042 (`0x13b2`) |
| RPC | https://rpc.mainnet.arc.io |
| Explorer | https://explorer.arc.io |
| Payment and gas asset | Native USDC, 18-decimal raw values |
| Optional ERC-20 USDC interface | `0x3600000000000000000000000000000000000000`, 6 decimals; not used for these native sends |

USDC's native and ERC-20 interfaces represent the same balance. This app uses native `eth_sendTransaction` with an exact 18-decimal `value`. Native transfers allow a payment reference in the transaction input without requiring a new contract or token allowance. The receiving account must have no code; contract and delegated receiving wallets are rejected. Senders must support a direct EIP-1193 transaction.

Before sending, the server checks chain ID, receiving account code, balance and estimated gas. Gas pricing uses RPC data with a 20 Gwei minimum. The wallet remains the final approval surface.

### What makes a receipt verifiable?

Each immutable invoice gets a cryptographically random UUID. Its transaction input is:

```
0x41524350415901 || SHA256(JSON.stringify([
  "arcpay-link-v1", 5042, invoice.id,
  invoice.recipient.toLowerCase(), exactNativeWeiAmount, invoice.note
]))
```

The prefix encodes `ARCPAY` and version 1. The server only records PAID after checking the mainnet RPC's chain ID; transaction hash; exact recipient, amount and input; a distinct payer; successful receipt status; matching receipt and transaction block identifiers; and the canonical block hash and timestamp. Transaction hashes are unique in the database, and a conditional update prevents overwriting a paid invoice. The note is stored off-chain but committed to by the reference hash. An explorer independently exposes the actual transaction. Verification still trusts the configured RPC and the hosted application; this is not a trustless light client.

## Run and build

Requirements: Node.js 24 and pnpm (the exact package-manager version is in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

The app uses React, Vinext, TypeScript, a Cloudflare Worker and D1. It has a Sites-maintained Vite integration; the deployed environment supplies the `DB` binding. `.openai/hosting.json` declares it. Drizzle schema and committed migrations are in `db/` and `drizzle/`.

For a local Worker after building:

```sh
pnpm exec wrangler d1 migrations apply DB --local --config dist/server/wrangler.json
pnpm start
```

Local data is separate from production. `pnpm db:generate` creates a migration after schema changes. Hosted publication applies committed migrations through Sites. Deployment elsewhere requires configuring a Cloudflare account, D1 database, Worker assets and bindings; no Circle API key is required for this implementation. Do not put private keys or wallet seed phrases into this repository.

## Small mainnet acceptance test

1. Open the live app using a standard receiving wallet (wallet A).
2. Create a link for **0.01 USDC**, note `ArcPay Link mainnet acceptance test`.
3. Open the link in another browser or wallet session, using wallet B with enough Arc mainnet USDC for the amount and network fee.
4. Review recipient, amount and network. Approve the payment in wallet B yourself.
5. Verify that both views change to PAID. Open the explorer link and reverify the receipt.
6. Reload the link on another device. Confirm the receipt persists.
7. Save the receipt URL and transaction hash as evidence for the grant submission.

The app deliberately refuses self-payments; use two wallet addresses you control. Testnet tokens will not work. No test payment is claimed until an actual mainnet receipt is recorded.

## Scope and limitations

- This is a small payment-request prototype, not an audited payment processor.
- Share one request with one payer. Without a settlement contract, simultaneous payments from separate browser sessions cannot be prevented atomically. A second transfer can occur before either session sees the first receipt; the app records the first verified payment and does not issue automatic refunds.
- Normal retries on the same browser preserve the submitted hash and disable the pay button. A dropped/cancelled transaction must be checked in the wallet or explorer before resetting the attempt.
- A transaction sent outside this app without the exact reference cannot settle its invoice.
- Closing the payer browser immediately after submission may require reopening it or entering the transaction hash. There is no background chain indexer.
- Public links expose the amount, note, wallet addresses and receipt details. Do not include private information in notes. Receiving-wallet ownership is not authenticated by a signature; a link is not proof of a merchant's identity.
- There is no account, invoice listing, cancellation, automatic expiry, refund flow, fiat conversion, bridge or WalletConnect integration.
- Public RPC reliability and hosting availability are dependencies. A missing/failed receipt never counts as payment.
- Storage endpoints are unauthenticated and not intended for high-volume production use; rate limiting and stronger anti-abuse controls are needed before broad rollout.

## Verification performed during the build

- Official Arc/Circle network, USDC and grant documentation checked on 11 October 2026.
- Official RPC `eth_chainId` returned `0x13b2` (5042).
- Unit tests cover decimal precision, invalid input, reference binding, mismatched transactions, replay across links, self-payment and failed/inconsistent receipts.
- Mainnet end-to-end payment requires the builder's wallet approval. Record its evidence before submitting.

## Official references

- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
- [Submission portal](https://dorahacks.io/hackathon/arc-microgrants)
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees)
- [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## License

MIT. Independent project; not an official Circle or Arc product.

### Wallet connection and security

On mobile browsers without an injected wallet, Connect Wallet opens the same payment URL in MetaMask Mobile through its official dapp universal link. Desktop MetaMask extension support is unchanged. Compatible injected EIP-1193 wallets also work; there is no WalletConnect integration.

Connection first reads `eth_accounts`, then requests `eth_requestAccounts` only when necessary. Arc switching uses `eth_chainId`, `wallet_switchEthereumChain`, and `wallet_addEthereumChain` only when needed. Only the explicit Pay button invokes `eth_sendTransaction` for the reviewed invoice. No token approvals, permits, message signatures, seed phrases, or private keys are requested. Creating a link does not send a transaction.

**Verification pending:** the earlier reported MetaMask security warning is unresolved. Code review found none of the approval/signature calls above, but cannot establish the warning's cause or clear a wallet vendor's classification. Actual phone deep-link behavior and a real mainnet transfer still require device testing. Do not bypass a security warning to test this app.

RPC reads use the official primary mainnet endpoint and the official dRPC mainnet endpoint as a fallback. Each endpoint must return chain ID 5042 before its data is used. Failover never broadcasts transactions; the wallet remains responsible for the single explicit payment submission. Failed reads log only the endpoint, method, and transport error for diagnosis.
