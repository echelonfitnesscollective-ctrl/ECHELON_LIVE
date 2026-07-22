// When your Etsy shop is ready, paste its full URL between the quotes below.
const EFC_ETSY_SHOP_URL = '';

document.addEventListener('DOMContentLoaded', () => {
    const shop = document.getElementById('shop');
    const container = shop?.querySelector('.container');
    if (!container) return;

    const collections = [
        { image: 'assets/images/BLACKECHELONTEE.jpg', alt: 'Echelon black training tee', number: '01', label: 'CORE COLLECTION', title: 'THE ECHELON TRAINING TEE', copy: 'A clean, performance-minded staple designed to move from training to everyday life without losing its edge.', details: 'BLACK / WHITE / GREY' },
        { image: 'assets/images/BLACKHOODIE.jpg', alt: 'Echelon black performance hoodie', number: '02', label: 'RECOVERY COLLECTION', title: 'THE PERFORMANCE HOODIE', copy: 'Heavyweight comfort for warm-ups, recovery, and the hours beyond the work.', details: 'BLACK / SIGNATURE MARK' },
        { image: 'assets/images/hat_blk_1.jpg', alt: 'Echelon black trucker cap', number: '03', label: 'FIELD COLLECTION', title: 'THE ECHELON TRAINING CAP', copy: 'An everyday finishing piece made for early sessions, long days, and a disciplined point of view.', details: 'BLACK / ADJUSTABLE FIT' }
    ];

    const slides = collections.map((item, index) => `<article class="collection-slide${index === 0 ? ' active' : ''}" data-collection-slide aria-hidden="${index === 0 ? 'false' : 'true'}"><div class="collection-visual"><img src="${item.image}" alt="${item.alt}"><span>DROP 01 / ${item.number}</span></div><div class="collection-copy"><span class="checkin-tag">${item.label}</span><h3>${item.title}</h3><p>${item.copy}</p><div class="goods-detail-row"><span>${item.details}</span><span>COMING TO ETSY</span></div></div></article>`).join('');
    const dots = collections.map((item, index) => `<button class="collection-dot${index === 0 ? ' active' : ''}" data-collection-dot="${index}" aria-label="Show ${item.title}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');

    container.innerHTML = `<div class="shop-showcase-heading"><span class="section-tag">ECHELON GOODS</span><h2 class="section-title">WEAR THE STANDARD.</h2><p>Purpose-built essentials and performance nutrition—organized around how you train, recover, and live.</p></div><div class="goods-tabs"><button class="goods-tab active" data-goods-view="apparel">ECHELON GOODS</button><button class="goods-tab" data-goods-view="nutrition">PERFORMANCE NUTRITION</button></div><section class="goods-panel active" data-goods-panel="apparel"><div class="collection-carousel" aria-label="Echelon Goods collections"><div class="collection-slides">${slides}</div><div class="collection-carousel-controls"><button type="button" class="collection-arrow" data-collection-previous aria-label="Previous collection">←</button><div class="collection-dots" aria-label="Choose a collection">${dots}</div><button type="button" class="collection-arrow" data-collection-next aria-label="Next collection">→</button></div></div><div class="goods-launch"><div><span class="checkin-tag">THE FIRST DROP</span><h3>ECHELON GOODS IS COMING TO ETSY.</h3><p>Join the waitlist for first access, product updates, and future limited releases.</p></div><a data-etsy-link href="pages/waitlist.html" class="btn-primary">GET DROP UPDATES →</a></div></section><section class="goods-panel" data-goods-panel="nutrition"><div class="nutrition-showcase-intro"><span class="checkin-tag">AMWAY PERFORMANCE NUTRITION</span><h3>SUPPORT THE WORK.</h3><p>Selected products available through Echelon’s independent Amway distributor links. Review product details and use only as appropriate for your own goals and needs.</p></div><div class="nutrition-showcase-grid"><article class="nutrition-showcase-card"><img src="assets/images/amway_prod_1.jpg" alt="XS Whey Protein"><span>MUSCLE RECOVERY</span><h3>XS™ WHEY PROTEIN</h3><p>A protein option for members looking to support their daily nutrition routine.</p><a href="https://amway.com/share-link/tKb6jO81I" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card"><img src="assets/images/amway_prod_2.jpg" alt="XS Creatine Plus"><span>POWER &amp; PERFORMANCE</span><h3>XS™ CREATINE+</h3><p>A performance-focused option for structured training and strength work.</p><a href="https://www.amway.com/en_US/XS™-Creatine%2B-p-128463" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article><article class="nutrition-showcase-card"><img src="assets/images/amway_prod_3.jpg" alt="XS Muscle Multiplier"><span>TRAINING SUPPORT</span><h3>XS™ MUSCLE MULTIPLIER</h3><p>A nutrition option to explore alongside your training and recovery plan.</p><a href="https://www.amway.com/en_US/XS™-Muscle-Multiplier---Berry-Blast-p-126753?searchTerm=MUS" target="_blank" rel="noopener" class="btn-secondary">VIEW PRODUCT →</a></article></div><div class="amway-showcase-disclaimer"><strong>Independent Distributor Disclaimer:</strong> Echelon Fitness Collective is an Independent Business Owner of Amway products. XS™, Nutrilite™, and Double X™ are registered trademarks of Amway Corp. Purchases are processed through official distributor links.</div></section>`;

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
            link.textContent = 'SHOP ON ETSY →';
        }
    });

    container.querySelectorAll('[data-goods-view]').forEach(button => button.addEventListener('click', () => {
        const view = button.dataset.goodsView;
        container.querySelectorAll('[data-goods-view]').forEach(item => item.classList.toggle('active', item === button));
        container.querySelectorAll('[data-goods-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.goodsPanel === view));
    }));

    const slidesElements = [...container.querySelectorAll('[data-collection-slide]')];
    const dotsElements = [...container.querySelectorAll('[data-collection-dot]')];
    let activeSlide = 0;
    let rotation;
    const showCollection = index => {
        activeSlide = (index + slidesElements.length) % slidesElements.length;
        slidesElements.forEach((slide, slideIndex) => {
            const active = slideIndex === activeSlide;
            slide.classList.toggle('active', active);
            slide.setAttribute('aria-hidden', String(!active));
        });
        dotsElements.forEach((dot, dotIndex) => {
            const active = dotIndex === activeSlide;
            dot.classList.toggle('active', active);
            dot.setAttribute('aria-current', String(active));
        });
    };
    const restartRotation = () => {
        window.clearInterval(rotation);
        rotation = window.setInterval(() => showCollection(activeSlide + 1), 6000);
    };
    container.querySelector('[data-collection-previous]')?.addEventListener('click', () => { showCollection(activeSlide - 1); restartRotation(); });
    container.querySelector('[data-collection-next]')?.addEventListener('click', () => { showCollection(activeSlide + 1); restartRotation(); });
    dotsElements.forEach((dot, index) => dot.addEventListener('click', () => { showCollection(index); restartRotation(); }));
    container.querySelector('.collection-carousel')?.addEventListener('mouseenter', () => window.clearInterval(rotation));
    container.querySelector('.collection-carousel')?.addEventListener('mouseleave', restartRotation);
    restartRotation();
});
