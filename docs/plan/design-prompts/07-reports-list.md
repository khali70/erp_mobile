# Screen 07 — التقارير / Reports list

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for the **reports menu** in a small-shop inventory + accounting ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "التقارير". Left: white star chip (Lucide `star`, favorites). Far right: back arrow.
2. **Grouped list** with muted section labels. Each report is a white row (RTL): on the **right** a colored icon chip; name (SemiBold) + one-line description (muted); on the **left** a chevron pointing left (Lucide `chevron-left`).

   **المالية:**
   - `trending-up` (teal chip) "الأرباح والخسائر" · "الإيراد − التكلفة − النفقات"
   - `user` (orange chip) "الديون حسب الزبون" · "مستحقات لك (AR)"
   - `truck` (red chip) "الديون حسب المورد" · "مستحقات عليك (AP)"
   - `banknote` (green chip) "دفتر النقدية" · "الوارد والصادر النقدي"

   **المبيعات والمشتريات:**
   - `calendar` (teal) "المبيعات حسب التاريخ" · "يومي / شهري"
   - `tag` (teal) "المبيعات حسب الصنف" · "الأكثر مبيعًا"
   - `user-round` (teal) "المبيعات حسب الزبون"

   **المخزون:**
   - `repeat` (teal) "حركة المخزون" · "وارد وصادر كل صنف"
   - `calculator` (teal) "تقييم المخزون" · "بالتكلفة المتوسطة"

3. **Bottom nav** — "التقارير" active (teal).

RTL throughout: icon on the right, chevron on the left.
