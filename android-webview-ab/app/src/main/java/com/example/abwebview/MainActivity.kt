package com.example.abwebview

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.CheckBox
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import java.io.ByteArrayInputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Loads the test site in a WebView and lets you take away, one at a time, the things a
 * client-side A/B test needs: JavaScript, storage, the testing script itself, a browser
 * User-Agent. The log shows which variant the page ended up showing.
 */
class MainActivity : Activity() {

    private val site = "https://hydration.mntzonline.com"

    private data class Target(val label: String, val path: String, val kind: String)

    private val targets = listOf(
        // Real tool: GrowthBook JS SDK from cdn.jsdelivr.net, visitor ID in localStorage/cookie.
        Target("GrowthBook (client)", "/growthbook.html", "gb"),
        // Fake Kameleoon script edits the headline in the browser (forced variant B).
        Target("Store: client script", "/home?fk_mode=client&fk_variant=B", "store"),
        // Same experiment, but the server picks variant B and renders it. Nothing to block.
        Target("Store: server SDK", "/home?fk_mode=server&fk_variant=B", "store"),
    )

    /** Requests the "Block A/B scripts" toggle refuses. */
    private val blockedUrlParts = listOf("@growthbook/", "growthbook", "fake-kameleoon.js")

    private lateinit var webView: WebView
    private lateinit var log: TextView
    private lateinit var logScroll: ScrollView
    private lateinit var targetGroup: RadioGroup

    private lateinit var jsBox: CheckBox
    private lateinit var storageBox: CheckBox
    private lateinit var blockBox: CheckBox
    private lateinit var uaBox: CheckBox
    private lateinit var forceBox: CheckBox

    private var defaultUa = ""
    private val main = Handler(Looper.getMainLooper())
    private val time = SimpleDateFormat("HH:mm:ss", Locale.US)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildUi())
        setupWebView()
        // Any change reloads the page straight away.
        targetGroup.setOnCheckedChangeListener { _, _ -> load() }
        listOf(jsBox, storageBox, blockBox, uaBox, forceBox).forEach { b ->
            b.setOnCheckedChangeListener { _, _ -> load() }
        }
        load()
    }

    // ---------------------------------------------------------------- UI

    private fun buildUi(): LinearLayout {
        val pad = dp(8)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
            fitsSystemWindows = true
        }

        targetGroup = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        targets.forEachIndexed { i, t ->
            targetGroup.addView(RadioButton(this).apply {
                id = 1000 + i
                text = t.label
                textSize = 12f
            })
        }
        targetGroup.check(1000)
        root.addView(HorizontalScrollView(this).apply {
            setPadding(pad, pad, pad, 0)
            addView(targetGroup)
        })

        // Defaults = a normal browser. Untick to see what each one breaks.
        jsBox = box("JavaScript", true)
        storageBox = box("DOM storage", true)
        blockBox = box("Block A/B scripts", false)
        uaBox = box("WebView UA", true)
        forceBox = box("App forces B", false)
        root.addView(row(jsBox, storageBox, blockBox))
        root.addView(row(uaBox, forceBox))

        root.addView(row(
            button("Load") { load() },
            button("Clear data") { clearData() },
            button("Clear log") { log.text = "" },
        ))

        webView = WebView(this)
        root.addView(webView, LinearLayout.LayoutParams(MATCH_PARENT, 0, 3f))

        log = TextView(this).apply {
            textSize = 11f
            typeface = android.graphics.Typeface.MONOSPACE
            setTextColor(Color.parseColor("#E5E7EB"))
            setPadding(pad, pad, pad, pad)
        }
        logScroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#111827"))
            addView(log)
        }
        root.addView(logScroll, LinearLayout.LayoutParams(MATCH_PARENT, 0, 2f))
        return root
    }

    private fun box(label: String, checked: Boolean) = CheckBox(this).apply {
        text = label
        textSize = 12f
        isChecked = checked
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        isAllCaps = false
        setOnClickListener { onClick() }
    }

    private fun row(vararg views: android.view.View) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(dp(8), 0, dp(8), 0)
        views.forEach { addView(it, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)) }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ---------------------------------------------------------------- WebView

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        defaultUa = webView.settings.userAgentString
        CookieManager.getInstance().setAcceptCookie(true)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                val msg = m.message()
                if (msg.startsWith("AB_RESULT") || msg.contains("GrowthBook") ||
                    m.messageLevel() == ConsoleMessage.MessageLevel.ERROR
                ) logLine("console: ${msg.take(200)}")
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            // Runs on a background thread for every request the page makes.
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                val url = req.url.toString()
                if (blockBox.isChecked && blockedUrlParts.any { url.contains(it) }) {
                    main.post { logLine("BLOCKED $url") }
                    return WebResourceResponse(
                        "text/plain", "utf-8", 403, "Blocked by app", emptyMap(),
                        ByteArrayInputStream(ByteArray(0)),
                    )
                }
                return null
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                logLine("loading $url")
            }

            override fun onPageFinished(view: WebView, url: String) {
                logLine("page loaded")
                // Give the test (and its anti-flicker timeout) time to finish, then read the result.
                main.postDelayed({
                    if (forceBox.isChecked) forceVariant()
                    main.postDelayed({ readResult() }, 300)
                }, 2000)
            }
        }
    }

    private fun currentTarget() = targets[targetGroup.checkedRadioButtonId - 1000]

    private fun load() {
        val s = webView.settings
        s.javaScriptEnabled = jsBox.isChecked
        s.domStorageEnabled = storageBox.isChecked
        // Android's WebView UA contains "; wv)". Removing it makes the page see a normal Chrome.
        s.userAgentString = if (uaBox.isChecked) defaultUa else defaultUa.replace("; wv)", ")")
        val t = currentTarget()
        logLine("── ${t.label} | JS=${on(jsBox)} storage=${on(storageBox)} " +
            "block=${on(blockBox)} wvUA=${on(uaBox)} force=${on(forceBox)}")
        webView.clearCache(true) // so a blocked script is really fetched (and blocked) again
        webView.loadUrl(site + t.path)
    }

    private fun clearData() {
        CookieManager.getInstance().removeAllCookies { logLine("cookies cleared") }
        WebStorage.getInstance().deleteAllData()
        webView.clearCache(true)
        logLine("localStorage + cache cleared (new visitor ID on next load)")
    }

    /** The app overrides whatever the test picked, like an in-app "visual editor" would. */
    private fun forceVariant() {
        if (!jsBox.isChecked) {
            logLine("force: cannot inject, JavaScript is off")
            return
        }
        val js = when (currentTarget().kind) {
            "gb" -> """
                (function(){
                  var b=document.getElementById('buy'); if(!b) return 'no button';
                  b.textContent='Buy now – 20% off'; b.className='buy discount';
                  document.getElementById('price').innerHTML='<s>${'$'}129.00</s><strong>${'$'}103.20</strong>';
                  document.getElementById('s-variant').textContent='B (forced by app)';
                  document.getElementById('s-reason').textContent='app injected JS after load';
                  window.__abResult=Object.assign(window.__abResult||{}, {variant:'discount', forcedByApp:true});
                  return 'forced B';
                })()
            """.trimIndent()
            else -> """
                (function(){
                  var h=document.querySelector('h1'); if(!h) return 'no h1';
                  h.textContent='Forced by the app'; return 'headline replaced';
                })()
            """.trimIndent()
        }
        webView.evaluateJavascript(js) { logLine("force: $it") }
    }

    private fun readResult() {
        if (!jsBox.isChecked) {
            logLine("RESULT: JavaScript off -> no client-side test can run; page shows its server HTML")
            readHeadlineWithoutJs()
            return
        }
        val js = """
            (function(){
              if (window.__abResult) return JSON.stringify(window.__abResult);
              var h=document.querySelector('h1');
              return JSON.stringify({headline: h ? h.textContent.trim() : null});
            })()
        """.trimIndent()
        webView.evaluateJavascript(js) { raw ->
            val text = raw.trim('"').replace("\\\"", "\"").replace("\\u2013", "–")
            logLine("RESULT: $text")
        }
    }

    /** With JS off we can't evaluate in the page, so just tell the user to look. */
    private fun readHeadlineWithoutJs() {
        logLine("   (look at the page: GrowthBook -> blue 'Buy'; store -> whatever the server rendered)")
    }

    private fun on(b: CheckBox) = if (b.isChecked) "on" else "off"

    private fun logLine(s: String) {
        log.append("${time.format(Date())} $s\n")
        logScroll.post { logScroll.fullScroll(ScrollView.FOCUS_DOWN) }
    }
}
