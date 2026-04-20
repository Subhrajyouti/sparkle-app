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

    // Persisted so START_STICKY restart doesn't lose them
    private static String sPartnerId;
   

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // When Android restarts a START_STICKY service, intent can be null
        if (intent != null) {
            String pid = intent.getStringExtra("partner_id");
            String url = intent.getStringExtra("supabase_url");
            String key = intent.getStringExtra("supabase_key");
            if (pid != null) sPartnerId  = pid;
            if (url != null) sSupabaseUrl = url;
            if (key != null) sSupabaseKey = key;
        }

        Log.d(TAG, "Service started. partner=" + sPartnerId + " url=" + sSupabaseUrl);

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
        if (PartnerId == null || SUPABASE_URL == null || SUPABASE_KEY == null) {
            Log.e(TAG, "Missing credentials — cannot push location");
            return;
        }

        new Thread(() -> {
            try {
                String now = new SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                    .format(new Date());

                // FIX 1: Add ?on_conflict=partner_id for proper upsert
                String urlStr = sSupabaseUrl
                    + "/rest/v1/partner_locations"
                    + "?on_conflict=partner_id";

                // FIX 2: Include reported_at in payload
                String body = "{"
                    + "\"partner_id\":\"" + sPartnerId + "\","
                    + "\"latitude\":"    + loc.getLatitude()  + ","
                    + "\"longitude\":"   + loc.getLongitude() + ","
                    + "\"accuracy\":"    + loc.getAccuracy()  + ","
                    + "\"speed\":"       + (loc.hasSpeed()   ? loc.getSpeed()   : 0) + ","
                    + "\"heading\":"     + (loc.hasBearing() ? loc.getBearing() : 0) + ","
                    + "\"is_online\":true,"
                    + "\"reported_at\":\"" + now + "\","
                    + "\"updated_at\":\""  + now + "\""
                    + "}";

                Log.d(TAG, "Pushing to: " + urlStr);
                Log.d(TAG, "Payload: " + body);

                HttpURLConnection conn = (HttpURLConnection)
                    new URL(urlStr).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("apikey",        sSupabaseKey);
                conn.setRequestProperty("Authorization", "Bearer " + sSupabaseKey);
                conn.setRequestProperty("Content-Type",  "application/json");
                // FIX 3: Correct Prefer header for upsert
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

                // Log error body if not success
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