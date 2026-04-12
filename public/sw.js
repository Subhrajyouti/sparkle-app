// Service Worker for Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "New Delivery Request!", body: "You have a new order." };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
  }

  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "delivery-notification",
    requireInteraction: true, // Don't auto-dismiss
    vibrate: [500, 200, 500, 200, 500, 200, 500], // Long vibration pattern
    actions: [
      { action: "open", title: "Open App" },
    ],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || "/";
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if any
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
