import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { useTags } from '../hooks/useTags';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Free-form tag editor: selected chips (removable) + type-to-add + tap-a-known-tag. */
export function TagInput({ label, value, onChange }: TagInputProps) {
  const { t } = useTranslation();
  const { tags: known } = useTags();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
    setDraft('');
  };
  const remove = (name: string) => onChange(value.filter((tg) => tg !== name));

  const suggestions = known.filter((tg) => !value.includes(tg)).slice(0, 12);

  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">{label}</Text>

      {value.length > 0 && (
        <View className={`${ROW} flex-wrap gap-2`}>
          {value.map((tg) => (
            <Pressable
              key={tg}
              className={`${ROW} items-center gap-1 bg-primary-light border border-primary/20 rounded-full px-3 py-1.5`}
              onPress={() => remove(tg)}
              accessibilityRole="button"
            >
              <Feather name="x" size={12} color={colors.primary} />
              <Text className="text-xs font-bold text-primary">{tg}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View className={`${ROW} items-center gap-1 bg-background border border-border rounded-xl px-3`}>
        <TextInput
          className="flex-1 text-sm text-ink py-2.5"
          value={draft}
          onChangeText={setDraft}
          placeholder={t('inventory.form.tagsPlaceholder')}
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => add(draft)}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <Pressable onPress={() => add(draft)} accessibilityRole="button" hitSlop={8}>
          <Feather name="plus" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {suggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={`${ROW} gap-2 pt-0.5`}>
          {suggestions.map((tg) => (
            <Pressable
              key={tg}
              className="bg-surface border border-border rounded-full px-3 py-1.5"
              onPress={() => add(tg)}
              accessibilityRole="button"
            >
              <Text className="text-xs font-medium text-muted">{tg}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
