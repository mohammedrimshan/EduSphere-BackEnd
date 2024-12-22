self.addEventListener('push', function(event) {
    if (event.data) {
      const data = event.data.json();
      
      // Show the notification
      event.waitUntil(
        self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/path/to/icon.png',
          badge: '/path/to/badge.png',
          data: {
            url: data.url
          }
        })
      );
  
      // Send a message to the client
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION',
            notification: {
              title: data.title,
              body: data.body
            }
          });
        });
      });
    }
  });
  
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.notification.data && event.notification.data.url) {
      event.waitUntil(
        clients.openWindow(event.notification.data.url)
      );
    }
  });
  
  