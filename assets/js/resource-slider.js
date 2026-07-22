document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.free-resource-grid');
    if (!grid) return;
    grid.classList.add('free-resource-slider');
    const controls = document.createElement('div'); controls.className = 'resource-slider-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '←'; previous.setAttribute('aria-label', 'Previous resources');
    const next = document.createElement('button'); next.type = 'button'; next.textContent = '→'; next.setAttribute('aria-label', 'Next resources');
    const shift = direction => grid.scrollBy({ left: direction * Math.min(grid.clientWidth * .82, 420), behavior: 'smooth' });
    previous.addEventListener('click', () => shift(-1)); next.addEventListener('click', () => shift(1)); controls.append(previous, next); grid.before(controls);
    const cta = document.querySelector('.vault-cta');
    if (cta) { cta.querySelector('h3').textContent = 'READY FOR YOUR COMPLETE ECHELON EXPERIENCE?'; cta.querySelector('p').textContent = 'The free library is premium on purpose. Membership adds the personal programming, tools, and direct coach support built around you.'; }
});
