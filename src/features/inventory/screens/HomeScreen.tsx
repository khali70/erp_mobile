import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ROW } from '@/theme/rtl';
import { PrivacyToggleButton } from '@/components/ui/PrivacyToggleButton';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { formatDashboardNumber } from '../dashboard-presenters';
import { KpiCard } from '../components/KpiCard';
import { DashboardTile } from '../components/DashboardTile';

/**
 * Home / Dashboard — native port of the web design
 * (arabic-retail-erp-mobile-desig · DashboardScreen.tsx).
 * Arabic-first, RTL. Copy comes from i18n (dashboard namespace); KPI figures
 * come from useDashboardStats (cached, background-computed, manual refresh).
 * Money figures are wrapped in <MaskedValue> inside <KpiCard> — masking is a
 * render-time concern only, the stats themselves are never filtered.
 * Styling: NativeWind `className` only. Colors resolve from src/theme/colors.js
 * (mirrored into tailwind.config.js). Icon `color` props read the same tokens
 * in JS, the one allowed exception for props that can't take a className.
 */

// One-off translucent overlays NativeWind can only express via banned arbitrary
// classes, so they stay inline per the styling law's rgba exception.
const overlayStrong = 'rgba(6,78,59,0.40)';
const overlaySoft = 'rgba(6,78,59,0.30)';
const overlayLight = 'rgba(255,255,255,0.10)';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, i18n } = useTranslation();
  const [, setBranchOpen] = useState(false);
  const { stats, computing, reload } = useDashboardStats();

  const lang = i18n.language;
  const currency = t('common.currency');
  const num = (n: number) => formatDashboardNumber(n, lang);

  // Real net margin for the month. No sales → no percentage: an empty tag beats
  // a fabricated one sitting next to a real number.
  const marginPct = stats?.monthlyMarginPct ?? null;
  const marginUp = (marginPct ?? 0) >= 0;
  const marginTag =
    marginPct === null
      ? ''
      : `${marginUp ? '▲' : '▼'} ${num(Math.abs(marginPct))}٪  ${t('dashboard.kpi.profit.tag')}`;

  // The section grid is the single source of both the tiles and their count.
  const sections = [
    {
      key: 'documents',
      route: 'Documents',
      icon: <Feather name="file-text" size={22} color={colors.primary} />,
      iconBgClass: 'bg-primary-light',
      badge: stats?.docCount ? num(stats.docCount) : undefined,
    },
    {
      key: 'voice',
      route: 'VoiceNotes',
      icon: <Feather name="mic" size={22} color={colors.accent} />,
      iconBgClass: 'bg-accent-light',
      badge: undefined,
    },
    {
      key: 'goods',
      route: 'Items',
      icon: <Feather name="package" size={22} color={colors.primary} />,
      iconBgClass: 'bg-primary-light',
      badge: stats?.lowStockCount ? num(stats.lowStockCount) : undefined,
    },
    {
      key: 'expenses',
      route: 'Expenses',
      icon: <MaterialCommunityIcons name="cash" size={22} color={colors.expense} />,
      iconBgClass: 'bg-expense-light',
      badge: undefined,
    },
    // The one place the owner reconciles the app against the money actually in his
    // drawer. It is also reachable from the Reports hub; this is the direct way.
    {
      key: 'cashbook',
      route: 'CashBook',
      icon: <Feather name="book-open" size={22} color={colors.primary} />,
      iconBgClass: 'bg-primary-light',
      badge: undefined,
    },
    {
      key: 'reports',
      route: 'Reports',
      icon: <Feather name="bar-chart-2" size={22} color={colors.info} />,
      iconBgClass: 'bg-info-light',
      badge: undefined,
    },
    {
      key: 'customers',
      route: 'Customers',
      icon: <Feather name="users" size={22} color={colors.accent} />,
      iconBgClass: 'bg-accent-light',
      badge: undefined,
    },
    {
      key: 'suppliers',
      route: 'Suppliers',
      icon: <Feather name="truck" size={22} color={colors['warning-dark']} />,
      iconBgClass: 'bg-warning-light',
      badge: undefined,
    },
  ];

  return (
    <View className="flex-1 bg-background">
      {/* Teal header bar */}
      <SafeAreaView edges={['top']} className="bg-primary px-4 pb-5">
        <View className={`${ROW} items-center justify-between mt-2`}>
          <Pressable
            className={`${ROW} items-center gap-2 px-3 py-1.5 rounded-xl`}
            style={{ backgroundColor: overlayStrong }}
            onPress={() => setBranchOpen((v) => !v)}
          >
            <MaterialCommunityIcons
              name="store-outline"
              size={20}
              color={colors['primary-100']}
            />
            <Text className="text-white font-bold text-base">{t('dashboard.defaultStore')}</Text>
            <Feather name="chevron-down" size={16} color={colors['primary-200']} />
          </Pressable>

          <View className={`${ROW} items-center gap-2`}>
            <PrivacyToggleButton />

            <Pressable
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: overlaySoft }}
              onPress={reload}
              disabled={computing}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.reload')}
            >
              {computing ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Feather name="refresh-cw" size={18} color={colors.surface} />
              )}
            </Pressable>

            <Pressable
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: overlaySoft }}
              onPress={() => navigation.navigate('Settings')}
            >
              <Feather name="settings" size={20} color={colors.surface} />
            </Pressable>
          </View>
        </View>
        <Text className="mt-2.5 text-primary-100 text-xs text-right opacity-90">
          {t('dashboard.tagline')}
        </Text>
      </SafeAreaView>

      <ScrollView
        contentContainerClassName="px-4 py-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        {/* KPI grid 2x2 */}
        <View className={`${ROW} flex-wrap gap-3.5`}>
          <KpiCard
            valueId="kpi:stockValue"
            dotClass="bg-ink"
            label={t('dashboard.kpi.stockValue.label')}
            valueText={num(stats?.inventoryValue ?? 0)}
            currency={currency}
            tagText={t('dashboard.kpi.stockValue.tag')}
            tagTextClass="text-muted"
            tagBgClass="bg-background"
          />
          <KpiCard
            valueId="kpi:monthlyProfit"
            dotClass={marginUp ? 'bg-positive' : 'bg-danger'}
            label={t('dashboard.kpi.profit.label')}
            valueText={num(stats?.monthlyProfit ?? 0)}
            currency={currency}
            tagText={marginTag}
            tagTextClass={marginUp ? 'text-positive' : 'text-danger'}
            tagBgClass={marginUp ? 'bg-positive-light' : 'bg-danger-light'}
          />
          {/* No customer receivable (AR) KPI by design: sales are cash, paid in
              full — the shop carries debt only WITH suppliers (AP), never for
              customers. See docs/plan screens rule. */}
          <KpiCard
            valueId="kpi:supplierDebt"
            dotClass="bg-danger"
            label={t('dashboard.kpi.payable.label')}
            valueText={num(stats?.totalPayables ?? 0)}
            currency={currency}
            tagText={t('dashboard.kpi.payable.tag')}
            tagTextClass="text-danger"
            tagBgClass="bg-danger-light"
            onPress={() => navigation.navigate('DebtsBySupplier')}
          />
        </View>

        {/* Quick actions */}
        <View className={`${ROW} flex-wrap gap-3`}>
          <Pressable
            className="grow basis-[30%] rounded-2xl py-3.5 px-2 items-center justify-center gap-2 bg-primary"
            onPress={() => navigation.navigate('NewOutgoing')}
          >
            <View
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: overlayLight }}
            >
              <Feather name="arrow-up" size={16} color={colors.surface} />
            </View>
            <Text className="text-xs font-bold text-white">{t('dashboard.actions.newOutgoing')}</Text>
          </Pressable>

          <Pressable
            className="grow basis-[30%] rounded-2xl py-3.5 px-2 items-center justify-center gap-2 bg-surface border border-primary"
            onPress={() => navigation.navigate('NewIncoming')}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center bg-primary-light">
              <Feather name="arrow-down" size={16} color={colors.primary} />
            </View>
            <Text className="text-xs font-bold text-primary">{t('dashboard.actions.newIncoming')}</Text>
          </Pressable>
        </View>

        {/* Sections header — the count is derived from the grid, never a literal. */}
        <View className={`${ROW} items-center justify-between`}>
          <Text className="text-base font-extrabold text-ink">{t('dashboard.sections.title')}</Text>
          <View className="bg-background px-2.5 py-1 rounded-full">
            <Text className="text-[11px] text-muted font-medium">
              {t('dashboard.sections.count', { n: num(sections.length) })}
            </Text>
          </View>
        </View>

        {/* Sections grid 3x2 */}
        <View className={`${ROW} flex-wrap gap-3`}>
          {sections.map((s) => (
            <DashboardTile
              key={s.route}
              icon={s.icon}
              iconBgClass={s.iconBgClass}
              label={t(`dashboard.sections.${s.key}`)}
              badgeText={s.badge}
              onPress={() => navigation.navigate(s.route as never)}
            />
          ))}
        </View>
        {/* Removed the "credit invoices collected" banner: it implied customer
            credit/receivables, which don't exist here (sales are always cash). */}
      </ScrollView>
    </View>
  );
}
