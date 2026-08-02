# CLAUDE.md — CryptoXAF

Read this fully before writing code in this repo.

---

## What this is

A Cameroonian platform for swapping XAF and USDT over Mobile Money. No accounts, no passwords, no signup — a session-based swap where the order reference is the identity. Two chains: USDT on Tron (TRC-20) and on BNB Smart Chain (BEP-20).

**Settlement is currently manual.** A human operator confirms the incoming MoMo payment in their own phone app, then sends the USDT by hand from a wallet and records the transaction hash. Automation comes later. Everything is built as though it were automated, with humans wired in as the executors.

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

## Provider abstraction

Both sides of the transaction sit behind an interface so automation is a swap, not a rewrite.

```
PaymentCollector   →  ManualMoMoCollector    | CampayCollector
PayoutExecutor     →  ManualPayoutExecutor   | TronPayoutExecutor | BscPayoutExecutor
```

The state machine must never know which implementation is behind it. **Only the manual implementations exist right now.** Do not build the automated executors until explicitly asked — including "while we're here" or "for completeness."

---

## Address validation

Run server-side at order creation. Client-side checks are UX, not security.

**Chain is detected from the address, never selected by the user.** The formats are mutually exclusive:

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

1. Prisma schema and the order state machine with its guards and transitions
2. Admin queue and admin order detail — nothing can be settled without these
3. Swap screen, payment instructions, order status
4. How it works, closed state, device-local order history
5. Admin settings

Automated payout and the sell flow are explicitly out of scope until asked.

---

## Before you finish a task

- Does any state change happen outside a transaction with a lock?
- Is any money value held in a float?
- Are USDT decimals read from per-chain config rather than hardcoded?
- Can any path reach a terminal state twice?
- Does any user-facing string leak a state machine name?
- Does it work at 360px, in dark mode, with a visible keyboard focus ring?