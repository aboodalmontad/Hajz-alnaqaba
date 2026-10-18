import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

function hmrWsShimPlugin() {
  const shimCode = `(function() {
  if (typeof window === 'undefined' || !window.WebSocket) return;
  var NativeWebSocket = window.WebSocket;

  class ViteHmrShim extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = String(url || '');
      this.protocol = typeof protocols === 'string' ? protocols : (Array.isArray(protocols) ? protocols.join(', ') : 'vite-hmr');
      this.readyState = 1;
      this.binaryType = 'blob';
      this.bufferedAmount = 0;
      this.extensions = '';
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this.onmessage = null;

      var self = this;
      setTimeout(function() {
        var openEvent = new Event('open');
        if (typeof self.onopen === 'function') {
          try { self.onopen(openEvent); } catch (e) {}
        }
        self.dispatchEvent(openEvent);
      }, 0);
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }

  ViteHmrShim.CONNECTING = 0;
  ViteHmrShim.OPEN = 1;
  ViteHmrShim.CLOSING = 2;
  ViteHmrShim.CLOSED = 3;

  function WebSocketProxy(url, protocols) {
    var urlStr = String(url || '');
    var isHmr = (typeof protocols === 'string' && protocols.indexOf('vite-hmr') !== -1) ||
                (Array.isArray(protocols) && protocols.indexOf('vite-hmr') !== -1) ||
                urlStr.indexOf('token=') !== -1 ||
                urlStr.indexOf('vite-hmr') !== -1;

    if (isHmr) {
      return new ViteHmrShim(url, protocols);
    }
    return new NativeWebSocket(url, protocols);
  }

  WebSocketProxy.prototype = NativeWebSocket.prototype;
  WebSocketProxy.CONNECTING = NativeWebSocket.CONNECTING;
  WebSocketProxy.OPEN = NativeWebSocket.OPEN;
  WebSocketProxy.CLOSING = NativeWebSocket.CLOSING;
  WebSocketProxy.CLOSED = NativeWebSocket.CLOSED;

  window.WebSocket = WebSocketProxy;
})();`;

  return {
    name: 'hmr-ws-shim',
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        if (html.includes('/@vite/client')) {
          return html.replace(
            '<script type="module" src="/@vite/client"></script>',
            `<script>${shimCode}</script>\n    <script type="module" src="/@vite/client"></script>`
          );
        }
        return html;
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      hmrWsShimPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'نظام تنظيم أدوار المراجعين - نقابة المحامين بحلب',
          short_name: 'نقابة المحامين',
          description: 'نظام إدارة أدوار المراجعين وإصدار التذاكر لدائرة الوكالات بنقابة المحامين بحلب',
          theme_color: '#1e3a8a',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: {},
    },
  };
});
