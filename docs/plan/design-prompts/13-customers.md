# Screen 13 — الزبائن / Customers list

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **customers list** (with balances) in a small-shop ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الزبائن". Left: white "+" add chip (`plus`). Far right: back arrow.
2. **Summary** — two side-by-side white stat cards: "مستحق لك (AR)" → "٩٬٤٠٠ ج.م" (warning-orange bold); "محصّل هذا الشهر" → "٦٬٢٠٠ ج.م" (green bold). Small "ج.م" prefix.
3. **Search bar** — white field, Lucide `search` on right, placeholder "ابحث عن زبون أو رقم هاتف".
4. **Filter chips** — "الكل" (active), "عليهم ديون", "دائنون".
5. **Customer rows** — white cards. Each (RTL): on the **right** a circular primary-light avatar with initial letter; name (SemiBold) + phone with Lucide `phone` icon (muted). On the **left** the balance bold + a small colored tag pill below it:
   - "أحمد محمود" · "٠١٠٠١٢٣٤٥٦٧" · "٣٬٢٠٠" · tag "عليه دَين" (orange)
   - "منى سعيد" · "٠١٢٢٢٢٢٢٢٢" · "خالص" · tag "لا ديون" (green)
   - "شركة النور للتجارة" · "٠١٢٧٧٧٧٧٧٧" · "٤٬٩٠٠" · tag "عليه دَين" (orange)
   - "خالد إبراهيم" · "٠١١٩٩٩٩٩٩٩" · "١٬٣٠٠" · tag "عليه دَين" (orange)
   - "فاطمة علي" · "٠١٠٥٥٥٥٥٥٥" · "دفعة مقدّمة" · tag "دائن" (teal)
6. **Bottom nav** — "المزيد" active.

RTL throughout: avatar right, balance left. Warning-orange = owes shop; teal = customer in credit.
