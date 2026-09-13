// The Echelon Goods catalog - the ONE place to edit when a product
// changes. Add a color by adding an entry to that product's `colors`
// array (needs a `name`, a `hex` for the swatch dot, and an `image`
// path - drop the photo in assets/images/merch/ first). Add a size by
// adding a string to `sizes`. Change a photo by swapping the `image`
// path on that color. Nothing else in the shop needs to change.
//
// Prices are in cents (Stripe's native unit) to avoid float rounding
// bugs - $32.00 is 3200. api/shop/checkout.js requires this exact file
// (via a shared copy, see that file's header) so the price a customer
// is charged always matches what's shown on the page - never trust a
// price the browser sends back.
//
// Fulfillment note (not shown to customers): made to order through
// Luther's own print shop, ships in 5-7 business days. Local orders
// may be hand-delivered instead of shipped - that's decided per order,
// not something the storefront needs to know about.
// Defined as a plain const first (not `window.EFC_SHOP_CATALOG = [...]`
// directly) so this same file loads cleanly in both the browser and
// Node - `window` does not exist when api/shop/checkout.js requires
// this file on the server to look up authoritative prices.
const EFC_SHOP_CATALOG = [
  {
    id: "classic-tee",
    name: "Echelon Classic Tee",
    description: "Soft, breathable cotton tee with the small chest emblem. An everyday staple.",
    priceCents: 3200,
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "Black", hex: "#0d0d0c", image: "assets/images/merch/classic-tee-black.jpg" },
      { name: "Heather Grey", hex: "#9a9a9a", image: "assets/images/merch/classic-tee-heather-grey.jpg" },
    ],
  },
  {
    id: "cropped-tee",
    name: "Echelon Cropped Tee",
    description: "Fitted, cropped length with the full front lockup. Built for training or off-duty.",
    priceCents: 3000,
    sizes: ["S", "M", "L"],
    colors: [
      { name: "White", hex: "#ffffff", image: "assets/images/merch/cropped-tee-white.jpg" },
      { name: "Black", hex: "#0d0d0c", image: "assets/images/merch/cropped-tee-black.jpg" },
    ],
  },
  {
    id: "long-sleeve",
    name: "Echelon Long Sleeve Performance Tee",
    description: "Moisture-wicking long sleeve with the small chest emblem. Layer it or wear it alone.",
    priceCents: 4200,
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "Black", hex: "#0d0d0c", image: "assets/images/merch/long-sleeve-black.jpg" },
      { name: "White", hex: "#ffffff", image: "assets/images/merch/long-sleeve-white.jpg" },
    ],
  },
  {
    id: "pullover-hoodie",
    name: "Echelon Pullover Hoodie",
    description: "Heavyweight fleece, front pouch pocket, full front lockup and sleeve mark.",
    priceCents: 6400,
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Black", hex: "#0d0d0c", image: "assets/images/merch/pullover-hoodie-black.jpg" }],
  },
  {
    id: "quarter-zip",
    name: "Echelon Quarter-Zip Pullover",
    description: "Performance fabric quarter-zip with the small chest emblem and sleeve mark.",
    priceCents: 5600,
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Black", hex: "#0d0d0c", image: "assets/images/merch/quarter-zip-black.jpg" }],
  },
  {
    id: "performance-leggings",
    name: "Echelon Performance Leggings",
    description: "High-waist compression leggings with a side zip pocket and hip emblem.",
    priceCents: 5800,
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [{ name: "Black", hex: "#0d0d0c", image: "assets/images/merch/performance-leggings-black.jpg" }],
  },
];

if (typeof window !== "undefined") {
  window.EFC_SHOP_CATALOG = EFC_SHOP_CATALOG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = EFC_SHOP_CATALOG;
}
