import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { useDocuments } from '../hooks/useDocuments';
import { presentDocument } from '../document-presenters';
import { DocumentListRow } from '../components/DocumentListRow';

type DocFilter = 'all' | 'in' | 'out';

/**
 * المستندات — documents list (Step 1). Composition-only: rows from the
 * repository (useDocuments), filter in memory, rows via <DocumentListRow>.
 * Reloads on focus so a doc posted from the new-doc screens shows up.
 */
export function DocumentsListScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { documents, reload } = useDocuments();
  const [filter, setFilter] = useState<DocFilter>('all');

  useFocusEffect(useCallback(() => reload(), [reload]));

  const rows = useMemo(() => {
    const kept = filter === 'all' ? documents : documents.filter((d) => d.kind === filter);
    return kept.map((d) => presentDocument(d, t, i18n.language));
  }, [documents, filter, t, i18n.language]);

  const filterOptions: FilterOption<DocFilter>[] = [
    { key: 'all', label: t('documents.filters.all'), activeClass: 'bg-primary' },
    { key: 'in', label: t('documents.filters.incoming'), activeClass: 'bg-positive' },
    { key: 'out', label: t('documents.filters.outgoing'), activeClass: 'bg-danger' },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('documents.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <FilterChips options={filterOptions} value={filter} onChange={(k: DocFilter) => setFilter(k)} />

        {rows.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
            <Feather name="file-text" size={44} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">{t('documents.empty')}</Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-24" showsVerticalScrollIndicator={false}>
            {rows.map((doc) => (
              <DocumentListRow key={doc.id} doc={doc} />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
