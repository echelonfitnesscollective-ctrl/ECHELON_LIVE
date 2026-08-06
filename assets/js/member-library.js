function matchGoalCategory(rawCategory) {
    const c = (rawCategory || '').toLowerCase();
    if (c.includes('weight')) return 'weight-loss';
    if (c.includes('cut')) return 'cutting';
    if (c.includes('bulk')) return 'bulking';
    if (c.includes('muscle') || c.includes('hypertrophy')) return 'muscle';
    if (c.includes('perform')) return 'performance';
    if (c.includes('older') || c.includes('senior') || c.includes('wellness')) return 'older-adult';
    if (c.includes('fuel') || c.includes('nutrition')) return 'fuel-general';
    if (c.includes('train')) return 'training';
    return null;
}

function ensureGeneralCategoryBlock() {
    const gridRoot = document.getElementById('resource-grid-root');
    const navRoot = document.getElementById('resource-hub-nav');
    if (!gridRoot || !navRoot) return null;
    let block = gridRoot.querySelector('.resource-category-block[data-cat="member-general"]');
    if (block) return block;

    const navBtn = document.createElement('button');
    navBtn.type = 'button';
    navBtn.dataset.cat = 'member-general';
    navBtn.innerHTML = 'MEMBER EXCLUSIVES';
    navBtn.addEventListener('click', () => setActiveResourceCategory('member-general', true));
    navRoot.appendChild(navBtn);

    block = document.createElement('div');
    block.className = 'resource-category-block';
    block.dataset.cat = 'member-general';
    block.hidden = true;
    const heading = document.createElement('div');
    heading.className = 'resource-category-heading';
    heading.innerHTML = '<span>MEMBER EXCLUSIVES</span>';
    block.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'resource-card-grid';
    block.appendChild(grid);
    gridRoot.appendChild(block);
    return block;
}

function buildPremiumCard(resource, catLabel, openFn) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'resource-card-tile';
    card.setAttribute('aria-haspopup', 'dialog');
    card.innerHTML = `
        <span class="resource-card-badge">${catLabel}</span>
        <h3>${resource.title}</h3>
        <p>${resource.description || 'Member-only Echelon resource.'}</p>
        <span class="resource-card-foot"><span class="resource-card-cta">OPEN GUIDE &rarr;</span><span class="resource-exclusive-flag">EXCLUSIVE</span></span>
    `;
    card.addEventListener('click', openFn);
    return card;
}

function openPremiumModal(resource, catLabel) {
    const overlay = document.getElementById('resource-modal-overlay');
    const panel = document.getElementById('resource-modal-panel');
    if (!overlay || !panel) return;

    panel.classList.remove('resource-modal-panel-wide');
    panel.innerHTML = `
        <button type="button" class="resource-modal-close" aria-label="Close">&times;</button>
        <span class="resource-card-badge">${catLabel} <span class="resource-exclusive-flag">MEMBER ONLY</span></span>
        <h2>${resource.title}</h2>
        <div class="resource-modal-body"><p>${resource.description || 'A member-only Echelon resource, added by your coach.'}</p><p class="resource-download-pending">Preparing your download&hellip;</p></div>
        <div class="resource-modal-footer" hidden></div>
    `;
    panel.querySelector('.resource-modal-close').addEventListener('click', closeResourceModal);
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('resource-modal-open');
    panel.scrollTop = 0;
    panel.querySelector('.resource-modal-close').focus();

    const isPdf = /\.pdf($|\?)/i.test(resource.storage_path);

    echelonMemberClient.storage.from('member-library').createSignedUrl(resource.storage_path, 3600).then(signed => {
        const body = panel.querySelector('.resource-modal-body');
        const footer = panel.querySelector('.resource-modal-footer');
        if (!body || !footer) return;
        const pending = body.querySelector('.resource-download-pending');
        if (!signed.data?.signedUrl) {
            if (pending) pending.textContent = 'This resource is temporarily unavailable, try again shortly.';
            return;
        }
        const url = signed.data.signedUrl;
        if (isPdf) {
            if (pending) pending.remove();
        } else {
            body.innerHTML += `<img src="${url}" alt="${resource.title}" class="resource-modal-image">`;
        }
        footer.hidden = false;
        footer.innerHTML = `<a class="btn-primary resource-download-btn" href="${url}" target="_blank" rel="noopener" download>DOWNLOAD RESOURCE &darr;</a>`;
    });
}

const MEMBER_CATEGORY_LABELS = {
    'fuel': '01 &middot; FUEL', 'training': '02 &middot; TRAINING', 'consistency': '03 &middot; CONSISTENCY',
    'fuel-weight-loss': 'FUEL &middot; WEIGHT LOSS', 'fuel-cutting': 'FUEL &middot; CUTTING', 'fuel-bulking': 'FUEL &middot; BULKING',
    'fuel-muscle': 'FUEL &middot; MUSCLE', 'fuel-performance': 'FUEL &middot; PERFORMANCE', 'fuel-older-adult': 'FUEL &middot; OLDER-ADULT',
    'weight-loss': 'WEIGHT LOSS', 'cutting': 'CUTTING', 'bulking': 'BULKING', 'muscle': 'MUSCLE', 'performance': 'PERFORMANCE', 'older-adult': 'OLDER-ADULT',
    'fuel-general': '01 &middot; FUEL'
};

function markYourGoalPill(catId) {
    const navRoot = document.getElementById('resource-hub-nav');
    if (!navRoot) return;
    const btn = navRoot.querySelector(`button[data-cat="${catId}"]`);
    if (!btn || btn.querySelector('.resource-your-goal-flag')) return;
    const flag = document.createElement('span');
    flag.className = 'resource-your-goal-flag';
    flag.textContent = 'YOUR GOAL';
    btn.appendChild(flag);
}

async function personalizeToMemberGoal(userId, status) {
    const { data, error } = await echelonMemberClient
        .from('member_training_profiles')
        .select('primary_goal')
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data?.primary_goal) return;

    const catId = matchGoalCategory(data.primary_goal);
    if (!catId || catId === 'fuel-general' || catId === 'training') return;
    const block = document.querySelector(`.resource-category-block[data-cat="${catId}"]`);
    if (!block) return;

    setActiveResourceCategory(catId, false);
    markYourGoalPill(catId);
    if (status) {
        status.textContent = `Starting with your goal, ${MEMBER_CATEGORY_LABELS[catId] || catId}, since that is what your coach has you focused on. Every other guide is still one click away.`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const gridRoot = document.getElementById('resource-grid-root');
    const status = document.getElementById('member-library-status');
    if (!gridRoot) return;

    const member = await requireMemberSession();
    if (!member) return;

    const { data, error } = await echelonMemberClient
        .from('member_library_resources')
        .select('id,title,category,description,storage_path')
        .eq('published', true)
        .order('created_at', { ascending: false });

    if (status) {
        status.textContent = 'Every free guide is here, plus anything marked EXCLUSIVE, added by your coach for members only.';
    }

    if (error) {
        if (status) status.textContent = 'The member library will be available shortly.';
    } else if (data && data.length) {
        data.forEach(resource => {
            const goal = matchGoalCategory(resource.category);
            const catId = goal === 'fuel-general' ? 'fuel' : goal;
            let block = catId ? gridRoot.querySelector(`.resource-category-block[data-cat="${catId}"]`) : null;
            if (!block) block = ensureGeneralCategoryBlock();
            if (!block) return;

            const grid = block.querySelector('.resource-card-grid');
            if (!grid) return;
            const catLabel = MEMBER_CATEGORY_LABELS[catId] || 'MEMBER RESOURCE';
            const card = buildPremiumCard(resource, catLabel.replace(/&middot;/g, '·'), () => openPremiumModal(resource, catLabel.replace(/&middot;/g, '·')));
            grid.appendChild(card);
        });
    }

    await personalizeToMemberGoal(member.id, status);
});
