# ArcPay Link

A link. A payment. A verifiable receipt.

ArcPay Link is a small, non-custodial USDC payment-link app for Arc mainnet. A requester connects a receiving wallet, enters an amount and optional note, and shares a link or QR code. The payer reviews the amount, recipient and USDC network fee in their wallet. A server verifies the successful on-chain transaction before marking the shared record **PAID**.

**Live app:** https://arcpay-link.faircalf64.chatgpt.site

**Public source:** https://github.com/shahrukhinfinitesoft-netizen/arcpay-link

**Real mainnet transfer verified:** 1 USDC, 11 October 2026, block 25436306. [Transaction](https://explorer.arc.io/tx/0x22e9bc8cd230ca45b87ea5b499c6c60c214e1dede88cc965da879a066bc85f6f), [receipt](https://arcpay-link.faircalf64.chatgpt.site/?pay=2a4a0181-1a67-4ce6-a642-c4b941994178).

Sender: `0xff4a2ff3d350ad0b13de2e736ee353748817edcc`. Recipient: `0x302fc334b6125af4025bc1fdfea409d1b975e0c0`. Successful receipt, exact amount/reference and canonical block were independently checked against Arc RPCs. The original mobile test required manually supplying the hash after a broken wallet handoff. Automatic discovery is now implemented; a full mobile retest remains pending. MetaMask's harmful-site warning is unresolved. **Not ready for submission.**

## What is included

- Amount + short note → persistent payment link and locally generated QR code.
- One payer action: **Pay with MetaMask**, using the desktop extension, MetaMask browser, or the official mobile relay connection.
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
2. Create a link for **0.10 USDC**, note `ArcPay Link mainnet acceptance test`.
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
- Open invoice pages trigger bounded server scans of native USDC Transfer logs, using persisted block checkpoints. Matching transactions undergo full receipt/reference verification before PAID. Scans resume every seven seconds while a page is open; there is no always-running indexer. Hash recovery remains available.
- Public links expose the amount, note, wallet addresses and receipt details. Do not include private information in notes. Receiving-wallet ownership is not authenticated by a signature; a link is not proof of a merchant's identity.
- There is no account, invoice listing, cancellation, automatic expiry, refund flow, fiat conversion, bridge or WalletConnect integration.
- Public RPC reliability and hosting availability are dependencies. A missing/failed receipt never counts as payment.
- Storage endpoints are unauthenticated and not intended for high-volume production use; rate limiting and stronger anti-abuse controls are needed before broad rollout.

## Verification performed during the build

- Official Arc/Circle network, USDC and grant documentation checked on 11 October 2026.
- Official RPC `eth_chainId` returned `0x13b2` (5042).
- Unit tests cover decimal precision, invalid input, reference binding, mismatched transactions, replay across links, self-payment and failed/inconsistent receipts.
- A real 1 USDC mainnet payment is recorded above. The complete automatic mobile flow still needs a retest after the security warning is resolved.

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

Payers open an ordinary payment URL or QR, review amount, note and recipient, and tap **Pay with MetaMask**. That one action handles account access, Arc switching, backend preparation and `eth_sendTransaction`; there is no separate Connect or in-app Review button. MetaMask is the final review and approval surface. Normal mobile browsers use the official `@metamask/connect-evm` relay so the request remains in the original browser. The desktop extension and MetaMask in-app browser use their injected provider. Creators can still connect their receiving wallet before creating a request.

Injected wallet connections read `eth_accounts` and request `eth_requestAccounts` only when necessary. For mobile relay connections, MetaMask Connect manages the wallet session internally as part of Pay; its EVM client includes Ethereum mainnet as a bootstrap permission alongside requested Arc, as documented by MetaMask. Arc switching uses `eth_chainId`, `wallet_switchEthereumChain`, and `wallet_addEthereumChain` only when needed. First-time wallet access and network prompts may still appear. Only the explicit Pay action requests a transaction. Account, chain, recipient, exact amount and invoice reference are checked before sending. No token approvals, permits, message signatures, seed phrases, or private keys are requested. SDK analytics are disabled. Creating a link does not send a transaction.

**Verification pending:** the earlier reported MetaMask security warning is unresolved. Code review found none of the approval/signature calls above, but cannot establish the warning's cause or clear a wallet vendor's classification. The real transfer is verified, but the repaired automatic status flow and mobile handoff still require device testing. Do not bypass a security warning to test this app.

RPC reads use the official primary mainnet endpoint and the official dRPC mainnet endpoint as a fallback. Each endpoint must return chain ID 5042 before its data is used. Failover never broadcasts transactions; the wallet remains responsible for the single explicit payment submission. Failed reads log only the endpoint, method, and transport error for diagnosis.

QR codes and copied links both open the ordinary payment page so details are visible before any wallet action. No payment is triggered by opening a URL. The app restores existing injected-wallet access with `eth_accounts` and handles late provider injection. Returning from MetaMask refreshes payment status; the submitted hash is persisted before independent backend verification. A cancelled wallet request is never automatically retried.

Payment preparation checks the native Arc USDC balance before gas estimation. Insufficient-funds RPC errors are reported as funding errors, rather than mislabeled network outages. USDC on other chains cannot pay an Arc invoice.

MetaMask integration references: [EVM quickstart](https://docs.metamask.io/metamask-connect/evm/quickstart/javascript/) and [EVM methods](https://docs.metamask.io/metamask-connect/evm/reference/methods/). No Infura API key is needed because the app supplies its Arc RPC URL.

Automatic discovery uses Arc native USDC Transfer events from `0xfffffffffffffffffffffffffffffffffffffffe` with 18-decimal values, recipient topics and a maximum 1,000-block range per scan. See [official indexing documentation](https://docs.arc.io/integrate/infrastructure/indexing-events). Matching amount alone cannot settle a request: its unique input reference and successful canonical receipt must also match.
