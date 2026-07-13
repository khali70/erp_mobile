import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { AttachmentMeta } from '@/repositories/document-repository';
import { openAttachment } from '../utils/attachments';

interface AttachmentsCardProps {
  attachments: AttachmentMeta[];
  onAddPhoto: () => void;
  onAddFile: () => void;
  onRemove: (id: string) => void;
}

const isImage = (mime: string) => mime.startsWith('image/');

/** Receipt attachments: snap a photo or pick a file, then a list of removable chips. */
export function AttachmentsCard({ attachments, onAddPhoto, onAddFile, onRemove }: AttachmentsCardProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <Text className="text-xs font-bold text-muted text-right">
        {t('documents.attachments.title')}
      </Text>

      <View className={`${ROW} gap-2`}>
        <Pressable
          className={`${ROW} flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-primary-light py-3`}
          onPress={onAddPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('documents.attachments.addPhoto')}
        >
          <Feather name="camera" size={16} color={colors.primary} />
          <Text className="text-primary text-sm font-bold">{t('documents.attachments.addPhoto')}</Text>
        </Pressable>
        <Pressable
          className={`${ROW} flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-primary-light py-3`}
          onPress={onAddFile}
          accessibilityRole="button"
          accessibilityLabel={t('documents.attachments.addFile')}
        >
          <Feather name="paperclip" size={16} color={colors.primary} />
          <Text className="text-primary text-sm font-bold">{t('documents.attachments.addFile')}</Text>
        </Pressable>
      </View>

      {attachments.length === 0 ? (
        <Text className="text-muted text-xs text-center">{t('documents.attachments.empty')}</Text>
      ) : (
        attachments.map((a) => (
          <View key={a.id} className={`${ROW} items-center gap-2 bg-background rounded-xl px-3 py-2.5`}>
            <Feather name={isImage(a.mime) ? 'image' : 'file-text'} size={16} color={colors.muted} />
            <Pressable className="flex-1" onPress={() => openAttachment(a)} accessibilityRole="button">
              <Text className="text-ink text-sm text-right" numberOfLines={1}>{a.name}</Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(a.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
            >
              <Feather name="x" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
