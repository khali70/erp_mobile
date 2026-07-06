# Screen 15 — الإعدادات / Settings, Backup & Restore

## Gemini prompt

Design a high-fidelity **RTL Arabic** mobile UI mockup, **390×844px**, for a **settings** screen (with local backup/restore) in a local single-user small-shop ERP. Flat modern, production-ready. Font: **Cairo**. Use **Lucide vector line icons — no emoji**.

**Palette:** primary teal `#0E7569`, primary-light `#E6F5F3`, background `#F1F5F9`, white `#FFFFFF`, ink `#0F172A`, muted `#64748B`, border `#E2E8F0`, positive `#16A34A`, warning `#EB8C17`, danger `#DC2626`.

**Layout:**

1. **Top bar** (teal) — title "الإعدادات". Far right: back arrow.
2. **Grouped settings list** — white cards with rows, each (RTL): leading Lucide icon on the **right**, label + optional value/sub (muted), a chevron-left or a toggle on the **left**.

   **المتجر:**
   - `store` "اسم المتجر" → "المتجر الرئيسي"
   - `coins` "العملة" → "الجنيه المصري (ج.م)"
   - `calculator` "طريقة التقييم" → "المتوسط المرجّح"
   - `alert-triangle` "السماح بالبيع بالسالب" → toggle (off)

   **النسخ الاحتياطي (local — no cloud):**
   - `download` "إنشاء نسخة احتياطية" → sub "آخر نسخة: أمس ٩:٠٠م"
   - `upload` "استعادة من ملف"
   - `file-spreadsheet` "تصدير CSV (أصناف · مستندات · ديون)"
   - `hard-drive` "حفظ إلى ملف / مشاركة" (share sheet)

   **الحماية:**
   - `lock` "قفل التطبيق (PIN / بصمة)" → toggle (off by default)

   **حول:**
   - `info` "الإصدار" → "1.0.0"

3. A prominent **warning-tinted banner** near backup: Lucide `shield-alert` + "بياناتك محفوظة على هذا الجهاز فقط. أنشئ نسخة احتياطية بانتظام." (data lives only on this device — back up regularly).

Note: no login, no accounts, no sync — this is a local single-user app; app-lock is optional and off by default. RTL throughout.
