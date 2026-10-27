import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '星準',
    short_name: '星準',
    description: '星準體育分析，即時比分與賽前分析。',
    id: '/',
    start_url: '/welcome',
    scope: '/',
    display: 'browser',
    lang: 'zh-Hant-TW',
    background_color: '#06101b',
    theme_color: '#06101b',
    icons: [
      {src: '/brand/xingzhun-icon-192-v1.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/brand/xingzhun-icon-512-v1.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
    ],
  };
}
