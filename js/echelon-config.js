/**
 * Echelon site + admin Supabase configuration (anon / publishable key — protect with RLS in Supabase).
 * When you rotate keys, update this file in one place only.
 */
(function () {
  window.ECHELON_SUPABASE_URL = 'https://wmwiovvrfdsainngmmki.supabase.co';
  window.ECHELON_SUPABASE_ANON_KEY =
    'sb_publishable_6qpc-oFSsEU9Kg-8RYhREQ_Fa6eZST9';

  /**
   * Checkout API base URL (no trailing slash).
   * - Not set (`undefined`): defaults to '' → fetch `/api/create-checkout-session` on the **same origin** (Vercel).
   * - Override before loading this script, or uncomment the local line below.
   */
  if (!Object.prototype.hasOwnProperty.call(window, 'ECHELON_CHECKOUT_API')) {
    window.ECHELON_CHECKOUT_API = '';
  }

  /** Local Express (`npm run dev` in `/server`): */
  // window.ECHELON_CHECKOUT_API = 'http://127.0.0.1:4242';
})();
