package org.wintozo.messenger;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * WinChat OTA: скачивает APK во внутреннее хранилище приложения и
 * открывает системный установщик. Вызывается из JS:
 *
 *   WinChatOta.getInfo()
 *   WinChatOta.install({ url: "https://.../winchat.apk" })
 *
 * Событие "otaStatus" сообщает JS о состоянии:
 *   downloading | permission | installing | error
 * При state=downloading дополнительно передаются progress/bytesDownloaded/bytesTotal.
 */
@CapacitorPlugin(name = "WinChatOta")
public class WinChatOtaPlugin extends Plugin {

    private static final String APK_NAME = "winchat-update.apk";
    private static final long PROGRESS_INTERVAL_MS = 500L;

    private long downloadId = -1L;
    private File pendingApk;
    private BroadcastReceiver downloadReceiver;
    private boolean receiverRegistered = false;

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private Runnable progressRunnable;
    private boolean progressPolling = false;
    private int lastProgress = -1;

    /* ------------------------------------------------------------
       Информация об устройстве
       ------------------------------------------------------------ */

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject ret = new JSObject();
        String androidId = Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ANDROID_ID
        );

        ret.put("deviceId", androidId == null ? "" : androidId);
        ret.put("model", Build.MODEL == null ? "" : Build.MODEL);
        ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        ret.put("osVersion", "Android " + Build.VERSION.RELEASE);
        ret.put("appVersion", appVersion());
        ret.put("packageName", getContext().getPackageName());
        call.resolve(ret);
    }

    /* ------------------------------------------------------------
       Загрузка и установка APK
       ------------------------------------------------------------ */

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Не указана ссылка на APK");
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            call.reject("Ссылка должна начинаться с http:// или https://");
            return;
        }

        try {
            DownloadManager manager = (DownloadManager) getContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                call.reject("Скачивание недоступно на этом устройстве");
                return;
            }

            File destination = apkFile();
            if (destination.exists() && !destination.delete()) {
                // Не критично: DownloadManager перезапишет файл.
            }

            stopProgressPolling();

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("WinChat OTA");
            request.setDescription("Загрузка обновления");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            request.setDestinationInExternalFilesDir(
                getContext(),
                Environment.DIRECTORY_DOWNLOADS,
                APK_NAME
            );
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);

            downloadId = manager.enqueue(request);
            registerDownloadReceiver();

            notifyState("downloading", null, 0, 0L, 0L);
            startProgressPolling();

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("downloadId", String.valueOf(downloadId));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Не удалось начать загрузку: " + e.getMessage());
        }
    }

    private void startProgressPolling() {
        if (progressPolling) return;
        progressPolling = true;
        lastProgress = -1;
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                if (!progressPolling) return;
                pollProgressOnce();
                if (progressPolling) {
                    progressHandler.postDelayed(this, PROGRESS_INTERVAL_MS);
                }
            }
        };
        progressHandler.post(progressRunnable);
    }

    private void stopProgressPolling() {
        progressPolling = false;
        if (progressRunnable != null) {
            progressHandler.removeCallbacks(progressRunnable);
            progressRunnable = null;
        }
    }

    private void pollProgressOnce() {
        if (downloadId <= 0) return;
        try {
            DownloadManager manager = (DownloadManager) getContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) return;

            DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
            Cursor cursor = manager.query(query);
            if (cursor == null) return;

            try {
                if (!cursor.moveToFirst()) return;
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long downloaded = safeColumnLong(cursor, DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                long total = safeColumnLong(cursor, DownloadManager.COLUMN_TOTAL_SIZE_BYTES);

                if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING
                        || status == DownloadManager.STATUS_PAUSED) {
                    int progress = -1;
                    if (total > 0) {
                        progress = (int) Math.max(0, Math.min(100, (downloaded * 100L) / total));
                    } else if (downloaded > 0) {
                        // Неизвестный размер: показываем, что загрузка идёт.
                        progress = 0;
                    }
                    if (progress != lastProgress || total > 0) {
                        lastProgress = progress;
                        notifyState("downloading", null, progress, downloaded, total);
                    }
                } else if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    stopProgressPolling();
                    notifyState("downloading", null, 100, total > 0 ? total : downloaded, total);
                } else if (status == DownloadManager.STATUS_FAILED) {
                    stopProgressPolling();
                }
            } finally {
                cursor.close();
            }
        } catch (Exception ignored) {
            // Ошибку прогресса не считаем фатальной, итог обработает receiver.
        }
    }

    private long safeColumnLong(Cursor cursor, String column) {
        try {
            int idx = cursor.getColumnIndex(column);
            if (idx < 0) return 0L;
            return cursor.getLong(idx);
        } catch (Exception e) {
            return 0L;
        }
    }

    private void registerDownloadReceiver() {
        if (receiverRegistered) return;

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (id != downloadId) return;
                stopProgressPolling();
                checkDownload(id);
            }
        };

        ContextCompat.registerReceiver(
            getContext(),
            downloadReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED
        );
        receiverRegistered = true;
    }

    private void checkDownload(long id) {
        try {
            DownloadManager manager = (DownloadManager) getContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                notifyState("error", "Скачивание недоступно", -1, 0L, 0L);
                return;
            }

            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            Cursor cursor = manager.query(query);
            if (cursor == null) {
                notifyState("error", "Не удалось проверить загрузку", -1, 0L, 0L);
                return;
            }

            try {
                if (!cursor.moveToFirst()) {
                    notifyState("error", "Загрузка не найдена", -1, 0L, 0L);
                    return;
                }

                int status = cursor.getInt(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                );

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    File apk = apkFile();
                    if (!apk.exists()) {
                        notifyState("error", "Файл обновления не найден", -1, 0L, 0L);
                        return;
                    }
                    notifyState("downloading", null, 100, 0L, 0L);
                    launchInstaller(apk);
                } else if (status == DownloadManager.STATUS_FAILED) {
                    int reason = cursor.getInt(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                    );
                    notifyState("error", "Ошибка загрузки (код " + reason + ")", -1, 0L, 0L);
                }
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            notifyState("error", "Ошибка проверки загрузки: " + e.getMessage(), -1, 0L, 0L);
        }
    }

    private void launchInstaller(File apk) {
        try {
            // Android 8+: нужно разрешение «Установка из неизвестных источников».
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
                pendingApk = apk;
                notifyState("permission", null, 100, 0L, 0L);

                Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settingsIntent);
                return;
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            notifyState("installing", null, 100, 0L, 0L);
        } catch (Exception e) {
            notifyState("error", "Не удалось открыть установщик: " + e.getMessage(), -1, 0L, 0L);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Пользователь вернулся из настроек — если разрешение выдано, ставим APK.
        if (pendingApk != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getContext().getPackageManager().canRequestPackageInstalls()) {
                File apk = pendingApk;
                pendingApk = null;
                launchInstaller(apk);
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopProgressPolling();
        if (receiverRegistered && downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {
                // receiver уже отписан
            }
            receiverRegistered = false;
        }
        super.handleOnDestroy();
    }

    /* ------------------------------------------------------------
       Вспомогательные методы
       ------------------------------------------------------------ */

    private File apkFile() {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) {
            dir = getContext().getCacheDir();
        }
        return new File(dir, APK_NAME);
    }

    private String appVersion() {
        try {
            return getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0)
                .versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private void notifyState(String state, String message, int progress, long downloaded, long total) {
        JSObject data = new JSObject();
        data.put("state", state);
        if (message != null) {
            data.put("message", message);
        }
        if (progress >= 0) {
            data.put("progress", progress);
        }
        if (downloaded > 0 || total > 0) {
            data.put("bytesDownloaded", downloaded);
            data.put("bytesTotal", total);
        }
        notifyListeners("otaStatus", data);
    }

    private void notifyState(String state, String message) {
        notifyState(state, message, -1, 0L, 0L);
    }
}
