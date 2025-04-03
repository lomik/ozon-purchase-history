import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json'

const isDev = process.env.NODE_ENV == 'development'

export default defineManifest({
  name: `${packageData.displayName || packageData.name}${isDev ? ` ➡️ Dev` : ''}`,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'img/icon16.png',
    32: 'img/icon32.png',
    48: 'img/icon48.png',
    128: 'img/icon128.png',
  },
  options_page: 'orders.html',
  action: {
    default_icon: 'img/icon48.png',
  },
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  web_accessible_resources: [
    {
      resources: [
        'img/icon16.png', 'img/icon32.png', 'img/icon48.png', 'img/icon128.png',
        'css/pico.min.css'
      ],
      matches: [],
    },
  ],
  permissions: [
    'storage', 'tabs',
    "cookies", "indexedDB",
  ],
  host_permissions: [
    "https://*.ozon.ru/*"
  ],
})
