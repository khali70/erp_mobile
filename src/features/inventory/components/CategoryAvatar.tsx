import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import type { ItemCategory } from '../types';

// Category → (tint bg + border, icon color). Presentational mapping only;
// uses default Tailwind tint classes (not arbitrary hex literals).
const CATEGORY_STYLE: Record<ItemCategory, { chip: string; icon: string }> = {
  tshirts: { chip: 'bg-emerald-50 border-emerald-100', icon: colors.positive },
  jackets: { chip: 'bg-cyan-50 border-cyan-100', icon: colors.info },
  shoes: { chip: 'bg-amber-50 border-amber-100', icon: colors.warning },
  pants: { chip: 'bg-violet-50 border-violet-100', icon: colors['warning-dark'] },
  shirts: { chip: 'bg-sky-50 border-sky-100', icon: colors.primary },
  accessories: { chip: 'bg-pink-50 border-pink-100', icon: colors.accent },
  other: { chip: 'bg-slate-50 border-slate-100', icon: colors.muted },
};

/** Rounded category tile with a package glyph, tinted by category. */
export function CategoryAvatar({ category }: { category: ItemCategory }) {
  const style = CATEGORY_STYLE[category];
  return (
    <View className={`w-12 h-12 rounded-xl items-center justify-center border ${style.chip}`}>
      <Feather name="package" size={22} color={style.icon} />
    </View>
  );
}
