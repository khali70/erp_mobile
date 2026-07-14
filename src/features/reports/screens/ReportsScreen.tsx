import { View, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { REPORT_LINKS, type ReportRoute } from '../report-links';
import { ReportRow } from '../components/ReportRow';

/**
 * التقارير — THE WAY IN TO EVERY NUMBER THE SHOP KEEPS.
 *
 * This hub is what makes دفتر النقدية reachable at all. Home's «التقارير» tile
 * has always navigated here, and this screen has always been a stub — so the cash
 * book, fully built, sat behind a registered route that NOTHING in the app could
 * open. ديون الموردين was barely better: its only door was a KPI card on Home.
 *
 * The reports that are still stubs are listed and visibly disabled ("قريبًا"),
 * never linked as if they worked.
 *
 * Composition only: the links are data (`report-links.ts`), the row renders, the
 * screen navigates.
 */
export function ReportsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Every report route takes no params, which is what lets the hub navigate by
  // name straight from its data.
  const open = (route: ReportRoute) => navigation.navigate(route);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('reports.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <FlatList
        data={REPORT_LINKS}
        keyExtractor={(link) => link.key}
        renderItem={({ item }) => <ReportRow link={item} onPress={() => open(item.route)} />}
        contentContainerClassName="px-4 py-4 gap-3 pb-24"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
