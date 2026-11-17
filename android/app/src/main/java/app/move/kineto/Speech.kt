package app.move.kineto

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * Offline text-to-speech with a user-selectable engine, voice and speed.
 *
 * Prefers Google's speech engine when installed (more natural than most OEM defaults).
 * `speak` reports completion so the runner never talks over its own countdown.
 */
class Speech(private val context: Context) {
  data class EngineInfo(val name: String, val label: String)
  data class VoiceInfo(val name: String, val locale: String, val quality: Int)

  private val prefs = context.getSharedPreferences("move", Context.MODE_PRIVATE)
  private val pending = ConcurrentHashMap<String, () -> Unit>()
  private val main = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var ready = false
  private var onReady: (() -> Unit)? = null
  private var currentEngine: String? = null

  init {
    start(prefs.getString(KEY_ENGINE, null) ?: preferredEngine(), null)
  }

  /** Engine in use; null means the system default engine. */
  val engineName: String? get() = currentEngine ?: tts?.defaultEngine

  fun engines(): List<EngineInfo> = tts?.engines?.map { EngineInfo(it.name, it.label) } ?: emptyList()

  fun voices(): List<VoiceInfo> {
    val engine = tts ?: return emptyList()
    if (!ready) return emptyList()
    return (engine.voices ?: emptySet<Voice>())
      .filter { voice ->
        voice.locale.language == "en" &&
          !voice.isNetworkConnectionRequired &&
          !voice.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
      }
      .sortedWith(compareBy<Voice>({ it.locale.toLanguageTag() }, { -it.quality }, { it.name }))
      .map { VoiceInfo(it.name, it.locale.toLanguageTag(), it.quality) }
  }

  val voiceName: String? get() = if (ready) tts?.voice?.name else prefs.getString(KEY_VOICE, null)
  val rate: Float get() = prefs.getFloat(KEY_RATE, DEFAULT_RATE)

  fun setEngine(name: String, done: () -> Unit) {
    prefs.edit().putString(KEY_ENGINE, name).remove(KEY_VOICE).apply()
    tts?.shutdown()
    start(name, done)
  }

  fun setVoice(name: String): Boolean {
    val voice = tts?.voices?.firstOrNull { it.name == name } ?: return false
    prefs.edit().putString(KEY_VOICE, name).apply()
    return tts?.setVoice(voice) == TextToSpeech.SUCCESS
  }

  fun setRate(value: Float) {
    val clamped = value.coerceIn(0.6f, 1.4f)
    prefs.edit().putFloat(KEY_RATE, clamped).apply()
    tts?.setSpeechRate(clamped)
  }

  /** Speaks `text`, flushing anything still being said; `done` runs when speech ends. */
  fun speak(text: String, done: () -> Unit) {
    val engine = tts
    if (engine == null || !ready) {
      done()
      return
    }
    val id = "move-${System.nanoTime()}"
    pending[id] = done
    if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
      pending.remove(id)?.invoke()
      return
    }
    // Safety net: never leave the runner waiting if the engine drops a callback.
    main.postDelayed({ pending.remove(id)?.invoke() }, 8000)
  }

  fun stop() {
    tts?.stop()
    flushPending()
  }

  fun shutdown() {
    tts?.shutdown()
    tts = null
    flushPending()
  }

  private fun start(engine: String?, done: (() -> Unit)?) {
    ready = false
    currentEngine = engine
    onReady = done
    tts = TextToSpeech(context, { status -> main.post { onInit(status) } }, engine)
  }

  private fun onInit(status: Int) {
    val engine = tts
    ready = status == TextToSpeech.SUCCESS && engine != null
    if (ready && engine != null) {
      engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String) = Unit
        override fun onDone(utteranceId: String) = finish(utteranceId)
        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String) = finish(utteranceId)
        override fun onStop(utteranceId: String, interrupted: Boolean) = finish(utteranceId)
      })
      if (engine.setLanguage(Locale.UK) < TextToSpeech.LANG_AVAILABLE) {
        engine.setLanguage(Locale.US)
      }
      prefs.getString(KEY_VOICE, null)?.let { saved ->
        engine.voices?.firstOrNull { it.name == saved }?.let { engine.setVoice(it) }
      }
      engine.setSpeechRate(rate)
    }
    onReady?.invoke()
    onReady = null
  }

  private fun finish(id: String) {
    main.post { pending.remove(id)?.invoke() }
  }

  private fun flushPending() {
    val callbacks = pending.values.toList()
    pending.clear()
    callbacks.forEach { it() }
  }

  private fun preferredEngine(): String? {
    val probe = TextToSpeech(context) {}
    val names = probe.engines.map { it.name }
    probe.shutdown()
    return names.firstOrNull { it == GOOGLE_ENGINE }
  }

  companion object {
    private const val KEY_ENGINE = "tts_engine"
    private const val KEY_VOICE = "tts_voice"
    private const val KEY_RATE = "tts_rate"
    private const val DEFAULT_RATE = 0.95f
    private const val GOOGLE_ENGINE = "com.google.android.tts"
  }
}
