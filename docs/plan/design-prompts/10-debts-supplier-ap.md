# Screen 10 — الديون حسب المورد / Debts by supplier (AP / payables)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **payables report — debts the shop owes to suppliers** in a small-shop accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الديون حسب المورد". Left: white export chip (Lucide `download`). Far right: back arrow.
2. **Summary hero** — white card, border. Big **danger-red** bold number "٥٬١٢٠ ج.م" with label "إجمالي مستحق عليك"; small muted sub "مدفوع للموردين هذا الشهر: ٣٬٠٠٠ ج.م".
3. **Sort chips** — "الأكبر ديناً" (active), "الأحدث", "الكل".
4. **Supplier debt rows** — white cards. Each (RTL): on the **right** a rounded square avatar (primary-light) with Lucide `truck` icon; supplier name (SemiBold) + "آخر توريد: ٦ يوليو" (muted). On the **left** the owed amount in **danger-red bold** + muted aging "منذ ٣ أيام". Rows:
   - "شركة النور للتجارة" · "٧٦٠ ج.م" · "منذ ٠ يوم"
   - "مخازن الدلتا" · "٢٬٦٠٠ ج.م" · "منذ ٨ أيام"
   - "موزّع ملابس رجالي" · "١٬٧٦٠ ج.م" · "منذ ٤ أيام"
5. Each row has a small teal "سداد" (pay) button / Lucide `banknote` icon on the far left.
6. **Bottom nav** — "التقارير" active.

Payables use **danger-red** (money the shop OWES). RTL throughout.
