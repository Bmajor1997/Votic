import { build_document, build_review, build_worksheet_blocks, build_worksheet_export, format_playback_rate, format_time, keyboard_command, location_for_progress, normalize_highlight_theme, normalize_resume_snapshot, parse_document_text, PLAYBACK_RATES, progress_for_sentence, section_timing, speech_segment, worksheet_control_id, worksheet_control_type } from "./document_tools.js";
let doc = null;
let documentTitle = "";
const RESUME_KEY = "votic.resume.v1";
const LEGACY_RESUME_KEYS = ["vetra.resume.v1", "voxify.resume.v1"];
const PREFERENCES_KEY = "votic.preferences.v1";
const LEGACY_PREFERENCES_KEYS = ["vetra.preferences.v1", "voxify.preferences.v1"];
const PERSISTENCE_CONSENT_KEY = "votic.persistence-consent.v1";
const LEGACY_PERSISTENCE_CONSENT_KEY = "vetra.persistence-consent.v1";
let active_app_view = "home";
let persistenceReady = false;
let persistenceEnabled = false;
let pending_document_text = "";
let active_document_mode = "reading";
let worksheet_responses = {};
let review_options = { summary: true, takeaways: true };
let current_review = null;
let preferences = { highlightTheme: "warm", textSize: "default", readingSpacing: "default", reduceMotion: false, wordEmphasis: true };
const state = { sentenceIndex: 0, wordIndex: 0, rate: 1, playing: false, completed: false, utterance: null };
const $ = (selector) => document.querySelector(selector);
const el = { emptyState: $("#emptyState"), emptyAddDocument: $("#emptyAddDocument"), reader: $("#reader"), player: $("#player"), document: $("#document"), title: $("#documentTitle"), worksheetTools: $("#worksheetTools"), downloadWorksheet: $("#downloadWorksheet"), downloadWorksheetDocx: $("#downloadWorksheetDocx"), worksheetDownloadStatus: $("#worksheetDownloadStatus"), playbackStatus: $("#playbackStatus"), highlightTrigger: $("#highlightTrigger"), highlightDialog: $("#highlightDialog"), closeHighlights: $("#closeHighlights"), doneHighlights: $("#doneHighlights"), shortcutTrigger: $("#shortcutTrigger"), shortcutDialog: $("#shortcutDialog"), closeShortcuts: $("#closeShortcuts"), resumeCard: $("#resumeCard"), resumeMessage: $("#resumeMessage"), resumePlayback: $("#resumePlayback"), startOver: $("#startOver"), completion: $("#completion"), openReview: $("#openReview"), reviewDialog: $("#reviewDialog"), closeReview: $("#closeReview"), reviewSummary: $("#reviewSummary"), reviewTakeaways: $("#reviewTakeaways"), reviewSummarySection: $("#reviewSummarySection"), reviewTakeawaysSection: $("#reviewTakeawaysSection"), includeSummary: $("#includeSummary"), includeTakeaways: $("#includeTakeaways"), downloadSummary: $("#downloadSummary"), downloadTakeaways: $("#downloadTakeaways"), downloadReview: $("#downloadReview"), sectionList: $("#sectionList"), panel: $("#sectionsPanel"), scrim: $("#panelScrim"), trigger: $("#sectionsTrigger"), close: $("#closeSections"), dialog: $("#documentDialog"), documentFile: $("#documentFile"), selectedFile: $("#selectedFile"), documentError: $("#documentError"), loadDocument: $("#loadDocument"), sectionName: $("#currentSectionName"), sectionPosition: $("#sectionPosition"), speedSelect: $("#speedSelect"), currentTime: $("#currentTime"), totalTime: $("#totalTime"), timeline: $("#timeline"), timelineComplete: $("#timelineComplete"), sectionDots: $("#sectionDots"), playPause: $("#playPause"), playIcon: $("#playIcon"), previous: $("#previousSentence"), next: $("#nextSentence") };
Object.assign(el, { rememberDocument: $("#rememberDocument"), clearSavedDocument: $("#clearSavedDocument"), generateReview: $("#generateReview"), reviewStatus: $("#reviewStatus"), accessibilityTrigger: $("#accessibilityTrigger"), accessibilityDialog: $("#accessibilityDialog"), closeAccessibility: $("#closeAccessibility"), doneAccessibility: $("#doneAccessibility"), reduceMotion: $("#reduceMotion"), wordEmphasis: $("#wordEmphasis"), closeDocumentTrigger: $("#closeDocumentTrigger"), closeDocumentDialog: $("#closeDocumentDialog"), cancelCloseDocumentIcon: $("#cancelCloseDocumentIcon"), cancelCloseDocument: $("#cancelCloseDocument"), confirmCloseDocument: $("#confirmCloseDocument"), assistantTrigger: $("#assistantTrigger"), assistantPanel: $("#assistantPanel"), assistantScrim: $("#assistantScrim"), closeAssistant: $("#closeAssistant"), assistantMessages: $("#assistantMessages"), assistantForm: $("#assistantForm"), assistantQuestion: $("#assistantQuestion"), assistantUseDocument: $("#assistantUseDocument"), assistantDocumentChoice: $("#assistantDocumentChoice"), sendAssistant: $("#sendAssistant") });
Object.assign(el, { homePage: $("#homePage"), documentsPage: $("#documentsPage"), settingsPage: $("#settingsPage"), homeAddDocument: $("#homeAddDocument"), documentsAddDocument: $("#documentsAddDocument"), documentLibrary: $("#documentLibrary"), homeSavedTitle: $("#homeSavedTitle"), homeSavedMeta: $("#homeSavedMeta"), homeOpenSaved: $("#homeOpenSaved"), settingsTextSize: $("#settingsTextSize"), settingsReadingSpacing: $("#settingsReadingSpacing"), settingsReduceMotion: $("#settingsReduceMotion"), settingsWordEmphasis: $("#settingsWordEmphasis") });


const escape_html = (value) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function render_document() {
  const render_sentence = (sentence, previous_sentence) => {
    const output = [];
    for (let word_index = 0; word_index < sentence.words.length; word_index++) {
      const word = sentence.words[word_index];
      const control_type = active_document_mode === "worksheet" ? worksheet_control_type(word.text) : null;
      const control_id = worksheet_control_id(sentence.index, word_index);
      if (control_type === "checkbox") {
        const checked = worksheet_responses[control_id] ?? /[☑☒]/.test(word.text);
        output.push(`<button type="button" class="worksheet-checkbox" data-word="${word_index}" data-worksheet-control="${control_id}" aria-pressed="${checked}" aria-label="${checked ? "Uncheck" : "Check"} this worksheet item">${checked ? "☑" : "☐"}</button>`);
      } else if (control_type === "answer") {
        let blank_count = 1;
        while (worksheet_control_type(sentence.words[word_index + blank_count]?.text) === "answer") blank_count++;
        const prompt = sentence.text.slice(0, word.start).replace(/[•☐□☑☒_]+/g, " ").trim().slice(-100) || previous_sentence?.text.replace(/[•☐□☑☒_]+/g, " ").trim().slice(-100) || "Worksheet answer";
        const value = typeof worksheet_responses[control_id] === "string" ? worksheet_responses[control_id] : "";
        if (blank_count > 1) output.push(`<textarea class="worksheet-answer worksheet-answer-large" rows="${Math.min(6, blank_count)}" data-word="${word_index}" data-worksheet-control="${control_id}" aria-label="Answer: ${escape_html(prompt)}" placeholder="Type your answer">${escape_html(value)}</textarea>`);
        else output.push(`<input class="worksheet-answer" data-word="${word_index}" data-worksheet-control="${control_id}" aria-label="Answer: ${escape_html(prompt)}" value="${escape_html(value)}" placeholder="Type your answer">`);
        word_index += blank_count - 1;
      } else output.push(`<span class="word" data-word="${word_index}">${escape_html(word.text)}</span>`);
    }
    return output.join(" ");
  };
  el.document.innerHTML = doc.sections.map((section) => `<section id="section-${section.sectionIndex}" data-section="${section.sectionIndex}"><h2>${escape_html(section.heading)}</h2><p>${section.sentences.map((sentence, index) => `<span class="sentence" data-sentence="${sentence.index}">${render_sentence(sentence, section.sentences[index - 1])}</span>`).join(" ")}</p></section>`).join("");
  el.document.classList.toggle("has-worksheet-controls", Boolean(el.document.querySelector("[data-worksheet-control]")));
  el.worksheetTools.hidden = active_document_mode !== "worksheet";
}
function render_sections() {
  el.sectionList.innerHTML = doc.sections.map((section, index) => `<button data-section-jump="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escape_html(section.heading)}</strong><small data-section-duration="${index}"></small></button>`).join("");
  el.sectionDots.innerHTML = doc.sections.map((section, index) => `<span data-section-dot="${index}" style="left:${section.startRatio * 100}%" aria-hidden="true"></span>`).join("") + '<span style="left:100%" aria-hidden="true"></span>';
}
const active_sentence = () => doc.sentences[state.sentenceIndex];
const active_section = () => doc.sections[active_sentence()?.sectionIndex ?? 0];
function announce(message) { el.playbackStatus.textContent = ""; requestAnimationFrame(() => { el.playbackStatus.textContent = message; }); }
function show_reader(open) { el.emptyState.hidden = open; el.reader.hidden = !open; el.player.hidden = !open; el.trigger.hidden = !open; el.closeDocumentTrigger.hidden = !open; el.assistantDocumentChoice.hidden = !open; el.assistantPanel.querySelectorAll("[data-document-suggestion]").forEach((button) => { button.hidden = !open; }); el.assistantUseDocument.checked = open; document.body.classList.toggle("has-document", open); }
function saved_document_snapshot() { try { if (localStorage.getItem(PERSISTENCE_CONSENT_KEY) !== "true") return null; return normalize_resume_snapshot(JSON.parse(localStorage.getItem(RESUME_KEY) || "null")); } catch { return null; } }
function render_document_library() { const saved = saved_document_snapshot(); if (!saved) { el.documentLibrary.innerHTML = '<div class="library-empty">No saved documents yet. When you choose “Remember this document,” it will be available here.</div>'; el.homeSavedTitle.textContent = "No saved document yet"; el.homeSavedMeta.textContent = "Documents you choose to remember will appear here."; el.homeOpenSaved.hidden = true; return; } const progress = doc && documentTitle === saved.title ? progress_for_sentence(doc, state.sentenceIndex, state.wordIndex) : 0; el.homeSavedTitle.textContent = saved.title; el.homeSavedMeta.textContent = saved.completed ? "Finished" : "Saved on this device"; el.homeOpenSaved.hidden = false; const card = document.createElement("article"); card.className = "library-card"; const info = document.createElement("div"); const title = document.createElement("h2"); title.textContent = saved.title; const meta = document.createElement("p"); meta.textContent = saved.completed ? "Finished · Ready to review or ask Votic questions" : "Saved · Open to continue reading, listening, or asking Votic questions"; info.append(title, meta); const actions = document.createElement("div"); actions.className = "library-actions"; const open = document.createElement("button"); open.className = "primary-button"; open.type = "button"; open.textContent = "Open"; open.addEventListener("click", open_saved_document); const remove = document.createElement("button"); remove.className = "secondary-button"; remove.type = "button"; remove.textContent = "Remove"; remove.addEventListener("click", () => { clear_saved_document(); render_document_library(); announce("Saved document removed from this device."); }); actions.append(open, remove); card.append(info, actions); el.documentLibrary.replaceChildren(card); }
function open_saved_document() { if (!doc && !restore_state()) return; if (doc) { show_reader(true); render_document(); render_sections(); render_state(); } set_app_view("reader"); }
function set_app_view(view) { active_app_view = view; const isReader = view === "reader"; document.body.classList.toggle("app-page-active", !isReader); el.homePage.hidden = view !== "home"; el.documentsPage.hidden = view !== "documents"; el.settingsPage.hidden = view !== "settings"; document.querySelectorAll("[data-app-view]").forEach((button) => { const selected = button.dataset.appView === view; button.classList.toggle("is-current", selected); if (selected) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); }); if (!isReader) { if (state.playing) cancel_speech(); render_document_library(); } }
function save_preferences() { try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Preferences still work for the current session. */ } }
function apply_highlight_theme(theme) {
  const safe_theme = normalize_highlight_theme(theme);
  preferences.highlightTheme = safe_theme;
  document.documentElement.dataset.highlightTheme = safe_theme;
  el.highlightDialog.querySelectorAll("[data-highlight-theme]").forEach((option) => { option.checked = option.dataset.highlightTheme === safe_theme; });
  save_preferences();
}
function apply_accessibility_preferences(next = {}) {
  preferences.textSize = ["default", "large", "extra-large"].includes(next.textSize) ? next.textSize : preferences.textSize;
  preferences.readingSpacing = ["default", "extra"].includes(next.readingSpacing) ? next.readingSpacing : preferences.readingSpacing;
  if (typeof next.reduceMotion === "boolean") preferences.reduceMotion = next.reduceMotion;
  if (typeof next.wordEmphasis === "boolean") preferences.wordEmphasis = next.wordEmphasis;
  document.documentElement.dataset.textSize = preferences.textSize; document.documentElement.dataset.readingSpacing = preferences.readingSpacing; document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion); document.documentElement.dataset.wordEmphasis = preferences.wordEmphasis ? "on" : "off";
  el.accessibilityDialog.querySelector(`[name="textSize"][value="${preferences.textSize}"]`).checked = true; el.accessibilityDialog.querySelector(`[name="readingSpacing"][value="${preferences.readingSpacing}"]`).checked = true; el.reduceMotion.checked = preferences.reduceMotion; el.wordEmphasis.checked = preferences.wordEmphasis; save_preferences();
}
function restore_preferences() { try { const stored = localStorage.getItem(PREFERENCES_KEY) || LEGACY_PREFERENCES_KEYS.map((key) => localStorage.getItem(key)).find(Boolean); const saved = JSON.parse(stored) || {}; preferences = { ...preferences, ...saved }; } catch { /* Use defaults. */ } apply_highlight_theme(preferences.highlightTheme); apply_accessibility_preferences(preferences); }
function render_state({ scroll = false } = {}) {
  if (!doc) return;
  document.querySelectorAll(".sentence.is-current, .word.is-current").forEach((node) => node.classList.remove("is-current"));
  const sentenceNode = document.querySelector(`[data-sentence="${state.sentenceIndex}"]`);
  sentenceNode?.classList.add("is-current"); sentenceNode?.querySelector(`[data-word="${state.wordIndex}"]`)?.classList.add("is-current");
  if (scroll) sentenceNode?.scrollIntoView({ behavior: "smooth", block: "center" });
  const section = active_section(), progress = state.completed ? 1 : progress_for_sentence(doc, state.sentenceIndex, state.wordIndex); el.title.textContent = documentTitle;
  const timing = section_timing(doc, section.sectionIndex, progress, state.rate);
  el.sectionName.textContent = section.heading; el.sectionPosition.textContent = `Section ${section.sectionIndex + 1} of ${doc.sections.length} · ${format_time(timing.remainingSeconds)} left`;
  el.currentTime.textContent = format_time((doc.durationSeconds * progress) / state.rate); el.totalTime.textContent = format_time(doc.durationSeconds / state.rate);
  el.timelineComplete.style.width = `${progress * 100}%`; el.timeline.setAttribute("aria-valuenow", String(Math.round(progress * 100))); el.timeline.setAttribute("aria-valuetext", `${format_time((doc.durationSeconds * progress) / state.rate)} of ${format_time(doc.durationSeconds / state.rate)}`);
  el.playIcon.textContent = state.playing ? "❚❚" : "▶"; el.playPause.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  el.previous.disabled = state.sentenceIndex === 0; el.next.disabled = state.sentenceIndex === doc.sentences.length - 1;
  el.completion.hidden = !state.completed;
  document.querySelectorAll("[data-section-jump]").forEach((button) => button.classList.toggle("is-current", Number(button.dataset.sectionJump) === section.sectionIndex));
  document.querySelectorAll("[data-section-duration]").forEach((label) => { label.textContent = `${format_time(section_timing(doc, Number(label.dataset.sectionDuration), 0, state.rate).durationSeconds)} at ${format_playback_rate(state.rate)}`; });
  document.querySelectorAll("[data-section-dot]").forEach((dot) => dot.classList.toggle("is-current", Number(dot.dataset.sectionDot) === section.sectionIndex));
  if (persistenceReady) persist_state();
}
function persist_state() { if (!persistenceEnabled) return; try { localStorage.setItem(RESUME_KEY, JSON.stringify({ version: 1, title: documentTitle, sections: doc.sections.map(({ heading, text }) => ({ heading, text })), sentenceIndex: state.sentenceIndex, wordIndex: state.wordIndex, rate: state.rate, completed: state.completed, documentMode: active_document_mode, worksheetResponses: worksheet_responses, reviewOptions: review_options, savedAt: Date.now() })); } catch { /* Storage can be unavailable or full; playback still works. */ } }
function restore_state() { try { persistenceEnabled = localStorage.getItem(PERSISTENCE_CONSENT_KEY) === "true" || localStorage.getItem(LEGACY_PERSISTENCE_CONSENT_KEY) === "true"; const stored = localStorage.getItem(RESUME_KEY) || LEGACY_RESUME_KEYS.map((key) => localStorage.getItem(key)).find(Boolean); if (stored && !persistenceEnabled) { const keep = window.confirm("Votic found a document saved by an earlier version. Keep it on this device and continue? Choose Cancel to remove it."); if (!keep) { clear_saved_document(); return false; } persistenceEnabled = true; localStorage.setItem(PERSISTENCE_CONSENT_KEY, "true"); } if (!persistenceEnabled) return false; const saved = normalize_resume_snapshot(JSON.parse(stored)); if (!saved) return false; doc = build_document(saved.sections); documentTitle = saved.title; active_document_mode = saved.documentMode; worksheet_responses = saved.worksheetResponses; review_options = saved.reviewOptions; state.sentenceIndex = Math.min(saved.sentenceIndex, doc.sentences.length - 1); state.wordIndex = Math.min(saved.wordIndex, Math.max(0, doc.sentences[state.sentenceIndex].words.length - 1)); state.rate = saved.rate; state.completed = saved.completed; el.speedSelect.value = String(state.rate); const progress = progress_for_sentence(doc, state.sentenceIndex, state.wordIndex); if (!state.completed && progress > 0 && progress < 1) { el.resumeMessage.textContent = `Continue “${documentTitle}” — ${format_time(doc.durationSeconds * progress / state.rate)} of ${format_time(doc.durationSeconds / state.rate)}`; el.resumeCard.hidden = false; } return true; } catch { return false; } }
function cancel_speech() { speechSynthesis.cancel(); state.utterance = null; state.playing = false; render_state(); }
function speak_current_sentence() {
  el.resumeCard.hidden = true;
  if (state.completed) { state.sentenceIndex = 0; state.wordIndex = 0; }
  state.completed = false;
  speechSynthesis.cancel(); const sentence = active_sentence(); if (!sentence) return;
  const segment = speech_segment(sentence, state.wordIndex);
  const utterance = new SpeechSynthesisUtterance(segment.text); utterance.rate = state.rate; state.utterance = utterance; state.playing = true;
  utterance.onboundary = (event) => { if (event.name !== "word") return; const sourceIndex = segment.start + event.charIndex; const next = sentence.words.findIndex((word, index) => sourceIndex >= word.start && sourceIndex < (sentence.words[index + 1]?.start ?? sentence.text.length + 1)); if (next >= 0) { state.wordIndex = next; render_state({ scroll: true }); } };
  utterance.onend = () => { if (!state.playing) return; if (state.sentenceIndex < doc.sentences.length - 1) { state.sentenceIndex++; state.wordIndex = 0; speak_current_sentence(); } else { state.wordIndex = sentence.words.length - 1; state.playing = false; state.completed = true; render_state(); } };
  utterance.onerror = () => { state.playing = false; render_state(); };
  speechSynthesis.speak(utterance); render_state({ scroll: true });
}
function pause_for_choice() { if (state.playing) cancel_speech(); }
function toggle_panel(open) { if (open) pause_for_choice(); el.panel.classList.toggle("is-open", open); el.scrim.classList.toggle("is-open", open); el.panel.setAttribute("aria-hidden", String(!open)); el.trigger.setAttribute("aria-expanded", String(open)); if (open) { (el.sectionList.querySelector(".is-current") || el.close).focus(); announce("Sections opened. Playback paused."); } else el.trigger.focus(); }
function jump_to_sentence(index) { cancel_speech(); state.completed = false; state.sentenceIndex = Math.max(0, Math.min(doc.sentences.length - 1, index)); state.wordIndex = 0; render_state({ scroll: true }); }
function seek_to_progress(progress) { cancel_speech(); const location = location_for_progress(doc, progress); state.completed = false; state.sentenceIndex = location.sentenceIndex; state.wordIndex = location.wordIndex; el.resumeCard.hidden = true; render_state({ scroll: true }); announce(`Moved to ${el.currentTime.textContent}. Playback paused.`); }
function clear_saved_document() { try { localStorage.removeItem(RESUME_KEY); LEGACY_RESUME_KEYS.forEach((key) => localStorage.removeItem(key)); localStorage.removeItem(PERSISTENCE_CONSENT_KEY); localStorage.removeItem(LEGACY_PERSISTENCE_CONSENT_KEY); } catch { /* Current-session state remains usable. */ } persistenceEnabled = false; }
function close_current_document() { if (doc) cancel_speech(); doc = null; documentTitle = ""; worksheet_responses = {}; review_options = { summary: true, takeaways: true }; current_review = null; state.sentenceIndex = 0; state.wordIndex = 0; state.completed = false; el.document.innerHTML = ""; el.sectionList.innerHTML = ""; el.sectionDots.innerHTML = ""; el.resumeCard.hidden = true; clear_saved_document(); show_reader(false); el.closeDocumentDialog.close(); el.emptyAddDocument.focus(); announce("Document closed. Choose another document when you are ready."); }
function load_parsed_document(parsed, mode = "reading") { persistenceEnabled = Boolean(el.rememberDocument?.checked); try { if (persistenceEnabled) localStorage.setItem(PERSISTENCE_CONSENT_KEY, "true"); else clear_saved_document(); } catch { persistenceEnabled = false; } if (!parsed.sections.length) { el.documentError.textContent = "This document does not contain readable text."; return; } if (doc) cancel_speech(); doc = build_document(parsed.sections); documentTitle = parsed.title; active_document_mode = mode === "worksheet" ? "worksheet" : "reading"; worksheet_responses = {}; review_options = { summary: true, takeaways: true }; current_review = null; state.sentenceIndex = 0; state.wordIndex = 0; state.completed = false; el.resumeCard.hidden = true; show_reader(true); render_document(); render_sections(); render_state(); el.dialog.close(); set_app_view("reader"); render_document_library(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function render_review() { const review = current_review || build_review(doc); el.reviewSummary.textContent = review.summary; el.reviewTakeaways.innerHTML = review.takeaways.map((item) => `<li>${escape_html(item)}</li>`).join(""); el.includeSummary.checked = review_options.summary; el.includeTakeaways.checked = review_options.takeaways; el.reviewSummarySection.hidden = !review_options.summary; el.reviewTakeawaysSection.hidden = !review_options.takeaways; el.downloadSummary.hidden = !review_options.summary; el.downloadTakeaways.hidden = !review_options.takeaways; el.downloadReview.hidden = !review_options.summary || !review_options.takeaways; el.generateReview.disabled = !review_options.summary && !review_options.takeaways; return review; }
async function generate_ai_review() {
  pause_for_choice(); el.generateReview.disabled = true; el.generateReview.textContent = "Generating…"; el.reviewStatus.textContent = "Creating AI review…";
  try {
    const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: documentTitle, sections: doc.sections.map(({ heading, text }) => ({ heading, text })) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Votic could not generate an AI review.");
    current_review = { summary: result.summary, takeaways: result.takeaways }; render_review(); el.reviewStatus.textContent = "AI-generated review"; announce("AI summary and key takeaways are ready.");
  } catch (error) { current_review = null; render_review(); el.reviewStatus.textContent = `${error.message} Showing the local review.`; announce("AI review unavailable. Showing the local review."); }
  finally { el.generateReview.textContent = "Generate AI review"; el.generateReview.disabled = !review_options.summary && !review_options.takeaways; }
}
function download_review(parts, suffix) { const body = `${[documentTitle, ...parts].join("\n\n")}\n`; const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${documentTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "votic"}-${suffix}.txt`; link.click(); URL.revokeObjectURL(url); }

PLAYBACK_RATES.forEach((speed) => { const option = document.createElement("option"); option.value = String(speed); option.textContent = format_playback_rate(speed); el.speedSelect.append(option); }); el.speedSelect.value = String(state.rate);
restore_preferences(); const restored_document = restore_state(); show_reader(restored_document); if (restored_document) { render_document(); render_sections(); } persistenceReady = true; set_app_view("home"); render_document_library();
el.trigger.addEventListener("click", () => toggle_panel(true)); el.close.addEventListener("click", () => toggle_panel(false)); el.scrim.addEventListener("click", () => toggle_panel(false));
function open_document_dialog() { pause_for_choice(); pending_document_text = ""; el.documentFile.value = ""; el.dialog.querySelector('[name="documentMode"][value="reading"]').checked = true; el.selectedFile.textContent = "No document selected"; el.documentError.textContent = ""; el.loadDocument.disabled = true; el.dialog.showModal(); el.dialog.querySelector('[name="documentMode"]:checked').focus(); }
document.querySelectorAll("[data-app-view]").forEach((button) => button.addEventListener("click", () => set_app_view(button.dataset.appView)));
document.querySelectorAll("[data-go-documents]").forEach((button) => button.addEventListener("click", () => set_app_view("documents")));
el.homeAddDocument.addEventListener("click", open_document_dialog); el.documentsAddDocument.addEventListener("click", open_document_dialog); el.homeOpenSaved.addEventListener("click", open_saved_document);
el.settingsTextSize.addEventListener("change", () => apply_accessibility_preferences({ textSize: el.settingsTextSize.value })); el.settingsReadingSpacing.addEventListener("change", () => apply_accessibility_preferences({ readingSpacing: el.settingsReadingSpacing.value })); el.settingsReduceMotion.addEventListener("change", () => apply_accessibility_preferences({ reduceMotion: el.settingsReduceMotion.checked })); el.settingsWordEmphasis.addEventListener("change", () => apply_accessibility_preferences({ wordEmphasis: el.settingsWordEmphasis.checked }));
el.settingsTextSize.value = preferences.textSize; el.settingsReadingSpacing.value = preferences.readingSpacing; el.settingsReduceMotion.checked = preferences.reduceMotion; el.settingsWordEmphasis.checked = preferences.wordEmphasis;
el.emptyAddDocument.addEventListener("click", open_document_dialog);
el.documentFile.addEventListener("change", async () => {
  const file = el.documentFile.files[0]; if (!file) return;
  pending_document_text = ""; el.selectedFile.textContent = `${file.name} · Reading…`; el.documentError.textContent = ""; el.loadDocument.disabled = true; el.loadDocument.textContent = "Reading document…";
  try {
    if (!/\.(txt|md|pdf|docx|pptx|ppt|epub)$/i.test(file.name)) throw new Error("Choose a TXT, Markdown, PDF, Word, PowerPoint, or EPUB document.");
    if (/\.(pdf|docx|pptx|ppt|epub)$/i.test(file.name)) {
      if (file.size > 25_000_000) throw new Error("Document is too large. The current limit is 25 MB.");
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent(file.name) }, body: file });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "The document could not be read."); pending_document_text = result.text;
    } else { pending_document_text = await file.text(); }
    if (!pending_document_text.trim()) throw new Error("This document does not contain readable text.");
    el.selectedFile.textContent = `${file.name} · Ready`;
    el.loadDocument.disabled = false;
  } catch (error) { pending_document_text = ""; el.selectedFile.textContent = file.name; el.documentError.textContent = error.message; }
  finally { el.loadDocument.textContent = "Open in reader"; }
});
el.loadDocument.addEventListener("click", () => load_parsed_document(parse_document_text(pending_document_text, el.documentFile.files[0]?.name.replace(/\.(txt|md|pdf|docx|pptx|ppt|epub)$/i, "") || "Untitled document"), el.dialog.querySelector('[name="documentMode"]:checked')?.value));
el.document.addEventListener("click", (event) => { const checkbox = event.target.closest(".worksheet-checkbox"); if (!checkbox) return; pause_for_choice(); const checked = checkbox.getAttribute("aria-pressed") !== "true"; worksheet_responses[checkbox.dataset.worksheetControl] = checked; checkbox.setAttribute("aria-pressed", String(checked)); checkbox.setAttribute("aria-label", `${checked ? "Uncheck" : "Check"} this worksheet item`); checkbox.textContent = checked ? "☑" : "☐"; persist_state(); });
el.document.addEventListener("input", (event) => { const answer = event.target.closest(".worksheet-answer"); if (!answer) return; pause_for_choice(); worksheet_responses[answer.dataset.worksheetControl] = answer.value; persist_state(); });
el.downloadWorksheet.addEventListener("click", () => { pause_for_choice(); const body = `${documentTitle}\n\n${build_worksheet_export(doc, worksheet_responses)}\n`; const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${documentTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "votic"}-completed.txt`; link.click(); URL.revokeObjectURL(url); announce("Completed worksheet downloaded."); });
el.downloadWorksheetDocx.addEventListener("click", async () => {
  pause_for_choice(); el.downloadWorksheetDocx.disabled = true; el.worksheetDownloadStatus.textContent = "Creating Word document…";
  try {
    const response = await fetch("/api/export-docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: documentTitle, blocks: build_worksheet_blocks(doc, worksheet_responses) }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Votic could not create the Word document."); }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `${documentTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "votic"}-completed.docx`; link.click(); URL.revokeObjectURL(url); el.worksheetDownloadStatus.textContent = "Word document downloaded."; announce("Completed Word worksheet downloaded.");
  } catch (error) { el.worksheetDownloadStatus.textContent = error.message; announce(error.message); }
  finally { el.downloadWorksheetDocx.disabled = false; }
});
el.highlightTrigger.addEventListener("click", () => { pause_for_choice(); el.highlightDialog.showModal(); (el.highlightDialog.querySelector("[data-highlight-theme]:checked") || el.highlightDialog.querySelector("[data-highlight-theme]")).focus(); announce("Votic color options opened. Playback paused."); });
el.highlightDialog.addEventListener("click", (event) => { const option = event.target.closest("[data-highlight-theme]"); if (!option) return; apply_highlight_theme(option.dataset.highlightTheme); announce(`${option.textContent.trim()} selected throughout Votic. Playback remains paused.`); });
el.closeHighlights.addEventListener("click", () => { el.highlightDialog.close(); el.highlightTrigger.focus(); });
el.doneHighlights.addEventListener("click", () => { el.highlightDialog.close(); el.highlightTrigger.focus(); announce("Personalization saved."); });
el.accessibilityTrigger.addEventListener("click", () => { pause_for_choice(); el.accessibilityDialog.showModal(); el.accessibilityDialog.querySelector("input:checked").focus(); announce("Accessibility options opened. Playback paused."); });
el.accessibilityDialog.addEventListener("change", () => { apply_accessibility_preferences({ textSize: el.accessibilityDialog.querySelector('[name="textSize"]:checked')?.value, readingSpacing: el.accessibilityDialog.querySelector('[name="readingSpacing"]:checked')?.value, reduceMotion: el.reduceMotion.checked, wordEmphasis: el.wordEmphasis.checked }); announce("Accessibility preferences updated."); });
el.closeAccessibility.addEventListener("click", () => { el.accessibilityDialog.close(); el.accessibilityTrigger.focus(); }); el.doneAccessibility.addEventListener("click", () => { el.accessibilityDialog.close(); el.accessibilityTrigger.focus(); announce("Accessibility preferences saved."); });
el.closeDocumentTrigger.addEventListener("click", () => { pause_for_choice(); el.closeDocumentDialog.showModal(); el.cancelCloseDocument.focus(); announce("Close document confirmation opened. Playback paused."); });
function cancel_close_document() { el.closeDocumentDialog.close(); el.closeDocumentTrigger.focus(); }
el.cancelCloseDocumentIcon.addEventListener("click", cancel_close_document); el.clearSavedDocument.addEventListener("click", () => { clear_saved_document(); el.closeDocumentDialog.close(); el.closeDocumentTrigger.focus(); announce("Saved document data cleared from this browser."); }); el.cancelCloseDocument.addEventListener("click", cancel_close_document); el.confirmCloseDocument.addEventListener("click", close_current_document);
function toggle_assistant(open) { if (open) pause_for_choice(); el.assistantPanel.classList.toggle("is-open", open); el.assistantScrim.classList.toggle("is-open", open); el.assistantPanel.setAttribute("aria-hidden", String(!open)); el.assistantTrigger.setAttribute("aria-expanded", String(open)); if (open) { el.assistantQuestion.focus(); announce("Votic Help opened. Playback paused."); } else el.assistantTrigger.focus(); }
function add_assistant_message(text, role, section = null) { const message = document.createElement("div"); message.className = `assistant-message assistant-message-${role}`; const body = document.createElement("span"); body.textContent = text; message.append(body); if (section && Number.isInteger(section.index)) { const button = document.createElement("button"); button.type = "button"; button.className = "assistant-section-link"; button.dataset.assistantSection = String(section.index); button.textContent = `Go to ${section.title}`; message.append(button); } el.assistantMessages.append(message); message.scrollIntoView({ block: "end" }); return message; }
async function ask_assistant(question) {
  add_assistant_message(question, "user"); const pending = add_assistant_message("Finding that for you…", "votic"); el.sendAssistant.disabled = true; el.assistantQuestion.disabled = true;
  try { const useDocument = Boolean(doc && el.assistantUseDocument.checked); const payload = { question }; if (useDocument) payload.document = { title: documentTitle, sections: doc.sections.map(({ heading, text }) => ({ heading, text })) }; const response = await fetch("/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Ask Votic could not answer right now."); pending.querySelector("span").textContent = result.answer; if (Number.isInteger(result.sectionIndex) && doc?.sections[result.sectionIndex]) { const button = document.createElement("button"); button.type = "button"; button.className = "assistant-section-link"; button.dataset.assistantSection = String(result.sectionIndex); button.textContent = `Go to ${doc.sections[result.sectionIndex].heading}`; pending.append(button); } }
  catch (error) { pending.textContent = error.message; }
  finally { el.sendAssistant.disabled = false; el.assistantQuestion.disabled = false; el.assistantQuestion.focus(); }
}
el.assistantTrigger.addEventListener("click", () => toggle_assistant(true)); el.closeAssistant.addEventListener("click", () => toggle_assistant(false)); el.assistantScrim.addEventListener("click", () => toggle_assistant(false));
el.assistantForm.addEventListener("submit", (event) => { event.preventDefault(); const question = el.assistantQuestion.value.trim(); if (!question) return; el.assistantQuestion.value = ""; ask_assistant(question); });
el.assistantQuestion.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); el.assistantForm.requestSubmit(); } });
el.assistantPanel.querySelector(".assistant-suggestions").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; if (button.hasAttribute("data-document-suggestion")) el.assistantUseDocument.checked = true; ask_assistant(button.textContent); });
el.assistantMessages.addEventListener("click", (event) => { const button = event.target.closest("[data-assistant-section]"); if (!button || !doc) return; const section = doc.sections[Number(button.dataset.assistantSection)]; if (!section) return; state.sentenceIndex = section.sentences[0].index; state.wordIndex = 0; cancel_speech(); toggle_assistant(false); render_state({ scroll: true }); announce(`${section.heading}. Playback paused.`); });
el.sectionList.addEventListener("click", (event) => { const button = event.target.closest("[data-section-jump]"); if (!button) return; const section = doc.sections[Number(button.dataset.sectionJump)]; state.sentenceIndex = section.sentences[0].index; state.wordIndex = 0; cancel_speech(); toggle_panel(false); render_state({ scroll: true }); announce(`${section.heading}. Section ${section.sectionIndex + 1} of ${doc.sections.length}. Playback paused.`); });
el.speedSelect.addEventListener("change", () => { pause_for_choice(); state.rate = Number(el.speedSelect.value); state.playing = false; render_state(); announce(`Speed set to ${format_playback_rate(state.rate)}. Playback remains paused.`); });
el.timeline.addEventListener("click", (event) => { const bounds = el.timeline.getBoundingClientRect(); seek_to_progress((event.clientX - bounds.left) / bounds.width); });
el.timeline.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const current = Number(el.timeline.getAttribute("aria-valuenow")) / 100; const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : current + (event.key === "ArrowRight" ? .01 : -.01); seek_to_progress(next); });
el.playPause.addEventListener("click", () => { if (state.playing) { cancel_speech(); announce("Playback paused."); } else { speak_current_sentence(); announce(`Playing ${active_section().heading}.`); } }); el.previous.addEventListener("click", () => { jump_to_sentence(state.sentenceIndex - 1); announce("Previous passage."); }); el.next.addEventListener("click", () => { jump_to_sentence(state.sentenceIndex + 1); announce("Next passage."); });
el.resumePlayback.addEventListener("click", speak_current_sentence); el.startOver.addEventListener("click", () => { el.resumeCard.hidden = true; jump_to_sentence(0); });
el.openReview.addEventListener("click", () => { render_review(); el.reviewDialog.showModal(); el.closeReview.focus(); }); el.closeReview.addEventListener("click", () => { el.reviewDialog.close(); el.openReview.focus(); });
el.reviewDialog.querySelector(".review-options").addEventListener("change", () => { review_options = { summary: el.includeSummary.checked, takeaways: el.includeTakeaways.checked }; render_review(); persist_state(); announce("Review options updated."); });
el.generateReview.addEventListener("click", generate_ai_review);
el.downloadSummary.addEventListener("click", () => { const review = render_review(); download_review([`Summary\n${review.summary}`], "summary"); });
el.downloadTakeaways.addEventListener("click", () => { const review = render_review(); download_review([`Key takeaways\n${review.takeaways.map((item) => `• ${item}`).join("\n")}`], "key-takeaways"); });
el.downloadReview.addEventListener("click", () => { const review = render_review(); download_review([`Summary\n${review.summary}`, `Key takeaways\n${review.takeaways.map((item) => `• ${item}`).join("\n")}`], "review"); });
el.shortcutTrigger.addEventListener("click", () => { el.shortcutDialog.showModal(); el.closeShortcuts.focus(); }); el.closeShortcuts.addEventListener("click", () => { el.shortcutDialog.close(); el.shortcutTrigger.focus(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { if (el.panel.classList.contains("is-open")) toggle_panel(false); if (el.assistantPanel.classList.contains("is-open")) toggle_assistant(false); if (el.speedMenu.classList.contains("is-open")) { el.speedMenu.classList.remove("is-open"); el.speedButton.setAttribute("aria-expanded", "false"); el.speedButton.focus(); } return; }
  const interactive = Boolean(event.target.closest("button, a, input, textarea, select, dialog, [contenteditable='true']")); const command = keyboard_command(event.key, interactive); if (!command) return; event.preventDefault();
  if (command === "toggle-playback" && doc) el.playPause.click(); else if (command === "previous-sentence" && doc && !el.previous.disabled) el.previous.click(); else if (command === "next-sentence" && doc && !el.next.disabled) el.next.click(); else if (command === "open-sections" && doc) toggle_panel(true); else if (command === "show-shortcuts") el.shortcutTrigger.click();
});
if (doc) render_state();
