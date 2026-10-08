package com.zoesystem.zoew;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "ZoeApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    static final String RELEASE_BASE = "https://github.com/mengsroy-h/Zoe-System/releases/download/";
    static final String TAG_PREFIX = "zoew-android-v";
    static final String FILE_PREFIX = "ZoeW-";
    static final String FILE_SUFFIX = ".apk";
    static final String PART_SUFFIX = ".part";
    static final String APK_MIME = "application/vnd.android.package-archive";
    static final String UPDATE_DIR = "apk-update";
    static final String ASSET_HOST_SUFFIX = ".githubusercontent.com";
    static final Pattern VERSION = Pattern.compile("^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$");
    static final int CONNECT_TIMEOUT_MS = 15000;
    static final int READ_TIMEOUT_MS = 30000;
    static final long PROGRESS_GAP_MS = 250;
    static final long MAX_APK_BYTES = 200L * 1024 * 1024;

    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final ExecutorService probes = Executors.newCachedThreadPool();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile boolean cancelled;

    static String releaseUrl(String version) {
        return RELEASE_BASE + TAG_PREFIX + version + "/" + FILE_PREFIX + version + FILE_SUFFIX;
    }

    static boolean validVersion(String version) {
        return version != null && VERSION.matcher(version).matches();
    }

    static String versionOfFile(String name) {
        if (name == null || !name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_SUFFIX)) return null;
        String version = name.substring(FILE_PREFIX.length(), name.length() - FILE_SUFFIX.length());
        return validVersion(version) ? version : null;
    }

    static int compareVersions(String a, String b) {
        String[] x = a.split("\\.");
        String[] y = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int d = Integer.compare(Integer.parseInt(x[i]), Integer.parseInt(y[i]));
            if (d != 0) return d;
        }
        return 0;
    }

    static boolean assetLocation(String location) {
        if (location == null) return false;
        try {
            URL url = new URL(location);
            String host = url.getHost();
            return "https".equals(url.getProtocol()) && host != null && host.endsWith(ASSET_HOST_SUFFIX);
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public void load() {
        downloads.execute(this::removeStaleFiles);
    }

    @Override
    protected void handleOnDestroy() {
        cancelled = true;
        downloads.shutdownNow();
        probes.shutdownNow();
    }

    private File updateDir() {
        return new File(getContext().getCacheDir(), UPDATE_DIR);
    }

    private File apkFile(String version) {
        return new File(updateDir(), FILE_PREFIX + version + FILE_SUFFIX);
    }

    private String installedVersion() {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return validVersion(info.versionName) ? info.versionName : null;
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            return null;
        }
    }

    private void removeStaleFiles() {
        try {
            File[] files = updateDir().listFiles();
            if (files == null) return;
            String installed = installedVersion();
            for (File file : files) {
                String version = versionOfFile(file.getName());
                if (version == null || installed == null || compareVersions(version, installed) <= 0) file.delete();
            }
        } catch (RuntimeException ignored) {
        }
    }

    private void removeOtherFiles(File keep) {
        File[] files = updateDir().listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.getName().equals(keep.getName())) file.delete();
        }
    }

    @SuppressWarnings("deprecation")
    private boolean apkMatches(File apk, String version) {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
            return info != null && ctx.getPackageName().equals(info.packageName) && version.equals(info.versionName);
        } catch (RuntimeException e) {
            return false;
        }
    }

    @PluginMethod
    public void probe(PluginCall call) {
        String version = call.getString("version", "");
        if (!validVersion(version)) {
            call.reject("bad version", "bad-version");
            return;
        }
        probes.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(releaseUrl(version)).openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod("HEAD");
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setUseCaches(false);
                int status = conn.getResponseCode();
                JSObject out = new JSObject();
                out.put("status", status);
                if (status == HttpURLConnection.HTTP_NOT_FOUND) {
                    out.put("available", false);
                    call.resolve(out);
                    return;
                }
                boolean redirect = status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
                if (redirect && assetLocation(conn.getHeaderField("Location"))) {
                    out.put("available", true);
                    call.resolve(out);
                    return;
                }
                call.reject("HTTP " + status, "http");
            } catch (IOException | RuntimeException e) {
                call.reject("network", "network", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void download(PluginCall call) {
        String version = call.getString("version", "");
        if (!validVersion(version)) {
            call.reject("bad version", "bad-version");
            return;
        }
        if (!busy.compareAndSet(false, true)) {
            call.reject("busy", "busy");
            return;
        }
        cancelled = false;
        try {
            downloads.execute(() -> {
                try {
                    File target = apkFile(version);
                    if (!target.isFile() || !apkMatches(target, version)) fetch(version, target);
                    JSObject out = new JSObject();
                    out.put("size", target.length());
                    call.resolve(out);
                } catch (ApkFailure f) {
                    call.reject(f.getMessage(), f.code);
                } catch (RuntimeException e) {
                    call.reject("failed", "failed", e);
                } finally {
                    busy.set(false);
                }
            });
        } catch (RuntimeException e) {
            busy.set(false);
            call.reject("failed", "failed", e);
        }
    }

    private void fetch(String version, File target) throws ApkFailure {
        File dir = target.getParentFile();
        if (dir == null || (!dir.isDirectory() && !dir.mkdirs())) throw new ApkFailure("storage", "cannot create folder");
        removeOtherFiles(target);
        File part = new File(dir, target.getName() + PART_SUFFIX);
        HttpURLConnection conn = null;
        boolean done = false;
        try {
            conn = (HttpURLConnection) new URL(releaseUrl(version)).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setUseCaches(false);
            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_NOT_FOUND) throw new ApkFailure("not-found", "HTTP 404");
            if (status != HttpURLConnection.HTTP_OK) throw new ApkFailure("http", "HTTP " + status);
            long total = conn.getContentLengthLong();
            if (total > MAX_APK_BYTES) throw new ApkFailure("size", "too large");
            if (total > 0 && dir.getUsableSpace() < total * 2) throw new ApkFailure("storage", "not enough space");
            long received = 0;
            long lastNotice = 0;
            progress(version, 0, total);
            try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                byte[] buffer = new byte[64 * 1024];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    if (cancelled) throw new ApkFailure("cancelled", "cancelled");
                    out.write(buffer, 0, n);
                    received += n;
                    if (received > MAX_APK_BYTES) throw new ApkFailure("size", "too large");
                    long now = SystemClock.elapsedRealtime();
                    if (now - lastNotice >= PROGRESS_GAP_MS) {
                        lastNotice = now;
                        progress(version, received, total);
                    }
                }
                out.getFD().sync();
            }
            progress(version, received, total);
            if (cancelled) throw new ApkFailure("cancelled", "cancelled");
            if (received <= 0 || (total > 0 && received != total)) throw new ApkFailure("size", "incomplete");
            if (target.exists() && !target.delete()) throw new ApkFailure("storage", "cannot replace");
            if (!part.renameTo(target)) throw new ApkFailure("storage", "cannot rename");
            if (!apkMatches(target, version)) {
                target.delete();
                throw new ApkFailure("bad-apk", "not this app");
            }
            done = true;
        } catch (IOException e) {
            throw new ApkFailure(cancelled ? "cancelled" : "network", "network");
        } finally {
            if (conn != null) conn.disconnect();
            if (!done) part.delete();
        }
    }

    private void progress(String version, long received, long total) {
        JSObject data = new JSObject();
        data.put("version", version);
        data.put("received", received);
        data.put("total", total);
        notifyListeners("progress", data);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelled = true;
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String version = call.getString("version", "");
        if (!validVersion(version)) {
            call.reject("bad version", "bad-version");
            return;
        }
        File apk = apkFile(version);
        if (!apk.isFile()) {
            call.reject("missing", "missing");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, settings, "installPermissionResult");
            } catch (ActivityNotFoundException e) {
                call.reject("no settings", "no-installer", e);
            }
            return;
        }
        openInstaller(call, apk);
    }

    @ActivityCallback
    private void installPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject out = new JSObject();
        out.put("status", granted ? "permission-granted" : "permission-denied");
        call.resolve(out);
    }

    private void openInstaller(PluginCall call, File apk) {
        try {
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_MIME);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            JSObject out = new JSObject();
            out.put("status", "opened");
            call.resolve(out);
        } catch (ActivityNotFoundException e) {
            call.reject("no installer", "no-installer", e);
        } catch (RuntimeException e) {
            call.reject("install failed", "failed", e);
        }
    }

    static final class ApkFailure extends Exception {
        final String code;

        ApkFailure(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
