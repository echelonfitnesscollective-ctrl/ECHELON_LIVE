const EFC_BOOKING_TYPE_LABELS = { one_on_one: '1-on-1', private_group: 'Private Training Group', group_fitness: 'Group Fitness' };
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

function efcProgramIsLive(row) {
    if (!row) return false;
    if (row.status !== 'launched' && row.status !== 'live') return false;
    if (row.status === 'live') return true;
    const now = new Date();
    if (row.launch_at && new Date(row.launch_at) > now) return false;
    if (row.expires_at && new Date(row.expires_at) <= now) return false;
    return true;
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
    let confirmedCounts = new Map();
    let waitlistedCounts = new Map();
    let busyRanges = [];

    async function loadMySessions() {
        const { data, error } = await echelonMemberClient
            .from('session_bookings')
            .select('id, session_type, class_label, scheduled_at, duration_minutes, status')
            .eq('user_id', member.id)
            .in('status', ['confirmed', 'waitlisted'])
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
            const typeName = row.class_label || efcBookingTypeLabel(row.session_type);
            const waitlistTag = row.status === 'waitlisted' ? ' · Waitlisted' : '';
            label.textContent = `${when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${typeName}${waitlistTag}`;
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

    function windowRecursOnDate(window, date) {
        if (window.day_of_week !== date.getDay()) return false;
        const interval = window.recurrence_interval_weeks || 1;
        if (interval <= 1 || !window.recurrence_anchor_date) return true;
        const anchor = new Date(`${window.recurrence_anchor_date}T00:00:00`);
        const weeksSinceAnchor = Math.round((date - anchor) / (7 * 24 * 60 * 60 * 1000));
        return weeksSinceAnchor >= 0 && weeksSinceAnchor % interval === 0;
    }

    function slotsForDate(date) {
        if (date < today || date > horizonEnd) return [];
        const slots = [];
        windows.filter((window) => windowRecursOnDate(window, date)).forEach((window) => {
            const [hours, minutes] = window.start_time.split(':').map(Number);
            const windowStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
            const windowEnd = new Date(windowStart.getTime() + efcWindowDurationMinutes(window) * 60 * 1000);

            if (window.session_type === 'one_on_one') {
                // Distinct-slot mode: up to `capacity` back-to-back appointments,
                // each `session_length_minutes` long, one confirmed member per
                // slot plus 1 waitlist spot (for a same-location back-to-back).
                const stepMs = window.session_length_minutes * 60 * 1000;
                for (let i = 0; i < window.capacity; i++) {
                    const scheduledAt = new Date(windowStart.getTime() + i * stepMs);
                    const slotEnd = new Date(scheduledAt.getTime() + stepMs);
                    if (slotEnd > windowEnd) break;
                    if (scheduledAt < new Date()) continue;
                    const confirmedTaken = confirmedCounts.get(scheduledAt.getTime()) || 0;
                    const waitlistedTaken = waitlistedCounts.get(scheduledAt.getTime()) || 0;
                    if (confirmedTaken >= 1 && waitlistedTaken >= 1) continue;
                    if (busyRanges.some((busy) => scheduledAt < busy.end && slotEnd > busy.start)) continue;
                    slots.push({ scheduledAt, window, taken: confirmedTaken, durationMinutes: window.session_length_minutes, isWaitlist: confirmedTaken >= 1 });
                }
                return;
            }

            // Group-style window: one shared start time, shared capacity, one waitlist spot.
            if (windowStart < new Date()) return;
            const confirmedTaken = confirmedCounts.get(windowStart.getTime()) || 0;
            const waitlistedTaken = waitlistedCounts.get(windowStart.getTime()) || 0;
            if (confirmedTaken >= window.capacity && waitlistedTaken >= 1) return;
            if (busyRanges.some((busy) => windowStart < busy.end && windowEnd > busy.start)) return;
            slots.push({
                scheduledAt: windowStart, window, taken: confirmedTaken,
                durationMinutes: efcWindowDurationMinutes(window),
                isWaitlist: confirmedTaken >= window.capacity,
            });
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
        slots.forEach(({ scheduledAt, window, taken, durationMinutes, isWaitlist }) => {
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const end = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
            const typeName = window.class_label || efcBookingTypeLabel(window.session_type);
            const countNote = window.session_type === 'one_on_one'
                ? (isWaitlist ? ' · full, waitlist open' : '')
                : (window.capacity > 1 ? (isWaitlist ? ' · full, waitlist open' : ` · ${taken}/${window.capacity} booked`) : '');
            const label = document.createElement('span');
            label.textContent = `${scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${typeName}${countNote}`;
            const book = document.createElement('button');
            book.type = 'button'; book.className = 'btn-primary';
            book.textContent = isWaitlist ? 'JOIN WAITLIST' : 'BOOK';
            book.addEventListener('click', async () => {
                const bookingLabel = isWaitlist ? 'JOIN WAITLIST' : 'BOOK';
                book.disabled = true; book.textContent = isWaitlist ? 'JOINING…' : 'BOOKING…';
                const { data, error } = await echelonMemberClient.from('session_bookings').insert({
                    user_id: member.id,
                    member_name: memberName,
                    session_type: window.session_type,
                    class_label: window.class_label || null,
                    scheduled_at: scheduledAt.toISOString(),
                    duration_minutes: durationMinutes,
                    booked_by: 'member',
                    window_id: window.id
                }).select('id, status').single();
                if (error) {
                    feedback.textContent = (error.code === '23505' || error.code === '23514') ? 'That slot just filled up, pick another.' : 'Could not book that session.';
                    book.disabled = false; book.textContent = bookingLabel;
                    refreshAvailability();
                    return;
                }
                feedback.textContent = data.status === 'waitlisted' ? "You're on the waitlist — we'll confirm you if a spot opens up." : '';
                loadMySessions();
                refreshAvailability();
                efcSyncBookingToCalendar(data.id, 'create');
            });
            item.append(label, book);
            detail.append(item);
        });
    }

    async function refreshAvailability() {
        const [windowsResult, bookedResult, programsResult, freshBusyRanges] = await Promise.all([
            echelonMemberClient.from('coach_availability_windows').select('id, day_of_week, start_time, end_time, session_type, class_label, capacity, session_length_minutes, program_key, recurrence_interval_weeks, recurrence_anchor_date').eq('active', true),
            echelonMemberClient.from('booked_session_times').select('scheduled_at, status').gte('scheduled_at', today.toISOString()).lte('scheduled_at', horizonEnd.toISOString()),
            echelonMemberClient.from('training_programs').select('program_key, status, launch_at, expires_at'),
            efcFetchBusyRanges()
        ]);
        if (windowsResult.error || bookedResult.error) { feedback.textContent = 'Could not load open windows.'; return; }
        const programsByKey = new Map((programsResult.data || []).map((row) => [row.program_key, row]));
        windows = windowsResult.data.filter((window) => !window.program_key || efcProgramIsLive(programsByKey.get(window.program_key)));
        confirmedCounts = new Map();
        waitlistedCounts = new Map();
        bookedResult.data.forEach((row) => {
            const time = new Date(row.scheduled_at).getTime();
            const map = row.status === 'waitlisted' ? waitlistedCounts : confirmedCounts;
            map.set(time, (map.get(time) || 0) + 1);
        });
        busyRanges = freshBusyRanges;
        renderGrid();
        renderDetail();
    }

    prevBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); renderGrid(); });
    nextBtn.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); renderGrid(); });

    loadMySessions();
    refreshAvailability();
});
