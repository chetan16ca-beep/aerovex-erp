# Karnataka Bank direct account feed — Aerovex ERP

Status: **BANK APPROVAL REQUIRED — NOT LIVE** (20 November 2026).

## Confirmed and not confirmed
- Karnataka Bank publicly announced an upgraded third-party-capable API platform (2 December 2025).
- We have **not verified** a free public Account Statements API, individual/current-account eligibility, production API URL, token method, webhook service, or commercial terms.
- Never infer that an API platform announcement grants Aerovex account-level API access.
- Read-only scope only. No payment initiation, beneficiary creation, transfer authorization, or automated debits.

## Request from the bank
- Are direct **read-only Account Balance** and **Account Statement / Transaction** APIs offered to a proprietorship current-account holder?
- Is zero-cost access available? Ask for written setup, fixed/monthly and usage tariffs, and minimum balance conditions.
- Obtain official API/sandbox documentation, developer onboarding, consent and service agreement, authentication (OAuth2 / mTLS / IP allow-listing), production endpoints, rate limits, backfill window, bank timezone/date formats, revocation steps.
- Ask about intraday frequency, webhooks, and SFTP/secure statement delivery if free API unavailable.

## Production architecture (activate only after approval)
Bank read-only API or bank-approved secured statement feed
→ Supabase Edge Function (server-side only; bank key/certs held in secrets)
→ private bank transaction tables and audit trail
→ deterministic de-duplication and normalization
→ suggestions against existing Aerovex `db.receipts`, `db.payments`, `db.invoices`
→ human review/confirm
→ accounting entry ONLY after confirmation and audit log.

Do not call the bank from browser JavaScript, expose tokens in public GitHub, pass OTP in chat, or screen-scrape net banking.

## Bank transaction schema (design; do not create until auth reviewed)
- `bank_connection_id` / `masked_account` / `bank_transaction_id`
- `posted_at`, `value_date`, `direction` (credit/debit), `amount_minor`, `currency`
- `utr`, `narration`, `running_balance_minor` if supplied by bank
- `source` = authorized API, bank-delivered statement, or manually imported statement
- `verification` = bank-issued, preliminary alert, or user-imported; `raw_payload_digest`
- Unique key bank+account+transaction_id; if bank lacks stable IDs, use approved composite key plus collision review.
- Immutable ingestion/audit logs, retention limits, masked PII, restricted authenticated-owner access, no unauthenticated grants.

## Accounting safeguards
- Matching by UTR + amount + direction; invoice reference as secondary clue; duplicates and partial payments remain pending review.
- Do not auto-close an invoice by amount alone; prevent double posting and reverse/chargeback mistakes.
- Bank reconciliation and invoice balance are different from live bank balance.
- User sees explicit `Connected` only after a real authorized test fetch and reconciliation validation.
- Monitor expired tokens, sync delays, repeated records, and missing/changed bank data.

## Free fallback
Use Karnataka Bank KBL ONE Corporate Internet Banking statement export and the existing ERP **Bank CSV Match** tool (normalized CSV columns: `Date,Description,Type,Amount,UTR`).
The existing matcher is **review-only**, not a live feed.
A bank-originated transaction alert may support near-live *hints* if available, but is not authoritative bank statement data. Avoid accounting auto-posting based on alerts.
