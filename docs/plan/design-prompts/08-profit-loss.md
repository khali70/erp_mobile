# Screen 08 — الأرباح والخسائر / Profit & Loss (P&L)

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **Profit & Loss report** in a small-shop accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-dark `#08483F`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الأرباح والخسائر". Left: white export chip (Lucide `download`). Far right: back arrow.
2. **Period chips** — "هذا الشهر" (active teal), "٣ شهور", "السنة", "مخصص".
3. **Hero net-profit card** — solid teal, 18px radius. Right-aligned: small light label "صافي الربح · يوليو ٢٠٢٦"; a very large bold white number "٧٬٦٣٠" with small "ج.م"; a translucent white pill "▲ ٪۸ عن الشهر الماضي".
4. **Statement card** — white, border, rows separated by hairline dividers. Each row: label (right, with small muted sub-line) and value (left, colored):
   - "المبيعات" / "إيراد الفترة" → "+٢٤٬٠٠٠" (green)
   - "تكلفة البضاعة المباعة" / "بالتكلفة المتوسطة" → "−١١٬٢٥٠" (red)
   - **"مجمّل الربح"** → "١٢٬٧٥٠" (ink, bold)
   - "النفقات التشغيلية" / "إيجار · رواتب · نقل" → "−٥٬١٢٠" (red)
   - **"صافي الربح"** → "٧٬٦٣٠" (teal, large bold)
5. **Info note** — primary-light pill with Lucide `info` icon: "هامش الربح ٣۱٪ · محسوب من المستندات المرحّلة".

Optionally add a small horizontal bar under the hero comparing إيراد vs تكلفة vs نفقات. RTL throughout: labels right, values left.
