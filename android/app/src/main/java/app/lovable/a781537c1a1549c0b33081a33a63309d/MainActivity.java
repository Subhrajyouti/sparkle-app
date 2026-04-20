package app.lovable.a781537c1a1549c0b33081a33a63309d;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.net.Uri;
import android.media.AudioAttributes;
import android.graphics.Color;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "delivery_alerts",
                "Delivery Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("New order notifications");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500, 200, 500});
            channel.setShowBadge(true);
            channel.enableLights(true);
            channel.setLightColor(Color.RED);

            // Custom alarm sound
            Uri soundUri = Uri.parse(
                android.content.ContentResolver.SCHEME_ANDROID_RESOURCE
                + "://" + getPackageName() + "/raw/alarm"
            );
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            channel.setSound(soundUri, audioAttributes);

            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }
}