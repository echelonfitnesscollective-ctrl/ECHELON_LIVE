const EFC_CONTENT_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_CONTENT_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

function efcContentPlacementTarget(placement) {
    const selectors = {
        homepage: '#about',
        training: '#training .container',
        resources: '#resources .container',
        shop: '#shop .container'
    };
    return document.querySelector(selectors[placement]);
}

function efcContentLink(url) {
    if (!url) return null;
    const link = document.createElement('a');
    link.className = 'btn-secondary';
    link.href = url;
    if (/^https?:\/\//i.test(url)) {
        link.target = '_blank';
        link.rel = 'noopener';
    }
    return link;
}

function renderEfcContent(items) {
    const existingFeeds = document.querySelectorAll('[data-efc-content-feed]');
    existingFeeds.forEach((feed) => feed.remove());
    const byPlacement = new Map();
    items.forEach((item) => {
        if (!byPlacement.has(item.placement)) byPlacement.set(item.placement, []);
        byPlacement.get(item.placement).push(item);
    });
    byPlacement.forEach((placementItems, placement) => {
        const target = efcContentPlacementTarget(placement);
        if (!target) return;
        const feed = document.createElement('div');
        feed.className = 'cms-live-feed';
        feed.dataset.efcContentFeed = placement;
        placementItems.forEach((item) => {
            const card = document.createElement('article');
            card.className = `cms-live-card${item.image_url ? ' has-image' : ''}`;
            if (item.image_url) {
                const image = document.createElement('img');
                image.src = item.image_url;
                image.alt = item.title || 'Echelon update';
                image.loading = 'lazy';
                card.append(image);
            }
            const copy = document.createElement('div');
            if (item.eyebrow) {
                const tag = document.createElement('span'); tag.className = 'checkin-tag'; tag.textContent = item.eyebrow;
                copy.append(tag);
            }
            const title = document.createElement('h3'); title.textContent = item.title;
            copy.append(title);
            if (item.body) {
                const body = document.createElement('p'); body.textContent = item.body;
                copy.append(body);
            }
            card.append(copy);
            const action = efcContentLink(item.cta_url);
            if (action) {
                action.textContent = item.cta_label || 'LEARN MORE →';
                card.append(action);
            }
            feed.append(card);
        });
        if (placement === 'homepage') target.before(feed);
        else target.prepend(feed);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    const client = window.supabase.createClient(EFC_CONTENT_SUPABASE_URL, EFC_CONTENT_SUPABASE_KEY);
    const { data, error } = await client.from('site_content_items').select('placement, eyebrow, title, body, cta_label, cta_url, image_url, sort_order, publish_at').order('sort_order', { ascending: true }).order('publish_at', { ascending: false }).limit(24);
    if (!error && data?.length) renderEfcContent(data);
});
