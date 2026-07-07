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
import { useCustomers } from '../hooks/useCustomers';
import { usePartyFilter, type PartyFilter } from '../hooks/usePartyFilter';
import { presentParty } from '../presenters';
import { PartyRow } from '../components/PartyRow';
import { PartyFormSheet } from '../components/PartyFormSheet';
import { customerRepository } from '@/repositories/customer-repository';
import type { Party, PartyDraft } from '../types';

/**
 * الزبائن — Customers list (Step 2). Composition-only screen: data from the
 * repository (useCustomers), filtering in usePartyFilter, rows via <PartyRow>.
 * All copy comes from i18n; styling is NativeWind `className` only.
 */
export function CustomersListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { customers, reload } = useCustomers();
  const { query, setQuery, filter, setFilter, filtered, reset } = usePartyFilter(customers);
  const [formOpen, setFormOpen] = useState(false);
  // Non-null while editing an existing customer; null = add mode.
  const [editing, setEditing] = useState<Party | null>(null);

  const filterOptions: FilterOption<PartyFilter>[] = [
    { key: 'all', label: t('customers.filters.all'), activeClass: 'bg-primary' },
    { key: 'withDebt', label: t('customers.filters.withDebt'), activeClass: 'bg-warning' },
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
      customerRepository.update({ id: editing.id, name, phone });
    } else {
      customerRepository.create({ name, phone });
    }
    reload();
    closeForm();
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert(
      t('customers.form.deleteTitle'),
      t('customers.form.deleteBody', { name: editing.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            customerRepository.archive(editing.id);
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
        title={t('customers.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{ icon: 'plus', onPress: openAdd, accessibilityLabel: t('customers.form.addTitle') }}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('customers.searchPlaceholder')}
        />

        <FilterChips options={filterOptions} value={filter} onChange={(k: PartyFilter) => setFilter(k)} />

        {filtered.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
            <Feather name="users" size={44} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">{t('customers.empty.message')}</Text>
            {customers.length > 0 ? (
              <Pressable onPress={reset} accessibilityRole="button">
                <Text className="text-xs text-primary font-bold underline">{t('customers.empty.reset')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={openAdd} accessibilityRole="button">
                <Text className="text-xs text-primary font-bold underline">{t('customers.empty.add')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-24" showsVerticalScrollIndicator={false}>
            {filtered.map((party) => (
              <PartyRow
                key={party.id}
                party={presentParty(party, t)}
                debtHint={t('customers.debtHint')}
                onPress={() => openEdit(party)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <PartyFormSheet
        visible={formOpen}
        initial={editing ? { name: editing.name, phone: editing.phone ?? '' } : null}
        titleAdd={t('customers.form.addTitle')}
        titleEdit={t('customers.form.editTitle')}
        onClose={closeForm}
        onSave={handleSave}
        onDelete={handleDelete}
        deleteLabel={t('customers.form.delete')}
      />
    </View>
  );
}
