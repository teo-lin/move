package app.move.kineto

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class MoveStorageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  private val cues = CueSounds(reactContext)
  private var tts: TextToSpeech? = TextToSpeech(reactContext, this)
  private var ttsReady = false

  override fun getName(): String = "MoveStorage"

  override fun onInit(status: Int) {
    ttsReady = status == TextToSpeech.SUCCESS
    if (ttsReady) {
      tts?.language = Locale.UK
    }
  }

  @ReactMethod
  fun getString(key: String, promise: Promise) {
    val prefs = reactContext.getSharedPreferences("move", Context.MODE_PRIVATE)
    promise.resolve(prefs.getString(key, null))
  }

  @ReactMethod
  fun setString(key: String, value: String, promise: Promise) {
    val prefs = reactContext.getSharedPreferences("move", Context.MODE_PRIVATE)
    prefs.edit().putString(key, value).apply()
    promise.resolve(true)
  }

  @ReactMethod
  fun exportCsv(fileName: String, csv: String, promise: Promise) {
    try {
      val resolver = reactContext.contentResolver
      val relativePath = Environment.DIRECTORY_DOWNLOADS + "/move/"
      resolver.delete(
        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
        "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?",
        arrayOf(fileName, relativePath),
      )

      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        put(MediaStore.MediaColumns.MIME_TYPE, "text/csv")
        put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }

      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Could not create export file")

      resolver.openOutputStream(uri)?.use { output ->
        output.write(csv.toByteArray(Charsets.UTF_8))
      } ?: throw IllegalStateException("Could not open export file")

      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
      promise.resolve("Download/move/$fileName")
    } catch (e: Exception) {
      promise.reject("EXPORT_FAILED", e)
    }
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    val engine = tts
    if (engine != null && ttsReady) {
      engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "move-${System.nanoTime()}")
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun click(promise: Promise) {
    cues.play("tick")
    promise.resolve(true)
  }

  @ReactMethod
  fun repChime(promise: Promise) {
    cues.play("rep")
    promise.resolve(true)
  }

  @ReactMethod
  fun finishChime(promise: Promise) {
    cues.play("finish")
    promise.resolve(true)
  }

  @ReactMethod
  fun restChime(promise: Promise) {
    cues.play("rest")
    promise.resolve(true)
  }

  @ReactMethod
  fun stopAudio(promise: Promise) {
    tts?.stop()
    cues.stop()
    promise.resolve(true)
  }

  /** Keeps the screen on (no dimming, no timeout) while a workout is running. */
  @ReactMethod
  fun setKeepAwake(enabled: Boolean, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      if (enabled) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
      promise.resolve(true)
    }
  }

  override fun invalidate() {
    super.invalidate()
    tts?.shutdown()
    tts = null
    cues.release()
  }
}
