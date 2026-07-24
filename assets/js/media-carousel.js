const EFC_MEDIA_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_MEDIA_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

const EFC_MEDIA_FALLBACK_ITEMS = [
    { type: 'image', src: 'assets/images/media/coach.jpg', label: 'THE COLLECTIVE', caption: 'One standard. One community. Forward together.' },
    { type: 'image', src: 'assets/images/media/gallery2.jpg', label: 'TRAINING IN MOTION', caption: 'Every rep carries the room forward.' },
    { type: 'image', src: 'assets/images/media/gallery3.jpg', label: 'THE PEOPLE', caption: 'Real people choosing more from themselves.' },
    { type: 'image', src: 'assets/images/media/gallery4.jpg', label: 'THE WORK', caption: 'The pace is earned together.' },
    { type: 'image', src: 'assets/images/media/gallery5.jpg', label: 'COMMUNITY', caption: 'Different paths. A shared standard.' },
    { type: 'image', src: 'assets/images/media/gallery6.jpg', label: 'ECHELON DAYS', caption: 'Show up. Lock in. Keep building.' },
    { type: 'image', src: 'assets/images/media/gallery7.jpg', label: 'THE COLLECTIVE', caption: 'Accountability looks good on us.' },
    { type: 'image', src: 'assets/images/media/gallery8.jpg', label: 'MOMENTUM', caption: 'Energy that stays with you after the session.' },
    { type: 'image', src: 'assets/images/media/gallery9.jpg', label: 'AFTER HOURS', caption: 'Discipline carries beyond the workout.' }
];

function publicMediaUrl(client, path) {
    return client.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('efc-media-carousel');
    if (!root) return;
    const client = window.supabase?.createClient(EFC_MEDIA_SUPABASE_URL, EFC_MEDIA_SUPABASE_KEY);
    let items = EFC_MEDIA_FALLBACK_ITEMS;
    if (client) {
        const { data, error } = await client.from('site_media_items').select('media_type,title,caption,storage_path,poster_path,sort_order,created_at').eq('published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(30);
        if (!error && data?.length) {
            items = data.map((item) => ({
                type: item.media_type,
                src: publicMediaUrl(client, item.storage_path),
                poster: item.poster_path ? publicMediaUrl(client, item.poster_path) : '',
                label: item.title || 'ECHELON IN MOTION',
                caption: item.caption || 'The work is personal. The standard stays high.'
            }));
        }
    }

    let active = 0;
    const frame = document.createElement('div'); frame.className = 'media-frame';
    const media = document.createElement('div'); media.className = 'media-visual';
    const copy = document.createElement('div'); copy.className = 'media-copy';
    const tag = document.createElement('span'); tag.className = 'checkin-tag';
    const heading = document.createElement('h3');
    const count = document.createElement('span'); count.className = 'media-count';
    copy.append(tag, heading, count); frame.append(media, copy);
    const controls = document.createElement('div'); controls.className = 'media-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'media-arrow'; previous.setAttribute('aria-label', 'Previous media item'); previous.textContent = '←';
    const dots = document.createElement('div'); dots.className = 'media-dots';
    const next = document.createElement('button'); next.type = 'button'; next.className = 'media-arrow'; next.setAttribute('aria-label', 'Next media item'); next.textContent = '→';
    const dotButtons = items.map((item, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'media-dot'; button.setAttribute('aria-label', `Show ${item.label}`); button.addEventListener('click', () => show(index)); dots.append(button); return button;
    });
    controls.append(previous, dots, next); root.append(frame, controls);

    function show(index) {
        active = (index + items.length) % items.length;
        const item = items[active]; media.replaceChildren();
        if (item.type === 'video') {
            const video = document.createElement('video'); video.src = item.src; video.poster = item.poster || ''; video.controls = true; video.preload = 'metadata'; video.playsInline = true; media.append(video);
        } else {
            const image = document.createElement('img'); image.src = item.src; image.alt = item.label; image.loading = 'lazy'; media.append(image);
        }
        tag.textContent = item.label; heading.textContent = item.caption;
        count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
        dotButtons.forEach((dot, dotIndex) => { const isActive = dotIndex === active; dot.classList.toggle('active', isActive); dot.setAttribute('aria-current', String(isActive)); });
    }
    previous.addEventListener('click', () => show(active - 1)); next.addEventListener('click', () => show(active + 1)); show(0);
});
