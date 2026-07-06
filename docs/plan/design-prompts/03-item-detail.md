# Screen 03 — تفاصيل الصنف / Item detail & edit

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for an **item detail / edit** screen in a small-shop inventory ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "تفاصيل الصنف". Left: white edit chip (Lucide `pencil`). Far right: back arrow (`arrow-right`).
2. **Hero** — large product image (rounded, primary-light with Lucide `package` placeholder), centered; below it the item name "بيبسي ٢ لتر" (bold) and category "مشروبات" (muted).
3. **Stock summary card** — white, border. Big current stock "٤٨ قطعة" with a green "متوفر" pill. Small row: "حد التنبيه: ١٠ قطعة".
4. **Info rows** (white card, dividers): 
   - "الباركود" → `6223000123456` (Lucide `barcode`)
   - "سعر البيع" → "١٥ ج.م" 
   - "سعر التكلفة" → "١١ ج.م" (muted)
   - "الوحدة" → "قطعة"
   - "التصنيف" → "مشروبات"
5. **Movement history** — section title "حركة الصنف". List rows with Lucide icons: `arrow-down` green "وارد +٦٠ · ٣ يوليو"، `arrow-up` teal "صادر −١٢ · ٥ يوليو"، `arrow-up` teal "صادر −٨ · ٦ يوليو". Each row shows resulting balance on the left.
6. **Footer** — two buttons: primary "تعديل" (teal) and outline "أرشفة" (muted, Lucide `archive` — archive-never-delete).

RTL throughout: labels right, values left.
