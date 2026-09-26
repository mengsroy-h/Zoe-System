package com.zoesystem.zoew;

import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.MotionEvent;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final float MAX_REFRESH_HZ = 120.5f;
    private static final long IDLE_RELEASE_MS = 2000L;

    private final Handler refreshHandler = new Handler(Looper.getMainLooper());
    private final Runnable releaseRefresh = this::releaseRefreshRate;
    private boolean refreshBoosted = false;

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        try {
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_MOVE) {
                refreshHandler.removeCallbacks(releaseRefresh);
                boostRefreshRate();
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                refreshHandler.removeCallbacks(releaseRefresh);
                refreshHandler.postDelayed(releaseRefresh, IDLE_RELEASE_MS);
            }
        } catch (RuntimeException e) {
        }
        return super.dispatchTouchEvent(event);
    }

    @Override
    public void onPause() {
        refreshHandler.removeCallbacks(releaseRefresh);
        releaseRefreshRate();
        super.onPause();
    }

    @SuppressWarnings("deprecation")
    private void boostRefreshRate() {
        if (refreshBoosted) return;
        try {
            Window window = getWindow();
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (window == null || display == null) return;
            Display.Mode current = display.getMode();
            Display.Mode best = current;
            for (Display.Mode mode : display.getSupportedModes()) {
                if (mode.getPhysicalWidth() != current.getPhysicalWidth() || mode.getPhysicalHeight() != current.getPhysicalHeight()) continue;
                if (mode.getRefreshRate() > MAX_REFRESH_HZ) continue;
                if (mode.getRefreshRate() > best.getRefreshRate()) best = mode;
            }
            WindowManager.LayoutParams params = window.getAttributes();
            params.preferredDisplayModeId = best.getModeId();
            window.setAttributes(params);
            refreshBoosted = true;
        } catch (RuntimeException e) {
        }
    }

    private void releaseRefreshRate() {
        if (!refreshBoosted) return;
        refreshBoosted = false;
        try {
            Window window = getWindow();
            if (window == null) return;
            WindowManager.LayoutParams params = window.getAttributes();
            params.preferredDisplayModeId = 0;
            window.setAttributes(params);
        } catch (RuntimeException e) {
        }
    }
}
