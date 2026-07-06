# Design System — shared style for all screens

Paste this block at the top of any per-screen Gemini prompt, or reference it. Every screen prompt in this folder already embeds the critical tokens so each file is standalone.

## Product

Local single-user **inventory + accounting ERP** for a small Arabic retail shop. Screens are **RTL Arabic**. Clone-family of "الجرد والمخزون ببساطة" (Stock & Inventory Simple).

## Canvas

- Mobile screen, **390 × 844 px** (iPhone portrait), single frame per prompt.
- High-fidelity UI mockup, flat modern design, crisp, production-ready. Not a wireframe.

## Language / direction

- All text **Arabic**, **right-to-left** layout. Titles right-aligned. Navigation "back" affordance on the **right**; forward chevrons point **left** (‹).
- Numbers shown in Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) is optional; Western digits acceptable if cleaner.
- Font: **Cairo** (or nearest clean Arabic sans — Tajawal, Almarai). Weights: Regular / Medium / SemiBold / Bold.

## Color palette

| Token | Hex | Use |
|---|---|---|
| Primary | `#0E7569` | teal — top bar, primary buttons, active nav, accents |
| Primary-dark | `#08483F` | pressed / deep accents |
| Primary-light | `#E6F5F3` | icon chip backgrounds, soft fills |
| Background | `#F1F5F9` | app background (slate-100) |
| Surface | `#FFFFFF` | cards, rows, sheets |
| Ink | `#0F172A` | primary text |
| Muted | `#64748B` | secondary text, labels |
| Border | `#E2E8F0` | hairline card/row borders |
| Positive | `#16A34A` | profit, paid, stock-in, credit |
| Warning | `#EB8C17` | receivables (money owed to shop), low stock |
| Danger | `#DC2626` | payables (shop owes), out-of-stock, delete |

## Components

- **Top bar:** solid primary `#0E7569`, ~52px top safe-area padding, white bold title on right, optional white action chip on left, back arrow (→) far right.
- **Cards / rows:** white surface, 14–16px corner radius, 1px `#E2E8F0` border, soft or no shadow.
- **KPI / stat cards:** label + colored dot, large bold value, small colored sub-label.
- **Chips:** pill, 20px radius; active = primary fill + white text; inactive = white + border + muted text.
- **Bottom nav (list screens):** white bar, top border, 5 items — الرئيسية / المستندات / البضائع / التقارير / المزيد. Active item in primary color.
- **Primary button:** full-width, primary fill, white bold label, 14px radius.

## Icons — IMPORTANT

**Use a real vector icon library — Lucide (preferred), Feather, or Phosphor. Do NOT use emoji.** Line icons, ~1.75px stroke, inherit the surrounding text/accent color. Suggested Lucide mappings are listed per screen.

## Tone

Clean, trustworthy, high-contrast, generous spacing, thumb-friendly. Small-shop owner is the user — plain labels, no accounting jargon in the UI.
