# Screen 02 — البضائع / Goods (items) list

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for the **items/goods list** of a small-shop inventory ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "البضائع" (bold white, right). Left: white "+" add-action chip (Lucide `plus`). Far right: back arrow (Lucide `arrow-right`).
2. **Search bar** — white rounded field, Lucide `search` icon on right, placeholder "ابحث بالاسم أو الباركود" (muted), a teal Lucide `scan-line` barcode icon on the left.
3. **Filter chips** — pills: "الكل" (active, teal fill white text), "منخفض المخزون", "نفد" (inactive, white + border).
4. **Item rows** — white cards, border, 14px radius. Each row (RTL): on the **right** a product image thumbnail (rounded square, primary-light bg with a Lucide `package` icon placeholder); to its left a name (SemiBold) + category (muted, small); on the **left** a bold price "١٥ ج.م" and below it a small colored quantity badge. Rows:
   - "بيبسي ٢ لتر" · مشروبات · qty "٤٨ قطعة" (green badge) · "١٥ ج.م"
   - "شوكولاتة جالاكسي" · حلويات · qty "٦ قطعة" (orange/low badge) · "٢٢ ج.م"
   - "شامبو هيد اند شولدرز" · عناية · qty "٠ قطعة" (red/out badge) · "٨٥ ج.م"
   - "أرز مصري ١ك" · بقالة · qty "١٢٠ كيس" (green) · "٢٨ ج.م"
   - "زيت عافية ٨٠٠مل" · بقالة · qty "٣٤ زجاجة" (green) · "٦٥ ج.م"
   - "مناديل فاين" · منزلية · qty "٩ باكت" (orange/low) · "١٨ ج.م"
5. **Bottom nav** — 5 items, "البضائع" active (teal).

Quantity badge colors: green = healthy, orange = low stock, red = out of stock. RTL throughout.
