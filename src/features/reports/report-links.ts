import type Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';

/**
 * The report screens the hub can open. Every one takes NO route params — which is
 * what lets the hub render a list and navigate by name, with no per-row wiring.
 */
export type ReportRoute = Extract<
  keyof RootStackParamList,
  'CashBook' | 'DebtsBySupplier' | 'Expenses' | 'ProfitLoss' | 'DebtsByCustomer'
>;

export interface ReportLink {
  /** i18n key under `reports.items.*` — the title and the one-line "why". */
  key: string;
  route: ReportRoute;
  icon: keyof typeof Feather.glyphMap;
  iconBgClass: string;
  iconColor: string;
  /**
   * FALSE ⇒ the screen behind it is still an UnderConstruction stub.
   *
   * It is listed anyway, visibly disabled and marked "قريبًا". Linking to a stub
   * as if it worked spends the owner's trust on a tap that goes nowhere; hiding
   * it entirely makes the hub silently under-promise what the app is for. Saying
   * "not yet" is the only honest third option.
   */
  ready: boolean;
}

/**
 * THE REPORTS HUB'S CONTENTS — and the only route to the cash book.
 *
 * دفتر النقدية was reachable from NOWHERE: the screen existed, the route was
 * registered, and no tap in the entire app led to it. Home's «التقارير» tile
 * already lands here (ReportsScreen.md always said this hub was the way in), so
 * this list is what finally connects them.
 *
 * Ordered by the question the owner asks most: what is in the drawer, then who
 * he owes, then what he spent.
 */
export const REPORT_LINKS: ReportLink[] = [
  {
    key: 'cashbook',
    route: 'CashBook',
    icon: 'book-open',
    iconBgClass: 'bg-primary-light',
    iconColor: colors.primary,
    ready: true,
  },
  {
    key: 'debtsBySupplier',
    route: 'DebtsBySupplier',
    icon: 'trending-down',
    iconBgClass: 'bg-danger-light',
    iconColor: colors.danger,
    ready: true,
  },
  {
    key: 'expenses',
    route: 'Expenses',
    icon: 'credit-card',
    iconBgClass: 'bg-expense-light',
    iconColor: colors.expense,
    ready: true,
  },
  {
    key: 'profitLoss',
    route: 'ProfitLoss',
    icon: 'bar-chart-2',
    iconBgClass: 'bg-info-light',
    iconColor: colors.info,
    ready: false,
  },
  {
    key: 'debtsByCustomer',
    route: 'DebtsByCustomer',
    icon: 'users',
    iconBgClass: 'bg-accent-light',
    iconColor: colors.accent,
    ready: false,
  },
];
