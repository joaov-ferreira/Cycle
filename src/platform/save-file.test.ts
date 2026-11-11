import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { saveAndShareFile } from './save-file';

const mockCreate = jest.fn();
const mockWrite = jest.fn();
const mockFile = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache-dir' },
  File: jest.fn().mockImplementation((...args: unknown[]) => {
    mockFile(...args);
    return { create: mockCreate, write: mockWrite, uri: 'file:///cache/x.json' };
  }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const sharing = Sharing as unknown as Record<string, jest.Mock>;
const file = { fileName: 'cycle-backup-ana-20261111.json', text: '{"a":1}', mimeType: 'application/json' };

beforeEach(() => {
  jest.clearAllMocks();
  sharing.isAvailableAsync.mockResolvedValue(true);
  sharing.shareAsync.mockResolvedValue(undefined);
  (Platform as { OS: string }).OS = 'ios';
});

describe('saveAndShareFile (native)', () => {
  it('writes the text to the cache directory and opens the share sheet', async () => {
    expect(await saveAndShareFile(file)).toBe(true);
    expect(mockFile).toHaveBeenCalledWith('cache-dir', file.fileName);
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith('{"a":1}');
    expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/x.json', {
      mimeType: 'application/json',
      dialogTitle: file.fileName,
    });
  });

  it('returns false when sharing is unavailable', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    expect(await saveAndShareFile(file)).toBe(false);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('returns false instead of throwing when writing or sharing fails', async () => {
    sharing.shareAsync.mockRejectedValue(new Error('cancelled'));
    expect(await saveAndShareFile(file)).toBe(false);
    mockWrite.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(await saveAndShareFile(file)).toBe(false);
  });
});

describe('saveAndShareFile (web)', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('downloads through a Blob URL', async () => {
    (Platform as { OS: string }).OS = 'web';
    const createObjectURL = jest.fn(() => 'blob:abc');
    const revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const anchor = { click: jest.fn(), href: '', download: '' };
    const body = { appendChild: jest.fn(), removeChild: jest.fn() };
    (globalThis as { document?: unknown }).document = { createElement: () => anchor, body };

    expect(await saveAndShareFile({ ...file, mimeType: 'text/csv' })).toBe(true);

    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('text/csv');
    expect(anchor).toMatchObject({ href: 'blob:abc', download: file.fileName });
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(body.appendChild).toHaveBeenCalledWith(anchor);
    expect(body.removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:abc');
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    delete (globalThis as { document?: unknown }).document;
  });

  it('returns false when the download cannot start', async () => {
    (Platform as { OS: string }).OS = 'web';
    URL.createObjectURL = jest.fn(() => {
      throw new Error('no blob');
    });
    expect(await saveAndShareFile(file)).toBe(false);
  });
});
