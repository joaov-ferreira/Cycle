import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type SaveableFile = { fileName: string; text: string; mimeType: string };

/** Web: downloads the text through a Blob URL and an anchor click. */
function downloadOnWeb(file: SaveableFile): boolean {
  const blob = new Blob([file.text], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Saves `file.text` as a file the user can keep: native writes it to the cache directory and
 * opens the share sheet; web downloads it. Resolves `false` when that was not possible. Never throws.
 */
export async function saveAndShareFile(file: SaveableFile): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return downloadOnWeb(file);
    if (!(await Sharing.isAvailableAsync())) return false;
    const target = new File(Paths.cache, file.fileName);
    target.create({ overwrite: true });
    target.write(file.text);
    await Sharing.shareAsync(target.uri, { mimeType: file.mimeType, dialogTitle: file.fileName });
    return true;
  } catch {
    return false;
  }
}
