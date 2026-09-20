'use strict';

// Cart-to-Stripe bridge for the Echelon Goods shop. The browser only
// ever sends product id / color / size / quantity - never a price -
// and every price paid is looked up here from the same published
// shop_products rows the storefront renders from (Supabase, admin-
// managed from the Admin Console's SHOP tab), so a tampered request
// or a since-hidden product can only ever be rejected, never charged
// the wrong amount.
//
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.
async function fetchCatalog() {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/shop_products?select=slug,name,price_cents,sizes,colors&published=eq.true`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
  );
  if (!response.ok) return [];
  const rows = await response.json();
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: row.slug,
        name: row.name,
        priceCents: row.price_cents,
        sizes: Array.isArray(row.sizes) ? row.sizes : [],
        colors: Array.isArray(row.colors) ? row.colors : [],
      }))
    : [];
}

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_LINE_ITEMS = 20;
const MAX_QTY_PER_LINE = 10;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = inMemoryRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  inMemoryRateLimit.set(ip, entry);
  if (inMemoryRateLimit.size > 1000) {
    const cutoff = now - WINDOW_MS;
    for (const [key, value] of inMemoryRateLimit) if (value.windowStart < cutoff) inMemoryRateLimit.delete(key);
  }
  return entry.count > MAX_PER_WINDOW;
}

function publicSiteUrl() {
  return String(process.env.SITE_URL || 'https://www.echelonfitness.co').trim().replace(/\/$/, '');
}

// Validates one cart line against the catalog and returns the
// authoritative product/color/qty to charge, or null if it doesn't
// resolve to a real, currently-sellable combination.
function resolveLine(catalog, rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const product = catalog.find((p) => p.id === String(rawItem.productId || ''));
  if (!product) return null;
  const color = product.colors.find((c) => c.name === String(rawItem.color || ''));
  if (!color) return null;
  if (!product.sizes.includes(String(rawItem.size || ''))) return null;
  const qty = Math.floor(Number(rawItem.qty));
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return null;
  return { product, color, size: String(rawItem.size), qty };
}

module.exports = async function shopCheckout(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  const siteUrl = publicSiteUrl();
  res.setHeader('Access-Control-Allow-Origin', origin === siteUrl ? origin : siteUrl);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (origin && origin !== siteUrl) return res.status(403).json({ error: 'This checkout request was not accepted.' });

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Checkout is being prepared. Please try again shortly.' });
  }

  const rawItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (rawItems.length > MAX_LINE_ITEMS) return res.status(400).json({ error: 'Too many items in one order. Please split it into two orders.' });

  const catalog = await fetchCatalog();
  const lines = rawItems.map((rawItem) => resolveLine(catalog, rawItem));
  if (lines.some((line) => !line)) {
    return res.status(400).json({ error: 'One of the items in your cart is no longer available. Please refresh the shop and try again.' });
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${siteUrl}/pages/shop-success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}/index.html#shop`);
  params.set('billing_address_collection', 'required');
  params.set('shipping_address_collection[allowed_countries][0]', 'US');
  params.set('customer_creation', 'always');
  params.set('metadata[order_type]', 'shop');

  let amountTotal = 0;
  const summaryParts = [];
  lines.forEach((line, index) => {
    amountTotal += line.product.priceCents * line.qty;
    summaryParts.push(`${line.qty}x ${line.product.name} (${line.color.name}, ${line.size})`);
    params.set(`line_items[${index}][quantity]`, String(line.qty));
    params.set(`line_items[${index}][price_data][currency]`, 'usd');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(line.product.priceCents));
    params.set(`line_items[${index}][price_data][product_data][name]`, `${line.product.name} - ${line.color.name} / ${line.size}`);
    params.set(`line_items[${index}][price_data][product_data][images][0]`, `${siteUrl}/${line.product.colors.find((c) => c.name === line.color.name).image}`);
    params.set(`line_items[${index}][price_data][product_data][metadata][color]`, line.color.name);
    params.set(`line_items[${index}][price_data][product_data][metadata][size]`, line.size);
  });

  // Stripe caps metadata values at 500 characters; a full cart summary
  // that would run over is truncated here so the API call itself never
  // fails, the order remains fully visible line-by-line in the Stripe
  // dashboard regardless.
  let summary = summaryParts.join('; ');
  if (summary.length > 480) summary = `${summary.slice(0, 477)}...`;
  params.set('metadata[order_summary]', summary);
  params.set('metadata[amount_total]', String(amountTotal));

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url) {
      console.error('Stripe shop checkout creation failed', session && session.error && session.error.message || stripeResponse.status);
      return res.status(502).json({ error: 'We could not begin checkout. Please try again.' });
    }
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe shop checkout request failed', error && error.message);
    return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' });
  }
};
