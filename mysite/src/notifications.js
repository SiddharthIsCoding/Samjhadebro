export const requestNotificationPermission = async () => {
    if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }
    return false;
};

export const triggerDesktopNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: "/logo192.png", // Path to your app logo/icon
        });
    }
};