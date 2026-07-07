import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { useCategories } from '../hooks/useCategories';
import type { ItemCategory } from '../types';

interface CategorySelectProps {
  label: string;
  value: ItemCategory;
  onChange: (category: ItemCategory) => void;
}

/** Horizontal chip selector for an item's category, backed by the registry.
 *  Includes an inline "＋ new category" affordance. */
export function CategorySelect({ label, value, onChange }: CategorySelectProps) {
  const { t } = useTranslation();
  const { categories, create } = useCategories();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const created = create(name);
    if (created) onChange(created.name);
    setName('');
    setAdding(false);
  };

  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={`${ROW} gap-2`}>
        {categories.map((category) => {
          const active = category.name === value;
          const chipLabel = category.i18nKey
            ? t(`inventory.categories.${category.i18nKey}`)
            : category.name;
          return (
            <Pressable
              key={category.id}
              className={`px-4 py-2 rounded-full border ${
                active ? 'bg-primary border-transparent' : 'bg-surface border-border'
              }`}
              onPress={() => onChange(category.name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}

        {adding ? (
          <View className={`${ROW} items-center gap-1 bg-surface border border-primary rounded-full px-3`}>
            <TextInput
              className="text-xs font-bold text-ink min-w-[80px] py-2"
              value={name}
              onChangeText={setName}
              placeholder={t('inventory.form.newCategoryPlaceholder')}
              placeholderTextColor={colors.muted}
              autoFocus
              onSubmitEditing={commit}
              returnKeyType="done"
            />
            <Pressable onPress={commit} accessibilityRole="button" hitSlop={8}>
              <Feather name="check" size={16} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            className={`${ROW} items-center gap-1 px-4 py-2 rounded-full border border-dashed border-primary`}
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.form.addCategory')}
          >
            <Feather name="plus" size={13} color={colors.primary} />
            <Text className="text-xs font-bold text-primary">{t('inventory.form.addCategory')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
