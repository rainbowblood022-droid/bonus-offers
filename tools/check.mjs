// Checks the title parser against real Doctor of Credit titles. usage: node tools/check.mjs
import assert from 'node:assert/strict';
import { parseTitle, decode, merge } from './update.mjs';

const cases = [
  ['[MI, NV, TX, VA] InTouch Credit Union $100 Referral Bonus', { institution: 'InTouch Credit Union', value: 100, regions: ['MI', 'NV', 'TX', 'VA'], expired: false }],
  ['[ID only] Cap Ed Credit Union $200 Checking Bonus &#8211; No Direct Deposit Required', { institution: 'Cap Ed Credit Union', value: 200, regions: ['ID'], expired: false }],
  ['[IN, OH, MI] First Merchants Bank $300/$600 Checking Promotion', { institution: 'First Merchants Bank', value: 600, regions: ['IN', 'OH', 'MI'] }],
  ['[PA &#038; MD only] ACNB $1,000-$3,000 Business Checking bonus', { institution: 'ACNB', value: 3000, regions: ['PA', 'MD'] }],
  ['[GA, Select Counties] Robins Financial Credit Union $300 Checking Bonus', { institution: 'Robins Financial Credit Union', value: 300, regions: ['GA'] }],
  ['TradeStation: Deposit $5,000+ &#038; Earn $250 Bonus', { institution: 'TradeStation', value: 250, regions: [] }],
  ['E*Trade: Up To $6,000 Brokerage Bonus ($1k-$2M Required)', { institution: 'E*Trade', value: 6000, regions: [] }],
  ['[Expired] UBS Visa Infinite Card Review: 100,000 Signup Bonus + $495 Annual Fee Waived First Year', { institution: 'UBS Visa Infinite Card', expired: true }],
  ['[6% $150k Cap Added] X Money Review &#8211; 6% APY/$300 Bonus &#038; 3% Back On Debit Card Purchases', { institution: 'X Money', value: 300, expired: false, regions: [] }],
];
for (const [raw, want] of cases) {
  const got = parseTitle(decode(raw));
  const pick = { institution: got.institution, value: got.reward.value, regions: got.regions, expired: got.expired };
  for (const [k, v] of Object.entries(want)) assert.deepEqual(pick[k], v, `${raw}\n  ${k}: got ${JSON.stringify(pick[k])}`);
}
// merging keeps when an offer was first seen and drops ones not seen for 120 days
const base = { offers: [{ id: 'old', url: 'https://www.doctorofcredit.com/old/', published: '2026-01-01', last_seen: '2026-05-01' }], updated: {} };
const m = merge(base, 'bank', [{ title: '[TX] A Bank $100 Bonus', link: 'https://www.doctorofcredit.com/a/', date: '2026-10-30', guid: 'x' }], '2026-10-31');
assert.deepEqual(m.offers.map((o) => [o.id, o.regions, o.first_seen]), [['a', ['TX'], '2026-10-31']]);
assert.equal(merge(m, 'bank', [{ title: '[TX] A Bank $100 Bonus', link: 'https://www.doctorofcredit.com/a/', date: '2026-10-30', guid: 'x' }], '2026-11-02').offers[0].first_seen, '2026-10-31');
console.log(`ok: ${cases.length} titles, merge`);
