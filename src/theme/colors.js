// Single source of color literals. Mirrored into tailwind.config.js.
// CommonJS so tailwind.config.js (Node) can require it.
// Canonical tokens follow docs/plan/design-prompts/00-style-guide.md.
module.exports = {
  // --- Canonical palette (style guide §Color palette) ---
  primary: '#0E7569', // teal — top bar, primary buttons, active nav
  'primary-dark': '#08483F', // pressed / deep accents
  'primary-light': '#E6F5F3', // icon chip backgrounds, soft fills
  background: '#F1F5F9', // app background (slate-100)
  surface: '#FFFFFF', // cards, rows, sheets
  ink: '#0F172A', // primary text
  muted: '#64748B', // secondary text, labels
  border: '#E2E8F0', // hairline card/row borders
  positive: '#16A34A', // profit, paid, stock-in, credit
  warning: '#EB8C17', // receivables (money owed to shop), low stock
  danger: '#DC2626', // payables (shop owes), out-of-stock, delete

  // --- Extended dashboard accents (tints + category icons + banner) ---
  'primary-100': '#CCFBF1', // header icon / subtitle on teal
  'primary-200': '#99F6E4', // header chevron on teal
  'primary-300': '#5EEAD4', // banner headline text
  'primary-400': '#2DD4BF', // banner progress fill
  'positive-light': '#F0FDF4', // positive KPI tag bg
  'warning-light': '#FFFBEB', // warning KPI / موردون tile bg
  'warning-dark': '#D97706', // موردون tile icon
  'danger-light': '#FFF1F2', // danger KPI tag bg
  info: '#2563EB', // تقارير tile icon
  'info-light': '#EFF6FF', // تقارير tile bg
  accent: '#4F46E5', // الزبائن tile icon
  'accent-light': '#EEF2FF', // الزبائن tile bg
  expense: '#EA580C', // النفقات tile icon
  'expense-light': '#FFF7ED', // النفقات tile bg
  'slate-800': '#1E293B', // banner border / track / coin
  'slate-400': '#94A3B8', // banner label
};
