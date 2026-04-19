package app.lovable.a781537c1a1549c0b33081a33a63309d;

import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class LocationForegroundService extends Service {

    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "location_channel";
    private static final int NOTIF_ID = 1001;

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;

    private String partnerId;
    private String supabaseUrl;
    private String supabaseKey;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        partnerId  = intent.getStringExtra("partner_id");
        supabaseUrl = intent.getStringExtra("supabase_url");
        supabaseKey = intent.getStringExtra("supabase_key");

        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Delivery tracking active")
            .setContentText("Sharing your location with Khanismita")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        startForeground(NOTIF_ID, notification);
        startLocationUpdates();

        return START_STICKY; // restart if killed
    }

    private void startLocationUpdates() {
        fusedClient = LocationServices.getFusedLocationProviderClient(this);

        LocationRequest request = LocationRequest.create()
            .setInterval(10000)          // 10 seconds
            .setFastestInterval(5000)
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location loc = result.getLastLocation();
                if (loc == null) return;
                pushToSupabase(loc);
            }
        };

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission missing", e);
        }
    }

    private void pushToSupabase(final Location loc) {
        new Thread(() -> {
            try {
                String url = supabaseUrl + "/rest/v1/partner_locations";
                String body = "{"
                    + "\"partner_id\":\"" + partnerId + "\","
                    + "\"latitude\":" + loc.getLatitude() + ","
                    + "\"longitude\":" + loc.getLongitude() + ","
                    + "\"accuracy\":" + loc.getAccuracy() + ","
                    + "\"speed\":" + (loc.hasSpeed() ? loc.getSpeed() : 0) + ","
                    + "\"is_online\":true,"
                    + "\"updated_at\":\"" + new java.util.Date().toInstant().toString() + "\""
                    + "}";

                HttpURLConnection conn = (HttpURLConnection)
                    new URL(url).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Supabase response: " + code);
                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Failed to push location", e);
            }
        }).start();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
}