package org.wintozo.messenger;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int REQUEST_CODE_PERMISSIONS = 1001;
    private static final String[] REQUIRED_PERMISSIONS = {
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.CAMERA,
        Manifest.permission.MODIFY_AUDIO_SETTINGS
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Локальный плагин OTA (скачивание APK + системный установщик).
        registerPlugin(WinChatOtaPlugin.class);
        registerPlugin(WinChatStoragePlugin.class);
        super.onCreate(savedInstanceState);

        // Сразу создаём DCIM/WinChat/Photos, DCIM/WinChat/Video
        // и /winchat/account_settings/ — ещё до первого входа в чат.
        try {
            WinChatStoragePlugin.ensureFoldersStatic(this);
        } catch (Exception ignored) {
            // Папки будут созданы при первом сохранении.
        }

        checkAndRequestPermissions();
    }

    private void checkAndRequestPermissions() {
        List<String> required = new ArrayList<>();
        for (String permission : REQUIRED_PERMISSIONS) required.add(permission);
        // На Android 9 и ниже запись в общую галерею требует runtime-разрешения.
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            required.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        boolean permissionsGranted = true;
        for (String permission : required) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionsGranted = false;
                break;
            }
        }
        if (!permissionsGranted) {
            ActivityCompat.requestPermissions(
                this,
                required.toArray(new String[0]),
                REQUEST_CODE_PERMISSIONS
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // Capacitor WebView сам обработает последующие getUserMedia запросы
    }
}
