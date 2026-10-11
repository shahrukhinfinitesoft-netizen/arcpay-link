# Arc Microgrants submission draft

Do not submit until the public GitHub repository and a successful mainnet acceptance-test receipt are available. Replace the bracketed fields with verified evidence. This file is a draft, not confirmation of submission.

## Project name
ArcPay Link

## One-line description
Shareable USDC payment links with on-chain verified receipts on Arc.

## Live deployment
https://arcpay-link.faircalf64.chatgpt.site

## Public GitHub repository
https://github.com/shahrukhinfinitesoft-netizen/arcpay-link

## Public builder profile
https://github.com/shahrukhinfinitesoft-netizen

## What it does
ArcPay Link makes a small wallet-to-wallet payment feel like sharing a link. A user connects a receiving wallet, enters an amount and optional short note, then shares a payment link or QR code. The payer opens the link and approves a USDC payment on Arc mainnet. After the transaction is independently checked by the app's server, both parties see a PAID status and a shareable receipt containing the transaction details and explorer link.

## How it uses Arc
Payments settle directly between wallets using native USDC on Arc mainnet, chain ID 5042. USDC also pays gas. Every payment includes a reference committing to its unique invoice, recipient, amount and note. Server-side verification checks the mainnet transaction, exact amount, recipient, reference and successful receipt before recording payment. The app holds no funds and needs no custom settlement contract or token approval.

## Why I built it
A small payment should not require an invoice platform, a merchant account or a separate gas token. ArcPay Link focuses on a single useful flow for freelancers and individuals: request, share, pay and verify. The prototype demonstrates how Arc's native USDC model can support a simple payment experience with a visible transaction trail.

## Technical implementation
React and TypeScript UI; Vinext/Cloudflare Worker backend; Cloudflare D1 for immutable invoice details and shared payment state; EIP-1193 wallet integration; Arc JSON-RPC transaction verification; client-generated QR codes. The repository includes verification tests and a documented mainnet acceptance procedure.

## Mainnet evidence
- Receipt URL: [Add successful mainnet receipt URL]
- Transaction hash: [Add verified transaction hash]
- Explorer URL: [Add verified explorer URL]
- Tested amount: [Actual amount]
- Test date: [Actual date]

## Quick demo for reviewers
1. Open the live app and connect a standard receiving wallet.
2. Enter an amount and note, then create the link.
3. Open the shareable link using a different funded Arc wallet.
4. Review and approve the payment.
5. Watch the status change to PAID, then open the explorer and reverify the receipt.

Use the completed receipt above to inspect the result without making a payment.

## Current boundaries
Standard receiving wallets only; no refunds, bridge, subscriptions or merchant dashboard. A link is intended for one payer. Simultaneous payments from different sessions cannot be prevented atomically without a settlement contract. This is a focused prototype, not an audited payment processor.

## Eligibility checklist to complete truthfully
- Live mainnet acceptance test completed and receipt recorded.
- Public repository contains the deployed source and README.
- Work is yours or you have the right to submit it.
- Disclose any prior Circle/Arc funding; the program excludes work already funded by those programs.
- Submit once for this project; follow the application form's actual terms.
- Have an Arc wallet able to receive a grant and complete private verification if conditionally selected.

## Timing verified from the official program page
Submission closes 14 October 2026 at 23:59 ET, equivalent to 15 October 2026 at 08:59 Pakistan time. Reviews are rolling; decisions are due by 21 October. Twenty awards of 500 USDC are listed, subject to program adjustments. No award is guaranteed.
