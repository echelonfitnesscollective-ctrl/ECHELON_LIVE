const EFC_BOOKING_TYPE_LABELS = { one_on_one: '1-on-1', private_group: 'Private Group' };
const EFC_BOOKING_HORIZON_DAYS = 60;

function efcBookingTypeLabel(type) {
    return EFC_BOOKING_TYPE_LABELS[type] || type;
}

function efcWindowDurationMinutes(window) {
    const [startHours, startMinutes] = window.start_time.split(':').map(Number);
    const [endHours, endMinutes] = window.end_time.split(':').map(Number);
    return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

function efcDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function efcSyncBookingToCalendar(bookingId, action) {
    try {
        const { data: sessionData } = await echelonMemberClient.auth.getSession();
        await fetch('/api/calendar/sync-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
            body: JSON.stringify({ bookingId, action })
        });
    } catch (_) { /* best-effort, the in-app booking already succeeded */ }
}

async function efcFetchBusyRanges() {
    try {
        const { data: sessionData } = await echelonMemberClient.auth.getSession();
        const result = await fetch(`/api/calendar/freebusy?days=${EFC_BOOKING_HORIZON_DAYS}`, {
            headers: { Authorization: `Bearer ${sessionData.session?.access_token || ''}` }
        });
        const body = await result.json().catch(() => ({}));
        return (body.busy || []).map((range) => ({ start: new Date(range.start), end: new Date(range.end) }));
    } catch (_) {
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const upcomingList = document.getElementById('my-upcoming-sessions');
    if (!upcomingList) return;

    const member = await requireMemberSession();
    if (!member) return;

    const grid = document.getElementById('booking-calendar-grid');
    const calendarLabel = document.getElementById('booking-calendar-label');
    const prevBtn = document.getElementById('booking-calendar-prev');
    const nextBtn = document.getElementById('booking-calendar-next');
    const detail = document.getElementById('booking-calendar-day-detail');
    const feedback = document.getElementById('booking-feedback');

    const { data: waiver } = await echelonMemberClient
        .from('member_waivers')
        .select('full_name')
        .eq('user_id', member.id)
        .maybeSingle();
    const memberName = waiver?.full_name || member.email;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizonEnd = new Date(today.getTime() + EFC_BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    let selectedKey = efcDateKey(today);
    let windows = [];
    let bookedTimes = new Set();
    let busyRanges = [];

    async function loadMySessions() {
        const { data, error } = await echelonMemberClient
            .from('session_bookings')
            .select('id, session_type, scheduled_at, duration_minutes')
            .eq('user_id', member.id)
            .eq('status', 'confirmed')
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true });
        upcomingList.innerHTML = '';
        if (error) { upcomingList.textContent = 'Could not load your sessions.'; return; }
        if (!data.length) { upcomingList.textContent = 'Nothing booked yet, choose an open day below.'; return; }
        data.forEach((row) => {
            const when = new Date(row.scheduled_at);
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const label = document.createElement('span');
            label.textContent = `${when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${efcBookingTypeLabel(row.session_type)}`;
            const cancel = document.createElement('button');
            cancel.type = 'button'; cancel.className = 'btn-secondary';
            cancel.textContent = 'CANCEL';
            cancel.addEventListener('click', async () => {
                await echelonMemberClient.from('session_bookings').update({ status: 'canceled' }).eq('id', row.id);
                efcSyncBookingToCalendar(row.id, 'cancel');
                loadMySessions();
                refreshAvailability();
            });
            item.append(label, cancel);
            upcomingList.append(item);
        });
    }

    function slotsForDate(date) {
        if (date < today || date > horizonEnd) return [];
        const slots = [];
        windows.filter((window) => window.day_of_week === date.getDay()).forEach((window) => {
            const [hours, minutes] = window.start_time.split(':').map(Number);
            const scheduledAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
            if (scheduledAt < new Date()) return;
            if (bookedTimes.has(scheduledAt.getTime())) return;
            const slotEnd = new Date(scheduledAt.getTime() + efcWindowDurationMinutes(window) * 60 * 1000);
            if (busyRanges.some((busy) => scheduledAt < busy.end && slotEnd > busy.start)) return;
            slots.push({ scheduledAt, window });
        });
        return slots.sort((a, b) => a.scheduledAt - b.scheduledAt);
    }

    function renderGrid() {
        const beforeHorizon = cursor <= new Date(today.getFullYear(), today.getMonth(), 1);
        prevBtn.disabled = beforeHorizon;
        const nextMonthStart = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        nextBtn.disabled = nextMonthStart > horizonEnd;

        calendarLabel.textContent = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
        const todayKey = efcDateKey(today);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const key = efcDateKey(date);
            const inRange = date >= today && date <= horizonEnd;
            const cell = document.createElement(inRange ? 'button' : 'div');
            if (inRange) cell.type = 'button';
            cell.className = `month-calendar-day${inRange ? ' month-calendar-day-active' : ''}`;
            if (key === todayKey) cell.classList.add('month-calendar-day-today');
            if (key === selectedKey) cell.classList.add('month-calendar-day-selected');
            cell.append(document.createTextNode(String(day)));
            if (inRange && slotsForDate(date).length) {
                const dot = document.createElement('span');
                dot.className = 'month-calendar-day-dot';
                cell.append(dot);
            }
            if (inRange) cell.addEventListener('click', () => { selectedKey = key; renderGrid(); renderDetail(); });
            grid.append(cell);
        }
    }

    function renderDetail() {
        detail.innerHTML = '';
        const [year, month, day] = selectedKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const heading = document.createElement('h4');
        heading.textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        detail.append(heading);

        const slots = slotsForDate(date);
        if (!slots.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-detail-empty';
            empty.textContent = 'No open windows this day.';
            detail.append(empty);
            return;
        }
        slots.forEach(({ scheduledAt, window }) => {
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const end = new Date(scheduledAt.getTime() + efcWindowDurationMinutes(window) * 60 * 1000);
            const label = document.createElement('span');
            label.textContent = `${scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${efcBookingTypeLabel(window.session_type)}`;
            const book = document.createElement('button');
            book.type = 'button'; book.className = 'btn-primary';
            book.textContent = 'BOOK';
            book.addEventListener('click', async () => {
                book.disabled = true; book.textContent = 'BOOKING…';
                const { data, error } = await echelonMemberClient.from('session_bookings').insert({
                    user_id: member.id,
                    member_name: memberName,
                    session_type: window.session_type,
                    scheduled_at: scheduledAt.toISOString(),
                    duration_minutes: efcWindowDurationMinutes(window),
                    booked_by: 'member'
                }).select('id').single();
                if (error) {
                    feedback.textContent = error.code === '23505' ? 'That time was just booked, pick another.' : 'Could not book that session.';
                    book.disabled = false; book.textContent = 'BOOK';
                    refreshAvailability();
                    return;
                }
                feedback.textContent = '';
                loadMySessions();
                refreshAvailability();
                efcSyncBookingToCalendar(data.id, 'create');
            });
            item.append(label, book);
            detail.append(item);
        });
    }

    async function refreshAvailability() {
        const [windowsResult, bookedResult, freshBusyRanges] = await Promise.all([
            echelonMemberClient.from('coach_availability_windows').select('day_of_week, start_time, end_time, session_type').eq('active', true),
            echelonMemberClient.from('booked_session_times').select('scheduled_at').gte('scheduled_at', today.toISOString()).lte('scheduled_at', horizonEnd.toISOString()),
            efcFetchBusyRanges()
        ]);
        if (windowsResult.error || bookedResult.error) { feedback.textContent = 'Could not load open windows.'; return; }
        windows = windowsResult.data;
        bookedTimes = new Set(bookedResult.data.map((row) => new Date(row.scheduled_at).getTime()));
        busyRanges = freshBusyRanges;
        renderGrid();
        renderDetail();
    }

    prevBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); renderGrid(); });
    nextBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); renderGrid(); });

    loadMySessions();
    refreshAvailability();
});
