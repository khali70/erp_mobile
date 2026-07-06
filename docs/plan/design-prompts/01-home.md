# Screen 01 — الرئيسية / Home (dashboard)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for the **home dashboard** of a local single-user inventory + accounting ERP app for a small shop. Flat modern design, production-ready, not a wireframe. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white surfaces `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout, top to bottom:**

1. **Top bar** — solid teal, ~52px top padding. Right side: store selector "المتجر الرئيسي" (bold white) with a small store icon (Lucide `store`) and a down chevron. Left side: a semi-transparent white rounded square holding a settings icon (Lucide `settings`). Below, small white subtitle "الجرد والمخزون ببساطة".
2. **KPI grid** — 2×2 white cards with border, 16px radius. Each card: a small colored dot + muted label (right-aligned), a large bold value, a small colored sub-label:
   - "قيمة المخزون" → `٤٨٬٣٢٠` "ج.م" (teal dot)
   - "أرباح الشهر" → `١٢٬٧٥٠` "▲ ٪۸" (green dot, green sub)
   - "ديون لك (زبائن)" → `٩٬٤٠٠` "مستحق" (warning/orange dot)
   - "ديون عليك (موردون)" → `٥٬١٢٠` "واجب" (red dot)
3. **Quick actions** — a row of 3 large buttons: "صادر جديد" (teal fill, white, Lucide `arrow-up`), "وارد جديد" (white, teal outline, Lucide `arrow-down`), "باركود" (white, border, Lucide `scan-line`).
4. **Section title** "الأقسام" (bold, right-aligned).
5. **Menu grid** — 2 rows × 3 white tiles, each: a teal icon on a primary-light rounded square + label below. Tiles: "المستندات" (Lucide `receipt-text`, red count badge "3"), "البضائع" (`package`, badge "1"), "النفقات" (`banknote`), "التقارير" (`bar-chart-3`), "الزبائن" (`users`), "الموردون" (`truck`).
6. **Bottom nav** — white bar, top border, 5 items with Lucide icons + Arabic labels: الرئيسية (`home`, active teal), المستندات (`receipt-text`), البضائع (`package`), التقارير (`bar-chart-3`), المزيد (`more-horizontal`).

RTL throughout: titles and labels right-aligned, back/store on the right, actions on the left.
