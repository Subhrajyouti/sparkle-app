package app.lovable.a781537c1a1549c0b33081a33a63309d;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeLocation")
public class LocationPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String partnerId   = call.getString("partner_id");
        String supabaseUrl = call.getString("supabase_url");
        String supabaseKey = call.getString("supabase_key");

        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.putExtra("partner_id",   partnerId);
        intent.putExtra("supabase_url", supabaseUrl);
        intent.putExtra("supabase_key", supabaseKey);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        getContext().stopService(
            new Intent(getContext(), LocationForegroundService.class));
        call.resolve();
    }
}