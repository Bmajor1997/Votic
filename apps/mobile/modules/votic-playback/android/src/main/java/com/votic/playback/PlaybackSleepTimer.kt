package com.votic.playback

/** A timer is never restored across processes and never starts audio. Durations include pauses. */
class PlaybackSleepTimer {
  var deadlineElapsed = 0L
    private set
  var deadlineWall = 0L
    private set
  var passage = -1
    private set
  fun configure(seconds: Double, boundary: Boolean, at: Int, elapsed: Long, wall: Long) {
    require(seconds.isFinite() && seconds >= 0 && seconds <= 86400)
    clear()
    if (boundary) passage = at
    else if (seconds > 0) {
      deadlineElapsed = elapsed + (seconds * 1000).toLong()
      deadlineWall = wall + (seconds * 1000).toLong()
    }
  }
  fun expired(elapsed: Long) = deadlineElapsed > 0 && elapsed >= deadlineElapsed
  fun clear() { deadlineElapsed = 0; deadlineWall = 0; passage = -1 }
}
