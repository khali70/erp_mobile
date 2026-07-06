# Screen 09 — الديون حسب الزبون / Debts by customer (AR / receivables)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **receivables report — debts owed to the shop by customers** in a small-shop accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الديون حسب الزبون". Left: white export chip (Lucide `download`). Far right: back arrow.
2. **Summary hero** — white card, border. Big warning-orange bold number "٩٬٤٠٠ ج.م" with label "إجمالي مستحق لك"; small green sub "محصّل هذا الشهر: ٦٬٢٠٠ ج.م".
3. **Sort/filter chips** — "الأكبر ديناً" (active), "الأحدث", "الكل".
4. **Customer debt rows** — white cards. Each (RTL): on the **right** a circular avatar (primary-light) with the customer's initial letter; name (SemiBold) + "آخر معاملة: ٢ يوليو" (muted). On the **left** the owed amount in **warning-orange bold** and a small muted "منذ ١٢ يوم" aging hint. Rows:
   - "أحمد محمود" · "٣٬٢٠٠ ج.م" · "منذ ١٢ يوم"
   - "شركة النور للتجارة" · "٤٬٩٠٠ ج.م" · "منذ ٥ أيام"
   - "خالد إبراهيم" · "١٬٣٠٠ ج.م" · "منذ ٢٠ يوم"
5. Each row has a small teal "تحصيل" (collect payment) text button / `hand-coins` icon on the far left.
6. **Bottom nav** — "التقارير" active.

Receivables use **warning-orange** (money owed TO the shop). RTL throughout.
