package com.zoesystem.zoew;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferHighestRefreshRate();
    }

    @Override
    public void onResume() {
        super.onResume();
        preferHighestRefreshRate();
    }

    private void preferHighestRefreshRate() {
        try {
            Display display = currentDisplay();
            if (display == null) return;
            Display.Mode best = highestRefreshMode(display.getMode(), display.getSupportedModes());
            if (best == null) return;
            Window window = getWindow();
            WindowManager.LayoutParams params = window.getAttributes();
            if (params.preferredDisplayModeId == best.getModeId()) return;
            params.preferredDisplayModeId = best.getModeId();
            window.setAttributes(params);
        } catch (RuntimeException ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private Display currentDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return getDisplay();
        return getWindowManager().getDefaultDisplay();
    }

    static Display.Mode highestRefreshMode(Display.Mode current, Display.Mode[] modes) {
        if (current == null) return null;
        Display.Mode best = current;
        if (modes == null) return best;
        for (Display.Mode mode : modes) {
            if (mode == null) continue;
            boolean sameSize = mode.getPhysicalWidth() == current.getPhysicalWidth()
                && mode.getPhysicalHeight() == current.getPhysicalHeight();
            if (sameSize && mode.getRefreshRate() > best.getRefreshRate()) best = mode;
        }
        return best;
    }
}
