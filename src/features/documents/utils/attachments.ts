import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { attachmentRepository } from '@/repositories/attachment-repository';
import { now } from '@/utils/id';
import type { AttachmentMeta } from '@/repositories/document-repository';

/** A file the owner picked, before it is compressed and stored. */
export interface PickedFile {
  uri: string;
  name: string;
  mime: string;
}

const MAX_EDGE = 1600; // px — cap the long edge; keeps receipt photos ~150–400KB
const JPEG_QUALITY = 0.6;

/** Snap a receipt with the camera. Returns null on cancel / denied permission. */
export async function pickPhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `receipt-${now()}.jpg`,
    mime: a.mimeType ?? 'image/jpeg',
  };
}

/** Pick an existing file (image or PDF). Returns null on cancel. */
export async function pickFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream' };
}

/** Downscale + recompress an image; returns a new cache-file uri + jpeg mime. */
async function compressImage(uri: string): Promise<{ uri: string; mime: string }> {
  let ref = await ImageManipulator.manipulate(uri).renderAsync();
  const longEdge = Math.max(ref.width, ref.height);
  if (longEdge > MAX_EDGE) {
    const scale = MAX_EDGE / longEdge;
    ref = await ImageManipulator.manipulate(ref)
      .resize({ width: Math.round(ref.width * scale) })
      .renderAsync();
  }
  const out = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: out.uri, mime: 'image/jpeg' };
}

/**
 * Read a picked file's bytes (compressing images first) and store them in the
 * attachments DB. Bytes hit disk immediately, so an OS kill mid-entry can't lose
 * them. document_id is backfilled at save via attachmentRepository.assignDocument.
 */
export async function ingest(picked: PickedFile): Promise<AttachmentMeta> {
  let uri = picked.uri;
  let mime = picked.mime;
  let name = picked.name;
  if (mime.startsWith('image/') && mime !== 'image/gif') {
    const c = await compressImage(uri);
    uri = c.uri;
    mime = c.mime;
    name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  const bytes = await new File(uri).bytes();
  return attachmentRepository.insert({ documentId: '', name, mime, bytes });
}

/** Load bytes to a temp cache file and hand it to the OS viewer / share sheet. */
export async function openAttachment(meta: AttachmentMeta): Promise<void> {
  const bytes = attachmentRepository.getBytes(meta.id);
  if (!bytes) return;
  const file = new File(Paths.cache, meta.name);
  if (file.exists) file.delete();
  file.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: meta.mime, dialogTitle: meta.name });
  }
}

/** Delete an attachment's bytes (chip removed before/after save). */
export function removeAttachment(id: string): void {
  attachmentRepository.remove(id);
}
