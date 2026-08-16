const EFC_BOOKING_WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EFC_BOOKING_TYPE_LABELS = { one_on_one: '1-on-1', private_group: 'Private Group' };
const EFC_BOOKING_LOOKAHEAD_DAYS = 14;

function efcBookingTypeLabel(type) {
    return EFC_BOOKING_TYPE_LABELS[type] || type;
}

function efcWindowDurationMinutes(window) {
    const [startHours, startMinutes] = window.start_time.split(':').map(Number);
    const [endHours, endMinutes] = window.end_time.split(':').map(Number);
    return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

document.addEventListener('DOMContentLoaded', async () => {
    const upcomingList = document.getElementById('my-upcoming-sessions');
    if (!upcomingList) return;

    const member = await requireMemberSession();
    if (!member) return;

    const slotList = document.getElementById('open-slot-list');
    const feedback = document.getElementById('booking-feedback');

    const { data: waiver } = await echelonMemberClient
        .from('member_waivers')
        .select('full_name')
        .eq('user_id', member.id)
        .maybeSingle();
    const memberName = waiver?.full_name || member.email;

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
        if (!data.length) { upcomingList.textContent = 'Nothing booked yet, choose an open window below.'; return; }
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
                loadMySessions();
                loadOpenSlots();
            });
            item.append(label, cancel);
            upcomingList.append(item);
        });
    }

    async function loadOpenSlots() {
        feedback.textContent = '';
        const rangeStart = new Date();
        const rangeEnd = new Date(Date.now() + EFC_BOOKING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

        const [windowsResult, bookedResult] = await Promise.all([
            echelonMemberClient.from('coach_availability_windows').select('day_of_week, start_time, end_time, session_type').eq('active', true),
            echelonMemberClient.from('booked_session_times').select('scheduled_at').gte('scheduled_at', rangeStart.toISOString()).lte('scheduled_at', rangeEnd.toISOString())
        ]);

        slotList.innerHTML = '';
        if (windowsResult.error || bookedResult.error) { slotList.textContent = 'Could not load open windows.'; return; }

        const windows = windowsResult.data;
        if (!windows.length) { slotList.textContent = 'No standing availability has been set yet, check back soon.'; return; }
        const bookedTimes = new Set(bookedResult.data.map((row) => new Date(row.scheduled_at).getTime()));

        const slots = [];
        for (let offset = 0; offset < EFC_BOOKING_LOOKAHEAD_DAYS; offset++) {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            windows.filter((window) => window.day_of_week === date.getDay()).forEach((window) => {
                const [hours, minutes] = window.start_time.split(':').map(Number);
                const scheduledAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
                if (scheduledAt < new Date()) return;
                if (bookedTimes.has(scheduledAt.getTime())) return;
                slots.push({ scheduledAt, window });
            });
        }
        slots.sort((a, b) => a.scheduledAt - b.scheduledAt);

        if (!slots.length) { slotList.textContent = 'Nothing open in the next two weeks, check back soon.'; return; }
        slots.forEach(({ scheduledAt, window }) => {
            const item = document.createElement('div');
            item.className = 'availability-window-item';
            const label = document.createElement('span');
            label.textContent = `${scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${efcFormatBookingEndTime(scheduledAt, window)} · ${efcBookingTypeLabel(window.session_type)}`;
            const book = document.createElement('button');
            book.type = 'button'; book.className = 'btn-primary';
            book.textContent = 'BOOK';
            book.addEventListener('click', async () => {
                book.disabled = true; book.textContent = 'BOOKING…';
                const { error } = await echelonMemberClient.from('session_bookings').insert({
                    user_id: member.id,
                    member_name: memberName,
                    session_type: window.session_type,
                    scheduled_at: scheduledAt.toISOString(),
                    duration_minutes: efcWindowDurationMinutes(window),
                    booked_by: 'member'
                });
                if (error) {
                    feedback.textContent = error.code === '23505' ? 'That time was just booked, pick another.' : 'Could not book that session.';
                    book.disabled = false; book.textContent = 'BOOK';
                    loadOpenSlots();
                    return;
                }
                loadMySessions();
                loadOpenSlots();
            });
            item.append(label, book);
            slotList.append(item);
        });
    }

    function efcFormatBookingEndTime(scheduledAt, window) {
        const end = new Date(scheduledAt.getTime() + efcWindowDurationMinutes(window) * 60 * 1000);
        return end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    loadMySessions();
    loadOpenSlots();
});
