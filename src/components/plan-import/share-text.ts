import { Share } from 'react-native';

/**
 * Opens the platform share sheet with `text`. Never throws: where sharing is unavailable (some
 * web browsers) or the user dismisses it, the selectable text field on screen is the fallback.
 */
export async function shareText(text: string): Promise<void> {
  try {
    await Share.share({ message: text });
  } catch {
    // Sharing unavailable: the text stays selectable on screen.
  }
}
