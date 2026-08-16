const EFC_WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EFC_SESSION_TYPE_LABELS = { one_on_one: '1-on-1', private_group: 'Private Group' };

function efcSessionTypeLabel(type) {
    return EFC_SESSION_TYPE_LABELS[type] || type;
}

function efcFormatTime(timeString) {
    const [hours, minutes] = String(timeString).split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function efcDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function efcSyncBookingToCalendar(bookingId, action) {
    try {
        const { data: sessionData } = await echelonAdminClient.auth.getSession();
        await fetch('/api/calendar/sync-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
            body: JSON.stringify({ bookingId, action })
        });
    } catch (_) { /* best-effort, the in-app booking already succeeded */ }
}

async function initializeCalendarConnection() {
    const status = document.getElementById('calendar-connection-status');
    const connectBtn = document.getElementById('calendar-connect-btn');
    if (!status) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') status.textContent = 'Connected. Syncing new bookings now.';
    else if (params.get('calendar') === 'error') status.textContent = 'That connection attempt did not work, try again.';
    if (params.has('calendar')) {
        params.delete('calendar');
        window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
    }

    const { data: sessionData } = await echelonAdminClient.auth.getSession();
    const result = await fetch('/api/calendar/status', { headers: { Authorization: `Bearer ${sessionData.session?.access_token || ''}` } });
    const body = await result.json().catch(() => ({}));
    if (!result.ok) { status.textContent = 'Could not check the calendar connection.'; return; }
    if (!body.configured) { status.textContent = 'Not set up yet, Google Calendar credentials are needed in Vercel.'; return; }
    if (body.connected) {
        status.textContent = `Connected as ${body.connectedEmail || 'your Google account'}.${body.trainingCalendarActive ? ' Sessions sync to your yellow "Echelon Training" calendar.' : ' Reconnect once more to create the dedicated Echelon Training calendar.'}`;
        connectBtn.textContent = 'RECONNECT';
        connectBtn.hidden = false;
    } else {
        status.textContent = 'Not connected yet, bookings stay in-app only until you connect.';
        connectBtn.textContent = 'CONNECT GOOGLE CALENDAR';
        connectBtn.hidden = false;
    }

    connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        const { data: session } = await echelonAdminClient.auth.getSession();
        const startResult = await fetch('/api/calendar/oauth-start', {
            method: 'POST', headers: { Authorization: `Bearer ${session.session?.access_token || ''}` }
        });
        const startBody = await startResult.json().catch(() => ({}));
        if (!startResult.ok || !startBody.authUrl) { status.textContent = startBody.error || 'Could not start the Google connection.'; connectBtn.disabled = false; return; }
        window.location.href = startBody.authUrl;
    });
}

function initializeSessionsCalendar() {
    const grid = document.getElementById('admin-calendar-grid');
    if (!grid) return null;
    const label = document.getElementById('admin-calendar-label');
    const prevBtn = document.getElementById('admin-calendar-prev');
    const nextBtn = document.getElementById('admin-calendar-next');
    const detail = document.getElementById('admin-calendar-day-detail');

    const cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
    let selectedKey = efcDateKey(new Date());
    let bookingsByDay = new Map();

    function renderGrid() {
        label.textContent = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        grid.innerHTML = '';
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((weekday) => {
            const heading = document.createElement('div');
            heading.className = 'month-calendar-weekday';
            heading.textContent = weekday;
            grid.append(heading);
        });
        const firstWeekday = cursor.getDay();
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        for (let i = 0; i < firstWeekday; i++) {
            const empty = document.createElement('div');
            empty.className = 'month-calendar-day month-calendar-day-empty';
            grid.append(empty);
        }
        const todayKey = efcDateKey(new Date());
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const key = efcDateKey(date);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'month-calendar-day month-calendar-day-active';
            if (key === todayKey) cell.classList.add('month-calendar-day-today');
            if (key === selectedKey) cell.classList.add('month-calendar-day-selected');
            cell.append(document.createTextNode(String(day)));
            if (bookingsByDay.has(key)) {
                const dot = document.createElement('span');
                dot.className = 'month-calendar-day-dot';
                cell.append(dot);
            }
            cell.addEventListener('click', () => { selectedKey = key; renderGrid(); renderDetail(); });
            grid.append(cell);
        }
    }

    function renderDetail() {
        detail.innerHTML = '';
        const [year, month, day] = selectedKey.split('-').map(Number);
        const heading = document.createElement('h4');
        heading.textContent = new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        detail.append(heading);
        const rows = bookingsByDay.get(selectedKey) || [];
        if (!rows.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-detail-empty';
            empty.textContent = 'No sessions this day.';
            detail.append(empty);
            return;
        }
        rows.forEach((row) => {
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const when = new Date(row.scheduled_at);
            const itemLabel = document.createElement('span');
            itemLabel.textContent = `${row.member_name} · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${efcSessionTypeLabel(row.session_type)} · ${row.duration_minutes} min`;
            const cancel = document.createElement('button');
            cancel.type = 'button'; cancel.className = 'btn-secondary';
            cancel.textContent = 'CANCEL';
            cancel.addEventListener('click', async () => {
                await echelonAdminClient.from('session_bookings').update({ status: 'canceled' }).eq('id', row.id);
                efcSyncBookingToCalendar(row.id, 'cancel');
                loadMonth();
            });
            item.append(itemLabel, cancel);
            detail.append(item);
        });
    }

    async function loadMonth() {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const { data, error } = await echelonAdminClient
            .from('session_bookings')
            .select('id, member_name, session_type, scheduled_at, duration_minutes')
            .eq('status', 'confirmed')
            .gte('scheduled_at', monthStart.toISOString())
            .lt('scheduled_at', monthEnd.toISOString())
            .order('scheduled_at', { ascending: true });
        bookingsByDay = new Map();
        if (!error) {
            (data || []).forEach((row) => {
                const key = efcDateKey(new Date(row.scheduled_at));
                if (!bookingsByDay.has(key)) bookingsByDay.set(key, []);
                bookingsByDay.get(key).push(row);
            });
        }
        renderGrid();
        renderDetail();
    }

    prevBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); loadMonth(); });
    nextBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); loadMonth(); });

    loadMonth();
    return { reload: loadMonth };
}

async function initializeAdminScheduling() {
    const windowForm = document.getElementById('availability-window-form');
    if (!windowForm) return;

    const windowList = document.getElementById('availability-window-list');
    const windowFeedback = document.getElementById('availability-window-feedback');
    const bookForm = document.getElementById('admin-book-session-form');
    const bookFeedback = document.getElementById('admin-book-session-feedback');
    const memberSelect = bookForm.elements.user_id;
    const sessionsCalendar = initializeSessionsCalendar();

    async function loadAvailabilityWindows() {
        const { data, error } = await echelonAdminClient
            .from('coach_availability_windows')
            .select('id, day_of_week, start_time, end_time, session_type, active')
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });
        windowList.innerHTML = '';
        if (error) { windowList.textContent = 'Could not load availability windows.'; return; }
        if (!data.length) { windowList.textContent = 'No standing availability yet, add one below.'; return; }
        data.forEach((row) => {
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const label = document.createElement('span');
            label.textContent = `${EFC_WEEKDAY_LABELS[row.day_of_week]} · ${efcFormatTime(row.start_time)} – ${efcFormatTime(row.end_time)} · ${efcSessionTypeLabel(row.session_type)}${row.active ? '' : ' (inactive)'}`;
            const toggle = document.createElement('button');
            toggle.type = 'button'; toggle.className = 'btn-secondary';
            toggle.textContent = row.active ? 'DEACTIVATE' : 'ACTIVATE';
            toggle.addEventListener('click', async () => {
                await echelonAdminClient.from('coach_availability_windows').update({ active: !row.active }).eq('id', row.id);
                loadAvailabilityWindows();
            });
            const remove = document.createElement('button');
            remove.type = 'button'; remove.className = 'btn-secondary';
            remove.textContent = 'DELETE';
            remove.addEventListener('click', async () => {
                await echelonAdminClient.from('coach_availability_windows').delete().eq('id', row.id);
                loadAvailabilityWindows();
            });
            item.append(label, toggle, remove);
            windowList.append(item);
        });
    }

    windowForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        windowFeedback.textContent = '';
        const { day_of_week, start_time, end_time, session_type } = windowForm.elements;
        const { error } = await echelonAdminClient.from('coach_availability_windows').insert({
            day_of_week: Number(day_of_week.value),
            start_time: start_time.value,
            end_time: end_time.value,
            session_type: session_type.value
        });
        if (error) { windowFeedback.textContent = 'Could not save that window. Make sure the end time is after the start time.'; return; }
        windowForm.reset();
        loadAvailabilityWindows();
    });

    async function loadMembersForBooking() {
        const { data: members, error } = await echelonAdminClient
            .from('account_access')
            .select('user_id, archived_at')
            .eq('role', 'member');
        if (error) return;
        const activeIds = members.filter((member) => !member.archived_at).map((member) => member.user_id);
        if (!activeIds.length) return;
        const { data: profiles } = await echelonAdminClient
            .from('member_profiles')
            .select('user_id, full_name, email')
            .in('user_id', activeIds);
        memberSelect.innerHTML = '<option value="">Choose a member</option>';
        (profiles || []).forEach((profile) => {
            const option = document.createElement('option');
            option.value = profile.user_id;
            option.textContent = profile.full_name || profile.email;
            memberSelect.append(option);
        });
    }

    bookForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        bookFeedback.textContent = '';
        const { user_id, date, time, duration_minutes, session_type, notes } = bookForm.elements;
        if (!user_id.value) { bookFeedback.textContent = 'Choose a member first.'; return; }
        const scheduledAt = new Date(`${date.value}T${time.value}`);
        if (Number.isNaN(scheduledAt.getTime())) { bookFeedback.textContent = 'Choose a valid date and time.'; return; }
        const memberName = user_id.selectedOptions[0].textContent;
        const submit = bookForm.querySelector('button[type="submit"]');
        submit.disabled = true; submit.textContent = 'BOOKING…';
        const { data, error } = await echelonAdminClient.from('session_bookings').insert({
            user_id: user_id.value,
            member_name: memberName,
            session_type: session_type.value,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: Number(duration_minutes.value),
            notes: notes.value.trim() || null,
            booked_by: 'admin'
        }).select('id').single();
        submit.disabled = false; submit.textContent = 'BOOK SESSION';
        if (error) {
            bookFeedback.textContent = error.code === '23505' ? 'That time is already booked.' : 'Could not book that session.';
            return;
        }
        bookForm.reset();
        if (sessionsCalendar) sessionsCalendar.reload();
        efcSyncBookingToCalendar(data.id, 'create');
    });

    loadAvailabilityWindows();
    loadMembersForBooking();
    initializeCalendarConnection();
}
