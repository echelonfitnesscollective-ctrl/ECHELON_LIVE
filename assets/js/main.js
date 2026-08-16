// ========================================
// ECHELON FITNESS COLLECTIVE
// MAIN JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    installLaunchBasics();
    installSharedFooter();
    configureContactInquiryFromLink();
    initializePhilosophyToggle();
    initializeMobileMenu();
    initializeSmoothScroll();
    initializeRevealAnimations();

});

function initializePhilosophyToggle() {
    const toggle = document.querySelector('.philosophy-toggle');
    const panel = document.querySelector('.philosophy-expand');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.lastElementChild.textContent = isOpen ? '−' : '+';
    });
}

function installLaunchBasics() {
    if (!document.querySelector('link[href*="mobile.css"]')) {
        const mobileStyles = document.createElement('link');
        mobileStyles.rel = 'stylesheet';
        mobileStyles.media = '(max-width: 600px)';
        const stylePath = window.location.pathname.includes('/pages/') ? '../assets/css/mobile.css' : 'assets/css/mobile.css';
        mobileStyles.href = stylePath;
        document.head.append(mobileStyles);
    }
    if (!document.querySelector('link[rel="icon"]')) {
        const icon = document.createElement('link');
        icon.rel = 'icon'; icon.type = 'image/png';
        icon.href = '/assets/images/favicon.png?v=8';
        document.head.append(icon);
    }
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
        link.rel = 'noopener noreferrer';
    });
    document.querySelectorAll('img:not([alt])').forEach((image) => {
        const filename = image.src.split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
        image.alt = filename ? `${filename} · Echelon Fitness Collective` : 'Echelon Fitness Collective';
    });
}

function installSharedFooter() {
    const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `
        <div class="container">
            <div class="footer-brand">
                <h2>ECHELON <span>FITNESS COLLECTIVE</span></h2>
                <p class="footer-tagline">Building Strength Through Structure.</p>
                <div class="footer-socials"><a href="https://www.instagram.com/EchelonFitness.co" target="_blank" rel="noopener">INSTAGRAM</a><a href="https://tr.ee/pO3gLtovXy" target="_blank" rel="noopener">TIKTOK</a></div>
            </div>
            <div class="footer-links-row"><a href="${prefix}index.html">HOME</a><a href="${prefix}index.html#about">ABOUT</a><a href="${prefix}index.html#training">TRAINING</a><a href="${prefix}index.html#resources">RESOURCES</a><a href="${prefix}index.html#shop">SHOP</a><a href="${prefix}index.html#contact">CONTACT</a></div>
            <div class="footer-opportunities" aria-label="Work with Echelon"><span>WORK WITH ECHELON</span><a href="${prefix}index.html?inquiry=sponsor#contact">APPLY TO BE A SPONSOR</a><a href="${prefix}index.html?inquiry=coach#contact">APPLY TO COACH</a></div>
            <div class="footer-actions"><a href="${prefix}pages/member-login.html" class="btn-primary">MEMBER PORTAL</a><a href="${prefix}pages/admin-login.html" class="btn-secondary">ADMIN PORTAL</a></div>
        </div>
        <div class="footer-partners"><span class="footer-partners-title">TRUSTED PARTNERS</span><div class="footer-partner-grid"><span class="partner-logo"><picture><source srcset="${prefix}assets/images/Cashmir.webp" type="image/webp"><img src="${prefix}assets/images/Cashmir.jpg" alt="Cashmir" loading="lazy"></picture></span><a href="https://intentrev.net" target="_blank" rel="noopener" class="partner-logo"><img src="${prefix}assets/images/intent-logo-i1.svg" alt="Intent Revenue" loading="lazy"></a><span class="partner-logo"><picture><source srcset="${prefix}assets/images/Official CentralShine logo.webp" type="image/webp"><img src="${prefix}assets/images/Official CentralShine logo.PNG" alt="Central Shine" loading="lazy"></picture></span><a href="#" class="partner-logo"><picture><source srcset="${prefix}assets/images/VL-Logo.webp" type="image/webp"><img src="${prefix}assets/images/VL-Logo.png" alt="VL Body Lab" loading="lazy"></picture></a></div></div>
        <div class="footer-bottom"><p>© 2026 Echelon Fitness Collective. All Rights Reserved.</p><div class="footer-legal"><a href="${prefix}pages/privacy.html">Privacy Policy</a><a href="${prefix}pages/terms.html">Terms &amp; Conditions</a><a href="${prefix}pages/disclaimer.html">Disclaimer</a></div></div>
        <div class="footer-credit-wrap"><a href="https://intentrev.net" target="_blank" rel="noopener" class="footer-credit"><img src="${prefix}assets/images/intent-logo-i1.svg" alt="Intent" loading="lazy"><span>Designed with <strong>INTENT</strong></span></a></div>`;
    const existing = document.querySelector('footer.footer');
    if (existing) existing.replaceWith(footer);
    else document.body.append(footer);
}

function configureContactInquiryFromLink() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const inquiry = new URLSearchParams(window.location.search).get('inquiry');
    const presets = {
        sponsor: {
            type: 'Sponsorship / Brand Partnership',
            message: 'I am interested in exploring a sponsorship or brand partnership with Echelon Fitness Collective.'
        },
        coach: {
            type: 'Coach Application',
            message: 'I am interested in applying to coach with Echelon Fitness Collective. I would love to share my background and availability.'
        }
    };
    const preset = presets[inquiry];
    if (!preset) return;

    const inquirySelect = form.querySelector('[name="inquiry_type"]');
    const message = form.querySelector('[name="message"]');
    if (inquirySelect) inquirySelect.value = preset.type;
    if (message && !message.value) message.value = preset.message;

    window.setTimeout(() => form.querySelector('[name="name"]')?.focus(), 450);
}

function showEchelonSuccess(target, title, message, options = {}) {
    if (!target) return;
    target.className = 'submission-confirmation';
    target.replaceChildren();
    const mark = document.createElement('span'); mark.className = 'submission-confirmation-mark'; mark.textContent = '✓';
    const heading = document.createElement('h2'); heading.textContent = title;
    const copy = document.createElement('p'); copy.textContent = message;
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'submission-confirmation-dismiss';
    dismiss.textContent = options.dismissLabel || 'DONE';
    dismiss.addEventListener('click', () => {
        target.hidden = true;
        target.style.display = 'none';
        target.className = 'form-success';
        target.replaceChildren();
        if (typeof options.onDismiss === 'function') return options.onDismiss();
        (options.form || target.closest('form'))?.reset();
    });
    target.append(mark, heading, copy, dismiss);
    target.hidden = false;
    target.style.display = 'block';
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ========================================
// MOBILE MENU
// ========================================

function initializeMobileMenu() {

    const toggle = document.querySelector(".mobile-toggle");
    let menu = document.querySelector(".mobile-menu");

    if (!toggle) return;

    if (!menu) {
        const links = [...document.querySelectorAll('.desktop-nav a')]
            .map((link) => `<a href="${link.href}">${link.textContent}</a>`).join('');
        if (!links) return;
        menu = document.createElement('nav');
        menu.className = 'mobile-menu';
        menu.setAttribute('aria-label', 'Mobile navigation');
        menu.innerHTML = links;
        document.body.append(menu);
    }

    toggle.addEventListener("click", () => {

        menu.classList.toggle("active");

        if (menu.classList.contains("active")) {
            toggle.innerHTML = "✕";
        } else {
            toggle.innerHTML = "☰";
        }

    });

    menu.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            menu.classList.remove("active");
            toggle.innerHTML = "☰";

        });

    });

}

// ========================================
// SMOOTH SCROLL
// ========================================

function initializeSmoothScroll() {

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {

        anchor.addEventListener("click", function (e) {

            const targetId = this.getAttribute("href");

            if (!targetId || targetId === "#") return;

            const target = document.querySelector(targetId);

            if (!target) return;

            e.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });

}

// ========================================
// REVEAL ANIMATIONS
// ========================================

function initializeRevealAnimations() {

    const sections = document.querySelectorAll(
        ".section, .card, .card-link"
    );

    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                entry.target.classList.add("reveal-active");

            }

        });

    }, {
        threshold: 0.15
    });

    sections.forEach(section => {

        section.classList.add("reveal");

        observer.observe(section);

    });

}

// ========================================
// GENERIC GOOGLE FORM SUBMISSION
// ========================================

async function submitGoogleForm(formId, successId) {

    const form = document.getElementById(formId);
    const success = document.getElementById(successId);

    if (!form || !success) return;

    const button = form.querySelector("button[type='submit']");

    try {

        button.disabled = true;
        button.textContent = "Submitting...";

        await fetch(form.action, {
            method: "POST",
            mode: "no-cors",
            body: new FormData(form)
        });

        form.style.display = "none";
        success.style.display = "block";

    } catch (error) {

        console.error(error);

        alert(
            "Submission failed. Please try again."
        );

        button.disabled = false;
        button.textContent = "Submit";

    }

}

// ========================================
// FUTURE CART SYSTEM PLACEHOLDER
// ========================================

const cart = {

    items: [],

    add(product) {

        this.items.push(product);

        console.log("Added:", product);

    },

    remove(index) {

        this.items.splice(index, 1);

    }

};

// ========================================
// FUTURE MEMBER PORTAL PLACEHOLDER
// ========================================

const memberPortal = {

    login() {

        console.log("Portal Login");

    },

    logout() {

        console.log("Portal Logout");

    }

};
window.addEventListener("load", () => {

    const carousel = document.getElementById("trainingCarousel");
    const startCard = document.getElementById("startingCard");

    if (!carousel || !startCard) return;

    carousel.scrollLeft =
        startCard.offsetLeft -
        carousel.offsetLeft;

});


function changeProductImage(imageId, newImage, dot){

    const image =
        document.getElementById(imageId);

    image.src = newImage;

    const dots =
        dot.parentElement.querySelectorAll('.image-dot');

    dots.forEach(d =>
        d.classList.remove('active')
    );

    dot.classList.add('active');
}


function switchShopTab(section){

    const tabs =
    document.querySelectorAll('.shop-tab');

    const content =
    document.querySelectorAll('.shop-content');

    tabs.forEach(tab =>
    tab.classList.remove('active'));

    content.forEach(item =>
    item.classList.remove('active-content'));

    if(section === 'apparel'){

        tabs[0].classList.add('active');

        document
        .getElementById('apparel-section')
        .classList.add('active-content');
    }

    if(section === 'nutrition'){

        tabs[1].classList.add('active');

        document
        .getElementById('nutrition-section')
        .classList.add('active-content');
    }
}




(function() {
    'use strict';

    const trainingHub = document.getElementById('training');
    if (!trainingHub) return;

    const initRevealAnimations = () => {
        const revealElements = trainingHub.querySelectorAll('.training-reveal');

        if (!('IntersectionObserver' in window)) {
            revealElements.forEach(el => el.classList.add('training-reveal-active'));
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.1
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('training-reveal-active');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealElements.forEach(el => revealObserver.observe(el));
    };

    const initAccordions = () => {
        const triggers = trainingHub.querySelectorAll('.training-accordion-trigger');

        triggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                const panelId = trigger.getAttribute('aria-controls');
                const panel = trainingHub.querySelector(`#${panelId}`);

                if (!panel) return;

                if (isExpanded) {
                    trigger.setAttribute('aria-expanded', 'false');
                    panel.style.maxHeight = '0px';
                    panel.style.opacity = '0';

                    setTimeout(() => {
                        if (trigger.getAttribute('aria-expanded') === 'false') {
                            panel.setAttribute('hidden', '');
                        }
                    }, 400);
                } else {
                    trigger.setAttribute('aria-expanded', 'true');
                    panel.removeAttribute('hidden');

                    void panel.offsetWidth;

                    panel.style.maxHeight = panel.scrollHeight + 'px';
                    panel.style.opacity = '1';
                }
            });
        });

        window.addEventListener('resize', () => {
            const openPanels = trainingHub.querySelectorAll('.training-accordion-trigger[aria-expanded="true"]');
            openPanels.forEach(trigger => {
                const panelId = trigger.getAttribute('aria-controls');
                const panel = trainingHub.querySelector(`#${panelId}`);
                if (panel) {
                    panel.style.maxHeight = 'none';
                    const newHeight = panel.scrollHeight;
                    panel.style.maxHeight = newHeight + 'px';
                }
            });
        });
    };

    const initSmoothScrolling = () => {
        const links = trainingHub.querySelectorAll('a[href^="#"]');

        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');

                if (targetId === '#') return;

                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    };

    const init = () => {
        initRevealAnimations();
        initAccordions();
        initSmoothScrolling();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();



document.addEventListener('DOMContentLoaded', () => {

    // TAB SWITCHING
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if(targetContent) targetContent.classList.add('active');
        });
    });

    // ACCORDION LOGIC
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            if(!body) return; // Safety check

            const isOpen = body.style.display === 'block';
            body.style.display = isOpen ? 'none' : 'block';
            header.querySelector('span').textContent = isOpen ? '+' : '−';
        });
    });

});


    const container = document.querySelector('.carousel-container');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    // Adjust this value based on your card width + gap
    const scrollAmount = 320;

    if (container && rightArrow && leftArrow) {
        rightArrow.addEventListener('click', () => {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        leftArrow.addEventListener('click', () => {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
    }


function scrollCarousel(direction) {
    const carousel = document.getElementById('trainingCarousel');
    const scrollAmount = 350; // Adjust this value to match your card width + gap

    if (!carousel) return;

    if (direction === 'left') {
        carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
}

// Adds a show/hide toggle to every password field sitewide, no per-page markup needed.
function efcInitPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach((input) => {
        if (input.closest('.password-field-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'password-field-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'password-toggle';
        toggle.textContent = 'SHOW';
        toggle.setAttribute('aria-label', 'Show password');
        toggle.addEventListener('click', () => {
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            toggle.textContent = showing ? 'SHOW' : 'HIDE';
            toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
        wrapper.appendChild(toggle);
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', efcInitPasswordToggles);
} else {
    efcInitPasswordToggles();
}
