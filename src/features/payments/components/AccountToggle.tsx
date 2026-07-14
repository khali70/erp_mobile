import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { Account } from '@/repositories/transaction-repository';

interface AccountToggleProps {
  value: Account;
  onChange: (account: Account) => void;
  /**
   * What the pocket MEANS here. Defaults to "الحساب".
   *
   * For a TRANSFER the same toggle picks the SOURCE pocket, and labelling that
   * "الحساب" says nothing about which of the two ends it is — the owner is left
   * to guess whether he is naming where the money leaves or where it lands.
   */
  label?: string;
}

const OPTIONS: { key: Account; icon: 'dollar-sign' | 'smartphone' }[] = [
  { key: 'cash', icon: 'dollar-sign' },
  { key: 'instapay', icon: 'smartphone' },
];

/**
 * الحساب — which POCKET the money moved through.
 *
 * Cash and InstaPay are two separate pockets that each reconcile independently:
 * the drawer has notes you can count, InstaPay has a balance in an app. A
 * payment that doesn't say which pocket can never be checked against either, so
 * this is never optional.
 */
export function AccountToggle({ value, onChange, label }: AccountToggleProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between`}>
      <View className={`${ROW} gap-2`}>
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              // A REQUIRED field on every purchase — it gets a full 44pt target.
              className={`${ROW} items-center gap-1.5 px-3 py-3 rounded-xl border ${
                active ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
              onPress={() => onChange(opt.key)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`payments.accounts.${opt.key}`)}
            >
              <Feather
                name={opt.icon}
                size={14}
                color={active ? colors.surface : colors.muted}
              />
              <Text
                className={`text-xs font-bold ${active ? 'text-surface' : 'text-muted'}`}
              >
                {t(`payments.accounts.${opt.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-ink text-sm font-semibold">{label ?? t('payments.account')}</Text>
    </View>
  );
}
