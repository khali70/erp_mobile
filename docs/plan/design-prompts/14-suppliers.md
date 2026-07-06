# Screen 14 — الموردون / Suppliers list

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **suppliers list** (with payables) in a small-shop ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الموردون". Left: white "+" add chip (`plus`). Far right: back arrow.
2. **Summary** — two white stat cards: "مستحق عليك (AP)" → "٥٬١٢٠ ج.م" (danger-red bold); "مدفوع هذا الشهر" → "٣٬٠٠٠ ج.م" (muted).
3. **Search bar** — white field, `search` on right, placeholder "ابحث عن مورد".
4. **Filter chips** — "الكل" (active), "علينا ديون", "خالص".
5. **Supplier rows** — white cards. Each (RTL): on the **right** a rounded-square primary-light avatar with Lucide `truck` icon; name (SemiBold) + phone with `phone` icon (muted). On the **left** the payable balance bold + colored tag:
   - "شركة النور للتجارة" · "٠١٢٧٧٧٧٧٧٧" · "٧٦٠" · tag "علينا" (red)
   - "مخازن الدلتا" · "٠١٠٨٨٨٨٨٨٨" · "٢٬٦٠٠" · tag "علينا" (red)
   - "موزّع المشروبات" · "٠١١٤٤٤٤٤٤٤" · "١٬٧٦٠" · tag "علينا" (red)
   - "مطبعة الأصناف" · "٠١٢٣٣٣٣٣٣٣" · "خالص" · tag "لا ديون" (green)
6. **Bottom nav** — "المزيد" active.

RTL throughout: avatar right, balance left. Danger-red = shop owes supplier.
