package com.zoesystem.zoew;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

@CapacitorPlugin(name = "ZoeScanBeep")
public class ScanBeepPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable finish = this::finish;
    private AudioManager audio;
    private ToneGenerator tone;
    private boolean playing;
    private boolean paused;
    private boolean destroyed;
    private int originalVolume = -1;
    private int forcedVolume = -1;

    @Override
    public void load() {
        handler.post(this::prepare);
    }

    private void prepare() {
        if (tone != null || paused || destroyed) return;
        try { tone = new ToneGenerator(AudioManager.STREAM_MUSIC, 100); } catch (RuntimeException ignored) { }
    }

    @PluginMethod
    public void play(PluginCall call) {
        handler.post(() -> {
            if (playing || paused || destroyed) {
                JSObject out = new JSObject();
                out.put("played", true);
                call.resolve(out);
                return;
            }
            finish();
            boolean played = false;
            try {
                prepare();
                audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (audio != null && !audio.isVolumeFixed() && audio.getMode() == AudioManager.MODE_NORMAL
                        && !audio.isStreamMute(AudioManager.STREAM_MUSIC) && speakerRoute(audio)) {
                    int before = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
                    int maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    if (before < maximum) {
                        originalVolume = before;
                        forcedVolume = maximum;
                        audio.setStreamVolume(AudioManager.STREAM_MUSIC, maximum, 0);
                        if (audio.getStreamVolume(AudioManager.STREAM_MUSIC) != maximum) {
                            originalVolume = -1;
                            forcedVolume = -1;
                            audio.setStreamVolume(AudioManager.STREAM_MUSIC, before, 0);
                        }
                    }
                }
                played = tone != null && tone.startTone(ToneGenerator.TONE_PROP_PROMPT, 150);
            } catch (RuntimeException ignored) {
            }
            if (played) {
                playing = true;
                handler.postDelayed(finish, 200);
            } else release();
            JSObject out = new JSObject();
            out.put("played", played);
            call.resolve(out);
        });
    }

    private static boolean speakerRoute(AudioManager audio) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                List<AudioDeviceInfo> route = audio.getAudioDevicesForAttributes(
                    new AudioAttributes.Builder().setLegacyStreamType(AudioManager.STREAM_MUSIC).build());
                if (route == null || route.isEmpty()) return false;
                for (AudioDeviceInfo device : route) {
                    if (device == null || device.getType() != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return false;
                }
                return true;
            }
            for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                if (device == null) return false;
                int type = device.getType();
                if (type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER && type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                        && type != AudioDeviceInfo.TYPE_TELEPHONY && type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE
                        && type != AudioDeviceInfo.TYPE_REMOTE_SUBMIX) return false;
            }
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private void finish() {
        handler.removeCallbacks(finish);
        if (playing && tone != null) {
            try { tone.stopTone(); } catch (RuntimeException ignored) { }
        }
        playing = false;
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

    private void release() {
        finish();
        if (tone != null) {
            try { tone.release(); } catch (RuntimeException ignored) { }
            tone = null;
        }
    }

    @Override
    protected void handleOnResume() {
        handler.post(() -> {
            paused = false;
            prepare();
        });
    }

    @Override
    protected void handleOnPause() {
        handler.post(() -> {
            paused = true;
            release();
        });
    }

    @Override
    protected void handleOnDestroy() {
        handler.post(() -> {
            destroyed = true;
            release();
        });
    }
}
