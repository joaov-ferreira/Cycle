import { Share } from 'react-native';

import { shareText } from './share-text';

describe('shareText', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shares the text as the message', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await shareText('hello');
    expect(share).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('never throws when sharing is unavailable', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('unavailable'));
    await expect(shareText('hello')).resolves.toBeUndefined();
  });
});
