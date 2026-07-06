import { I18nManager } from 'react-native';

/**
 * Row direction for RTL-aware layouts. Under a forced-RTL layout, `flex-row`
 * already lays children right-to-left; when not RTL we reverse to keep the same
 * visual reading order. Use as `className={ROW}`.
 */
export const ROW = I18nManager.isRTL ? 'flex-row' : 'flex-row-reverse';

/** Translucent dark overlay for controls sitting on the teal header. */
export const HEADER_OVERLAY = 'rgba(6,78,59,0.30)';
