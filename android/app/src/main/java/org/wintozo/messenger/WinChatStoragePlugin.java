package org.wintozo.messenger;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * WinChat Storage — сохранение фото/видео из чата в общую галерею
 * (DCIM/WinChat/Photos и DCIM/WinChat/Video) и зашифрованное хранилище
 * данных аккаунта/настроек в /winchat/account_settings/.
 *
 * JS API:
 *   WinChatStorage.ensureFolders()
 *   WinChatStorage.saveMedia({ url, kind: "photo"|"video", fileName, base64? })
 *   WinChatStorage.saveSettings({ data })
 *   WinChatStorage.loadSettings()
 *   WinChatStorage.clearSettings()
 */
@CapacitorPlugin(name = "WinChatStorage")
public class WinChatStoragePlugin extends Plugin {

    private static final String KEY_ALIAS = "winchat_account_settings_v1";
    private static final String SETTINGS_FILE = "account_settings.enc";
    private static final String MARKER_NAME = ".winchat";
    private static final int GCM_TAG_BITS = 128;

    /* ============================================================
       Папки
       ============================================================ */

    @PluginMethod
    public void ensureFolders(PluginCall call) {
        try {
            JSObject ret = ensureFoldersStatic(getContext());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Не удалось создать папки WinChat: " + e.getMessage());
        }
    }

    /** Создаёт DCIM/WinChat/{Photos,Video} и приватную папку настроек. */
    public static JSObject ensureFoldersStatic(Context context) {
        JSObject ret = new JSObject();
        String photosPath = "DCIM/WinChat/Photos";
        String videoPath = "DCIM/WinChat/Video";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentResolver resolver = context.getContentResolver();
                ensureMediaFolder(resolver, photosPath, "image/jpeg");
                ensureMediaFolder(resolver, videoPath, "video/mp4");
            } catch (Exception ignored) {
                // Папки создадутся непосредственно при первом сохранении файла.
            }
        } else {
            try {
                File dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM);
                new File(new File(dcim, "WinChat"), "Photos").mkdirs();
                new File(new File(dcim, "WinChat"), "Video").mkdirs();
            } catch (Exception ignored) {
                // Ниже вернём прогнозируемые пути.
            }
        }

        File settingsDir = settingsDir(context);
        settingsDir.mkdirs();

        ret.put("photos", photosPath);
        ret.put("videos", videoPath);
        ret.put("settings", settingsDir.getAbsolutePath());
        ret.put("native", true);
        return ret;
    }

    private static void ensureMediaFolder(ContentResolver resolver, String relativePath, String mime) {
        Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

        // Маркер создаётся один раз: повторные запуски не плодят скрытые файлы.
        try (android.database.Cursor existing = resolver.query(
            collection,
            new String[]{MediaStore.MediaColumns._ID},
            MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?",
            new String[]{relativePath, MARKER_NAME},
            null
        )) {
            if (existing != null && existing.moveToFirst()) return;
        } catch (Exception ignored) {
            // Если запрос не поддерживается — пробуем создать маркер ниже.
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, MARKER_NAME);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        Uri uri = null;
        try {
            uri = resolver.insert(collection, values);
        } catch (Exception ignored) {
            // Некоторые прошивки запрещают запись служебных файлов — папка появится
            // при сохранении первого реального фото/видео.
        }
        // Маркер оставляем: он скрытый (начинается с точки) и гарантирует,
        // что папка не исчезнет из файловой системы.
        if (uri == null) {
            return;
        }
        try {
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
        } catch (Exception ignored) {
            // no-op
        }
    }

    private static File settingsDir(Context context) {
        File base = context.getExternalFilesDir(null);
        if (base == null) base = context.getFilesDir();
        return new File(new File(base, "winchat"), "account_settings");
    }

    /* ============================================================
       Сохранение фото и видео
       ============================================================ */

    @PluginMethod
    public void saveMedia(PluginCall call) {
        final String url = call.getString("url");
        final String base64 = call.getString("base64");
        final String kind = call.getString("kind", "photo");
        final String fileName = call.getString("fileName", defaultFileName(kind));

        if ((url == null || url.trim().isEmpty()) && (base64 == null || base64.trim().isEmpty())) {
            call.reject("Не передан URL или данные файла");
            return;
        }

        new Thread(() -> {
            InputStream input = null;
            try {
                boolean isVideo = "video".equalsIgnoreCase(kind);
                String mime = isVideo ? "video/mp4" : "image/jpeg";
                if (fileName != null) {
                    String lower = fileName.toLowerCase();
                    if (lower.endsWith(".png")) mime = "image/png";
                    else if (lower.endsWith(".webp")) mime = "image/webp";
                    else if (lower.endsWith(".gif")) mime = "image/gif";
                    else if (lower.endsWith(".mov")) mime = "video/quicktime";
                    else if (lower.endsWith(".webm")) mime = "video/webm";
                    else if (lower.endsWith(".3gp")) mime = "video/3gpp";
                    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = isVideo ? "video/mp4" : "image/jpeg";
                }

                if (base64 != null && !base64.trim().isEmpty()) {
                    byte[] bytes = Base64.decode(stripDataUrl(base64), Base64.DEFAULT);
                    input = new java.io.ByteArrayInputStream(bytes);
                } else {
                    HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(60000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "WinChat-Android");
                    connection.connect();
                    int code = connection.getResponseCode();
                    if (code < 200 || code >= 300) {
                        call.reject("Сервер вернул код " + code);
                        return;
                    }
                    String type = connection.getContentType();
                    if (type != null && type.startsWith("video/")) mime = type.split(";")[0];
                    else if (type != null && type.startsWith("image/")) mime = type.split(";")[0];
                    input = connection.getInputStream();
                }

                JSObject result = saveStreamToGallery(
                    getContext(), input, fileName == null ? defaultFileName(kind) : fileName, mime, isVideo
                );
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Не удалось сохранить файл: " + e.getMessage());
            } finally {
                try {
                    if (input != null) input.close();
                } catch (Exception ignored) {
                    // no-op
                }
            }
        }, "WinChatMediaSave").start();
    }

    private static String stripDataUrl(String data) {
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma >= 0) return data.substring(comma + 1);
        return data;
    }

    private static String defaultFileName(String kind) {
        String stamp = String.valueOf(System.currentTimeMillis());
        return ("video".equalsIgnoreCase(kind) ? "WinChat_" : "WinChat_") + stamp +
            ("video".equalsIgnoreCase(kind) ? ".mp4" : ".jpg");
    }

    private static JSObject saveStreamToGallery(
        Context context, InputStream input, String fileName, String mime, boolean isVideo
    ) throws Exception {
        String relativePath = isVideo ? "DCIM/WinChat/Video" : "DCIM/WinChat/Photos";
        String safeName = sanitizeFileName(fileName);
        JSObject ret = new JSObject();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri collection = isVideo
                ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                : MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

            ContentResolver resolver = context.getContentResolver();
            Uri uri = resolver.insert(collection, values);
            if (uri == null) throw new Exception("MediaStore не создал запись");

            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new Exception("Не удалось открыть поток записи");
                copy(input, out);
            }

            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);

            String displayName = safeName;
            try (android.database.Cursor cursor = resolver.query(
                uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null
            )) {
                if (cursor != null && cursor.moveToFirst()) displayName = cursor.getString(0);
            }

            ret.put("saved", true);
            ret.put("uri", uri.toString());
            ret.put("fileName", displayName);
            ret.put("path", relativePath + "/" + displayName);
            return ret;
        }

        @SuppressWarnings("deprecation")
        File dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM);
        File dir = new File(new File(dcim, "WinChat"), isVideo ? "Video" : "Photos");
        if (!dir.exists() && !dir.mkdirs() && !dir.exists()) {
            throw new Exception("Нет доступа к папке " + dir.getAbsolutePath());
        }
        File target = uniqueFile(dir, safeName);
        try (OutputStream out = new FileOutputStream(target)) {
            copy(input, out);
        }

        MediaScannerConnection.scanFile(
            context,
            new String[]{target.getAbsolutePath()},
            new String[]{mime},
            null
        );

        ret.put("saved", true);
        ret.put("uri", Uri.fromFile(target).toString());
        ret.put("fileName", target.getName());
        ret.put("path", target.getAbsolutePath());
        return ret;
    }

    private static File uniqueFile(File dir, String name) {
        File file = new File(dir, name);
        if (!file.exists()) return file;
        int dot = name.lastIndexOf('.');
        String stem = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        int i = 2;
        while (file.exists()) {
            file = new File(dir, stem + "_" + i + ext);
            i++;
        }
        return file;
    }

    private static String sanitizeFileName(String name) {
        String cleaned = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
        if (cleaned.isEmpty()) cleaned = "WinChat_" + System.currentTimeMillis();
        return cleaned;
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        output.flush();
    }

    /* ============================================================
       Зашифрованные настройки аккаунта (AES/GCM + Android Keystore)
       ============================================================ */

    @PluginMethod
    public void saveSettings(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Нет данных для сохранения");
            return;
        }
        try {
            File dir = settingsDir(getContext());
            dir.mkdirs();
            byte[] plain = data.getBytes(StandardCharsets.UTF_8);
            byte[] encrypted = encrypt(plain);

            File target = new File(dir, SETTINGS_FILE);
            File temp = new File(dir, SETTINGS_FILE + ".tmp");
            try (FileOutputStream out = new FileOutputStream(temp)) {
                out.write(encrypted);
                out.flush();
                out.getFD().sync();
            }
            if (target.exists() && !target.delete()) {
                // Перезапишем ниже.
            }
            if (!temp.renameTo(target)) {
                try (FileOutputStream out = new FileOutputStream(target)) {
                    out.write(encrypted);
                }
                temp.delete();
            }

            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("path", target.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Не удалось сохранить настройки: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadSettings(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            File target = new File(settingsDir(getContext()), SETTINGS_FILE);
            if (!target.exists()) {
                ret.put("data", (String) null);
                ret.put("exists", false);
                call.resolve(ret);
                return;
            }
            byte[] encrypted = readAll(target);
            byte[] plain = decrypt(encrypted);
            ret.put("data", new String(plain, StandardCharsets.UTF_8));
            ret.put("exists", true);
            ret.put("path", target.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            // Повреждённый файл/сменился ключ — не блокируем запуск приложения.
            ret.put("data", (String) null);
            ret.put("exists", true);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void clearSettings(PluginCall call) {
        try {
            File target = new File(settingsDir(getContext()), SETTINGS_FILE);
            boolean removed = !target.exists() || target.delete();
            JSObject ret = new JSObject();
            ret.put("cleared", removed);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Не удалось очистить настройки: " + e.getMessage());
        }
    }

    private static byte[] readAll(File file) throws Exception {
        try (FileInputStream in = new FileInputStream(file);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toByteArray();
        }
    }

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return generator.generateKey();
    }

    private static byte[] encrypt(byte[] plain) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        byte[] cipherText = cipher.doFinal(plain);

        // Формат файла: [1 байт версии][12 байт IV][шифротекст + tag]
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(1);
        out.write(iv);
        out.write(cipherText);
        return out.toByteArray();
    }

    private static byte[] decrypt(byte[] encrypted) throws Exception {
        if (encrypted.length < 14) throw new Exception("Файл настроек повреждён");
        int version = encrypted[0] & 0xFF;
        if (version != 1) throw new Exception("Неизвестная версия файла настроек");

        byte[] iv = new byte[12];
        System.arraycopy(encrypted, 1, iv, 0, 12);
        byte[] cipherText = new byte[encrypted.length - 13];
        System.arraycopy(encrypted, 13, cipherText, 0, cipherText.length);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        return cipher.doFinal(cipherText);
    }
}
