const EFC_TESTIMONIALS_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_TESTIMONIALS_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

function testimonialPublicPhotoUrl(client, path) {
    return client.storage.from('testimonial-photos').getPublicUrl(path).data.publicUrl;
}

function buildTestimonialCard(item) {
    const card = document.createElement('article');
    card.className = 'testimonial-card';

    if (item.beforeUrl || item.afterUrl) {
        const photos = document.createElement('div');
        photos.className = 'testimonial-photos';
        if (item.beforeUrl) {
            const wrap = document.createElement('div'); wrap.className = 'testimonial-photo';
            const label = document.createElement('span'); label.textContent = 'BEFORE';
            const img = document.createElement('img'); img.src = item.beforeUrl; img.alt = `${item.clientName}, before`; img.loading = 'lazy';
            wrap.append(img, label); photos.append(wrap);
        }
        if (item.afterUrl) {
            const wrap = document.createElement('div'); wrap.className = 'testimonial-photo';
            const label = document.createElement('span'); label.textContent = 'AFTER';
            const img = document.createElement('img'); img.src = item.afterUrl; img.alt = `${item.clientName}, after`; img.loading = 'lazy';
            wrap.append(img, label); photos.append(wrap);
        }
        card.append(photos);
    }

    if (item.rating) {
        const stars = document.createElement('div'); stars.className = 'testimonial-stars'; stars.setAttribute('aria-label', `${item.rating} out of 5 stars`);
        stars.textContent = '★'.repeat(item.rating);
        card.append(stars);
    }

    const quote = document.createElement('p'); quote.className = 'testimonial-quote'; quote.textContent = `“${item.quote}”`;
    const byline = document.createElement('p'); byline.className = 'testimonial-byline';
    byline.textContent = item.program ? `${item.clientName} · ${item.program}` : item.clientName;
    card.append(quote, byline);
    return card;
}

document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('efc-testimonials');
    if (!root) return;
    const section = root.closest('.testimonials-section');
    const client = window.supabase?.createClient(EFC_TESTIMONIALS_SUPABASE_URL, EFC_TESTIMONIALS_SUPABASE_KEY);
    if (!client) return;

    const { data, error } = await client
        .from('testimonials')
        .select('client_name,program,quote,rating,before_image_path,after_image_path,sort_order,created_at')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(24);

    if (error || !data?.length) {
        // Nothing published yet. Hide the whole section rather than show an
        // empty "REAL CLIENTS. REAL RESULTS." heading with no proof under it.
        if (section) section.hidden = true;
        return;
    }

    const items = data.map((row) => ({
        clientName: row.client_name,
        program: row.program,
        quote: row.quote,
        rating: row.rating,
        beforeUrl: row.before_image_path ? testimonialPublicPhotoUrl(client, row.before_image_path) : '',
        afterUrl: row.after_image_path ? testimonialPublicPhotoUrl(client, row.after_image_path) : '',
    }));

    root.replaceChildren(...items.map(buildTestimonialCard));
});
