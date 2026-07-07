import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

// Color token → (tint bg + border, icon color). Tokens are stored per category
// (categories.color). Full class strings are listed statically so NativeWind can
// see them at build time. Unknown/absent token falls back to slate.
const COLOR_STYLE: Record<string, { chip: string; icon: string }> = {
  emerald: { chip: 'bg-emerald-50 border-emerald-100', icon: colors.positive },
  cyan: { chip: 'bg-cyan-50 border-cyan-100', icon: colors.info },
  amber: { chip: 'bg-amber-50 border-amber-100', icon: colors.warning },
  violet: { chip: 'bg-violet-50 border-violet-100', icon: colors['warning-dark'] },
  sky: { chip: 'bg-sky-50 border-sky-100', icon: colors.primary },
  pink: { chip: 'bg-pink-50 border-pink-100', icon: colors.accent },
  slate: { chip: 'bg-slate-50 border-slate-100', icon: colors.muted },
};

const FALLBACK = COLOR_STYLE.slate;

/** Rounded category tile with a package glyph, tinted by the category color token. */
export function CategoryAvatar({ color }: { color?: string | null }) {
  const style = (color && COLOR_STYLE[color]) || FALLBACK;
  return (
    <View className={`w-12 h-12 rounded-xl items-center justify-center border ${style.chip}`}>
      <Feather name="package" size={22} color={style.icon} />
    </View>
  );
}
