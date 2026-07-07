import { useState } from 'react';
import { View, Text, Pressable, ScrollView, I18nManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ROW } from '@/theme/rtl';
import { useDashboardStats } from '../hooks/useDashboardStats';

/**
 * Home / Dashboard — native port of the web design
 * (arabic-retail-erp-mobile-desig · DashboardScreen.tsx).
 * Arabic-first, RTL. Copy comes from i18n (dashboard namespace); KPI figures
 * come from useDashboardStats (cached, background-computed, manual refresh).
 * Styling: NativeWind `className` only. Colors resolve from src/theme/colors.js
 * (mirrored into tailwind.config.js). Icon `color` props read the same tokens
 * in JS, the one allowed exception for props that can't take a className.
 */

// RTL row helper: force writing direction; row stays reversed for Arabic.

// One-off translucent overlays NativeWind can only express via banned arbitrary
// classes, so they stay inline per the styling law's rgba exception.
const overlayStrong = 'rgba(6,78,59,0.40)';
const overlaySoft = 'rgba(6,78,59,0.30)';
const overlayLight = 'rgba(255,255,255,0.10)';

// Locale-aware number formatting (Hermes has no ICU). Arabic-Indic digits +
// '٬' separator for `ar`, Western digits + ',' otherwise.
function formatNum(n: number, lang: string): string {
  const sep = lang === 'ar' ? '٬' : ',';
  const western = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (lang !== 'ar') return western;
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return western.replace(/\d/g, (d) => map[Number(d)]);
}

type KpiProps = {
  dotClass: string;
  label: string;
  valueText: string;
  currency: string;
  tagText: string;
  tagTextClass: string;
  tagBgClass: string;
  onPress?: () => void;
};

function KpiCard({
  dotClass,
  label,
  valueText,
  currency,
  tagText,
  tagTextClass,
  tagBgClass,
  onPress,
}: KpiProps) {
  return (
    <Pressable
      className="grow basis-[46%] bg-surface rounded-[20px] p-4 border border-border"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className={`${ROW} items-center gap-1.5 mb-2.5`}>
        <View className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <Text className="text-xs text-muted font-medium">{label}</Text>
      </View>
      <Text className="text-lg font-extrabold text-ink text-right">
        {valueText} <Text className="text-xs font-normal text-muted">{currency}</Text>
      </Text>
      <View className={`self-end mt-1.5 px-2 py-0.5 rounded-md ${tagBgClass}`}>
        <Text className={`text-[10px] font-semibold ${tagTextClass}`}>{tagText}</Text>
      </View>
    </Pressable>
  );
}

type TileProps = {
  icon: React.ReactNode;
  iconBgClass: string;
  label: string;
  badgeText?: string;
  onPress?: () => void;
};

function Tile({ icon, iconBgClass, label, badgeText, onPress }: TileProps) {
  return (
    <Pressable
      className="grow basis-[30%] bg-surface rounded-2xl p-3 border border-border items-center gap-2"
      onPress={onPress}
    >
      {!!badgeText && (
        <View className="absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-danger border-2 border-surface items-center justify-center z-10">
          <Text className="text-white text-[10px] font-bold">{badgeText}</Text>
        </View>
      )}
      <View
        className={`w-11 h-11 rounded-xl items-center justify-center ${iconBgClass}`}
      >
        {icon}
      </View>
      <Text className="text-xs font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, i18n } = useTranslation();
  const [, setBranchOpen] = useState(false);
  const { stats, computing, reload } = useDashboardStats();

  const lang = i18n.language;
  const currency = t('common.currency');
  const num = (n: number) => formatNum(n, lang);

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
            dotClass="bg-ink"
            label={t('dashboard.kpi.stockValue.label')}
            valueText={num(stats?.inventoryValue ?? 0)}
            currency={currency}
            tagText={t('dashboard.kpi.stockValue.tag')}
            tagTextClass="text-muted"
            tagBgClass="bg-background"
          />
          <KpiCard
            dotClass="bg-positive"
            label={t('dashboard.kpi.profit.label')}
            valueText={num(stats?.monthlyProfit ?? 0)}
            currency={currency}
            tagText={t('dashboard.kpi.profit.tag')}
            tagTextClass="text-positive"
            tagBgClass="bg-positive-light"
          />
          {/* No customer receivable (AR) KPI by design: sales are cash, paid in
              full — the shop carries debt only WITH suppliers (AP), never for
              customers. See docs/plan screens rule. */}
          <KpiCard
            dotClass="bg-danger"
            label={t('dashboard.kpi.payable.label')}
            valueText={num(stats?.supplierDebt ?? 0)}
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

        {/* Sections header */}
        <View className={`${ROW} items-center justify-between`}>
          <Text className="text-base font-extrabold text-ink">{t('dashboard.sections.title')}</Text>
          <View className="bg-background px-2.5 py-1 rounded-full">
            <Text className="text-[11px] text-muted font-medium">{t('dashboard.sections.count')}</Text>
          </View>
        </View>

        {/* Sections grid 3x2 */}
        <View className={`${ROW} flex-wrap gap-3`}>
          <Tile
            icon={<Feather name="file-text" size={22} color={colors.primary} />}
            iconBgClass="bg-primary-light"
            label={t('dashboard.sections.documents')}
            badgeText={stats?.docCount ? num(stats.docCount) : undefined}
            onPress={() => navigation.navigate('Documents')}
          />
          <Tile
            icon={<Feather name="package" size={22} color={colors.primary} />}
            iconBgClass="bg-primary-light"
            label={t('dashboard.sections.goods')}
            badgeText={stats?.lowStockCount ? num(stats.lowStockCount) : undefined}
            onPress={() => navigation.navigate('Items')}
          />
          <Tile
            icon={<MaterialCommunityIcons name="cash" size={22} color={colors.expense} />}
            iconBgClass="bg-expense-light"
            label={t('dashboard.sections.expenses')}
            onPress={() => navigation.navigate('Expenses')}
          />
          <Tile
            icon={<Feather name="bar-chart-2" size={22} color={colors.info} />}
            iconBgClass="bg-info-light"
            label={t('dashboard.sections.reports')}
            onPress={() => navigation.navigate('Reports')}
          />
          <Tile
            icon={<Feather name="users" size={22} color={colors.accent} />}
            iconBgClass="bg-accent-light"
            label={t('dashboard.sections.customers')}
            onPress={() => navigation.navigate('Customers')}
          />
          <Tile
            icon={<Feather name="truck" size={22} color={colors['warning-dark']} />}
            iconBgClass="bg-warning-light"
            label={t('dashboard.sections.suppliers')}
            onPress={() => navigation.navigate('Suppliers')}
          />
        </View>
        {/* Removed the "credit invoices collected" banner: it implied customer
            credit/receivables, which don't exist here (sales are always cash). */}
      </ScrollView>
    </View>
  );
}
