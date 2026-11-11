import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { DEFAULT_MAX_BYTES } from '@/domain/plan-import';

export type PickedTextFile = { name: string; text: string; size: number };

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Opens the system document picker for a `.json` / `.txt` file and reads its text.
 * Returns null when cancelled. A file over the import size limit is not read (`text` is empty,
 * `size` tells the caller to reject it).
 */
export async function pickTextFile(): Promise<PickedTextFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'text/*', '*/*'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size !== undefined && asset.size > DEFAULT_MAX_BYTES) {
    return { name: asset.name, text: '', size: asset.size };
  }
  const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text, size: asset.size ?? utf8Length(text) };
}
