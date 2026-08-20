import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import * as Notifications from "expo-notifications";

import { setToken, startTracking, stopTracking } from "./src/tracking";

const CRM = "https://crm.momentumlandscapingut.com";

/**
 * Momentum Crew.
 *
 * There is deliberately NO native sign-in screen. The old build had one, which
 * meant signing in twice to the same system — once natively, then again on the
 * web inside the very same app — and two places for a login bug to hide.
 *
 * The web sign-in is now the only one. This shell watches for the Supabase
 * session the CRM stores after that sign-in, hands the token to the background
 * location task, and otherwise stays out of the way.
 */

// Read the session the CRM already holds and pass it out. Runs on every page
// load and again every few seconds, because a sign-in can happen at any point.
const BRIDGE = `
(function () {
  function findSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('-auth-token') === -1) continue;
        var raw = localStorage.getItem(k);
        if (!raw) continue;
        if (raw.slice(0, 7) === 'base64-') raw = atob(raw.slice(7));
        var v = JSON.parse(raw);
        var t = v && (v.access_token || (v[0] && v[0].access_token) || (Array.isArray(v) && v[0]));
        if (typeof t === 'string' && t.length > 20) return t;
      }
    } catch (e) {}
    return null;
  }
  function post() {
    var t = findSession();
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'session', token: t })
    );
  }
  post();
  setInterval(post, 5000);
  true;
})();
`;

export default function App() {
  const [loading, setLoading] = useState(true);
  const tracking = useRef(false);

  const onMessage = useCallback(async (e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg?.type !== "session") return;

    setToken(msg.token ?? null);

    if (msg.token && !tracking.current) {
      tracking.current = await startTracking();
      // Ask for push on the same beat, so a crew member sees both prompts once
      // rather than being interrupted again later in the day.
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const t = await Notifications.getDevicePushTokenAsync();
          await fetch(`${CRM}/api/crm/push-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${msg.token}` },
            body: JSON.stringify({ token: t.data, platform: "ios" }),
          }).catch(() => null);
        }
      } catch {}
    }

    // Signed out on the web: stop reporting location immediately.
    if (!msg.token && tracking.current) {
      await stopTracking();
      tracking.current = false;
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <WebView
          source={{ uri: CRM }}
          injectedJavaScript={BRIDGE}
          onMessage={onMessage}
          onLoadEnd={() => setLoading(false)}
          // The CRM keeps the session in localStorage; without these the shell
          // would forget it every launch and ask the crew to sign in daily.
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          originWhitelist={["https://*.momentumlandscapingut.com"]}
          style={styles.web}
          onContentProcessDidTerminate={() => setLoading(true)}
        />
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#7FB8BE" />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1219" },
  web: { flex: 1, backgroundColor: "#0B1219" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B1219",
  },
});
