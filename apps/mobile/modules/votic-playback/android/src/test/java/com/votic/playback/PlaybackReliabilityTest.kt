package com.votic.playback

import org.junit.Assert.*
import org.junit.Test

class PlaybackReliabilityTest {
  @Test fun countsOnlyConfirmedSpeechAndExcludesPausesAndRestarts() {
    val clock = MeasuredSpeechClock()
    assertEquals(0L, clock.checkpoint(5000))
    clock.start(7000)
    assertEquals(2500L, clock.checkpoint(9500))
    assertEquals(500L, clock.checkpoint(10000))
    clock.reset()
    assertEquals(0L, clock.checkpoint(90000))
    clock.start(90000)
    assertEquals(1000L, clock.checkpoint(91000))
    assertEquals(0L, MeasuredSpeechClock().checkpoint(100000))
  }
  @Test fun cumulativeSessionsCannotCrossAccountsInOneService() {
    val identity = SpeechSessionIdentity()
    val first = identity.forAccount("A")
    assertEquals(first, identity.forAccount("A"))
    val second = identity.forAccount("B")
    assertNotEquals(first, second)
    assertNotEquals(second, identity.forAccount("A"))
  }
  @Test fun sleepDurationIncludesPausesAndUsesMonotonicTime() {
    val timer = PlaybackSleepTimer()
    timer.configure(900.0, false, 4, 1000, 1000000)
    assertFalse(timer.expired(900999))
    assertTrue(timer.expired(901000))
    assertEquals(1900000L, timer.deadlineWall)
    timer.clear()
    assertFalse(timer.expired(9999999))
    assertEquals(0L, PlaybackSleepTimer().deadlineWall)
  }
  @Test fun passageTimerAndCancellationCannotCreateAnExpiredDuration() {
    val timer = PlaybackSleepTimer()
    timer.configure(0.0, true, 5, 10, 100)
    assertEquals(5, timer.passage)
    assertFalse(timer.expired(Long.MAX_VALUE))
    timer.clear()
    assertEquals(-1, timer.passage)
    assertThrows(IllegalArgumentException::class.java) { timer.configure(Double.NaN, false, 0, 0, 0) }
    assertThrows(IllegalArgumentException::class.java) { timer.configure(-1.0, false, 0, 0, 0) }
  }
}
