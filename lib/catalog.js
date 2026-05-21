/**
 * Authoritative product definitions (prices MUST NOT come from the browser raw).
 */
function catalog() {
  const trainingTee = {
    name: 'Echelon Training Tee',
    /** Fixed USD amount when STRIPE_PRICE_TRAINING_TEE is not used */
    unitAmountCents: 2500,
    maxQty: 20,
    /**
     * Prefer a Stripe Dashboard Price ID once created (recommended for reconciliation).
     * Optional: omit to use Stripe Checkout dynamic price_data with unitAmountCents.
     */
    stripePriceId: process.env.STRIPE_PRICE_TRAINING_TEE?.trim() || '',
  };

  return {
    training_tee: trainingTee,
  };
}

module.exports = { catalog };
