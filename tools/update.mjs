// Reads one Doctor of Credit category feed and merges its offers into offers.json.
//
// Titles only: bank or company, amount, the states an offer is limited to ("[MI, NV, TX, VA] ..."), and whether
// it has expired ("[Expired] ..."). The post's text is never stored; each offer links back to its post.
// One feed per run, in turn: the site asks for at least 10 minutes between requests (robots.txt Crawl-delay: 600),
// and the workflow runs hourly, so each category refreshes every 6 hours.
//
// usage: node tools/update.mjs [category-id]   (no id: the category for this hour; node 20+, no dependencies)
import fs from 'node:fs';

export const CATEGORIES = [
  { id: 'bank', name: 'Bank account bonuses', feed: 'bank-account-bonuses' },
  { id: 'credit_card', name: 'Credit card bonuses', feed: 'credit-cards/current-sign-up-bonuses' },
  { id: 'brokerage', name: 'Brokerage bonuses', feed: 'brokerage-bonuses' },
  { id: 'gift_card', name: 'Gift card deals', feed: 'gift-card-deals' },
  { id: 'debit_card', name: 'Debit card bonuses', feed: 'debit-cards' },
  { id: 'freebie', name: 'Free items', feed: 'freebies' },
];
const OUT = 'offers.json';
const UA = 'FinanceDesk-offers/1.0 (+https://github.com/rainbowblood022-droid/bonus-offers; personal bonus tracker, reads RSS only)';
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP'.split(' '));
// dropped after this long without showing up in its feed again (the feed only lists the latest posts)
const KEEP_DAYS = 120;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' };
export const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();

/** The facts in an offer's title. */
export function parseTitle(title) {
  const tags = [...title.matchAll(/\[([^\]]*)\]|\(([^)]*)\)/g)].map((m) => (m[1] ?? m[2]).trim());
  const expired = tags.some((t) => /^expired\b|\bexpired\]?$|^dead\b/i.test(t));
  // states: two-letter codes inside a bracket ("[MI, NV, TX, VA]", "[PA & MD only]", "[GA, Select Counties]")
  const regions = [...new Set(tags.filter((t) => !/expired/i.test(t)).flatMap((t) => t.split(/[^A-Za-z]+/)).filter((w) => w.length === 2 && w === w.toUpperCase() && STATES.has(w)))];
  const nationwide = tags.some((t) => /nationwide/i.test(t));
  // the title without its leading brackets ("[ID only] Cap Ed Credit Union $200 Checking Bonus")
  const clean = title.replace(/^(\s*[[(][^\])]*[\])]\s*)+/, '').trim();
  // amounts: "$1,000", "$300/$600", "$1,000-$3,000", "Up To $6,000": the largest; else points ("100,000 points").
  // A deposit or spend requirement isn't the reward: amounts next to "Bonus"/"Referral"/"Promotion" or after
  // "Up To" win when there are any ("Deposit $5,000+ & Earn $250 Bonus" -> 250).
  const all = [...clean.matchAll(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?\b/gi)];
  const named = all.filter((m) =>
    /^[\s\d$,/\-–k+]*(?:\w+\s+){0,2}(bonus|referral|promotion|promo|cash\s*back|statement\s*credit|gift\s*card)/i.test(clean.slice(m.index + m[0].length)) ||
    /up\s+to\s*$/i.test(clean.slice(0, m.index)));
  const dollars = (named.length ? named : all).map((m) => Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1));
  const points = [...clean.matchAll(/([\d,]{3,})\s*(?:bonus\s+)?(points|miles|pts)\b/gi)].map((m) => Number(m[1].replace(/,/g, '')));
  const reward = dollars.length ? { type: 'cash', value: Math.max(...dollars) } : points.length ? { type: 'points', value: Math.max(...points) } : { type: 'cash', value: null };
  // who: the words before the amount, a colon or a dash ("TradeStation: Deposit...", "InTouch Credit Union $100...")
  const institution = clean.split(/\s+(?:Up\s+To\s+)?\$|:|\s[–—-]\s|\s(?:Review|Get|Earn|Offers?)\b/i)[0].replace(/\s+/g, ' ').trim().slice(0, 80) || clean.slice(0, 80);
  return { institution, reward, regions: nationwide ? [] : regions, expired, title: clean };
}

/** The items of an RSS feed: title, link, date, id. */
export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const tag = (n) => decode(it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1] ?? '');
    return { title: tag('title'), link: tag('link'), date: new Date(tag('pubDate')).toISOString().slice(0, 10), guid: tag('guid') || tag('link') };
  });
}

/** offers.json with this feed's items merged in: new ones added, known ones refreshed, old ones dropped. */
export function merge(data, category, items, today) {
  const byUrl = new Map(data.offers.map((o) => [o.url, o]));
  for (const it of items) {
    if (!it.link.startsWith('https://www.doctorofcredit.com/')) continue;
    const p = parseTitle(it.title);
    const old = byUrl.get(it.link);
    byUrl.set(it.link, {
      id: old?.id ?? it.link.replace(/^https:\/\/www\.doctorofcredit\.com\//, '').replace(/\/+$/, '').slice(0, 120),
      category: old?.category ?? category,
      institution: p.institution,
      title: p.title,
      reward_type: p.reward.type,
      reward_value: p.reward.value,
      regions: p.regions,
      expired: p.expired,
      url: it.link,
      published: it.date,
      first_seen: old?.first_seen ?? today,
      last_seen: today,
    });
  }
  const cutoff = new Date(Date.parse(today) - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const offers = [...byUrl.values()].filter((o) => o.last_seen >= cutoff).sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
  return { ...data, offers, updated: { ...data.updated, [category]: today } };
}

async function main() {
  const id = process.argv[2] ?? CATEGORIES[new Date().getUTCHours() % CATEGORIES.length].id;
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`unknown category ${id}`);
  const res = await fetch(`https://www.doctorofcredit.com/category/${cat.feed}/feed/`, { headers: { 'user-agent': UA, accept: 'application/rss+xml' } });
  if (!res.ok) throw new Error(`${cat.feed}: HTTP ${res.status}`);
  const items = parseFeed(await res.text());
  const today = new Date().toISOString().slice(0, 10);
  const data = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
    : { schema_version: 1, source: 'Doctor of Credit (doctorofcredit.com), titles and links only', categories: CATEGORIES.map(({ id, name }) => ({ id, name })), updated: {}, offers: [] };
  const next = merge(data, cat.id, items, today);
  fs.writeFileSync(OUT, JSON.stringify(next, null, 1) + '\n');
  console.log(`${cat.id}: ${items.length} in the feed, ${next.offers.length} offers in all`);
}

// run as a script, not when imported by the tests
if (process.argv[1]?.endsWith('update.mjs')) await main();
