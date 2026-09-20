// Echelon Goods Manager: lets the admin add a product, set its price,
// sizes, and per-color photos, then show or hide it on the public shop
// (index.html#shop, rendered by shop-showcase.js from the shop_products
// table) - no code change or redeploy needed. Relies on echelonAdminClient,
// defined in admin-auth.js, which is loaded before this file.

function shopColorImagePath(image) {
    return /^https?:\/\//i.test(image || '') ? image : `../${image}`;
}

function shopSlugify(name) {
    return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
}

function addShopColorRow(container, color = {}) {
    const row = document.createElement('div');
    row.className = 'shop-color-row';
    row.dataset.existingImage = color.image || '';

    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.name = 'color_name'; nameInput.placeholder = 'Color name';
    nameInput.setAttribute('aria-label', 'Color name'); nameInput.value = color.name || '';

    const hexInput = document.createElement('input');
    hexInput.type = 'color'; hexInput.setAttribute('aria-label', 'Swatch color'); hexInput.value = color.hex || '#0d0d0c';

    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.setAttribute('aria-label', 'Color photo');

    const thumb = document.createElement('img');
    thumb.className = 'shop-color-thumb'; thumb.alt = '';
    if (color.image) thumb.src = shopColorImagePath(color.image);
    else thumb.hidden = true;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        thumb.src = URL.createObjectURL(file);
        thumb.hidden = false;
    });

    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'detail-row-remove'; remove.setAttribute('aria-label', 'Remove color'); remove.textContent = '×';
    remove.addEventListener('click', () => row.remove());

    row.append(nameInput, hexInput, fileInput, thumb, remove);
    container.appendChild(row);
    return row;
}

function renderShopProductForm(form, row) {
    form.elements.product_id.value = row?.id || '';
    form.elements.name.value = row?.name || '';
    form.elements.description.value = row?.description || '';
    form.elements.price.value = row ? (row.price_cents / 100).toFixed(2) : '';
    form.elements.sizes.value = row?.sizes?.length ? row.sizes.join(', ') : '';
    form.elements.published.value = row ? String(row.published) : 'true';
    form.elements.sort_order.value = row ? String(row.sort_order ?? 0) : '0';

    const colorContainer = form.querySelector('[data-shop-color-rows]');
    colorContainer.innerHTML = '';
    const colors = row?.colors?.length ? row.colors : [{}];
    colors.forEach((c) => addShopColorRow(colorContainer, c));

    const modeTag = document.getElementById('shop-form-mode-tag');
    if (modeTag) modeTag.textContent = row ? 'EDITING' : 'NEW PRODUCT';
    const cancelBtn = document.getElementById('shop-product-cancel');
    if (cancelBtn) cancelBtn.hidden = !row;
    const saveBtn = document.getElementById('shop-product-save');
    if (saveBtn) saveBtn.textContent = row ? 'SAVE CHANGES' : 'SAVE PRODUCT';
}

async function initializeShopManager() {
    const form = document.getElementById('shop-product-form');
    if (!form) return;
    const list = document.getElementById('shop-product-list');
    const feedback = document.getElementById('shop-product-feedback');
    const count = document.getElementById('shop-product-count');
    const save = document.getElementById('shop-product-save');
    const cancelBtn = document.getElementById('shop-product-cancel');
    const colorContainer = form.querySelector('[data-shop-color-rows]');

    form.querySelector('[data-add-shop-color]').addEventListener('click', () => addShopColorRow(colorContainer));
    cancelBtn.addEventListener('click', () => { renderShopProductForm(form, null); feedback.textContent = ''; });

    const refresh = async () => {
        count.textContent = 'LOADING…';
        const { data, error } = await echelonAdminClient.from('shop_products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(100);
        if (error) { list.textContent = 'Run the Shop database update to activate this section.'; count.textContent = 'SETUP REQUIRED'; return; }
        const records = data || [];
        list.replaceChildren(); count.textContent = `${records.length} PRODUCT${records.length === 1 ? '' : 'S'}`;
        if (!records.length) { const empty = document.createElement('p'); empty.className = 'cms-content-empty'; empty.textContent = 'No products yet. Add your first one to open the shop.'; list.append(empty); return; }
        records.forEach((item) => {
            const card = document.createElement('article'); card.className = `cms-content-item shop-product-item${item.published ? ' is-published' : ''}`;
            const preview = document.createElement('img'); preview.className = 'media-manager-preview'; preview.alt = item.name;
            const firstColor = Array.isArray(item.colors) ? item.colors[0] : null;
            if (firstColor?.image) preview.src = shopColorImagePath(firstColor.image);
            const copy = document.createElement('div');
            const tag = document.createElement('span'); tag.className = 'checkin-tag'; tag.textContent = `$${(item.price_cents / 100).toFixed(2)}`;
            const title = document.createElement('h4'); title.textContent = item.name;
            const sizesLine = document.createElement('p'); sizesLine.textContent = Array.isArray(item.sizes) && item.sizes.length ? `Sizes: ${item.sizes.join(', ')}` : 'No sizes set';
            const meta = document.createElement('div'); meta.className = 'cms-content-meta';
            const visibility = document.createElement('span'); visibility.className = 'cms-status'; visibility.textContent = item.published ? 'PUBLISHED' : 'DRAFT';
            const order = document.createElement('span'); order.textContent = `ORDER ${item.sort_order}`;
            const colorCount = document.createElement('span'); colorCount.textContent = `${(item.colors || []).length} COLOR${(item.colors || []).length === 1 ? '' : 'S'}`;
            meta.append(visibility, order, colorCount); copy.append(tag, title, sizesLine, meta);
            const actions = document.createElement('div'); actions.className = 'cms-content-actions';
            const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'EDIT';
            edit.addEventListener('click', () => { renderShopProductForm(form, item); feedback.textContent = ''; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
            const publish = document.createElement('button'); publish.type = 'button'; publish.textContent = item.published ? 'HIDE FROM SITE' : 'PUBLISH';
            publish.addEventListener('click', async () => {
                const { error: publishError } = await echelonAdminClient.from('shop_products').update({ published: !item.published }).eq('id', item.id);
                if (publishError) { feedback.textContent = 'That product could not be updated.'; return; }
                feedback.textContent = item.published ? 'Hidden from the public shop.' : 'Published to the public shop.'; refresh();
            });
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cms-delete'; remove.textContent = 'DELETE';
            remove.addEventListener('click', async () => {
                if (!window.confirm(`Delete "${item.name}" from the Echelon shop? This cannot be undone.`)) return;
                remove.disabled = true;
                const { error: deleteError } = await echelonAdminClient.from('shop_products').delete().eq('id', item.id);
                if (deleteError) { feedback.textContent = 'The product could not be deleted.'; remove.disabled = false; return; }
                feedback.textContent = 'Product deleted.'; refresh();
            });
            actions.append(edit, publish, remove); card.append(preview, copy, actions); list.append(card);
        });
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const values = form.elements;
        const name = values.name.value.trim();
        const price = Number(values.price.value);
        const sizes = values.sizes.value.split(',').map((s) => s.trim()).filter(Boolean);
        const colorRows = Array.from(colorContainer.querySelectorAll('.shop-color-row'));
        if (!name) { feedback.textContent = 'Enter a product name.'; return; }
        if (!Number.isFinite(price) || price <= 0) { feedback.textContent = 'Enter a valid price.'; return; }
        if (!sizes.length) { feedback.textContent = 'Enter at least one size.'; return; }
        if (!colorRows.length) { feedback.textContent = 'Add at least one color.'; return; }

        save.disabled = true; save.textContent = 'SAVING…';
        const colors = [];
        for (const row of colorRows) {
            const colorName = row.querySelector('input[name=color_name]').value.trim();
            const hex = row.querySelector('input[type=color]').value;
            const file = row.querySelector('input[type=file]').files[0];
            const existingImage = row.dataset.existingImage;
            if (!colorName) { feedback.textContent = 'Every color needs a name.'; save.disabled = false; save.textContent = 'SAVE PRODUCT'; return; }
            let image = existingImage;
            if (file) {
                if (file.size > 10 * 1024 * 1024) { feedback.textContent = `${colorName}: choose a photo under 10 MB.`; save.disabled = false; save.textContent = 'SAVE PRODUCT'; return; }
                const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
                const path = `${Date.now()}-${safeName}`;
                const upload = await echelonAdminClient.storage.from('shop-products').upload(path, file, { contentType: file.type, upsert: false });
                if (upload.error) { feedback.textContent = `${colorName}: the photo could not be uploaded.`; save.disabled = false; save.textContent = 'SAVE PRODUCT'; return; }
                image = echelonAdminClient.storage.from('shop-products').getPublicUrl(path).data.publicUrl;
            }
            if (!image) { feedback.textContent = `${colorName}: add a photo.`; save.disabled = false; save.textContent = 'SAVE PRODUCT'; return; }
            colors.push({ name: colorName, hex, image });
        }

        const productId = values.product_id.value;
        const payload = {
            name,
            description: values.description.value.trim(),
            price_cents: Math.round(price * 100),
            sizes,
            colors,
            published: values.published.value === 'true',
            sort_order: Number(values.sort_order.value) || 0,
        };

        let error;
        if (productId) {
            ({ error } = await echelonAdminClient.from('shop_products').update(payload).eq('id', productId));
        } else {
            let slug = shopSlugify(name);
            let insertResult = await echelonAdminClient.from('shop_products').insert({ ...payload, slug });
            if (insertResult.error?.code === '23505') {
                slug = `${slug}-${Date.now().toString(36)}`;
                insertResult = await echelonAdminClient.from('shop_products').insert({ ...payload, slug });
            }
            error = insertResult.error;
        }

        save.disabled = false; save.textContent = productId ? 'SAVE CHANGES' : 'SAVE PRODUCT';
        if (error) { feedback.textContent = 'The product could not be saved. Please check the details and try again.'; return; }
        feedback.textContent = payload.published ? 'Saved and published to the public shop.' : 'Saved as a private draft.';
        renderShopProductForm(form, null);
        await refresh();
    });

    renderShopProductForm(form, null);
    await refresh();
}
