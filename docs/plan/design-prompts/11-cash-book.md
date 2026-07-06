# Screen 11 — دفتر النقدية / Cash book

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **cash book** (cash in/out ledger with running balance) in a small-shop accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "دفتر النقدية". Left: white export chip (`download`). Far right: back arrow.
2. **Balance hero** — solid teal card. Right-aligned small light label "الرصيد النقدي الحالي"; large bold white "١٨٬٤٥٠ ج.م". Two translucent inline stats: "وارد اليوم +٣٬٢٠٠" and "صادر اليوم −١٬١٠٠".
3. **Period chips** — "اليوم" (active), "الأسبوع", "الشهر".
4. **Ledger rows** — white cards. Each (RTL): on the **right** a colored round icon chip — cash-in = green `arrow-down-left`, cash-out = red `arrow-up-right`; description (SemiBold) + source/time (muted). On the **left** the signed amount (green `+` or red `−`) and below it a small muted running balance. Rows:
   - "تحصيل من أحمد محمود" · "بيع #١٠٥٠ · ٢:٣٠م" · "+٤٢٠" · رصيد "١٨٬٤٥٠"
   - "سداد لمخازن الدلتا" · "شراء #١٠٤٨ · ١:١٠م" · "−١٬١٠٠" · رصيد "١٨٬٠٣٠"
   - "مصروف: كهرباء" · "نفقات · ١١:٠٠ص" · "−٣٠٠" · رصيد "١٩٬١٣٠"
   - "مبيعات نقدية" · "بيع #١٠٤٧ · ١٠:١٥ص" · "+٦٨٠" · رصيد "١٩٬٤٣٠"
5. **Footer** — two buttons: "قبض" (green outline, `plus`) and "صرف" (red outline, `minus`) to record manual cash movements.

RTL throughout: description right, amount left.
