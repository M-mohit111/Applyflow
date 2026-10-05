import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AutoApply',
  version: '1.0.0',
  description: 'Smart Form-Filling Assistant for Placements',
  permissions: ['storage', 'activeTab', 'scripting', 'contextMenus'],
  host_permissions: ['https://*/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      all_frames: true,
      match_about_blank: true,
    },
  ],
  action: {
    default_popup: 'index.html',
  },
  options_ui: {
    page: 'options.html',
    open_in_tab: true
  }
});
