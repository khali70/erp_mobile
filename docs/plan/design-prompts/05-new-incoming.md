# Screen 05 — وارد جديد / New Incoming document (purchase)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **new incoming document (purchase from supplier)** form in a small-shop inventory ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "وارد جديد · شراء". Left: white check chip (Lucide `check`). Far right: back arrow (`arrow-right`).
2. **Form fields** — white rounded inputs, label above (right), leading icon on right, chevron on left:
   - "المورد" → "شركة النور للتجارة" (Lucide `truck`, teal value) — **tappable → supplier picker sheet (same pattern as `04-new-outgoing.md` §2a: search by name/phone, quick-add new supplier inline, or leave blank for cash purchase)**
   - "التاريخ" → "٦ يوليو ٢٠٢٦" (Lucide `calendar`)
   - "المتجر" → "المتجر الرئيسي" (Lucide `store`)
3. **Items section** — header "الأصناف" (bold, right) + primary-light "إضافة صنف" chip with `plus`.
4. **Line item rows** — white cards. Each (RTL): right = item name + meta "**تكلفة** ٦٠ × ١١ ج.م" (muted, note this captures **unit cost** — important for weighted-average COGS); teal edit chip; left = line total teal bold. Rows:
   - "تيشيرت قطن أبيض · L" · "٦٠ × ١٤٠ ج.م" · "٨٬٤٠٠ ج.م"
   - "بنطلون جينز أزرق · ٣٢" · "٤٠ × ٣٨٠ ج.م" · "١٥٬٢٠٠ ج.م"
5. **Totals card** — primary-light. Rows: "عدد الأصناف: ٢"، "المدفوع للمورد: ٢٠٬٠٠٠ ج.م"، "المتبقّي (علينا): ٣٬٦٠٠ ج.م"، bold "الإجمالي: ٢٣٬٦٠٠ ج.م" teal.
6. **Footer** — primary button "حفظ المستند".

Note: incoming = stock enters + records unit cost + money out; unpaid balance creates supplier payable (AP). RTL throughout.
