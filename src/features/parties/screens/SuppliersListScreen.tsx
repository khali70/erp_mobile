import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { useSuppliers } from '../hooks/useSuppliers';
import { usePartyFilter, type PartyFilter } from '../hooks/usePartyFilter';
import { presentParty } from '../presenters';
import { PartyRow } from '../components/PartyRow';
import { PartyFormSheet } from '../components/PartyFormSheet';
import { supplierRepository } from '@/repositories/supplier-repository.client';
import { SupplierHasDebtError } from '@/repositories/supplier-repository';
import { formatMoney } from '@/utils/money';
import type { Party, PartyDraft } from '../types';

/**
 * الموردون — Suppliers list (Step 2). Composition-only screen: data from the
 * repository (useSuppliers), filtering in usePartyFilter, rows via <PartyRow>.
 * All copy comes from i18n; styling is NativeWind `className` only.
 */
export function SuppliersListScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { suppliers, reload } = useSuppliers();
  const { query, setQuery, filter, setFilter, filtered, reset } = usePartyFilter(suppliers);
  const [formOpen, setFormOpen] = useState(false);
  // Non-null while editing an existing supplier; null = add mode.
  const [editing, setEditing] = useState<Party | null>(null);

  // The withDebt chip was commented out because it always matched nothing —
  // it filtered on `suppliers.balance`, a column nothing ever wrote. Debt is now
  // derived from the invoices, so the chip has something real to match.
  const filterOptions: FilterOption<PartyFilter>[] = [
    { key: 'all', label: t('suppliers.filters.all'), activeClass: 'bg-primary' },
    { key: 'withDebt', label: t('suppliers.filters.withDebt'), activeClass: 'bg-warning' },
  ];

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (party: Party) => {
    setEditing(party);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSave = (draft: PartyDraft) => {
    const name = draft.name.trim();
    const phone = draft.phone.trim() || null;
    if (editing) {
      supplierRepository.update({ id: editing.id, name, phone });
    } else {
      supplierRepository.create({ name, phone });
    }
    reload();
    closeForm();
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert(
      t('suppliers.form.deleteTitle'),
      t('suppliers.form.deleteBody', { name: editing.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            try {
              supplierRepository.archive(editing.id);
            } catch (err) {
              // A supplier the shop still owes cannot be archived: every payables
              // figure filters deleted_at IS NULL, so removing him would silently
              // subtract his debt from what the owner believes he owes — no
              // warning, no trace. Say the amount out loud instead.
              if (err instanceof SupplierHasDebtError) {
                Alert.alert(
                  t('suppliers.form.deleteBlockedTitle'),
                  t('suppliers.form.deleteBlockedBody', {
                    name: editing.name,
                    amount: formatMoney(err.owed),
                  }),
                );
                return;
              }
              throw err;
            }
            reload();
            closeForm();
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('suppliers.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{ icon: 'plus', onPress: openAdd, accessibilityLabel: t('suppliers.form.addTitle') }}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('suppliers.searchPlaceholder')}
        />

        <FilterChips options={filterOptions} value={filter} onChange={(k: PartyFilter) => setFilter(k)} />

        {filtered.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
            <Feather name="users" size={44} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">{t('suppliers.empty.message')}</Text>
            {suppliers.length > 0 ? (
              <Pressable onPress={reset} accessibilityRole="button">
                <Text className="text-xs text-primary font-bold underline">{t('suppliers.empty.reset')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={openAdd} accessibilityRole="button">
                <Text className="text-xs text-primary font-bold underline">{t('suppliers.empty.add')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-24" showsVerticalScrollIndicator={false}>
            {filtered.map((party) => (
              <PartyRow
                key={party.id}
                party={presentParty(party, t, i18n.language)}
                debtHint={t('suppliers.debtHint')}
                onPress={() => openEdit(party)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <PartyFormSheet
        visible={formOpen}
        initial={editing ? { name: editing.name, phone: editing.phone ?? '' } : null}
        titleAdd={t('suppliers.form.addTitle')}
        titleEdit={t('suppliers.form.editTitle')}
        onClose={closeForm}
        onSave={handleSave}
        onDelete={handleDelete}
        deleteLabel={t('suppliers.form.delete')}
      />
    </View>
  );
}
