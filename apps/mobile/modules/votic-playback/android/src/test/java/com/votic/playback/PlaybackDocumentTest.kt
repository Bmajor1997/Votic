package com.votic.playback

import org.junit.Assert.*
import org.junit.Test

class PlaybackDocumentTest {
  private fun payload(offsets: String = "[0,6]", words: String = "[0,1]", rate: String = "1", account: String = "user") =
    """{"accountId":"$account","documentId":"book","passages":[{"text":"Hello world","offsets":$offsets,"words":$words}],"rate":$rate,"passageIndex":999,"wordIndex":999}"""

  @Test fun mapsSpeechOffsetsAndClampsResumePosition() {
    val document = PlaybackDocument.parse(payload())
    val passage = document.passages.first()
    assertEquals(0, passage.word_at(0))
    assertEquals(0, passage.word_at(5))
    assertEquals(1, passage.word_at(6))
    assertEquals(6, passage.offset_for(99))
    assertEquals(0, document.passageIndex)
    assertEquals(1, document.wordIndex)
    assertEquals(4f, PlaybackDocument.parse(payload(rate = "100")).rate)
  }

  @Test fun rejectsMissingIdentityAndDamagedWordMaps() {
    assertThrows(IllegalArgumentException::class.java) { PlaybackDocument.parse(payload(account = "")) }
    for (offsets in listOf("[]", "[6,0]", "[0,99]")) {
      assertThrows(IllegalArgumentException::class.java) { PlaybackDocument.parse(payload(offsets = offsets)) }
    }
    assertThrows(IllegalArgumentException::class.java) { PlaybackDocument.parse(payload(words = "[0]")) }
    assertThrows(IllegalArgumentException::class.java) { PlaybackDocument.parse(payload(words = "[-1,0]")) }
  }
}
