package app.lovable.a781537c1a1549c0b33081a33a63309d;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class); // ADD THIS
        super.onCreate(savedInstanceState);
    }
}