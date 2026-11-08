// Sitio público en modo framework con SSR (spec 3.7). Sin flags `unstable_` (FE-03).
import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'app',
  ssr: true,
} satisfies Config;
