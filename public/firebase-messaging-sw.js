// Firebase Messaging Service Worker
// Recebe notificações push em background (app fechado ou minimizado)
// As variáveis de ambiente são injetadas em build-time via next.config.mjs
// ou manualmente substituídas no deploy.

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

const swUrl = new URL(self.location.href);
const query = swUrl.searchParams;
const fallbackConfig = self.__FIREBASE_CONFIG__ || {};

firebase.initializeApp({
  apiKey: query.get('apiKey') || fallbackConfig.apiKey || '',
  projectId: query.get('projectId') || fallbackConfig.projectId || '',
  messagingSenderId: query.get('messagingSenderId') || fallbackConfig.messagingSenderId || '',
  appId: query.get('appId') || fallbackConfig.appId || '',
});

const messaging = firebase.messaging();

// Debug: captura qualquer evento push bruto (ajuda a diagnosticar)
self.addEventListener('push', function (event) {
  console.log('[SW] push event recebido:', event.data ? event.data.text() : '(sem dados)');
});

// Notificação recebida em background
messaging.onBackgroundMessage(function (payload) {
  console.log('[SW] onBackgroundMessage:', JSON.stringify(payload));
  const title = payload.notification?.title || 'Maestro';
  const options = {
    body: payload.notification?.body || '📚 Hora de estudar!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: payload.data,
    actions: [
      { action: 'estudar', title: '📖 Estudar agora' },
      { action: 'depois', title: 'Depois' },
    ],
  };

  self.registration.showNotification(title, options);
});

// Clique na notificação
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.action === 'estudar'
    ? '/dashboard/estudar'
    : '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se já tem uma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Senão abre nova aba
      return self.clients.openWindow(url);
    })
  );
});
