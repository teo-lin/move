package app.move.kineto

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MoveStorageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val cues = CueSounds(reactContext)
  private val speech = Speech(reactContext)

  override fun getName(): String = "MoveStorage"

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

  /** Resolves when the utterance has finished (or was interrupted). */
  /** Text of a file the user put in the app's own external folder (adb push), or null. */
  @ReactMethod
  fun readImportFile(fileName: String, promise: Promise) {
    try {
      val dir = reactApplicationContext.getExternalFilesDir(null)
      val file = java.io.File(dir, fileName)
      promise.resolve(if (file.isFile) file.readText(Charsets.UTF_8) else null)
    } catch (error: Exception) {
      promise.reject("import_failed", error)
    }
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    speech.speak(text) { promise.resolve(true) }
  }

  @ReactMethod
  fun getSpeechSettings(promise: Promise) {
    val result = Arguments.createMap()
    result.putString("engine", speech.engineName)
    result.putString("voice", speech.voiceName)
    result.putDouble("rate", speech.rate.toDouble())
    val engines = Arguments.createArray()
    speech.engines().forEach { engine ->
      engines.pushMap(Arguments.createMap().apply {
        putString("name", engine.name)
        putString("label", engine.label)
      })
    }
    result.putArray("engines", engines)
    val voices = Arguments.createArray()
    speech.voices().forEach { voice ->
      voices.pushMap(Arguments.createMap().apply {
        putString("name", voice.name)
        putString("locale", voice.locale)
        putInt("quality", voice.quality)
      })
    }
    result.putArray("voices", voices)
    promise.resolve(result)
  }

  @ReactMethod
  fun setSpeechEngine(name: String, promise: Promise) {
    speech.setEngine(name) { promise.resolve(true) }
  }

  @ReactMethod
  fun setSpeechVoice(name: String, promise: Promise) {
    promise.resolve(speech.setVoice(name))
  }

  @ReactMethod
  fun setSpeechLanguage(tag: String, promise: Promise) {
    speech.setLanguage(tag)
    promise.resolve(true)
  }

  @ReactMethod
  fun setSpeechRate(rate: Double, promise: Promise) {
    speech.setRate(rate.toFloat())
    promise.resolve(true)
  }

  @ReactMethod
  fun countdownRoll(promise: Promise) {
    cues.play("roll")
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
    speech.stop()
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
    speech.shutdown()
    cues.release()
  }
}
