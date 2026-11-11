import * as DocumentPicker from 'expo-document-picker';

import { BACKUP_MAX_BYTES, pickBackupFile } from './pick-backup-file';

const mockText = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ text: () => mockText(uri) })),
}));

const getDocument = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('pickBackupFile', () => {
  it('returns null when cancelled', async () => {
    getDocument.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickBackupFile()).toBeNull();
  });

  it('reads the picked file through expo-file-system', async () => {
    getDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///b.json', name: 'b.json', size: 7 }] });
    mockText.mockResolvedValue('{"a":1}');
    expect(await pickBackupFile()).toEqual({ name: 'b.json', text: '{"a":1}', size: 7 });
    expect(mockText).toHaveBeenCalledWith('file:///b.json');
  });

  it('reads the web File when the asset carries one, measuring it when the size is unknown', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:x', name: 'b.json', file: { text: () => Promise.resolve('é') } }],
    });
    expect(await pickBackupFile()).toEqual({ name: 'b.json', text: 'é', size: 2 });
  });

  it('accepts backups larger than a plan file but does not read files over the backup limit', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.json', name: 'big.json', size: BACKUP_MAX_BYTES + 1 }],
    });
    expect(await pickBackupFile()).toEqual({ name: 'big.json', text: '', size: BACKUP_MAX_BYTES + 1 });
    expect(mockText).not.toHaveBeenCalled();

    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mid.json', name: 'mid.json', size: 1_000_000 }],
    });
    mockText.mockResolvedValue('{}');
    expect((await pickBackupFile())?.text).toBe('{}');
  });
});
