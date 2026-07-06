# Screen 06 — المستندات / Documents list

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for the **documents list** (all incoming/outgoing transactions) in a small-shop inventory ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "المستندات". Left: white filter chip (Lucide `sliders-horizontal`). Far right: back arrow.
2. **Segmented filter** — pills: "الكل" (active teal), "صادر", "وارد", "جرد" (stock-take).
3. **Date group label** — muted "اليوم · ٦ يوليو".
4. **Document rows** — white cards, border. Each (RTL): on the right a colored round icon chip — outgoing = teal `arrow-up`, incoming = green `arrow-down`, stock-take = muted `clipboard-list`. Next to it: document type + party name (SemiBold) and doc number + time (muted). On the left: amount (bold) and a small status pill ("مدفوع" green / "دَين" orange). Rows:
   - "صادر · أحمد محمود" · "#١٠٥٢ · ٢:٣٠م" · "١٬٣٦٠ ج.م" · pill "دَين" (orange)
   - "وارد · شركة النور" · "#١٠٥١ · ١٢:١٠م" · "١٬٧٦٠ ج.م" · pill "دَين" (orange)
   - "صادر · منى سعيد" · "#١٠٥٠ · ١١:٤٥ص" · "٤٢٠ ج.م" · pill "مدفوع" (green)
5. **Date group label** — "أمس · ٥ يوليو" then 2 more rows (one صادر مدفوع، one جرد "تسوية مخزون").
6. **Bottom nav** — "المستندات" active.

RTL throughout. Floating action: teal circular "+" button (Lucide `plus`) bottom-left.
