# CLAUDE.md — CryptoXAF

Read this fully before writing code in this repo.

---

## What this is

A Cameroonian platform for swapping XAF and USDT over Mobile Money — both directions: **buy** (XAF → USDT) and **sell** (USDT → XAF). No accounts, no passwords, no signup — a session-based swap where the order reference is the identity. Two chains: USDT on Tron (TRC-20) and on BNB Smart Chain (BEP-20).

**Settlement is currently manual, both directions.** Buy: a human operator confirms the incoming MoMo payment in their own phone app, then sends the USDT by hand from a wallet and records the transaction hash. Sell: the operator confirms the incoming USDT deposit (system-assisted — see "Sell flow" below), then sends XAF by hand via MoMo and records the confirmation code. Automation comes later. Everything is built as though it were automated, with humans wired in as the executors.

Revenue is an FX spread plus a pass-through network fee.

---

## Stack

- **Frontend** — React + Vite + Tailwind, installable PWA via `vite-plugin-pwa`
- **Backend** — Node + Express
- **Database** — PostgreSQL + Prisma. **Not MongoDB.** This is a ledger and it needs real transactions, row-level locks, and unique constraints that make double-payout structurally impossible rather than merely unlikely.
- **Queue** — BullMQ + Redis for payout jobs
- **Chain** — `tronweb` for Tron, `ethers` v6 for BSC

---

## Money rules — non-negotiable

These are invariants. If a change would violate one, stop and raise it rather than working around it.

**Never use floating point for money.** XAF has no minor unit — store as `Int`. USDT is stored as `BigInt` in base units.

**USDT decimals differ by chain.** Tron TRC-20 USDT has **6 decimals**. Binance-Peg USDT on BSC has **18 decimals**. Hardcoding 6 everywhere and sending on BSC transfers a trillionth of the intended amount. Read decimals from a per-chain config constant, never inline a literal.

**`COMPLETED` is terminal, enforced by the database.** Not by a disabled button, not by a client-side check. A partial unique index or a state-transition constraint. The worst possible outcome in manual mode is a double-send from a double-tap on a slow connection.

**Every state transition happens inside a Postgres transaction** with the row locked. Read-modify-write on an order without a lock is a race condition waiting for your busiest day.

**Payouts are idempotent queued jobs.** Never executed inline in a request handler or a webhook handler. Every job carries an idempotency key derived from the order ID.

**Fail closed on pricing.** If the rate feed is unavailable, stale beyond its TTL, or returns an implausible value, refuse to quote. Show "rates updating." Never fall back to a cached or guessed rate.

**Clamp every quote.** Hard floor at cost plus minimum margin, hard ceiling at a configured percentage above market. A bug that quotes triple the market rate costs more than the order — it costs the trust the product is built on.

**Never trust a webhook payload.** When Campay is eventually integrated: verify the signature, then discard the body and re-query their API for the authoritative status. A webhook is an unauthenticated HTTP request from the open internet. Releasing funds because a POST body said `status: success` is how the hot wallet gets emptied.

---

## Order state machine

```
QUOTED → AWAITING_PAYMENT → PAYMENT_CLAIMED → PAYMENT_VERIFIED → COMPLETED
                ↓                   ↓
             EXPIRED           REFUND_DUE → REFUNDED
```

| State | Meaning | Who advances it |
|---|---|---|
| `QUOTED` | Rate locked, 15 minutes | System |
| `AWAITING_PAYMENT` | Reference issued, waiting on customer | Customer |
| `PAYMENT_CLAIMED` | Customer submitted a MoMo transaction ID | Customer |
| `PAYMENT_VERIFIED` | Operator confirmed it in their MoMo app | Operator |
| `COMPLETED` | USDT sent, tx hash recorded | Operator |
| `EXPIRED` | Quote lapsed before payment | System |
| `REFUND_DUE` | Verification failed, money owed back | Operator |
| `REFUNDED` | Refund sent and recorded | Operator |

`COMPLETED`, `EXPIRED` and `REFUNDED` are terminal. No transition out of them exists.

**Customer-facing names never expose these.** The UI says "waiting for your payment," "checking your payment," "USDT sent," "refund on the way." A person waiting reads `PAYMENT_CLAIMED` as evasion.

---

## Sell flow

USDT → XAF is a second, parallel state machine on the same `Order` model (a `direction` column, `BUY` or `SELL`), sharing the terminal states with buy:

```
QUOTED → AWAITING_DEPOSIT → DEPOSIT_CLAIMED → DEPOSIT_VERIFIED → COMPLETED
                ↓                    ↓
             EXPIRED            REFUND_DUE → REFUNDED
```

Reusing `PAYMENT_CLAIMED` etc. for a crypto deposit would read as evasive in a different way — an operator misreading what's actually pending. `COMPLETED` here means the MoMo payout was sent, not USDT.

**Chain is customer-*selected* for sell — the one deliberate exception to Address Validation's "chain is detected from the address, never selected by the user."** There's no customer address to detect a chain from at order creation; the customer is choosing which of the *platform's own* two fixed deposit addresses (admin-settings-configured, one per chain) to send USDT to. The address the customer *does* provide at creation (`destinationAddress`, still run through the same `validateDestinationAddress`) is their own wallet — a refund-safety-net only, used solely if the deposit is ever rejected. It is never a payout target for sell and the UI never implies otherwise.

**Deposit verification is system-assisted, not automated.** When the customer submits a tx hash, the admin panel runs a read-only on-chain lookup (`backend/src/chain/depositVerification.js`, same RPC clients as address validation — decodes the TRC-20/BEP-20 `Transfer` event, checks recipient and amount) and shows the operator what it found. The operator still clicks confirm or reject. This is the same category of work as `validateDestinationAddress` — reading the chain, not moving funds — and must stay that way; do not wire it to auto-transition an order.

**Screenshot is a valid alternative to a tx hash when claiming a deposit** (sell only — buy's MoMo transaction ID field is unaffected). At least one is required. A screenshot-only claim has nothing to look up on-chain — the operator's manual review of the image *is* the verification. Screenshots live on local disk (gitignored `backend/uploads/receipts/`, UUID-named — never the order reference), served **only** through an authenticated admin route. Never a public static mount, never named in a way that leaks which order it belongs to.

**Pricing mirrors buy, inverted:** `sell_quoted_rate = market_rate × (1 - sell_target_pct)`, same clamp discipline (`MIN_SELL_MARGIN_BPS`/`MAX_SELL_MARGIN_BPS` in `rateProvider.js`). Sell stays off — fails closed with `RateUnavailableError` — until an operator explicitly sets a sell margin *and* both deposit addresses in admin settings. No network fee is deducted from the XAF payout (the customer pays their own gas to deposit; there's no equivalent platform cost to pass through).

**`payoutReference`, not `payoutTxHash`.** Renamed for direction-neutral accuracy: buy stores a real on-chain hash there; sell stores a MoMo payout confirmation code, which is not a tx hash at all.

---

## Reviews

A buyer can rate+comment on their own **completed** swap, once — the review sits `PENDING` until an operator approves or rejects it from the admin queue. Nothing reaches the public list without a human in the loop.

**No rating-based auto-filtering.** A 1★ review goes through the exact same `PENDING → APPROVED/REJECTED` queue as a 5★ one. Silently hiding low ratings while claiming to show "reviews" is a dishonesty pattern — it's the same trust the pricing rules protect, applied to social proof instead of a rate.

**One review per order.** Enforced by a database constraint, not just a service-layer check — reviewing is tied to the reference the customer already holds (the same bearer-token trust model as order status/claim-payment), not a login.

**The public review list never includes the order reference.** It's a bearer token for that stranger's order lookup (see Security) — leaking it through an unrelated public endpoint defeats the point of it being one.

---

## Live activity ticker

The landing page's "recent activity" strip is **real, anonymized `COMPLETED` orders only.** The amount is bucketed (rounded to the nearest 5,000 XAF) so a line can never be matched back to one specific order's exact figure; nothing identifying — reference, address, MoMo number — is ever included.

**Never fabricated.** No placeholder names, no seeded/looping fake entries to make the platform look busier than it is. When there's no recent activity, the ticker **renders nothing** — not a loading skeleton, not an empty shell pretending there's data. Same principle as the copy rule below: no urgency the product hasn't earned.

---

## Provider abstraction

Both sides of the transaction sit behind an interface so automation is a swap, not a rewrite.

```
PaymentCollector   →  ManualMoMoCollector    | CampayCollector           (buy: collects XAF)
PayoutExecutor     →  ManualPayoutExecutor   | TronPayoutExecutor | BscPayoutExecutor   (buy: sends USDT)
DepositCollector   →  ManualDepositCollector | ...                       (sell: collects USDT — today, an operator-reviewed on-chain lookup, see "Sell flow")
MomoPayoutExecutor →  ManualMomoPayoutExecutor | CampayPayoutExecutor    (sell: sends XAF)
```

The state machine must never know which implementation is behind it. **Only the manual implementations exist right now.** Do not build the automated executors until explicitly asked — including "while we're here" or "for completeness."

---

## Address validation

Run server-side at order creation. Client-side checks are UX, not security.

**Chain is detected from the address, never selected by the user** — for buy. Sell has the one deliberate exception to this rule; see "Sell flow" above. The formats are mutually exclusive:

- Tron — Base58Check, starts with `T`, exactly 34 chars, Base58 alphabet (no `0`, `O`, `I`, `l`)
- EVM — `0x` plus exactly 40 hex chars

**Regex is not validation.** It checks shape, not correctness, and misses single-character typos that the checksums catch:

```js
tronWeb.isAddress(addr)          // decodes base58, verifies the 4-byte checksum
ethers.isAddress(addr)           // validates EIP-55 when mixed case
await provider.getCode(addr)     // anything but "0x" is a contract — reject
```

**A `0x` address is EVM, not necessarily BSC.** Identical format on Ethereum, Polygon, Arbitrum, Base. Sending BEP-20 USDT to an ERC-20-only exchange deposit address succeeds on-chain and is never credited. The UI requires explicit confirmation that the destination accepts USDT on BNB Smart Chain before a `0x` order can proceed.

**Block contract addresses outright**, including the USDT contracts themselves. Funds sent there are unrecoverable.

**Echo the first six and last six characters** back for the user to verify against their wallet. Defence against clipboard malware substituting a lookalike address.

---

## Pricing engine

Fixed costs and percentage margin are separate. Folding gas into a per-dollar spread makes small orders absurd and large orders unprofitable.

```
network_fee  = live gas cost in XAF + buffer     ← flat, per order
margin       = amount × target_pct               ← percentage
quoted_rate  = market_rate × (1 + target_pct)
```

**The network fee is deducted from the amount paid, not added on top.** What the customer types is exactly what leaves their MoMo.

Live inputs, cached 30–60s:

1. Binance P2P XAF/USDT street rate
2. TRX price and current energy unit price, or a live energy rental quote
3. BSC gas price and BNB price
4. **The recipient's USDT balance on the destination chain** — a zero balance means the ~65,000 energy path on Tron instead of ~32,000, roughly doubling cost. The same lookup that validates the address prices it.

Tron energy is **rented**, not burned. Burning TRX costs roughly 13–14 TRX per transfer to a fresh address; rental is typically 60–85% cheaper. Staking locks too much capital that should be USDT float.

---

## Design tokens

Source of truth is `docs/design-system.html`. Read the actual CSS values there rather than inferring from screenshots.

```css
--ink:   #0E1A16   /* body text, headings */
--vault: #1A5C48   /* primary actions, focus */
--live:  #3FD08F   /* live and confirmed states ONLY */
--paper: #EDEFEA   /* page ground */
--fee:   #8A5F10   /* costs and fees ONLY */
--fault: #A8382C   /* failures and refunds ONLY */
```

Live mint appears only when something is genuinely live or genuinely finished. Used decoratively it stops meaning anything, and the one moment it must land — payout confirmed — lands flat.

**Typography carries one rule.** Instrument Sans for interface and money, with `font-variant-numeric: tabular-nums` on every number. IBM Plex Mono for anything a machine reads back: wallet address, transaction hash, order reference, MoMo transaction ID. Never mix the roles.

**Mobile-first at 360px**, not 390. Tecno, Infinix and itel dominate this market. Then 430, 768, 1024. Dark mode is required, not optional — this is read at night on a phone.

**Motion and glow effects are hand-rolled in plain CSS/Tailwind, not a library.** The look draws on reactbits.dev (cursor-spotlight card glow, marquee scroll, gradient-blob backgrounds, scroll-reveal) but its heavier pieces — Aurora, Particles — pull in `three.js` + `@react-three/fiber`, a poor fit for the 360px-budget-Android target above. Reuse `frontend/src/components/effects/` (`SpotlightCard`, `Marquee`, `RevealOnScroll`, `GradientBlobs`) rather than reaching for an animation dependency; don't `npm install` one for "just this effect."

---

## UI copy

Sentence case. No exclamation marks. No emoji. No urgency the product hasn't earned.

Errors state what happened and what to do next. They never apologise and they are never vague. "That address isn't valid on BEP-20. Check it and try again." — not "Oops, something went wrong."

A control says exactly what happens when it's used, and keeps that name through the whole flow. The button that says "Send USDT" produces a confirmation that says "USDT sent."

Never promise speed the system can't control. Settlement is manual. The UI says "settles in 5–15 minutes" and names operating hours.

---

## Security

- Never log private keys, seed phrases, or full MoMo numbers
- `.env` is never committed; keys live in the host's secret store
- Admin routes behind real auth, rate-limited, with every action written to an append-only audit log carrying actor and timestamp
- Sanitise order references in logs — they're bearer tokens for order lookup
- Validate and clamp every numeric input server-side; never trust a client-supplied amount or rate

---

## Build order

1. Prisma schema and the order state machine with its guards and transitions — done
2. Admin queue and admin order detail — nothing can be settled without these — done
3. Swap screen, payment instructions, order status — done
4. How it works, closed state, device-local order history — done
5. Admin settings — done

All five are built. Since then, additively: reviews + admin moderation, the live activity ticker, an admin "notify me" queue, a landing page redesign (desktop layout, mobile app-shell nav), and the sell flow (USDT → XAF — see "Sell flow" above) with its own admin settings section and order-detail stage panels.

Automated payout remains explicitly out of scope until asked — sell's deposit verification is system-assisted (read-only chain lookup, operator confirms), not automated fund movement; see "Sell flow" for the distinction. Live pricing feeds (Binance P2P, gas oracles) are still manual-settings-driven, not yet live.

---

## Before you finish a task

- Does any state change happen outside a transaction with a lock?
- Is any money value held in a float?
- Are USDT decimals read from per-chain config rather than hardcoded?
- Can any path reach a terminal state twice?
- Does any user-facing string leak a state machine name?
- Does it work at 360px, in dark mode, with a visible keyboard focus ring?