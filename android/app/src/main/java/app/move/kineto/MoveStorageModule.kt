package app.move.kineto

import android.content.ContentValues
import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Environment
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class MoveStorageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  private val tone = ToneGenerator(AudioManager.STREAM_MUSIC, 85)
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
    tone.startTone(ToneGenerator.TONE_PROP_BEEP, 90)
    promise.resolve(true)
  }

  @ReactMethod
  fun repChime(promise: Promise) {
    tone.startTone(ToneGenerator.TONE_PROP_ACK, 120)
    promise.resolve(true)
  }

  @ReactMethod
  fun finishChime(promise: Promise) {
    tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 260)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopAudio(promise: Promise) {
    tts?.stop()
    tone.stopTone()
    promise.resolve(true)
  }

  override fun invalidate() {
    super.invalidate()
    tts?.shutdown()
    tts = null
    tone.release()
  }
}
