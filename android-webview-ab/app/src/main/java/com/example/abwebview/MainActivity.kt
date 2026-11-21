package com.example.abwebview

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/** Full-screen WebView of the store, with a friendly page when it can't load. */
class MainActivity : Activity() {

    private val home = "https://hydration.mntzonline.com/"

    private lateinit var webView: WebView
    private var showingError = false
    private var lastUrl = home

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply { fitsSystemWindows = true }
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, req: WebResourceRequest, error: WebResourceError) {
                if (!req.isForMainFrame) return
                lastUrl = req.url.toString()
                val (title, body) = when (error.errorCode) {
                    ERROR_HOST_LOOKUP, ERROR_CONNECT, ERROR_IO ->
                        "You're offline" to "We couldn't reach the store. Check your Wi-Fi or mobile data, then try again."
                    ERROR_TIMEOUT ->
                        "This is taking too long" to "The store didn't answer in time. Your connection may be slow."
                    else ->
                        "Page not available" to "Something went wrong while opening the page."
                }
                showError(title, body)
            }

            override fun onReceivedHttpError(view: WebView, req: WebResourceRequest, res: WebResourceResponse) {
                if (!req.isForMainFrame || res.statusCode < 400) return
                lastUrl = req.url.toString()
                val (title, body) = if (res.statusCode == 404)
                    "Page not found" to "This page doesn't exist or has moved."
                else
                    "The store is having a problem" to "It's not you, it's us. Please try again in a moment."
                showError(title, body)
            }

            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                if (req.url.scheme == "app" && req.url.host == "retry") {
                    showingError = false
                    webView.loadUrl(lastUrl)
                    return true
                }
                return false
            }
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(home)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Simple back handling for all API levels")
    override fun onBackPressed() {
        if (!showingError && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun showError(title: String, body: String) {
        if (showingError) return
        showingError = true
        val html = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
                   font:16px/1.5 system-ui,sans-serif;background:#f6f7f9;color:#1d2330;padding:24px;box-sizing:border-box}
              .box{max-width:360px;text-align:center}
              .icon{font-size:48px;margin-bottom:8px}
              h1{font-size:22px;margin:0 0 8px} p{color:#5f6878;margin:0 0 24px}
              a{display:inline-block;padding:12px 28px;border-radius:10px;background:#d2051e;color:#fff;
                text-decoration:none;font-weight:600}
            </style></head><body><div class="box">
              <div class="icon">&#9888;</div>
              <h1>$title</h1>
              <p>$body</p>
              <a href="app://retry">Try again</a>
            </div></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }
}
