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
 */
@CapacitorPlugin(name = "WinChatOta")
public class WinChatOtaPlugin extends Plugin {

    private static final String APK_NAME = "winchat-update.apk";

    private long downloadId = -1L;
    private File pendingApk;
    private BroadcastReceiver downloadReceiver;
    private boolean receiverRegistered = false;

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

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("WinChat OTA");
            request.setDescription("Загрузка обновления WinChat");
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

            notifyState("downloading", null);

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("downloadId", String.valueOf(downloadId));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Не удалось начать загрузку: " + e.getMessage());
        }
    }

    private void registerDownloadReceiver() {
        if (receiverRegistered) return;

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (id != downloadId) return;
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
                notifyState("error", "Скачивание недоступно");
                return;
            }

            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            Cursor cursor = manager.query(query);
            if (cursor == null) {
                notifyState("error", "Не удалось проверить загрузку");
                return;
            }

            try {
                if (!cursor.moveToFirst()) {
                    notifyState("error", "Загрузка не найдена");
                    return;
                }

                int status = cursor.getInt(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                );

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    File apk = apkFile();
                    if (!apk.exists()) {
                        notifyState("error", "Файл обновления не найден");
                        return;
                    }
                    launchInstaller(apk);
                } else if (status == DownloadManager.STATUS_FAILED) {
                    int reason = cursor.getInt(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                    );
                    notifyState("error", "Ошибка загрузки (код " + reason + ")");
                }
            } finally {
                cursor.close();
            }
        } catch (Exception e) {
            notifyState("error", "Ошибка проверки загрузки: " + e.getMessage());
        }
    }

    private void launchInstaller(File apk) {
        try {
            // Android 8+: нужно разрешение «Установка из неизвестных источников».
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
                pendingApk = apk;
                notifyState("permission", null);

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

            notifyState("installing", null);
        } catch (Exception e) {
            notifyState("error", "Не удалось открыть установщик: " + e.getMessage());
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

    private void notifyState(String state, String message) {
        JSObject data = new JSObject();
        data.put("state", state);
        if (message != null) {
            data.put("message", message);
        }
        notifyListeners("otaStatus", data);
    }
}
