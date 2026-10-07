package com.zoesystem.zoew;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    static final long KEYBOARD_HOLD_MAX_MS = 1000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferHighestRefreshRate();
        holdWebViewWhileKeyboardOpens();
    }

    private void holdWebViewWhileKeyboardOpens() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        try {
            View decor = getWindow().getDecorView();
            decor.setWindowInsetsAnimationCallback(new KeyboardOpenHold(decor));
        } catch (RuntimeException ignored) {
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private final class KeyboardOpenHold extends WindowInsetsAnimation.Callback {
        private final View decor;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final List<ViewGroup> unclipped = new ArrayList<>();
        private final List<Boolean> clipChildren = new ArrayList<>();
        private final Runnable release = this::release;
        private boolean decorClipToPadding = true;
        private View held;

        KeyboardOpenHold(View decor) {
            super(DISPATCH_MODE_CONTINUE_ON_SUBTREE);
            this.decor = decor;
        }

        @Override
        public void onPrepare(@NonNull WindowInsetsAnimation animation) {
            if ((animation.getTypeMask() & WindowInsets.Type.ime()) == 0 || held != null) return;
            try {
                WindowInsets now = decor.getRootWindowInsets();
                if (now != null && now.isVisible(WindowInsets.Type.ime())) return;
                View webView = bridge == null ? null : bridge.getWebView();
                if (webView == null || webView.getHeight() <= 0) return;
                ViewGroup.LayoutParams params = webView.getLayoutParams();
                if (params == null) return;
                params.height = webView.getHeight();
                webView.setLayoutParams(params);
                held = webView;
                for (ViewParent parent = webView.getParent(); parent instanceof ViewGroup; parent = parent.getParent()) {
                    ViewGroup group = (ViewGroup) parent;
                    unclipped.add(group);
                    clipChildren.add(group.getClipChildren());
                    group.setClipChildren(false);
                    if (group == decor) break;
                }
                if (decor instanceof ViewGroup) {
                    decorClipToPadding = ((ViewGroup) decor).getClipToPadding();
                    ((ViewGroup) decor).setClipToPadding(false);
                }
                handler.postDelayed(release, KEYBOARD_HOLD_MAX_MS);
            } catch (RuntimeException e) {
                release();
            }
        }

        @NonNull
        @Override
        public WindowInsets onProgress(@NonNull WindowInsets insets, @NonNull List<WindowInsetsAnimation> running) {
            return insets;
        }

        @Override
        public void onEnd(@NonNull WindowInsetsAnimation animation) {
            if ((animation.getTypeMask() & WindowInsets.Type.ime()) != 0) release();
        }

        private void release() {
            handler.removeCallbacks(release);
            View webView = held;
            held = null;
            try {
                if (webView != null) {
                    ViewGroup.LayoutParams params = webView.getLayoutParams();
                    if (params != null) {
                        params.height = ViewGroup.LayoutParams.MATCH_PARENT;
                        webView.setLayoutParams(params);
                    }
                }
                for (int i = 0; i < unclipped.size(); i++) unclipped.get(i).setClipChildren(clipChildren.get(i));
                if (webView != null && decor instanceof ViewGroup) ((ViewGroup) decor).setClipToPadding(decorClipToPadding);
            } catch (RuntimeException ignored) {
            } finally {
                unclipped.clear();
                clipChildren.clear();
            }
        }
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
