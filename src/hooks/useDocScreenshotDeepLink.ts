import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import {
  isDocScreenshotUrl,
  parseDocScreenshotId,
  requestDocScreenshot,
} from '@/lib/docScreenshot';

/** __DEV__ deep links: repright://doc-screenshot/06-paywall */
export function useDocScreenshotDeepLink() {
  useEffect(() => {
    if (!__DEV__) return;

    const handle = (url: string | null) => {
      if (!url || !isDocScreenshotUrl(url)) return;
      const id = parseDocScreenshotId(url);
      if (id) requestDocScreenshot(id);
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}
