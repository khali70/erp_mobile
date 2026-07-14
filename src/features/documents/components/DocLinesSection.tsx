import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { DocLineRow } from './DocLineRow';
import { DocLinesHeader } from './DocLinesHeader';
import { OverStockBanner } from './OverStockBanner';
import { QuickEntryRow } from './QuickEntryRow';
import type { DocStock } from '../hooks/useStockCeilings';
import type { DocLine, DocMode, QuickEntryValues, QuickEntryLocks } from '../types';

interface DocLinesSectionProps {
  /** i18n namespace of the owning mode (documents.outgoing | documents.incoming). */
  ns: string;
  mode: DocMode;
  lines: DocLine[];
  /**
   * Sale ceilings. Omitted by the purchase screen — buying more of something can
   * never overdraw it, so the incoming form carries no ceilings at all.
   */
  stock?: DocStock;
  onMutateQty: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
  onSetPrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onAddLine: () => void;
  /** Sale-only: when provided, renders the barcode scan toggle. */
  scanning?: boolean;
  onToggleScan?: () => void;
  // Fast-entry
  entryMode: 'list' | 'quick';
  onSetEntryMode: (m: 'list' | 'quick') => void;
  quick: QuickEntryValues;
  locks: QuickEntryLocks;
  onQuickChange: <K extends keyof QuickEntryValues>(field: K, value: QuickEntryValues[K]) => void;
  onToggleLock: (field: keyof QuickEntryValues) => void;
  onAddQuick: () => void;
  titleSuggestions: string[];
}

/** Lines block: header controls + optional quick-entry row + line list / empty. */
export function DocLinesSection({
  ns,
  mode,
  lines,
  stock,
  onMutateQty,
  onSetQty,
  onSetPrice,
  onRemove,
  onAddLine,
  scanning,
  onToggleScan,
  entryMode,
  onSetEntryMode,
  quick,
  locks,
  onQuickChange,
  onToggleLock,
  onAddQuick,
  titleSuggestions,
}: DocLinesSectionProps) {
  const { t } = useTranslation();
  // Quick entry is a purchase-mode affordance; sale mode always uses the list.
  const showQuick = mode !== 'sale' && entryMode === 'quick';

  return (
    <>
      <DocLinesHeader
        ns={ns}
        mode={mode}
        onAddLine={onAddLine}
        entryMode={entryMode}
        onSetEntryMode={onSetEntryMode}
        scanning={scanning}
        onToggleScan={onToggleScan}
      />

      {showQuick && (
        <QuickEntryRow
          values={quick}
          locks={locks}
          onChange={onQuickChange}
          onToggleLock={onToggleLock}
          onAdd={onAddQuick}
          suggestions={titleSuggestions}
        />
      )}

      {/* Which lines outgrew their stock — named, never silently trimmed. */}
      <OverStockBanner names={(stock?.overLines ?? []).map((l) => l.name)} />

      {/* Lines */}
      {lines.length === 0 ? (
        <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3">
          <Feather name="inbox" size={40} color={colors['slate-400']} />
          <Text className="text-muted text-sm text-center">{t('documents.emptyLines')}</Text>
        </View>
      ) : (
        <View className="gap-3">
          {lines.map((line, i) => (
            <DocLineRow
              key={line.id}
              line={line}
              mode={mode}
              isNewest={i === lines.length - 1}
              maxQty={stock?.maxQtyById[line.id] ?? null}
              onInc={() => onMutateQty(line.id, 1)}
              onDec={() => onMutateQty(line.id, -1)}
              onQty={(q) => onSetQty(line.id, q)}
              onPrice={(p) => onSetPrice(line.id, p)}
              onDelete={() => onRemove(line.id)}
            />
          ))}
        </View>
      )}
    </>
  );
}
