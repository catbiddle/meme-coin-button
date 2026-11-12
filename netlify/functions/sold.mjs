// Tells the shop page which buttons have sold through Square checkout.
// The list is kept in Netlify's storage (not in buttons.json), and the
// square-webhook function adds to it each time a payment goes through.
import { getStore } from '@netlify/blobs';

export default async () => {
  let sold = [];
  try {
    const store = getStore({ name: 'sold', consistency: 'strong' });
    const { blobs } = await store.list();
    sold = blobs.map((b) => Number(b.key)).filter(Number.isInteger);
  } catch (e) {
    console.error('Could not read the sold list', e);
  }
  return new Response(JSON.stringify({ sold }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
