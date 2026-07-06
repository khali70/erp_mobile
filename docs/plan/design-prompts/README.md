# ERP Mobile — Screen Design Prompts (for Gemini)

Standalone image/UI-generation prompts, one file per screen. Each is self-contained (embeds palette, font, RTL rules, Lucide icon mappings) — paste directly into Gemini. Shared design system in [`00-style-guide.md`](./00-style-guide.md).

**Rules baked into every prompt:** RTL Arabic · Cairo font · 390×844 · teal `#0E7569` system · **Lucide vector icons, no emoji**.

| # | File | Screen | Status in Figma |
|---|---|---|---|
| — | `00-style-guide.md` | Shared design system | — |
| 01 | `01-home.md` | الرئيسية / Home dashboard | ✅ built (emoji placeholders) |
| 02 | `02-goods-list.md` | البضائع / Goods list | ✅ built (emoji) |
| 03 | `03-item-detail.md` | تفاصيل الصنف / Item detail & edit | prompt only |
| 04 | `04-new-outgoing.md` | صادر جديد / New sale doc | ✅ built (emoji) |
| 05 | `05-new-incoming.md` | وارد جديد / New purchase doc | prompt only |
| 06 | `06-documents-list.md` | المستندات / Documents list | prompt only |
| 07 | `07-reports-list.md` | التقارير / Reports menu | prompt only |
| 08 | `08-profit-loss.md` | الأرباح والخسائر / P&L | prompt only |
| 09 | `09-debts-customer-ar.md` | الديون حسب الزبون / Receivables | prompt only |
| 10 | `10-debts-supplier-ap.md` | الديون حسب المورد / Payables | prompt only |
| 11 | `11-cash-book.md` | دفتر النقدية / Cash book | prompt only |
| 12 | `12-expenses.md` | النفقات / Expenses | prompt only |
| 13 | `13-customers.md` | الزبائن / Customers | prompt only |
| 14 | `14-suppliers.md` | الموردون / Suppliers | prompt only |
| 15 | `15-settings.md` | الإعدادات / Settings + Backup | prompt only |

**Figma file** (3 screens built before hitting the Starter-plan MCP call limit; emoji used as icon placeholders):
https://www.figma.com/design/GKJBvhF3TLYLW5Wm9yAq7h

Screens map to the roadmap: 01–06 = Steps 1–3 (store + docs + parties), 07–11 = Steps 5–6 (expenses, cash book, P&L, AR/AP reports), 13–14 = Step 2 (parties), 15 = Step 8 (settings/backup).
