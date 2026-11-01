# bonus-offers

New bank, credit card, brokerage, gift card, debit card and freebie offers as one JSON file, for the Finance Desk
app (personal finance tracker). Updated automatically every hour by a GitHub Action.

**Source:** [Doctor of Credit](https://www.doctorofcredit.com) category RSS feeds. Only each post's **title and link**
are kept (no post text), plus facts read from the title: who offers it, the amount, the states it's limited to
(`[MI, NV, TX, VA] ...`) and whether it has expired. Always read the linked post and the bank's own terms before
applying. This repo isn't affiliated with Doctor of Credit.

## The file

`offers.json` (raw: `https://raw.githubusercontent.com/rainbowblood022-droid/bonus-offers/main/offers.json`):

```json
{
  "schema_version": 1,
  "categories": [{ "id": "bank", "name": "Bank account bonuses" }, ...],
  "updated": { "bank": "2026-10-31", ... },
  "offers": [{
    "id": "intouch-credit-union-100-referral-bonus",
    "category": "bank",
    "institution": "InTouch Credit Union",
    "title": "InTouch Credit Union $100 Referral Bonus",
    "reward_type": "cash", "reward_value": 100,
    "regions": ["MI", "NV", "TX", "VA"],
    "expired": false,
    "is_offer": true,
    "url": "https://www.doctorofcredit.com/...",
    "published": "2026-10-31", "first_seen": "2026-10-31", "last_seen": "2026-10-31"
  }]
}
```

- `regions`: postal codes the offer is limited to; empty = no limit in the title (nationwide or not stated).
- `is_offer`: false for news posts in a category feed (rates, launches, hacks) whose title names no reward.
- `reward_value`: the largest bonus amount in the title (points for points offers); null when the title has none.
- An offer is dropped 120 days after it last appeared in its feed.

## How it updates

`.github/workflows/update.yml` runs `tools/update.mjs` hourly, one category per run, so each category is read every
6 hours and the site gets one request an hour (its robots.txt asks for 10+ minutes between requests). No
dependencies, Node 20+.

```
node tools/check.mjs              # parser checks against real titles
node tools/update.mjs bank        # read one category now (bank, credit_card, brokerage, gift_card, debit_card, freebie)
```
