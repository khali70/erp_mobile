# Screen 12 — النفقات / Expenses

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for an **expenses** screen in a small-shop accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "النفقات". Left: white "+" add chip (`plus`). Far right: back arrow.
2. **Summary hero** — white card. Big danger-red bold "٥٬١٢٠ ج.م" label "نفقات يوليو"; small muted "الشهر الماضي: ٤٬٦٠٠ ج.م".
3. **Category chips** — "الكل" (active), "إيجار", "رواتب", "كهرباء", "نقل", "أخرى".
4. **Expense rows** — white cards. Each (RTL): on the **right** a colored round icon chip per category (Lucide `home` rent, `users` salaries, `zap` electricity, `truck` transport, `receipt` other); title (SemiBold) + date (muted). On the **left** amount in danger-red bold. Rows:
   - "إيجار المحل" · "١ يوليو" · "٣٬٠٠٠ ج.م" (`home`)
   - "راتب عامل" · "١ يوليو" · "١٬٥٠٠ ج.م" (`users`)
   - "فاتورة كهرباء" · "٤ يوليو" · "٣٠٠ ج.م" (`zap`)
   - "بنزين توصيل" · "٥ يوليو" · "٢٢٠ ج.م" (`truck`)
   - "مصاريف نثرية" · "٦ يوليو" · "١٠٠ ج.م" (`receipt`)
5. **Bottom nav** — "المزيد" active, or floating teal "+" (Lucide `plus`) bottom-left to add expense.

RTL throughout: title right, amount left. All expenses reduce cash and hit P&L operating expenses.
