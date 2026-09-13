// Echelon Goods: a real, cart-enabled storefront. Products, prices,
// colors, sizes and photos all come from shop-catalog.js (loaded before
// this file) - edit that file, not this one, to change what's for sale.
//
// The cart lives in localStorage under EFC_CART_KEY so it survives a
// reload or a trip to another page. Checkout POSTs the cart's product
// IDs, colors, sizes and quantities to /api/shop/checkout, which looks
// up the real price server-side and builds the Stripe Checkout Session
// - the browser's cart is never a source of truth for price.

const EFC_CART_KEY = 'efc_shop_cart_v1';
const EFC_CART_ENDPOINT = 'api/shop/checkout';

function efcPic(src, alt, eager, imgClass) {
    const webp = src.replace(/\.(jpe?g|png)$/i, '.webp');
    const loading = eager ? '' : ' loading="lazy"';
    const cls = imgClass ? ` class="${imgClass}"` : '';
    return `<picture><source srcset="${webp}" type="image/webp"><img src="${src}" alt="${alt}"${loading}${cls}></picture>`;
}

function efcMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}

function efcLoadCart() {
    try {
        const raw = localStorage.getItem(EFC_CART_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function efcSaveCart(cart) {
    try {
        localStorage.setItem(EFC_CART_KEY, JSON.stringify(cart));
    } catch (_) {
        // Private browsing or a full quota - the cart just won't persist
        // across a reload, the shop itself still works this session.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const shop = document.getElementById('shop');
    const container = shop?.querySelector('.container');
    const catalog = window.EFC_SHOP_CATALOG;
    if (!container || !Array.isArray(catalog)) return;

    let cart = efcLoadCart();
    // Per-card UI state: which color/size is currently selected, keyed
    // by product id. Not persisted - only the cart itself is.
    const selection = new Map(catalog.map((p) => [p.id, { color: p.colors[0]?.name || null, size: null }]));

    // Mobile carousel autoplay state. carouselInteracted latches true
    // the first time the visitor touches, drags, or scrolls the
    // carousel themselves and never resets (short of a viewport resize
    // across the mobile breakpoint), so autoplay never fights a swipe
    // already in progress.
    let carouselAutoplayTimer = null;
    let carouselInteracted = false;

    function productCard(product) {
        const sel = selection.get(product.id);
        const activeColor = product.colors.find((c) => c.name === sel.color) || product.colors[0];
        const swatches = product.colors
            .map((c) => `<button type="button" class="shop-swatch${c.name === sel.color ? ' active' : ''}" style="background:${c.hex}" data-product="${product.id}" data-color="${c.name}" title="${c.name}" aria-label="${c.name}" aria-pressed="${c.name === sel.color}"></button>`)
            .join('');
        const sizes = product.sizes
            .map((s) => `<button type="button" class="shop-size${s === sel.size ? ' active' : ''}" data-product="${product.id}" data-size="${s}" aria-pressed="${s === sel.size}">${s}</button>`)
            .join('');
        return `<article class="shop-card" data-product-card="${product.id}">
            <div class="shop-card-image" data-product-image="${product.id}">
                <div class="shop-card-image-bg" style="background-image:url('${activeColor.image}')" aria-hidden="true"></div>
                <button type="button" class="shop-card-zoom" data-zoom-src="${activeColor.image}" data-zoom-alt="${product.name}, ${activeColor.name}" aria-label="Enlarge photo of ${product.name}, ${activeColor.name}">
                    ${efcPic(activeColor.image, `${product.name}, ${activeColor.name}`, false, 'shop-card-fg')}
                    <span class="shop-zoom-icon" aria-hidden="true">⤢</span>
                </button>
            </div>
            <div class="shop-card-info">
                <h4>${product.name}</h4>
                <p class="shop-card-desc">${product.description}</p>
                <p class="shop-card-price">${efcMoney(product.priceCents)}</p>
                <div class="shop-card-field">
                    <span class="shop-field-label">Color: <em data-color-label="${product.id}">${activeColor.name}</em></span>
                    <div class="shop-swatches" role="group" aria-label="Color">${swatches}</div>
                </div>
                <div class="shop-card-field">
                    <span class="shop-field-label">Size${sel.size ? '' : ' <em class="shop-field-required">(select one)</em>'}</span>
                    <div class="shop-sizes" role="group" aria-label="Size">${sizes}</div>
                </div>
                <button type="button" class="btn-secondary shop-add-btn" data-add-to-cart="${product.id}" ${sel.size ? '' : 'disabled'}>${sel.size ? 'ADD TO CART' : 'SELECT A SIZE'}</button>
            </div>
        </article>`;
    }

    const mobileCarouselQuery = window.matchMedia('(max-width:600px)');

    // On the mobile carousel, .shop-card is a full-width scroll-snap
    // slide - "current slide" is just whichever card's left edge sits
    // closest to the current scroll position.
    function carouselIndex(grid) {
        const cards = [...grid.querySelectorAll('.shop-card')];
        if (!cards.length) return 0;
        let closest = 0;
        let closestDist = Infinity;
        cards.forEach((card, i) => {
            const dist = Math.abs(card.offsetLeft - grid.scrollLeft);
            if (dist < closestDist) {
                closestDist = dist;
                closest = i;
            }
        });
        return closest;
    }

    function carouselGoTo(grid, index, smooth) {
        const cards = grid.querySelectorAll('.shop-card');
        if (!cards.length) return;
        const clamped = ((index % cards.length) + cards.length) % cards.length;
        grid.scrollTo({ left: cards[clamped].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    }

    function stopCarouselAutoplay() {
        if (carouselAutoplayTimer) {
            clearInterval(carouselAutoplayTimer);
            carouselAutoplayTimer = null;
        }
    }

    function startCarouselAutoplay() {
        stopCarouselAutoplay();
        if (!mobileCarouselQuery.matches || carouselInteracted) return;
        const grid = container.querySelector('.shop-grid');
        if (!grid) return;
        carouselAutoplayTimer = setInterval(() => {
            carouselGoTo(grid, carouselIndex(grid) + 1, true);
        }, 4500);
    }

    function markCarouselInteracted() {
        if (carouselInteracted) return;
        carouselInteracted = true;
        stopCarouselAutoplay();
    }

    function initializeShopCarousel() {
        const grid = container.querySelector('.shop-grid');
        if (!grid) return;
        // Any real touch, drag, or wheel input on the carousel means the
        // visitor is browsing on their own - autoplay stops for good so
        // it never fights a swipe already in progress.
        grid.addEventListener('touchstart', markCarouselInteracted, { passive: true });
        grid.addEventListener('pointerdown', markCarouselInteracted);
        grid.addEventListener('wheel', markCarouselInteracted, { passive: true });

        if (typeof mobileCarouselQuery.addEventListener === 'function') {
            mobileCarouselQuery.addEventListener('change', () => {
                carouselInteracted = false;
                startCarouselAutoplay();
            });
        }

        startCarouselAutoplay();
    }

    function renderGrid() {
        const grid = container.querySelector('.shop-grid');
        if (!grid) return;
        // A swatch or size change re-renders every card, which would
        // otherwise snap the mobile carousel back to slide one every
        // time - remember which slide was showing and restore it.
        const onMobile = mobileCarouselQuery.matches;
        const priorIndex = onMobile ? carouselIndex(grid) : 0;
        grid.innerHTML = catalog.map(productCard).join('');
        if (onMobile) carouselGoTo(grid, priorIndex, false);
    }

    function cartLine(item, index) {
        return `<li class="cart-line" data-cart-index="${index}">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-line-info">
                <p class="cart-line-name">${item.name}</p>
                <p class="cart-line-variant">${item.color} / ${item.size}</p>
                <div class="cart-line-qty">
                    <button type="button" data-qty-step="-1" data-cart-index="${index}" aria-label="Decrease quantity">-</button>
                    <span>${item.qty}</span>
                    <button type="button" data-qty-step="1" data-cart-index="${index}" aria-label="Increase quantity">+</button>
                </div>
            </div>
            <div class="cart-line-end">
                <p class="cart-line-total">${efcMoney(item.priceCents * item.qty)}</p>
                <button type="button" class="cart-line-remove" data-cart-remove="${index}" aria-label="Remove item">Remove</button>
            </div>
        </li>`;
    }

    function renderCart() {
        const countEl = document.getElementById('shop-cart-count');
        const listEl = document.getElementById('shop-cart-list');
        const subtotalEl = document.getElementById('shop-cart-subtotal');
        const emptyEl = document.getElementById('shop-cart-empty');
        const checkoutBtn = document.getElementById('shop-cart-checkout');
        const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
        if (countEl) countEl.textContent = String(totalQty);
        if (listEl) listEl.innerHTML = cart.map(cartLine).join('');
        if (emptyEl) emptyEl.hidden = cart.length > 0;
        if (listEl) listEl.hidden = cart.length === 0;
        const subtotal = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
        if (subtotalEl) subtotalEl.textContent = efcMoney(subtotal);
        if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
        efcSaveCart(cart);
    }

    function openLightbox(src, alt) {
        const overlay = document.getElementById('shop-lightbox-overlay');
        const modal = document.getElementById('shop-lightbox');
        const img = document.getElementById('shop-lightbox-img');
        if (!overlay || !modal || !img) return;
        img.src = src;
        img.alt = alt || '';
        overlay.classList.add('open');
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
        const overlay = document.getElementById('shop-lightbox-overlay');
        const modal = document.getElementById('shop-lightbox');
        if (overlay) overlay.classList.remove('open');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function openCart() {
        document.getElementById('shop-cart-drawer')?.classList.add('open');
        document.getElementById('shop-cart-overlay')?.classList.add('open');
    }

    function closeCart() {
        document.getElementById('shop-cart-drawer')?.classList.remove('open');
        document.getElementById('shop-cart-overlay')?.classList.remove('open');
    }

    // The cart drawer and its overlay are appended straight to <body>
    // rather than left inside .container. #shop has a scroll-reveal
    // class that applies a CSS transform, and a transform on any
    // ancestor turns it into the containing block for a
    // position:fixed descendant - the drawer would then be "fixed"
    // relative to that section instead of the viewport and render in
    // the wrong place.
    const cartHost = document.createElement('div');
    cartHost.innerHTML = '<div class="cart-overlay" id="shop-cart-overlay"></div><aside class="cart-drawer" id="shop-cart-drawer" aria-label="Shopping cart"><div class="cart-drawer-header"><h3>YOUR CART</h3><button type="button" class="cart-close" id="shop-cart-close" aria-label="Close cart">&times;</button></div><p class="cart-empty" id="shop-cart-empty">Your cart is empty.</p><ul class="cart-list" id="shop-cart-list" hidden></ul><div class="cart-drawer-footer"><div class="cart-subtotal-row"><span>Subtotal</span><span id="shop-cart-subtotal">$0.00</span></div><p class="cart-fine-print">Shipping calculated at checkout. Made to order and printed locally, ships in 5-7 business days.</p><button type="button" class="btn-primary cart-checkout-btn" id="shop-cart-checkout" disabled>CHECKOUT</button><p class="cart-error" id="shop-cart-error" hidden></p></div></aside>';
    while (cartHost.firstChild) document.body.appendChild(cartHost.firstChild);

    // Same reason as the cart drawer above: appended to <body>, not
    // .container, so the reveal-transform on #shop can't hijack its
    // position:fixed.
    const lightboxHost = document.createElement('div');
    lightboxHost.innerHTML = '<div class="lightbox-overlay" id="shop-lightbox-overlay"></div><div class="lightbox-modal" id="shop-lightbox" role="dialog" aria-modal="true" aria-label="Product photo" aria-hidden="true"><button type="button" class="lightbox-close" id="shop-lightbox-close" aria-label="Close">&times;</button><img id="shop-lightbox-img" src="" alt=""></div>';
    while (lightboxHost.firstChild) document.body.appendChild(lightboxHost.firstChild);

    container.innerHTML = `<div class="shop-showcase-heading"><span class="section-tag">ECHELON GOODS</span><h2 class="section-title">WEAR THE STANDARD.</h2><p>Purpose-built essentials and performance nutrition, organized around how you train, recover, and live.</p></div><div class="goods-tabs"><button class="goods-tab active" data-goods-view="apparel">ECHELON GOODS</button><button class="goods-tab" data-goods-view="nutrition">PERFORMANCE NUTRITION</button></div><section class="goods-panel active" data-goods-panel="apparel"><div class="shop-toolbar"><p class="shop-toolbar-note">Made to order and printed locally. Ships in 5-7 business days.</p><button type="button" class="cart-toggle" id="shop-cart-toggle">CART <span class="cart-count" id="shop-cart-count">0</span></button></div><div class="shop-carousel-wrap"><button type="button" class="shop-carousel-arrow shop-carousel-prev" data-carousel-nav="prev" aria-label="Previous product">‹</button><div class="shop-grid"></div><button type="button" class="shop-carousel-arrow shop-carousel-next" data-carousel-nav="next" aria-label="Next product">›</button></div></section><section class="goods-panel" data-goods-panel="nutrition"><div class="nutrition-showcase-intro"><span class="checkin-tag">AMWAY PERFORMANCE NUTRITION</span><h3>SUPPORT THE WORK.</h3><p>Selected products available through Echelon’s independent Amway distributor links. Review product details and use only as appropriate for your own goals and needs.</p></div><div class="nutrition-showcase-grid"><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_1.jpg", "XS Whey Protein", false)}<span>MUSCLE RECOVERY</span><h3>XS™ WHEY PROTEIN</h3><p>A protein option for members looking to support their daily nutrition routine.</p><a href="https://amway.com/share-link/tKb6jO81I" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_2.jpg", "XS Creatine Plus", false)}<span>POWER &amp; PERFORMANCE</span><h3>XS™ CREATINE+</h3><p>A performance-focused option for structured training and strength work.</p><a href="https://www.amway.com/en_US/XS™-Creatine%2B-p-128463" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card">${efcPic("assets/images/amway_prod_3.jpg", "XS Muscle Multiplier", false)}<span>TRAINING SUPPORT</span><h3>XS™ MUSCLE MULTIPLIER</h3><p>A nutrition option to explore alongside your training and recovery plan.</p><a href="https://www.amway.com/en_US/XS™-Muscle-Multiplier---Berry-Blast-p-126753?searchTerm=MUS" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article></div><div class="amway-showcase-disclaimer"><strong>Independent Distributor Disclaimer:</strong> Echelon Fitness Collective is an Independent Business Owner of Amway products. XS™, Nutrilite™, and Double X™ are registered trademarks of Amway Corp. Purchases are processed through official distributor links.</div></section>`;

    renderGrid();
    renderCart();
    initializeShopCarousel();

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

    container.querySelectorAll('[data-goods-view]').forEach(button => button.addEventListener('click', () => {
        const view = button.dataset.goodsView;
        container.querySelectorAll('[data-goods-view]').forEach(item => item.classList.toggle('active', item === button));
        container.querySelectorAll('[data-goods-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.goodsPanel === view));
    }));

    // Event delegation on the container: the grid re-renders whenever a
    // swatch or size changes, so listeners are bound once here rather
    // than re-attached after every render.
    // Bound to <body>, not .container: the cart drawer and overlay now
    // live outside .container (see the reveal-transform note above), so
    // a listener scoped to .container would miss every click inside them.
    document.body.addEventListener('click', (event) => {
        const carouselNav = event.target.closest('[data-carousel-nav]');
        if (carouselNav) {
            markCarouselInteracted();
            const grid = container.querySelector('.shop-grid');
            if (grid) carouselGoTo(grid, carouselIndex(grid) + (carouselNav.dataset.carouselNav === 'next' ? 1 : -1), true);
            return;
        }

        const zoomBtn = event.target.closest('[data-zoom-src]');
        if (zoomBtn) {
            openLightbox(zoomBtn.dataset.zoomSrc, zoomBtn.dataset.zoomAlt);
            return;
        }

        if (event.target.closest('#shop-lightbox-close') || event.target === document.getElementById('shop-lightbox-overlay')) {
            closeLightbox();
            return;
        }

        const swatchBtn = event.target.closest('[data-color]');
        if (swatchBtn) {
            const productId = swatchBtn.dataset.product;
            const sel = selection.get(productId);
            sel.color = swatchBtn.dataset.color;
            renderGrid();
            return;
        }

        const sizeBtn = event.target.closest('[data-size]');
        if (sizeBtn) {
            const productId = sizeBtn.dataset.product;
            const sel = selection.get(productId);
            sel.size = sizeBtn.dataset.size;
            renderGrid();
            return;
        }

        const addBtn = event.target.closest('[data-add-to-cart]');
        if (addBtn) {
            const productId = addBtn.dataset.addToCart;
            const product = catalog.find((p) => p.id === productId);
            const sel = selection.get(productId);
            if (!product || !sel.size) return;
            const color = product.colors.find((c) => c.name === sel.color) || product.colors[0];
            const existing = cart.find((item) => item.productId === productId && item.color === color.name && item.size === sel.size);
            if (existing) {
                existing.qty = Math.min(existing.qty + 1, 10);
            } else {
                cart.push({
                    productId,
                    name: product.name,
                    color: color.name,
                    size: sel.size,
                    priceCents: product.priceCents,
                    image: color.image,
                    qty: 1,
                });
            }
            renderCart();
            openCart();
            return;
        }

        if (event.target.closest('#shop-cart-toggle')) {
            openCart();
            return;
        }
        if (event.target.closest('#shop-cart-close') || event.target === document.getElementById('shop-cart-overlay')) {
            closeCart();
            return;
        }

        const qtyBtn = event.target.closest('[data-qty-step]');
        if (qtyBtn) {
            const index = Number(qtyBtn.dataset.cartIndex);
            const step = Number(qtyBtn.dataset.qtyStep);
            const item = cart[index];
            if (!item) return;
            item.qty = Math.max(1, Math.min(10, item.qty + step));
            renderCart();
            return;
        }

        const removeBtn = event.target.closest('[data-cart-remove]');
        if (removeBtn) {
            const index = Number(removeBtn.dataset.cartRemove);
            cart.splice(index, 1);
            renderCart();
            return;
        }

        if (event.target.closest('#shop-cart-checkout')) {
            const errorEl = document.getElementById('shop-cart-error');
            const checkoutBtn = document.getElementById('shop-cart-checkout');
            if (!cart.length || !checkoutBtn) return;
            if (errorEl) errorEl.hidden = true;
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = 'REDIRECTING…';
            fetch(EFC_CART_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map((item) => ({ productId: item.productId, color: item.color, size: item.size, qty: item.qty })),
                }),
            })
                .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
                .then(({ ok, data }) => {
                    if (ok && data && data.url) {
                        window.location.href = data.url;
                        return;
                    }
                    throw new Error((data && data.error) || 'We could not begin checkout. Please try again.');
                })
                .catch((error) => {
                    if (errorEl) {
                        errorEl.textContent = error.message || 'We could not begin checkout. Please try again.';
                        errorEl.hidden = false;
                    }
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = 'CHECKOUT';
                });
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeLightbox();
            closeCart();
        }
    });
});
