import * as DocumentPicker from 'expo-document-picker';

import { pickTextFile } from './pick-text-file';

const mockText = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ text: () => mockText(uri) })),
}));

const getDocument = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pickTextFile', () => {
  it('returns null when the picker is cancelled', async () => {
    getDocument.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickTextFile()).toBeNull();
  });

  it('asks for json and text files copied to the cache', async () => {
    getDocument.mockResolvedValue({ canceled: true, assets: null });
    await pickTextFile();
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        copyToCacheDirectory: true,
        multiple: false,
        type: expect.arrayContaining(['application/json', 'text/plain']),
      }),
    );
  });

  it('reads the picked file through expo-file-system on native', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/plan.json', name: 'plan.json', size: 12 }],
    });
    mockText.mockResolvedValue('{"a":1}');
    expect(await pickTextFile()).toEqual({ name: 'plan.json', text: '{"a":1}', size: 12 });
    expect(mockText).toHaveBeenCalledWith('file:///cache/plan.json');
  });

  it('reads the web File object when present', async () => {
    const file = { text: () => Promise.resolve('# Plan') };
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:x', name: 'plan.txt', size: 6, file }],
    });
    expect(await pickTextFile()).toEqual({ name: 'plan.txt', text: '# Plan', size: 6 });
    expect(mockText).not.toHaveBeenCalled();
  });

  it('does not read a file over the size limit', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.txt', name: 'big.txt', size: 300 * 1024 }],
    });
    expect(await pickTextFile()).toEqual({ name: 'big.txt', text: '', size: 300 * 1024 });
    expect(mockText).not.toHaveBeenCalled();
  });

  it('falls back to the text length when the size is unknown', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.txt', name: 'a.txt' }],
    });
    mockText.mockResolvedValue('ação');
    expect(await pickTextFile()).toEqual({ name: 'a.txt', text: 'ação', size: 6 });
  });
});
