package com.fainthit.remix;

import android.content.Intent;
import android.view.KeyEvent;

import com.fainthit.remix.core.RemixCorePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
