# ============================================
# Wuxia Cultivation Tracker — ProGuard Rules
# Production R8 configuration
# ============================================

# ── Capacitor / WebView ───────────────────────
# Keep JavaScript interface methods used by Capacitor bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.wuxia.cultivation.** { *; }

# ── AndroidX ──────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-keep class androidx.core.view.WindowCompat { *; }
-keep class androidx.core.view.WindowInsetsControllerCompat { *; }

# ── WebView / WebSettings ─────────────────────
-keep class android.webkit.WebView { *; }
-keep class android.webkit.WebSettings { *; }

# ── Google Services (optional) ────────────────
-keep class com.google.android.gms.** { *; }

# ── Debugging (optional — uncomment for readable stack traces) ──
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Remove logging in release ─────────────────
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ── General safety rules ──────────────────────
-dontwarn org.apache.**
-dontwarn org.conscrypt.**
