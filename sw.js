// Service Worker – notification scheduler
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
let scheduledTimers = [];

function clearScheduled() {
  scheduledTimers.forEach(id => clearTimeout(id));
  scheduledTimers = [];
}

function scheduleAll() {
  clearScheduled();
  const now = Date.now();
  HOURS.forEach(hour => {
    const target = new Date();
    target.setHours(hour, 0, 0, 0);
    const diff = target.getTime() - now;
    if (diff > 0) {
      const id = setTimeout(() => {
        self.registration.showNotification('作業報告リマインド 📋', {
          body: `${hour}:00 の作業内容を記録しましょう`,
          tag: `wr-${hour}`,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📋</text></svg>',
          requireInteraction: false
        });
      }, diff);
      scheduledTimers.push(id);
    }
  });
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleAll();
  }
  if (event.data?.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('作業報告リマインド 📋', {
      body: 'テスト通知です。通知は正常に動作しています！',
      tag: 'wr-test'
    });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Reschedule on SW activation (e.g. after update)
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
