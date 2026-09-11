// Replace this with your full Etsy storefront URL when it is ready.
// Leave blank to show a "notify me" state instead of a link to Etsy's generic homepage.
const EFC_ETSY_SHOP_URL = '';

function efcPic(src, alt, eager) {
    const webp = src.replace(/\.(jpe?g|png)$/i, '.webp');
    const loading = eager ? '' : ' loading="lazy"';
    return `<picture><source srcset="${webp}" type="image/webp"><img src="${src}" alt="${alt}"${loading}></picture>`;
}

// The real merch line, priced for a boutique training-brand catalog.
// Every image lives under assets/images/merch/ - drop the real photos
// in with these exact filenames and the carousel just picks them up,
// nothing else to change. Every card shows COMING SOON until
// EFC_ETSY_SHOP_URL above is filled in with the live storefront link.
const EFC_MERCH = [
    { image: 'assets/images/merch/echelon-cap.jpg', alt: 'Echelon classic cap, black, EC monogram', name: 'Echelon Classic Cap', colors: 'Black', price: '$28' },
    { image: 'assets/images/merch/echelon-visor.jpg', alt: 'Echelon performance visor, black, EC monogram', name: 'Echelon Performance Visor', colors: 'Black', price: '$22' },
    { image: 'assets/images/merch/echelon-tee-black.jpg', alt: 'Echelon classic tee, black', name: 'Echelon Classic Tee', colors: 'Black / White / Heather Grey', price: '$32' },
    { image: 'assets/images/merch/echelon-tank-black.jpg', alt: 'Echelon tank top, black', name: 'Echelon Tank Top', colors: 'Black', price: '$26' },
    { image: 'assets/images/merch/echelon-crop-white.jpg', alt: 'Echelon cropped tee, white', name: 'Echelon Cropped Tee', colors: 'White / Black', price: '$30' },
    { image: 'assets/images/merch/echelon-longsleeve-black.jpg', alt: 'Echelon long sleeve performance tee, black', name: 'Echelon Long Sleeve Performance Tee', colors: 'Black / White', price: '$42' },
    { image: 'assets/images/merch/echelon-quarterzip-black.jpg', alt: 'Echelon quarter-zip pullover, black', name: 'Echelon Quarter-Zip Pullover', colors: 'Black', price: '$56' },
    { image: 'assets/images/merch/echelon-hoodie-black.jpg', alt: 'Echelon pullover hoodie, black', name: 'Echelon Pullover Hoodie', colors: 'Black / White', price: '$64' },
    { image: 'assets/images/merch/echelon-leggings.jpg', alt: 'Echelon performance leggings, black', name: 'Echelon Performance Leggings', colors: 'Black', price: '$58' }
];

function merchCard(item) {
    return `<article class="merch-card"><div class="merch-card-image">${efcPic(item.image, item.alt, false)}<span class="merch-coming-soon">COMING SOON</span></div><div class="merch-card-info"><h4>${item.name}</h4><p class="merch-card-colors">${item.colors}</p><p class="merch-card-price">${item.price}</p></div></article>`;
}

document.addEventListener('DOMContentLoaded', () => {
    const shop = document.getElementById('shop');
    const container = shop?.querySelector('.container');
    if (!container) return;

    // Doubled so the CSS animation can loop seamlessly from 0 to -50%.
    const cards = EFC_MERCH.map(merchCard).join('');

    container.innerHTML = `<div class="shop-showcase-heading"><span class="section-tag">ECHELON GOODS</span><h2 class="section-title">WEAR THE STANDARD.</h2><p>Purpose-built essentials and performance nutrition, organized around how you train, recover, and live.</p></div><div class="goods-tabs"><button class="goods-tab active" data-goods-view="apparel">ECHELON GOODS</button><button class="goods-tab" data-goods-view="nutrition">PERFORMANCE NUTRITION</button></div><section class="goods-panel active" data-goods-panel="apparel"><div class="merch-marquee" aria-label="Echelon Goods, coming soon"><div class="merch-track">${cards}${cards}</div></div><div class="goods-launch"><div><span class="checkin-tag">ECHELON GOODS</span><h3>THE COLLECTION IS COMING.</h3><p>Performance-minded essentials for training, recovery, and the work beyond the session. Be the first to know when the shop goes live.</p></div><a data-etsy-link href="pages/waitlist.html" class="btn-primary">NOTIFY ME WHEN IT LAUNCHES →</a></div></section><section class="goods-panel" data-goods-panel="nutrition"><div class="nutrition-showcase-intro"><span class="checkin-tag">AMWAY PERFORMANCE NUTRITION</span><h3>SUPPORT THE WORK.</h3><p>Selected products available through Echelon’s independent Amway distributor links. Review product details and use only as appropriate for your own goals and needs.</p></div><div class="nutrition-showcase-grid"><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_1.jpg", "XS Whey Protein", false)}<span>MUSCLE RECOVERY</span><h3>XS™ WHEY PROTEIN</h3><p>A protein option for members looking to support their daily nutrition routine.</p><a href="https://amway.com/share-link/tKb6jO81I" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_2.jpg", "XS Creatine Plus", false)}<span>POWER &amp; PERFORMANCE</span><h3>XS™ CREATINE+</h3><p>A performance-focused option for structured training and strength work.</p><a href="https://www.amway.com/en_US/XS™-Creatine%2B-p-128463" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_3.jpg", "XS Muscle Multiplier", false)}<span>TRAINING SUPPORT</span><h3>XS™ MUSCLE MULTIPLIER</h3><p>A nutrition option to explore alongside your training and recovery plan.</p><a href="https://www.amway.com/en_US/XS™-Muscle-Multiplier---Berry-Blast-p-126753?searchTerm=MUS" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article></div><div class="amway-showcase-disclaimer"><strong>Independent Distributor Disclaimer:</strong> Echelon Fitness Collective is an Independent Business Owner of Amway products. XS™, Nutrilite™, and Double X™ are registered trademarks of Amway Corp. Purchases are processed through official distributor links.</div></section>`;

    const nutritionGrid = container.querySelector('.nutrition-showcase-grid');
    if (nutritionGrid) {
        const catalogLink = document.createElement('a');
        catalogLink.className = 'nutrition-catalog-link';
        catalogLink.href = 'https://amway.com/share-link/ClXesZdrf';
        catalogLink.target = '_blank';
        catalogLink.rel = 'noopener';
        catalogLink.textContent = 'VIEW FULL CATALOG →';
        nutritionGrid.after(catalogLink);
    }

    container.querySelectorAll('[data-etsy-link]').forEach(link => {
        if (EFC_ETSY_SHOP_URL.trim()) {
            link.href = EFC_ETSY_SHOP_URL.trim();
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = 'SHOP ON ETSY →';
        } else {
            link.href = 'pages/waitlist.html';
            link.removeAttribute('target');
            link.removeAttribute('rel');
            link.textContent = 'NOTIFY ME WHEN IT LAUNCHES →';
        }
    });

    container.querySelectorAll('[data-goods-view]').forEach(button => button.addEventListener('click', () => {
        const view = button.dataset.goodsView;
        container.querySelectorAll('[data-goods-view]').forEach(item => item.classList.toggle('active', item === button));
        container.querySelectorAll('[data-goods-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.goodsPanel === view));
    }));
});
