package com.zoesystem.zoew;

import android.content.Context;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "ZoeCaptureCleanup")
public class CaptureCleanupPlugin extends Plugin {

    static final long CLOCK_SLACK_MS = 2000;
    static final long QUEUE_PHOTO_KEEP_MS = 24L * 60 * 60 * 1000;
    static final String QUEUE_PHOTO_DIR = "queue-photo";
    static final String WORKER_NAME = "ZoeCaptureCleanup";
    static final Pattern CAPTURE_NAME = Pattern.compile("JPEG_\\p{Nd}{8}_\\p{Nd}{6}_[0-9]{1,20}\\.jpg");
    static final Pattern QUEUE_HASH = Pattern.compile("[0-9a-f]{64}");
    static final Pattern QUEUE_NAME = Pattern.compile("[A-Za-z0-9_-]+\\.jpg");

    @Override
    public void load() {
        final long loadedAt = System.currentTimeMillis();
        final Context context = getContext();
        try {
            File cache = context.getCacheDir();
            if (cache != null) sweepQueuePhotos(new File(cache, QUEUE_PHOTO_DIR), loadedAt - QUEUE_PHOTO_KEEP_MS);
        } catch (RuntimeException ignored) {
        }
        try {
            new Thread(() -> {
                try {
                    releaseCaptures(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "", loadedAt);
                } catch (RuntimeException ignored) {
                }
            }, WORKER_NAME).start();
        } catch (RuntimeException ignored) {
        }
    }

    @PluginMethod
    public void release(PluginCall call) {
        int removed = 0;
        try {
            Long before = call.getLong("before", 0L);
            removed = releaseCaptures(getContext().getExternalFilesDir(Environment.DIRECTORY_PICTURES),
                call.getString("name", ""), before == null ? 0 : before);
        } catch (RuntimeException ignored) {
        }
        JSObject out = new JSObject();
        out.put("removed", removed);
        call.resolve(out);
    }

    static boolean isCapture(String name) {
        return name != null && CAPTURE_NAME.matcher(name).matches();
    }

    static int releaseCaptures(File dir, String name, long before) {
        if (dir == null) return 0;
        int removed = 0;
        if (isCapture(name) && removeFile(new File(dir, name), dir)) removed++;
        if (before <= CLOCK_SLACK_MS) return removed;
        File[] files = dir.listFiles();
        if (files == null) return removed;
        long cutoff = before - CLOCK_SLACK_MS;
        for (File file : files) {
            if (!isCapture(file.getName())) continue;
            long modified = file.lastModified();
            if (modified > 0 && modified < cutoff && removeFile(file, dir)) removed++;
        }
        return removed;
    }

    static int sweepQueuePhotos(File root, long cutoff) {
        File[] dirs = root.listFiles();
        if (dirs == null) return 0;
        int removed = 0;
        for (File dir : dirs) {
            if (!QUEUE_HASH.matcher(dir.getName()).matches() || !dir.isDirectory() || !inside(dir, root)) continue;
            File[] files = dir.listFiles();
            if (files == null) continue;
            for (File file : files) {
                if (!QUEUE_NAME.matcher(file.getName()).matches()) continue;
                long modified = file.lastModified();
                if (modified > 0 && modified < cutoff && removeFile(file, dir)) removed++;
            }
            String[] left = dir.list();
            if (left != null && left.length == 0) dir.delete();
        }
        return removed;
    }

    static boolean removeFile(File file, File dir) {
        return file.isFile() && inside(file, dir) && file.delete();
    }

    static boolean inside(File file, File dir) {
        try {
            File parent = file.getCanonicalFile().getParentFile();
            return parent != null && parent.equals(dir.getCanonicalFile());
        } catch (IOException | SecurityException e) {
            return false;
        }
    }
}
