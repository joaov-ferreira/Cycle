import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/** A backup of a long logbook is far larger than a plan file: allow up to 16 MiB. */
export const BACKUP_MAX_BYTES = 16 * 1024 * 1024;

export type PickedBackupFile = { name: string; text: string; size: number };

/**
 * Opens the document picker and reads the chosen file as text. Returns null when cancelled. A
 * file over `BACKUP_MAX_BYTES` is not read (`text` is empty, `size` tells the caller to reject it).
 * (The plan-import picker caps files at 256 KiB, too small for backups, hence this variant.)
 */
export async function pickBackupFile(): Promise<PickedBackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'text/*', '*/*'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size !== undefined && asset.size > BACKUP_MAX_BYTES) {
    return { name: asset.name, text: '', size: asset.size };
  }
  const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text, size: asset.size ?? new TextEncoder().encode(text).length };
}
