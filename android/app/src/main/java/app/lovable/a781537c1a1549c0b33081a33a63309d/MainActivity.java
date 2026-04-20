package app.lovable.a781537c1a1549c0b33081a33a63309d;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);

        // Create notification channel for delivery alerts (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "delivery_alerts",
                "Delivery Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("New order notifications");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }
}