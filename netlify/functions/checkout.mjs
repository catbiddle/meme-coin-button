// Meme Coin checkout.
// The site sends the ids of the buttons in the buyer's stash. This function
// looks up the buttons in buttons.json and works out the prices here (so nobody can change a price from
// their browser), asks Square for one checkout page covering the whole order,
// and sends back the link to that page.
//
// It needs two settings in Netlify (Project configuration > Environment variables):
//   SQUARE_ACCESS_TOKEN  your Square access token (keep it secret)
//   SQUARE_LOCATION_ID   your Square location ID
// Optional: SQUARE_ENV = sandbox   to test with Square's fake-money sandbox.

const SHIPPING_CENTS = 150;
// Pricing: 1 button for $4, or $3 each when the order has 2 or more buttons
// (2 for $6, 3 for $9, and so on). A double card counts as 2 buttons, a triple as 3.
// Keep these the same as EACH and SOLO in site/index.html.
const EACH_CENTS = 300;
const SOLO_CENTS = 400;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use the Check out button on the shop page.' });

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token || !locationId) return json(500, { error: 'Checkout is not set up yet.' });

  let ids;
  try {
    ids = (await req.json()).ids;
  } catch {
    return json(400, { error: 'That order could not be read.' });
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every(Number.isInteger)) {
    return json(400, { error: 'Your stash is empty.' });
  }
  ids = [...new Set(ids)];

  // Load the current list of buttons from the live site.
  const origin = new URL(req.url).origin;
  let buttons;
  try {
    const res = await fetch(`${origin}/buttons.json`, { cache: 'no-store' });
    buttons = await res.json();
  } catch {
    return json(500, { error: 'The button list could not be loaded.' });
  }

  const picked = [];
  for (const id of ids) {
    const b = buttons.find((x) => x.id === id);
    if (!b) return json(400, { error: 'One of those buttons is no longer listed. Please refresh the page.' });
    if (b.sold) return json(409, { error: `Sorry, "${b.title}" has already sold. Please put it back and try again.` });
    picked.push(b);
  }

  const count = picked.reduce((n, b) => n + b.pics.length, 0);
  const cents = (b) => (count === 1 ? SOLO_CENTS : EACH_CENTS * b.pics.length);

  const base = process.env.SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  const body = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: locationId,
      line_items: picked.map((b) => ({
        name: `${b.title} (button #${b.id})`,
        quantity: '1',
        base_price_money: { amount: cents(b), currency: 'USD' },
      })),
    },
    checkout_options: {
      ask_for_shipping_address: true,
      redirect_url: `${origin}/?thanks=1`,
      shipping_fee: { name: 'Shipping', charge: { amount: SHIPPING_CENTS, currency: 'USD' } },
    },
  };

  let sq;
  try {
    const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    sq = await res.json();
    if (!res.ok || !sq.payment_link || !sq.payment_link.url) {
      console.error('Square error', res.status, JSON.stringify(sq.errors || sq));
      return json(502, { error: 'Square could not start the checkout.' });
    }
  } catch (e) {
    console.error('Square request failed', e);
    return json(502, { error: 'Square could not be reached.' });
  }

  return json(200, { url: sq.payment_link.url });
};
