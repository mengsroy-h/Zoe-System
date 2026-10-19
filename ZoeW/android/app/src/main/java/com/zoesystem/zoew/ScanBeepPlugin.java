package com.zoesystem.zoew;

import android.content.Context;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZoeScanBeep")
public class ScanBeepPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable finish = this::finish;
    private AudioManager audio;
    private ToneGenerator tone;
    private int originalVolume = -1;
    private int forcedVolume = -1;

    @PluginMethod
    public void play(PluginCall call) {
        handler.post(() -> {
            finish();
            boolean played = false;
            try {
                audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (audio != null && !audio.isVolumeFixed() && audio.getMode() == AudioManager.MODE_NORMAL) {
                    int before = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
                    int maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    if (before < maximum) {
                        originalVolume = before;
                        forcedVolume = maximum;
                        audio.setStreamVolume(AudioManager.STREAM_MUSIC, maximum, 0);
                    }
                }
                tone = new ToneGenerator(AudioManager.STREAM_MUSIC, 100);
                played = tone.startTone(ToneGenerator.TONE_PROP_BEEP, 150);
            } catch (RuntimeException ignored) {
            }
            if (played) handler.postDelayed(finish, 200);
            else finish();
            JSObject out = new JSObject();
            out.put("played", played);
            call.resolve(out);
        });
    }

    private void finish() {
        handler.removeCallbacks(finish);
        if (tone != null) {
            try { tone.release(); } catch (RuntimeException ignored) { }
            tone = null;
        }
        try {
            if (audio != null && originalVolume >= 0 && audio.getStreamVolume(AudioManager.STREAM_MUSIC) == forcedVolume) {
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, originalVolume, 0);
            }
        } catch (RuntimeException ignored) {
        }
        originalVolume = -1;
        forcedVolume = -1;
        audio = null;
    }

    @Override
    protected void handleOnPause() {
        handler.post(finish);
    }

    @Override
    protected void handleOnDestroy() {
        handler.post(finish);
    }
}
