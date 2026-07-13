import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { toArabicDigits } from '@/utils/numerals';
import { useDocumentDetail } from '../hooks/useDocumentDetail';
import { openAttachment } from '../utils/attachments';

/**
 * تفاصيل المستند — one document with its lines and a report roll-up
 * (item count, total quantity, total amount). Read-only; data from
 * useDocumentDetail. Opened by tapping a row in the documents list.
 */
export function DocumentDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'DocumentDetail'>>();
  const { detail } = useDocumentDetail(params.documentId);

  if (!detail) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={t('documents.detail.title')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View className="flex-1 items-center justify-center gap-3">
          <Feather name="file-text" size={44} color={colors['slate-400']} />
          <Text className="text-muted text-sm">{t('documents.empty')}</Text>
        </View>
      </View>
    );
  }

  const incoming = detail.kind === 'in';
  const tint = incoming ? colors.positive : colors.danger;
  const tintBg = incoming ? 'bg-positive-light' : 'bg-danger-light';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={detail.docLabel}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3.5 gap-4 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {/* Doc header card */}
        <View className={`${ROW} items-center gap-3 bg-surface rounded-2xl p-4 border border-border`}>
          <View className={`w-11 h-11 rounded-full items-center justify-center ${tintBg}`}>
            <Feather name={incoming ? 'arrow-down-left' : 'arrow-up-right'} size={22} color={tint} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-base font-extrabold text-right">{detail.docLabel}</Text>
            <Text className="text-muted text-xs text-right mt-0.5">
              {detail.kindLabel} · {detail.dateLabel}
            </Text>
          </View>
        </View>

        {/* Report roll-up */}
        <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
          <Text className="text-xs font-bold text-muted text-right">
            {t('documents.detail.reportTitle')}
          </Text>
          <View className={`${ROW} justify-between`}>
            <Text className="text-sm text-muted">{t('documents.detail.itemCount')}</Text>
            <Text className="text-sm font-extrabold text-ink">{toArabicDigits(detail.itemCount)}</Text>
          </View>
          <View className={`${ROW} justify-between`}>
            <Text className="text-sm text-muted">{t('documents.detail.totalQty')}</Text>
            <Text className="text-sm font-extrabold text-ink">{toArabicDigits(detail.totalQty)}</Text>
          </View>
          <View className="h-px bg-border" />
          <View className={`${ROW} justify-between items-center`}>
            <Text className="text-sm font-bold text-muted">{t('documents.detail.total')}</Text>
            <Text className="text-xl font-extrabold text-ink">
              {detail.totalLabel} {t('common.currency')}
            </Text>
          </View>
        </View>

        {/* Counterparty (supplier / customer) */}
        {detail.partyLabel ? (
          <View className="bg-surface rounded-2xl p-4 border border-border gap-1.5">
            <Text className="text-xs font-bold text-muted text-right">
              {incoming ? t('documents.incoming.party') : t('documents.outgoing.party')}
            </Text>
            <Text className="text-sm text-ink text-right">{detail.partyLabel}</Text>
          </View>
        ) : null}

        {/* Optional doc note */}
        {detail.noteLabel ? (
          <View className="bg-surface rounded-2xl p-4 border border-border gap-1.5">
            <Text className="text-xs font-bold text-muted text-right">
              {t('documents.detail.note')}
            </Text>
            <Text className="text-sm text-ink text-right">{detail.noteLabel}</Text>
          </View>
        ) : null}

        {/* Receipt attachments */}
        {detail.attachments.length > 0 ? (
          <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
            <Text className="text-xs font-bold text-muted text-right">
              {t('documents.attachments.title')}
            </Text>
            {detail.attachments.map((a) => (
              <Pressable
                key={a.id}
                className={`${ROW} items-center gap-2 bg-background rounded-xl px-3 py-2.5`}
                onPress={() => openAttachment(a)}
                accessibilityRole="button"
              >
                <Feather
                  name={a.mime.startsWith('image/') ? 'image' : 'file-text'}
                  size={16}
                  color={colors.muted}
                />
                <Text className="text-ink text-sm text-right flex-1" numberOfLines={1}>{a.name}</Text>
                <Feather name="external-link" size={15} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Lines */}
        <Text className="text-xs font-bold text-muted text-right mt-1">
          {t('documents.detail.linesTitle')}
        </Text>
        {detail.lines.map((line) => (
          <View
            key={line.id}
            className="bg-surface rounded-2xl p-3.5 border border-border gap-1"
          >
            <View className={`${ROW} items-center justify-between`}>
              <Text className="text-ink text-sm font-extrabold flex-1 text-right" numberOfLines={2}>
                {line.name}
              </Text>
              <Text className="text-ink text-sm font-extrabold">
                {line.lineTotalLabel} {t('common.currency')}
              </Text>
            </View>
            <View className={`${ROW} items-center justify-between`}>
              <Text className="text-muted text-xs">
                {toArabicDigits(line.qty)} × {line.unitPriceLabel} {t('common.currency')}
              </Text>
            </View>
            {line.noteLabel ? (
              <Text className="text-muted text-[11px] text-right" numberOfLines={1}>
                {line.noteLabel}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
