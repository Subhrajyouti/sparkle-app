package app.lovable.a781537c1a1549c0b33081a33a63309d;

import android.app.*;
import android.content.*;
import android.location.Location;
import android.os.*;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

public class LocationForegroundService extends Service {

    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "location_channel";
    private static final int NOTIF_ID = 1001;

    private static final String SUPABASE_URL = "https://opcnbtnoefrchzdaabbt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wY25idG5vZWZyY2h6ZGFhYmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTQ2ODgsImV4cCI6MjA4ODEzMDY4OH0.i-SPRe-H8dh-FWhMrCmA_6lKWiyfz20wRQ-KUS8iQJE";

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private String partnerId;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Save partner_id to SharedPreferences so START_STICKY restart can read it
        if (intent != null) {
            String pid = intent.getStringExtra("partner_id");
            if (pid != null) {
                getSharedPreferences("location_prefs", MODE_PRIVATE)
                    .edit().putString("partner_id", pid).apply();
            }
        }

        // Always read from SharedPreferences — works after Android restarts service too
        partnerId = getSharedPreferences("location_prefs", MODE_PRIVATE)
            .getString("partner_id", null);

        Log.d(TAG, "Service started. partner=" + partnerId);

        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Delivery tracking active")
            .setContentText("Sharing your location with Khanismita")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();

        startForeground(NOTIF_ID, notification);
        startLocationUpdates();
        return START_STICKY;
    }

    private void startLocationUpdates() {
        fusedClient = LocationServices.getFusedLocationProviderClient(this);

        LocationRequest request = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 10000L)
            .setMinUpdateIntervalMillis(5000L)
            .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location loc = result.getLastLocation();
                if (loc == null) return;
                Log.d(TAG, "Location fix: " + loc.getLatitude() + ", " + loc.getLongitude());
                pushToSupabase(loc);
            }
        };

        try {
            fusedClient.requestLocationUpdates(
                request, locationCallback, Looper.getMainLooper());
            Log.d(TAG, "Location updates requested successfully");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission missing", e);
        }
    }

    private void pushToSupabase(final Location loc) {
        if (partnerId == null) {
            Log.e(TAG, "Missing partner_id — cannot push location");
            return;
        }

        new Thread(() -> {
            try {
                String now = new SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                    .format(new Date());

                String urlStr = SUPABASE_URL
                    + "/rest/v1/partner_locations"
                    + "?on_conflict=partner_id";

                String body = "{"
                    + "\"partner_id\":\"" + partnerId + "\","
                    + "\"latitude\":"     + loc.getLatitude()  + ","
                    + "\"longitude\":"    + loc.getLongitude() + ","
                    + "\"accuracy\":"     + loc.getAccuracy()  + ","
                    + "\"speed\":"        + (loc.hasSpeed()    ? loc.getSpeed()   : 0) + ","
                    + "\"heading\":"      + (loc.hasBearing()  ? loc.getBearing() : 0) + ","
                    + "\"is_online\":true,"
                    + "\"reported_at\":\"" + now + "\","
                    + "\"updated_at\":\""  + now + "\""
                    + "}";

                Log.d(TAG, "Pushing to: " + urlStr);
                Log.d(TAG, "Payload: " + body);

                HttpURLConnection conn = (HttpURLConnection)
                    new URL(urlStr).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("apikey",        SUPABASE_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                conn.setRequestProperty("Content-Type",  "application/json");
                conn.setRequestProperty("Prefer",
                    "resolution=merge-duplicates,return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Supabase response code: " + code);

                if (code >= 300) {
                    InputStream es = conn.getErrorStream();
                    if (es != null) {
                        String errBody = new String(es.readAllBytes(), StandardCharsets.UTF_8);
                        Log.e(TAG, "Supabase error body: " + errBody);
                    }
                }

                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Failed to push location to Supabase", e);
            }
        }).start();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
        // Mark partner offline — no updated_at so manager timer doesn't reset
        if (partnerId != null) {
            new Thread(() -> {
                try {
                    String urlStr = SUPABASE_URL
                        + "/rest/v1/partner_locations"
                        + "?on_conflict=partner_id";

                    String body = "{"
                        + "\"partner_id\":\"" + partnerId + "\","
                        + "\"is_online\":false"
                        + "}";

                    HttpURLConnection conn = (HttpURLConnection)
                        new URL(urlStr).openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("apikey", SUPABASE_KEY);
                    conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                    conn.getResponseCode();
                    conn.disconnect();
                    Log.d(TAG, "Marked partner offline");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to mark offline", e);
                }
            }).start();
        }
        Log.d(TAG, "Service destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows while location is being shared");
            getSystemService(NotificationManager.class)
                .createNotificationChannel(channel);
        }
    }
}