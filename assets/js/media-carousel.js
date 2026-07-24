// Add photos or short videos here. For videos, place an MP4/WebM in assets/media
// and replace the placeholder entry's `src` with its path.
const EFC_MEDIA_ITEMS = [
    { type: 'image', src: 'assets/images/coach.jpg', alt: 'Echelon coach in training', label: 'COACHING IN MOTION', caption: 'The work is personal. The standard stays high.' },
    { type: 'image', src: 'assets/images/IMG_0274.jpg', alt: 'Echelon Fitness Collective training moment', label: 'THE COLLECTIVE', caption: 'Built with structure. Carried with purpose.' },
    { type: 'image', src: 'assets/images/hero-main.png', alt: 'Echelon Fitness Collective', label: 'THE STANDARD', caption: 'Strength that shows up beyond the session.' },
    { type: 'video-placeholder', poster: 'assets/images/efc-studio-dawn.png', label: 'SHORT-FORM VIDEO', caption: 'Drop your training reel, class clip, or member moment here.', note: 'ADD A 15–45 SECOND VIDEO' }
];

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('efc-media-carousel');
    if (!root) return;
    let active = 0;

    const frame = document.createElement('div'); frame.className = 'media-frame';
    const media = document.createElement('div'); media.className = 'media-visual';
    const copy = document.createElement('div'); copy.className = 'media-copy';
    const tag = document.createElement('span'); tag.className = 'checkin-tag';
    const heading = document.createElement('h3');
    const count = document.createElement('span'); count.className = 'media-count';
    copy.append(tag, heading, count);
    frame.append(media, copy);

    const controls = document.createElement('div'); controls.className = 'media-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'media-arrow'; previous.setAttribute('aria-label', 'Previous media item'); previous.textContent = '←';
    const dots = document.createElement('div'); dots.className = 'media-dots';
    const next = document.createElement('button'); next.type = 'button'; next.className = 'media-arrow'; next.setAttribute('aria-label', 'Next media item'); next.textContent = '→';
    const dotButtons = EFC_MEDIA_ITEMS.map((item, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'media-dot'; button.setAttribute('aria-label', `Show ${item.label}`); button.addEventListener('click', () => show(index)); dots.append(button); return button; });
    controls.append(previous, dots, next);
    root.append(frame, controls);

    function show(index) {
        active = (index + EFC_MEDIA_ITEMS.length) % EFC_MEDIA_ITEMS.length;
        const item = EFC_MEDIA_ITEMS[active];
        media.replaceChildren();
        if (item.type === 'image') {
            const image = document.createElement('img'); image.src = item.src; image.alt = item.alt; image.loading = 'lazy'; media.append(image);
        } else if (item.type === 'video') {
            const video = document.createElement('video'); video.src = item.src; video.poster = item.poster || ''; video.controls = true; video.preload = 'metadata'; video.playsInline = true; media.append(video);
        } else {
            const placeholder = document.createElement('div'); placeholder.className = 'media-video-placeholder';
            const image = document.createElement('img'); image.src = item.poster; image.alt = ''; image.loading = 'lazy';
            const play = document.createElement('span'); play.textContent = '▶';
            const note = document.createElement('strong'); note.textContent = item.note;
            placeholder.append(image, play, note); media.append(placeholder);
        }
        tag.textContent = item.label;
        heading.textContent = item.caption;
        count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(EFC_MEDIA_ITEMS.length).padStart(2, '0')}`;
        dotButtons.forEach((dot, dotIndex) => { const isActive = dotIndex === active; dot.classList.toggle('active', isActive); dot.setAttribute('aria-current', String(isActive)); });
    }
    previous.addEventListener('click', () => show(active - 1));
    next.addEventListener('click', () => show(active + 1));
    show(0);
});
