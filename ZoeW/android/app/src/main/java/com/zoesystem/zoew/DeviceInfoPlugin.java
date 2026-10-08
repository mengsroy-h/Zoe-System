package com.zoesystem.zoew;

import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZoeDevice")
public class DeviceInfoPlugin extends Plugin {

    static String text(String value) {
        return value == null ? "" : value.trim();
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject out = new JSObject();
        out.put("manufacturer", text(Build.MANUFACTURER));
        out.put("brand", text(Build.BRAND));
        out.put("model", text(Build.MODEL));
        out.put("release", text(Build.VERSION.RELEASE));
        out.put("sdk", Build.VERSION.SDK_INT);
        String androidId = "";
        try {
            androidId = text(Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID));
        } catch (RuntimeException ignored) {
        }
        out.put("androidId", androidId);
        call.resolve(out);
    }
}
