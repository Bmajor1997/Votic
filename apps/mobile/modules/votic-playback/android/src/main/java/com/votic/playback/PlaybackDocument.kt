package com.votic.playback

import org.json.JSONObject

data class PlaybackPassage(val text: String, val offsets: IntArray, val words: IntArray) {
  fun word_at(offset: Int): Int {
    var low = 0
    var high = offsets.lastIndex
    while (low <= high) {
      val mid = (low + high) / 2
      if (offsets[mid] <= offset) low = mid + 1 else high = mid - 1
    }
    return words[high.coerceAtLeast(0)]
  }
  fun offset_for(word: Int): Int = offsets[words.indexOfFirst { it >= word }.let { if (it < 0) words.lastIndex else it }]
}

data class PlaybackDocument(
  val accountId: String, val documentId: String, val title: String,
  val passages: List<PlaybackPassage>, val rate: Float, val voice: String?,
  val passageIndex: Int, val wordIndex: Int
) {
  companion object {
    fun parse(payload: String): PlaybackDocument {
      val json = JSONObject(payload)
      val accountId = json.getString("accountId")
      val documentId = json.getString("documentId")
      require(accountId.isNotBlank() && documentId.isNotBlank()) { "Sign in before listening." }
      val array = json.getJSONArray("passages")
      require(array.length() > 0) { "This document has no readable text." }
      val passages = (0 until array.length()).map { index ->
        val passage = array.getJSONObject(index)
        val text = passage.getString("text")
        val offsets = passage.getJSONArray("offsets")
        val words = passage.getJSONArray("words")
        require(text.isNotBlank() && offsets.length() > 0 && offsets.length() == words.length())
        val offsetValues = IntArray(offsets.length()) { offsets.getInt(it) }
        val wordValues = IntArray(words.length()) { words.getInt(it) }
        require(offsetValues.first() >= 0 && offsetValues.last() < text.length)
        require(offsetValues.asList().zipWithNext().all { (a, b) -> a <= b })
        require(wordValues.all { it >= 0 } && wordValues.asList().zipWithNext().all { (a, b) -> a <= b })
        PlaybackPassage(text, offsetValues, wordValues)
      }
      val at = json.optInt("passageIndex").coerceIn(0, passages.lastIndex)
      return PlaybackDocument(accountId, documentId, json.optString("title", "Votic document").take(200),
        passages, json.optDouble("rate", 1.0).toFloat().let { if (it.isFinite()) it.coerceIn(0.5f, 4f) else 1f },
        json.optString("voice").takeIf { it.isNotBlank() }, at,
        json.optInt("wordIndex").coerceIn(0, passages[at].words.last()))
    }
  }
}
