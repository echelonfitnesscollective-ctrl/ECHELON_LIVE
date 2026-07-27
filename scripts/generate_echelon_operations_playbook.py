from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether


OUT = Path(__file__).resolve().parents[1] / "output/pdf/Echelon-Operations-Playbook.pdf"
GOLD = colors.HexColor("#D7B55B")
INK = colors.HexColor("#090909")
MUTED = colors.HexColor("#666666")


def p(text, style):
    return Paragraph(text, style)


def section(title, subtitle, styles):
    return [Spacer(1, 8), p(title, styles["section"]), p(subtitle, styles["sub"]), Spacer(1, 10)]


def flow_table(rows, styles):
    data = [[p("CLIENT / PUBLIC", styles["tablehead"]), p("ECHELON / COACH", styles["tablehead"]), p("SYSTEM", styles["tablehead"])]]
    for a, b, c in rows:
        data.append([p(a, styles["cell"]), p(b, styles["cell"]), p(c, styles["cell"])])
    t = Table(data, colWidths=[2.1 * inch, 2.55 * inch, 2.1 * inch], repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CFCFCF")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAFAF8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def script_block(label, subject, body, styles):
    return KeepTogether([
        p(label, styles["scriptlabel"]),
        p(f"<b>Subject:</b> {subject}", styles["scriptmeta"]),
        p(body, styles["script"]),
        Spacer(1, 8),
    ])


def page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.65 * inch, 0.42 * inch, "ECHELON FITNESS COLLECTIVE - OPERATIONS PLAYBOOK")
    canvas.drawRightString(7.85 * inch, 0.42 * inch, f"PAGE {doc.page}")
    canvas.restoreState()


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUT), pagesize=letter, rightMargin=.62 * inch, leftMargin=.62 * inch, topMargin=.62 * inch, bottomMargin=.7 * inch)
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=28, leading=30, textColor=INK, spaceAfter=10),
        "kicker": ParagraphStyle("kicker", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=GOLD, letterSpacing=2),
        "lead": ParagraphStyle("lead", parent=base["Normal"], fontSize=12, leading=18, textColor=colors.HexColor("#303030"), spaceAfter=10),
        "section": ParagraphStyle("section", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=INK, spaceAfter=3),
        "sub": ParagraphStyle("sub", parent=base["Normal"], fontSize=9.3, leading=13.5, textColor=MUTED),
        "body": ParagraphStyle("body", parent=base["Normal"], fontSize=9.4, leading=14.5, textColor=colors.HexColor("#262626"), spaceAfter=7),
        "tablehead": ParagraphStyle("tablehead", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7.7, leading=10, textColor=colors.white),
        "cell": ParagraphStyle("cell", parent=base["Normal"], fontSize=7.7, leading=10.7, textColor=colors.HexColor("#222222")),
        "scriptlabel": ParagraphStyle("scriptlabel", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=GOLD, backColor=INK, borderPadding=5),
        "scriptmeta": ParagraphStyle("scriptmeta", parent=base["Normal"], fontSize=8, leading=11, textColor=MUTED, spaceBefore=5),
        "script": ParagraphStyle("script", parent=base["Normal"], fontSize=8.6, leading=13, textColor=colors.HexColor("#242424"), borderColor=colors.HexColor("#D7D7D7"), borderWidth=.5, borderPadding=8, backColor=colors.HexColor("#FBFBF9")),
        "small": ParagraphStyle("small", parent=base["Normal"], fontSize=8, leading=11.5, textColor=MUTED),
    }
    story = []
    story += [p("ECHELON FITNESS COLLECTIVE", styles["kicker"]), p("OPERATIONS PLAYBOOK", styles["title"]), p("Client journey, coach workflow, booking rules, and ready-to-send communication scripts.", styles["lead"])]
    story += [Spacer(1, 8), p("HOW TO USE THIS", styles["section"]), p("Use this as the handoff manual for any person operating Echelon. Read the Client column to understand what people experience. Read the Coach column to know the action that must happen next. The System column names the tool or record that should hold the work.", styles["body"])]
    story += [flow_table([
        ("Find Echelon through a referral, social post, QR code, search, or a partner.", "Keep the homepage current, review inbound requests daily, and make the next action clear.", "Website, Google Business Profile, social links, partner links."),
        ("Choose a lane: Group Fitness, 12-Week Transformation, 1-on-1 Coaching, Private Group Training, or free resources.", "Do not sell every lane personally. Direct people to the correct page and preserve fixed delivery windows.", "Training Hub, Resources Hub, Coaching Application."),
        ("Receive a clear response, payment path, schedule, onboarding, and member experience.", "Move every approved person through the same sequence: approve, collect payment, invite, onboard, schedule, deliver, review.", "Formspree, Stripe, Supabase, Calendly, Member Hub, Admin Console."),
    ], styles)]
    story += [PageBreak()]

    story += section("1. HOMEPAGE TO FIRST ACTION", "Public visitor flow from the first landing page through the footer.", styles)
    story += [flow_table([
        ("Reads the brand promise and chooses About, Training, Resources, Shop, or Contact.", "Keep each navigation destination active and current. Do not promise a program that has not launched.", "Homepage navigation and CMS."),
        ("Uses free resources without a paywall.", "Provide useful starter content. Use the Member Vault invitation only after genuine value is delivered.", "Resources Hub and Member Portal."),
        ("Chooses an offer in Training Hub.", "Group Fitness is fixed-schedule. 1-on-1 is limited roster. 12-Week is structured coaching. Private Groups use event windows only.", "Training Hub and Coaching Application."),
        ("Uses footer links for policy, contact, sponsorship, coaching interest, or member access.", "Check links quarterly. Route sponsorship and coach interest into the Contact form with the inquiry type preselected.", "Footer, Formspree."),
    ], styles)]
    story += [p("Operating rule: the public site invites interest, but it never promises a specific appointment time. Availability is released only after you decide it fits your schedule.", styles["body"])]

    story += section("2. CONTACT, SPONSOR, AND GENERAL INQUIRY", "The lightweight lead flow - appropriate for questions that do not need a full coaching application.", styles)
    story += [flow_table([
        ("Submits name, email, inquiry type, and message.", "Review Formspree notification. Categorize: coaching, group event, sponsor, merch, media, or general question.", "Contact form -> Formspree -> Admin Console task."),
        ("Receives acknowledgement.", "Reply within one business day. Answer directly when possible; otherwise name the next step and date.", "Gmail / saved scripts."),
        ("Moves to coaching application or private-group inquiry when needed.", "Never collect health history by email. Use the correct secured application/onboarding flow.", "Coaching Application, Member Onboarding."),
    ], styles)]
    story += [PageBreak()]

    story += section("3. GROUP FITNESS AND COMMUNITY EVENTS", "A scalable recurring offer. The schedule is the product boundary.", styles)
    story += [flow_table([
        ("Chooses $20 drop-in or $59/month for scheduled Group Fitness sessions.", "Publish only the sessions you can reliably coach. 'Unlimited' means all scheduled Echelon Group Fitness sessions, not private training or special events.", "Stripe product catalog, Training Hub."),
        ("Books or attends a published class / community workout and completes check-in.", "Use check-in roster for attendance, readiness, waivers, and follow-up. Keep one free community workout each month as a lead generator.", "Check-in form, Admin Console."),
        ("Returns consistently or is invited into higher-touch coaching.", "Offer 12-week or 1-on-1 only when the person needs structure beyond the group format.", "Member Hub, Coaching Application."),
    ], styles)]
    story += [p("Coach capacity guardrail: launch with one or two fixed weekly group classes. Add another slot only after the existing slot is consistently attended and recovery/admin work is under control.", styles["body"])]

    story += section("4. COACHING APPLICATION -> ACCEPTANCE -> PAYMENT", "Use this flow for 1-on-1 Coaching, 12-Week Transformation, and Private Group Training.", styles)
    story += [flow_table([
        ("Selects a program and submits the coaching application.", "Review application in Formspree/Admin Console. The Private Group detail field only appears for group/organization applicants.", "Coaching Application -> Formspree."),
        ("Waits for decision.", "Approve, waitlist, decline, or request a discovery call. Add a task and response deadline; do not leave applications unowned.", "Admin Console tasks."),
        ("If accepted, receives payment link.", "Send the correct Stripe payment link. Payment is the commitment point; do not reserve recurring capacity before payment clears.", "Stripe, Admin Console."),
        ("Pays and receives account/onboarding next steps.", "Create/invite Supabase member if needed. Send onboarding, waiver, and portal link. Mark payment state in Admin Console.", "Stripe, Supabase Auth, Member Portal."),
    ], styles)]
    story += [PageBreak()]

    story += section("5. 1-ON-1 AND 12-WEEK DELIVERY", "Two different promises. Keep them distinct so your time stays protected.", styles)
    story += [flow_table([
        ("1-on-1: receives individualized plan, support, and approved coaching appointments.", "Cap roster initially at 4-6 hybrid clients. Release appointments only inside calendar windows that do not conflict with Burn shifts or group classes.", "Calendly, Member Hub, Admin Console."),
        ("12-Week: follows shared progression, portal tasks, nutrition support, and weekly review.", "Run this as a structured coaching system, not a second 1-on-1 roster. Define one weekly review cadence and one escalation route.", "Member Hub, Weekly Check-in, Coach tasks."),
        ("Uses the Member Hub to log progress, nutrition, photos, messages, and check-ins.", "Review the information on your planned cadence. Respond to safety, missed-session, or high-priority messages first.", "Supabase, Member Hub, Admin Console."),
    ], styles)]
    story += [p("Capacity guardrail: group members receive group access; 12-week members receive structured coaching; 1-on-1 members receive scarce appointment time. Do not let one tier quietly absorb the work of another.", styles["body"])]
    story += [PageBreak()]

    story += section("6. PRIVATE GROUP TRAINING / ORGANIZATION WELLNESS", "Premium event service for 3-15 people.", styles)
    story += [flow_table([
        ("Organizer applies with group size, goal, location, preferred date, and cadence.", "Confirm fit, safety, location, travel, and actual coaching capacity. Quote rather than automatically confirming an event.", "Group application, Admin Console."),
        ("Receives approved quote and payment request.", "Base catalog reference: $199 for up to 5 people + $25 each additional participant. Use a custom quote for organizations, travel, special equipment, or special timing.", "Stripe / invoice / payment link."),
        ("Pays, then receives a private booking link.", "Release only designated event windows in Calendly. Do not expose your full calendar. Require final headcount and waiver/check-in deadline.", "Calendly, Check-in, Admin Console."),
        ("Group attends; organizer receives follow-up.", "Capture attendance, note opportunities for monthly continuation, and send a short recap / next-step offer within 48 hours.", "Check-in roster, Coach notes, email."),
    ], styles)]
    story += [PageBreak()]

    story += section("7. CALENDAR AND AVAILABILITY RULES", "Calendly is the booking surface. Your connected calendar is the source of truth.", styles)
    story += [p("Connect Calendly to the calendar holding your Burn shifts and personal conflicts. Create a separate Echelon calendar for confirmed sessions. Calendly should check conflicts across both calendars, then add confirmed Echelon bookings to the Echelon calendar.", styles["body"])]
    story += [flow_table([
        ("1-on-1 client", "Receives a 45-60 minute Calendly link only after approval/payment. Limit the event type to released coaching windows.", "Calendly event: Echelon 1-on-1 Session."),
        ("Private group organizer", "Receives a 90-minute Calendly link after approval/payment. Offer only designated event windows, not your normal 1-on-1 blocks.", "Calendly event: Echelon Private Group Training."),
        ("New lead", "May receive a 15-minute discovery-call link only if you want a screening step. Otherwise application comes first.", "Calendly event: Echelon Discovery Call."),
        ("Community / group client", "Does not self-book a private slot. They attend the fixed public schedule or event page.", "Published schedule + Check-in."),
    ], styles)]
    story += [p("Required Calendly settings: minimum notice 24 hours, maximum booking range 30 days, buffers before/after sessions, cancellation cutoff, daily appointment cap, and no same-day override unless you manually approve it.", styles["body"])]

    story += section("8. MEMBER PORTAL, CHECK-IN, AND SUPPORT", "What happens after someone becomes a member.", styles)
    story += [flow_table([
        ("Signs in, completes onboarding/waiver, then sees ordered next actions.", "Confirm profile, waiver, program, and emergency details are complete before coached activity.", "Supabase Auth, Member Onboarding."),
        ("Uses member check-in; profile details prefill but remain editable.", "Review readiness responses before live sessions when risk or new health information appears.", "Check-in + Admin Console."),
        ("Sends coach message, logs nutrition, weight, progress photos, or weekly review.", "Use message separator / ownership, coach notes, and task queue. Sensitive information remains in approved systems, not random texts.", "Member Coaching, Nutrition, Performance, Admin Console."),
    ], styles)]
    story += [PageBreak()]

    story += section("9. ADMIN CONSOLE AND CONTENT MANAGEMENT", "The operating room - one source of truth for work that needs action.", styles)
    story += [flow_table([
        ("Applicant/member sees clear status and next step.", "Review applications, payments, check-ins, tasks, and messages daily. Delete only duplicate/test entries; preserve real client history.", "Admin Console, Supabase."),
        ("Public site remains current.", "Use CMS for approved content, media carousel, announcements, resource highlights, and event messaging. Review before publishing.", "Admin CMS, media manager."),
        ("A replacement operator can take over.", "Keep credentials in a password manager, not the site or this PDF. Update the Operators Manual whenever a tool, form, price, or workflow changes.", "Operators Manual, password manager."),
    ], styles)]
    story += [p("Current systems map: Website and hosting (GitHub + Vercel), database/member accounts (Supabase), inbound forms (Formspree), payments (Stripe), scheduling (Calendly once connected), email (Gmail), reviews (Google Business Profile), and merch (Etsy when linked).", styles["body"])]

    story += section("10. READY-TO-SEND SCRIPTS", "Use these as the default starting point. Personalize the bracketed fields and keep promises specific.", styles)
    scripts = [
        ("GENERAL INQUIRY ACKNOWLEDGEMENT", "We received your Echelon request", "Hey [First Name], thanks for reaching out to Echelon Fitness Collective. I received your message about [topic]. I’m reviewing it now and will get back to you by [day/time]. If you are looking for coaching, the best next step is the Echelon application so I can recommend the right lane."),
        ("COACHING APPLICATION RECEIVED", "Your Echelon application is in", "Hey [First Name], your application is in. I’m reviewing your goals, schedule, and the level of coaching you are looking for. I’ll follow up by [day/time] with either next steps, a question, or a fit recommendation. No action is needed from you right now."),
        ("APPLICATION ACCEPTED - PAYMENT", "You’re approved for Echelon", "Hey [First Name], I’m ready to move forward with you for [program]. Your next step is to complete enrollment here: [Stripe payment link]. Once payment is complete, I’ll send your portal access, onboarding steps, and the right booking link if your program includes appointments."),
        ("PAYMENT RECEIVED - ONBOARDING", "Welcome to Echelon", "Welcome, [First Name]. Your enrollment is confirmed. Complete these in order: 1) create/sign in to your Member Hub, 2) complete onboarding and waiver, 3) review your first next action. After that, I’ll confirm your program start and any scheduling details."),
        ("1-ON-1 CALENDAR INVITATION", "Choose your Echelon session time", "Hey [First Name], your coaching windows are now open. Use this private link to choose a session that works for you: [Calendly 1-on-1 link]. It only shows confirmed Echelon availability. Please book at least [24] hours ahead and use the reschedule link if plans change."),
        ("PRIVATE GROUP APPROVAL", "Your private group training is ready to confirm", "Hey [Organizer Name], your group experience for [date range / goal] is approved. Your quote is [amount] for [headcount / scope]. Complete payment here: [Stripe link]. After payment, I’ll send your private booking link, final headcount deadline, and check-in instructions for the group."),
        ("PRIVATE GROUP CONFIRMED", "Your Echelon group session is confirmed", "Your Echelon group experience is confirmed for [date/time/location]. Final headcount: [number]. Please have every participant complete the check-in/waiver by [deadline]: [link]. Bring water and arrive [10-15] minutes early. Reply here with any accessibility, injury, or location updates."),
        ("WEEKLY CHECK-IN RESPONSE", "Your next week at Echelon", "Hey [First Name], I reviewed your check-in. This week the focus is [focus]. Keep [one habit] steady, adjust [one item], and let me know if [specific barrier] changes. Your consistency matters more than making the week perfect."),
        ("NO-FIT / WAITLIST", "Echelon next step", "Hey [First Name], thanks for your application. I don’t want to over-promise capacity, so I’m not opening a spot in [program] right now. I can [offer group fitness / add you to the waitlist / recommend the 12-week path]. If you want, I’ll keep you first in line when the next appropriate opening is available."),
        ("POST-EVENT FOLLOW-UP", "Strong work with Echelon", "Thank you for bringing your group out, [Organizer Name]. I appreciate the energy your people brought to the session. If you want to keep the momentum going, I can build a recurring monthly format or help you choose the next Echelon step for the group."),
    ]
    for label, subject, body in scripts:
        story.append(script_block(label, subject, body, styles))
    story += [Spacer(1, 6), p("FINAL OPERATING PRINCIPLE: Publish fewer promises, deliver them consistently, and let the system protect your time. Every lead should have one clear next step; every paid client should have one clear owner and one clear cadence.", styles["lead"])]
    doc.build(story, onFirstPage=page_number, onLaterPages=page_number)
    print(OUT)


if __name__ == "__main__":
    build()
