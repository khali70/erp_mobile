import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { useCategories } from '@/features/inventory/hooks/useCategories';
import { TagInput } from '@/features/inventory/components/TagInput';
import type { QuickEntryValues, QuickEntryLocks } from '../types';
import { LockableField } from './LockableField';

interface QuickEntryRowProps {
  values: QuickEntryValues;
  locks: QuickEntryLocks;
  onChange: <K extends keyof QuickEntryValues>(field: K, value: QuickEntryValues[K]) => void;
  onToggleLock: (field: keyof QuickEntryValues) => void;
  onAdd: () => void;
  /** Existing item names matching the typed title (find-or-create autocomplete). */
  suggestions: string[];
}

/**
 * Pinned fast-entry row: category + title + price + qty + tags (+ optional
 * note), each with a lock toggle. Return/＋ adds the line; unlocked fields clear
 * and focus returns to the title for rapid bulk entry.
 */
export function QuickEntryRow({
  values,
  locks,
  onChange,
  onToggleLock,
  onAdd,
  suggestions,
}: QuickEntryRowProps) {
  const { t } = useTranslation();
  const { categories } = useCategories();
  const canAdd = values.title.trim() !== '' && values.category.trim() !== '';

  return (
    <View className="bg-surface rounded-2xl p-3.5 border border-primary/30 gap-3">
      {/* Category chips */}
      <LockableField
        label={t('inventory.form.category')}
        locked={locks.category}
        onToggleLock={() => onToggleLock('category')}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={`${ROW} gap-2`}>
          {categories.map((c) => {
            const active = c.name === values.category;
            const label = c.i18nKey ? t(`inventory.categories.${c.i18nKey}`) : c.name;
            return (
              <Pressable
                key={c.id}
                className={`px-3.5 py-1.5 rounded-full border ${active ? 'bg-primary border-transparent' : 'bg-background border-border'}`}
                onPress={() => onChange('category', c.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LockableField>

      {/* Title: fixed prefix (lockable) + variable part + autocomplete */}
      <View className={`${ROW} gap-3 items-start`}>
        {/* Fixed prefix — lock to reuse across many lines (e.g. brand) */}
        <LockableField
          className="w-28"
          label={t('documents.quick.titlePrefix')}
          locked={locks.titlePrefix}
          onToggleLock={() => onToggleLock('titlePrefix')}
        >
          <TextInput
            className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm"
            value={values.titlePrefix}
            onChangeText={(v) => onChange('titlePrefix', v)}
            placeholder={t('documents.quick.titlePrefixPlaceholder')}
            placeholderTextColor={colors.muted}
          />
        </LockableField>

        {/* Variable part */}
        <View className="flex-1 gap-1">
          <Text className="text-[11px] font-semibold text-muted">{t('documents.quick.title')}</Text>
          <View className={`${ROW} items-center gap-1 bg-background border border-border rounded-xl px-3`}>
            <TextInput
              className="flex-1 text-sm text-ink py-2.5"
              value={values.title}
              onChangeText={(v) => onChange('title', v)}
              placeholder={t('documents.quick.titlePlaceholder')}
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => canAdd && onAdd()}
              blurOnSubmit={false}
            />
          </View>
        </View>
      </View>
      {values.title.trim() !== '' && suggestions.length > 0 && (
        <View className="gap-1 -mt-1">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={`${ROW} gap-2 pt-0.5`}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                className="bg-primary-light border border-primary/20 rounded-full px-3 py-1.5"
                onPress={() => onChange('title', name)}
                accessibilityRole="button"
              >
                <Text className="text-xs font-medium text-primary" numberOfLines={1}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Price + qty */}
      <View className={`${ROW} gap-3`}>
        <LockableField
          className="flex-1"
          label={t('documents.quick.price')}
          locked={locks.price}
          onToggleLock={() => onToggleLock('price')}
        >
          <TextInput
            className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm"
            value={values.price}
            onChangeText={(v) => onChange('price', v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors['slate-400']}
          />
        </LockableField>
        <LockableField
          className="flex-1"
          label={t('documents.quick.qty')}
          locked={locks.qty}
          onToggleLock={() => onToggleLock('qty')}
        >
          <TextInput
            className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm"
            value={values.qty}
            onChangeText={(v) => onChange('qty', v)}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={colors['slate-400']}
          />
        </LockableField>
      </View>

      {/* Tags */}
      <LockableField
        label={t('inventory.form.tags')}
        locked={locks.tags}
        onToggleLock={() => onToggleLock('tags')}
      >
        <TagInput label="" value={values.tags} onChange={(v) => onChange('tags', v)} />
      </LockableField>

      {/* Note */}
      <LockableField
        label={t('inventory.form.notes')}
        locked={locks.note}
        onToggleLock={() => onToggleLock('note')}
      >
        <TextInput
          className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm"
          value={values.note}
          onChangeText={(v) => onChange('note', v)}
          placeholder={t('inventory.form.notesPlaceholder')}
          placeholderTextColor={colors['slate-400']}
        />
      </LockableField>

      {/* Add */}
      <Pressable
        className={`${ROW} items-center justify-center gap-2 rounded-xl py-3 ${canAdd ? 'bg-primary' : 'bg-border'}`}
        onPress={() => canAdd && onAdd()}
        disabled={!canAdd}
        accessibilityRole="button"
      >
        <Feather name="plus" size={18} color={canAdd ? colors.surface : colors.muted} />
        <Text className={`text-sm font-extrabold ${canAdd ? 'text-white' : 'text-muted'}`}>
          {t('documents.quick.add')}
        </Text>
      </Pressable>
    </View>
  );
}
