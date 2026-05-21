'use strict';

const Stripe = require('stripe');
const { catalog } = require('./catalog');

/**
 * @param {Array} rawItems
 * @param {string} stripeSecret
 * @param {string} frontEntryBase Absolute URL for the storefront entry (HTML), no trailing slash, no query
 * @returns {Promise<{ url: string | null | undefined; id: string }>}
 */
async function createStripeCheckoutSession(rawItems, stripeSecret, frontEntryBase) {
  const stripe = new Stripe(stripeSecret.trim());
  const map = catalog();

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const err = new Error('Cart is empty.');
    err.code = 'EMPTY';
    throw err;
  }

  const line_items = [];
  let metadataLines = '';

  for (const row of rawItems) {
    const sku = row && typeof row.sku === 'string' ? row.sku.trim() : '';
    const product = map[sku];
    if (!product) {
      const err = new Error(`Unsupported product SKU: "${sku}".`);
      err.code = 'SKU';
      throw err;
    }

    const qtyParsed = Number.parseInt(String(row.quantity ?? 1), 10);
    const quantity = Number.isFinite(qtyParsed)
      ? Math.min(Math.max(qtyParsed, 1), product.maxQty ?? 99)
      : 1;

    let customization = '';
    if (row.customization != null && typeof row.customization === 'string') {
      customization = row.customization.replace(/[<>&]/g, '').slice(0, 280);
    }

    const productName =
      customization.length > 0 ? `${product.name} — ${customization}` : product.name;

    if (product.stripePriceId && product.stripePriceId.startsWith('price_')) {
      line_items.push({ price: product.stripePriceId, quantity });
    } else {
      line_items.push({
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: product.unitAmountCents,
          product_data: {
            name: productName,
          },
        },
      });
    }

    metadataLines += `${quantity}× ${productName}; `;
  }

  const meta = metadataLines.slice(0, 500);
  const success_url = `${frontEntryBase}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${frontEntryBase}?checkout=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    metadata: { echelon_cart: meta },
    success_url,
    cancel_url,
  });

  return { url: session.url, id: session.id };
}

module.exports = { createStripeCheckoutSession };
