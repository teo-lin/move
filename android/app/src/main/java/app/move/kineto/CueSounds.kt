package app.move.kineto

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sin

/**
 * Soft, synthesized workout cues (no bundled audio, no network).
 *
 * - tick:   light, short wooden tick for the 5-second countdown
 * - rep:    muted woodblock "tock" marking each repetition
 * - finish: rising three-note marimba chime at the end of an exercise
 * - rest:   low, soft two-note "breathe" chime that ends a rest break
 */
class CueSounds(context: Context) {
  private val pool = SoundPool.Builder()
    .setMaxStreams(4)
    .setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
    )
    .build()

  private val ids = mutableMapOf<String, Int>()

  init {
    val dir = File(context.cacheDir, "cues").apply { mkdirs() }
    val sounds = mapOf(
      "tick" to render(0.09) { t -> mallet(t, 1400.0, 0.012, 0.22) + mallet(t, 2800.0, 0.006, 0.05) },
      "rep" to render(0.22) { t ->
        mallet(t, 620.0, 0.045, 0.30) + mallet(t, 1690.0, 0.018, 0.08) + mallet(t, 310.0, 0.06, 0.06)
      },
      "finish" to render(1.1) { t ->
        marimba(t, 784.0) + marimba(t - 0.13, 988.0) + marimba(t - 0.26, 1175.0)
      },
      "rest" to render(1.2) { t -> marimba(t, 523.0) * 0.8 + marimba(t - 0.32, 392.0) * 0.8 },
    )
    for ((name, samples) in sounds) {
      val file = File(dir, "$name-v1.wav")
      if (!file.exists()) {
        file.writeBytes(wav(samples))
      }
      ids[name] = pool.load(file.absolutePath, 1)
    }
  }

  fun play(name: String, volume: Float = 1f) {
    ids[name]?.let { pool.play(it, volume, volume, 1, 0, 1f) }
  }

  fun stop() {
    pool.autoPause()
  }

  fun release() {
    pool.release()
  }

  private fun mallet(t: Double, freq: Double, decay: Double, amp: Double): Double {
    if (t < 0) return 0.0
    val attack = min(1.0, t / 0.002)
    return amp * attack * exp(-t / decay) * sin(2 * PI * freq * t)
  }

  /** Marimba-like note: fundamental plus the characteristic 4x partial. */
  private fun marimba(t: Double, freq: Double): Double {
    if (t < 0) return 0.0
    val attack = min(1.0, t / 0.004)
    return attack * (
      0.20 * exp(-t / 0.35) * sin(2 * PI * freq * t) +
        0.05 * exp(-t / 0.06) * sin(2 * PI * freq * 4 * t)
      )
  }

  private fun render(seconds: Double, wave: (Double) -> Double): ShortArray {
    val count = (SAMPLE_RATE * seconds).toInt()
    val fadeOut = (SAMPLE_RATE * 0.02).toInt()
    return ShortArray(count) { i ->
      val t = i.toDouble() / SAMPLE_RATE
      val fade = if (i > count - fadeOut) (count - i).toDouble() / fadeOut else 1.0
      (wave(t).coerceIn(-1.0, 1.0) * fade * Short.MAX_VALUE).toInt().toShort()
    }
  }

  private fun wav(samples: ShortArray): ByteArray {
    val dataBytes = samples.size * 2
    val buffer = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN)
    buffer.put("RIFF".toByteArray()).putInt(36 + dataBytes).put("WAVE".toByteArray())
    buffer.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
      .putInt(SAMPLE_RATE).putInt(SAMPLE_RATE * 2).putShort(2).putShort(16)
    buffer.put("data".toByteArray()).putInt(dataBytes)
    samples.forEach { buffer.putShort(it) }
    return buffer.array()
  }

  companion object {
    private const val SAMPLE_RATE = 44100
  }
}
