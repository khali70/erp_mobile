# Screen 04 — صادر جديد / New Outgoing document (sale)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **new outgoing document (sale)** form in a small-shop inventory ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "صادر جديد · بيع". Left: white save/check chip (Lucide `check`). Far right: back arrow (`arrow-right`).
2. **Form fields** — each a white rounded input with a muted label above (right-aligned), a leading icon on the right, a value, and a down chevron on the left:
   - "الزبون" → "أحمد محمود" (Lucide `user`, value in teal) — **tappable → customer picker sheet (see §2a)**
   - "التاريخ" → "٦ يوليو ٢٠٢٦" (Lucide `calendar`)
   - "المتجر" → "المتجر الرئيسي" (Lucide `store`)

**2a. Customer picker (bottom sheet, opens on tap of الزبون field):**
- **Search field** at top (Lucide `search`, RTL): placeholder "ابحث بالاسم أو رقم الهاتف". Filters live as you type — matches name OR phone.
- **Results dropdown** — matching customer rows (avatar initial · name · phone · balance tag), tap to select and close sheet.
- **Quick-add row** — always visible when no exact match: "＋ زبون جديد: «<typed text>»" (Lucide `user-plus`, teal). Tapping creates a customer inline from the typed name; if the typed text is digits, prefill it as the phone instead. Optional second inline field for the other value (name/phone) before confirm.
- **Walk-in option** — top chip "بيع نقدي (بدون زبون)" to leave الزبون blank for an anonymous cash sale (no debt tracking possible then).
- Selecting a customer with an existing balance shows their current debt under the field as a muted hint.
3. **Items section** — header row: title "الأصناف" (bold, right) and a small primary-light "إضافة صنف" chip with Lucide `plus` on the left.
4. **Line item rows** — white cards. Each (RTL): on the right item name (SemiBold) + meta "٢٠ × ١٥ ج.م" (muted); a small teal edit chip (`pencil`); on the left the line total in teal bold. Rows:
   - "بيبسي ٢ لتر" · "٢٠ × ١٥ ج.م" · "٣٠٠ ج.م"
   - "أرز مصري ١ك" · "٣٠ × ٢٨ ج.م" · "٨٤٠ ج.م"
   - "شوكولاتة جالاكسي" · "١٠ × ٢٢ ج.م" · "٢٢٠ ج.م"
5. **Totals card** — primary-light bg. Rows (label right, value left): "عدد الأصناف: ٣ أصناف"، "المدفوع نقدًا: ١٬٠٠٠ ج.م"، "المتبقّي (دَين): ٣٦٠ ج.م"، and a bold large "الإجمالي: ١٬٣٦٠ ج.م" in teal.
6. **Footer** — full-width primary button "حفظ المستند" (teal, white bold).

Note: outgoing = stock leaves + money in; partial payment creates customer debt. RTL throughout.
