package com.votic.playback

/** Monotonic intervals exist only between confirmed engine callbacks. A new process starts inactive. */
class MeasuredSpeechClock {
  private var started: Long? = null
  fun start(now: Long) { started = now }
  fun checkpoint(now: Long): Long {
    val before = started ?: return 0
    started = now
    return (now - before).coerceAtLeast(0)
  }
  fun reset() { started = null }
}

/** A service can outlive an account switch; its cumulative keys must never cross owners. */
class SpeechSessionIdentity {
  private var owner: String? = null
  var id: String = java.util.UUID.randomUUID().toString()
    private set
  fun forAccount(account: String): String {
    if (owner != account) { owner = account; id = java.util.UUID.randomUUID().toString() }
    return id
  }
}
