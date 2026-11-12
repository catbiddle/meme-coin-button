// Square calls this address every time a payment changes. When a payment is
// completed, the buttons in that order are marked sold, so the shop page shows
// them as "Gone forever" without anyone editing buttons.json.
//
// It needs one setting in Netlify (Project configuration > Environment variables):
//   SQUARE_WEBHOOK_SIGNATURE_KEY  the "signature key" Square shows for the webhook
//
// The address below must be exactly the one typed into Square for the webhook.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const NOTIFICATION_URL = process.env.SQUARE_WEBHOOK_URL
  || 'https://memecoinbutton.com/.netlify/functions/square-webhook';

function fromSquare(raw, signature, key) {
  if (!signature || !key) return false;
  const expected = createHmac('sha256', key).update(NOTIFICATION_URL + raw).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('This address is for Square.', { status: 405 });

  const raw = await req.text();
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!fromSquare(raw, req.headers.get('x-square-hmacsha256-signature'), key)) {
    return new Response('Not from Square.', { status: 403 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return new Response('Unreadable.', { status: 400 }); }

  const payment = event && event.data && event.data.object && event.data.object.payment;
  if (!payment || payment.status !== 'COMPLETED' || !payment.order_id) {
    return new Response('Nothing to do.', { status: 200 });
  }

  // checkout.mjs saved which buttons belong to this Square order.
  const orders = getStore({ name: 'orders', consistency: 'strong' });
  const order = await orders.get(payment.order_id, { type: 'json' });
  if (!order || !Array.isArray(order.ids)) {
    console.log('Paid order with no saved buttons (not from the shop page?)', payment.order_id);
    return new Response('Unknown order.', { status: 200 });
  }

  const sold = getStore({ name: 'sold', consistency: 'strong' });
  for (const id of order.ids) {
    await sold.setJSON(String(id), { order: payment.order_id, at: new Date().toISOString() });
  }
  console.log('Marked sold:', order.ids.join(', '), 'for order', payment.order_id);
  return new Response('Marked sold.', { status: 200 });
};
