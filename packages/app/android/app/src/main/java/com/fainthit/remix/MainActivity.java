package com.fainthit.remix;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Bundle;
import android.view.KeyEvent;

import com.fainthit.remix.core.RemixCorePlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        RemixPermissionManager.grantAllDeclaredRuntimePermissions(this);

        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public Bitmap getDefaultVideoPoster() {
                Bitmap bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                canvas.drawARGB(0, 0, 0, 0);
                return bitmap;
            }
        });
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (RemixCorePlugin.handleKeyEvent(event)) {
            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        RemixCorePlugin.handleNewIntent(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            RemixCorePlugin.reapplySystemUiMode();
        }
    }
}
