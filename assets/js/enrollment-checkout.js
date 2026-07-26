(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  const copy = document.getElementById('enrollment-copy'); const offer = document.getElementById('enrollment-offer'); const button = document.getElementById('enrollment-pay'); const feedback = document.getElementById('enrollment-feedback');
  if (!token) { copy.textContent = 'This private payment link is incomplete. Please contact Echelon for a new link.'; return; }
  fetch(`/api/enrollment/checkout?token=${encodeURIComponent(token)}`).then(async response => ({ response, body: await response.json() })).then(({ response, body }) => {
    if (!response.ok) throw new Error(body.error || 'This payment link is unavailable.');
    copy.textContent = 'Your coaching placement is ready. Review the selection below, then continue to Stripe to complete enrollment.';
    offer.textContent = body.program; offer.hidden = false; button.disabled = false;
  }).catch(error => { copy.textContent = error.message; });
  button.addEventListener('click', async () => {
    button.disabled = true; button.textContent = 'OPENING SECURE CHECKOUT…'; feedback.textContent = '';
    try { const response = await fetch('/api/enrollment/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); const body = await response.json(); if (!response.ok || !body.url) throw new Error(body.error || 'Checkout is unavailable.'); window.location.assign(body.url); }
    catch (error) { feedback.textContent = error.message; button.disabled = false; button.textContent = 'CONTINUE TO SECURE PAYMENT'; }
  });
})();

