document.addEventListener('DOMContentLoaded', () => {
    const portal = document.querySelector('.resource-portal-card');
    if (!portal) return;

    portal.innerHTML = `
        <section class="resource-command" id="free-library">
            <div class="resource-command-copy"><span class="checkin-tag">YOUR OPEN-ACCESS PATH</span><h2>START WITH<br><span>WHAT YOU NEED.</span></h2><p>Pick the area that will make your next week easier: food, training, or consistency. Use one tool today, then build from there.</p></div>
            <ol class="resource-command-steps"><li><span>01</span><strong>CHOOSE A LANE</strong><p>Nutrition, training, or a weekly reset.</p></li><li><span>02</span><strong>USE ONE TOOL</strong><p>Apply the guide before chasing more information.</p></li><li><span>03</span><strong>BUILD YOUR RHYTHM</strong><p>Return when you are ready to personalize.</p></li></ol>
        </section>

        <section class="resource-library-section">
            <div class="resource-section-heading"><div><span class="checkin-tag">FREE STARTER LIBRARY</span><h2>THE RIGHT TOOL,<br>RIGHT NOW.</h2></div><p>Pick one focused category, not a pile of content. Each resource is designed to create a useful next action.</p></div>
            <nav class="resource-library-nav" aria-label="Free resource categories"><a href="#free-nutrition">01 · FUEL</a><a href="#free-training">02 · TRAINING</a><a href="#free-consistency">03 · CONSISTENCY</a></nav>
            <div class="resource-library-grid">
                <article id="free-nutrition" class="open-resource-card"><span>01 · FUEL</span><h3>5-MINUTE MEAL GUIDES</h3><p>Simple breakfast and lunch ideas for busy days: quick ingredients, dependable fuel, less guesswork.</p><div class="resource-card-links"><a href="../assets/images/5-Meals-Under-5-Min-Breakfast-Pt1B.png" target="_blank" rel="noopener">BREAKFAST GUIDE →</a><a href="../assets/images/5-Meals-Under-5-Min-Lunch-Pt1B.png" target="_blank" rel="noopener">LUNCH GUIDE →</a></div></article>
                <details id="free-training" class="open-resource-card"><summary><span>02 · TRAINING</span><h3>THE 3-PART STARTER</h3><p>A simple way to structure your first consistent training week.</p><strong>OPEN FRAMEWORK +</strong></summary><div><ol><li><b>Move:</b> Schedule three 30–45 minute sessions you can actually keep.</li><li><b>Build:</b> Use full-body basics: squat, hinge, push, pull, carry.</li><li><b>Recover:</b> Leave one easier day between hard sessions.</li></ol></div></details>
                <details id="free-consistency" class="open-resource-card"><summary><span>03 · CONSISTENCY</span><h3>THE WEEKLY RESET</h3><p>Close your week with a five-minute check before you start another one.</p><strong>OPEN RESET +</strong></summary><div><ol><li>What did I complete?</li><li>What got in my way?</li><li>What is one adjustment for next week?</li></ol></div></details>
            </div>
        </section>

        <section class="resource-principles"><span class="checkin-tag">THE ECHELON STANDARD</span><div><article><strong>TRAIN WITH INTENT.</strong><p>Choose the smallest plan you can execute consistently before chasing the most complicated one.</p></article><article><strong>FUEL THE WORK.</strong><p>Build meals around protein, produce, hydration, and the schedule you actually live.</p></article><article><strong>REVIEW, THEN ADJUST.</strong><p>Progress comes from noticing what works and making the next week more precise.</p></article></div></section>

        <section class="resource-vault-bridge">
            <div><span class="checkin-tag">WHEN YOU WANT MORE</span><h2>THE MEMBER VAULT<br><span>MAKES IT PERSONAL.</span></h2><p>The free library gives you a strong place to start. Membership brings the coach, plan, feedback, and tracking that connect it to your goals.</p></div>
            <div class="resource-vault-list"><p><span>01</span> YOUR CURRENT TRAINING PLAN</p><p><span>02</span> FUEL TRACKING &amp; PERSONAL TARGETS</p><p><span>03</span> WEEKLY REVIEW &amp; PROGRESS DATA</p><p><span>04</span> PRIVATE COACH SUPPORT</p><a href="member-login.html" class="btn-primary">ENTER MEMBER VAULT →</a></div>
        </section>`;
});
