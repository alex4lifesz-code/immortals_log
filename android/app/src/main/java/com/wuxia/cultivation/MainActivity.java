package com.wuxia.cultivation;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge rendering — let the web layer handle safe areas
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Dark status/navigation bars to match app theme
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), decorView);
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        // Prevent screenshots/screen recording in release builds for security
        // (comment out if screen sharing is needed)
        // getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,
        //         WindowManager.LayoutParams.FLAG_SECURE);

        // Keep screen awake during workout sessions
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Hardware-accelerated rendering (ensures smooth animations)
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        // Apply status bar colour to match app background
        getWindow().setStatusBarColor(0xFF0D0F14);
        getWindow().setNavigationBarColor(0xFF0D0F14);

        // Configure WebView for optimal rendering after bridge initialises
        configureWebView();
    }

    private void configureWebView() {
        // Access the Capacitor WebView after the bridge is ready
        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();
            if (webView == null) return;

            WebSettings settings = webView.getSettings();

            // Typography & Rendering
            settings.setStandardFontFamily("sans-serif");
            settings.setDefaultFontSize(16);
            settings.setMinimumFontSize(1);
            settings.setTextZoom(100);

            // Force dark mode handling to the web layer (don't let Android override)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                settings.setAlgorithmicDarkeningAllowed(false);
            }

            // Layout & Viewport
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(false);
            settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);

            // Performance
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Rendering pipeline optimisations
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);

            // Disable long-press context menus (prevents accidental text selection)
            webView.setLongClickable(false);
            webView.setHapticFeedbackEnabled(true);
        });
    }
}
