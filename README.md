# APS Prep

Password-protected study app. The question data is encrypted.

## Podcast

The **Podcast** tab reads all the cards aloud, one after the other, so you can study by listening.

- It reads each card in English as: its section (when the cards are in order), "Question n", the question, a pause to think,
  "Answer", then the answer. It can also read the Vietnamese, after the English or alone (the setting "Đọc bằng").
- **Live transcript** under the player: every card of the list, the English with its Vietnamese translation below it. The
  sentence that is being read is highlighted and the transcript scrolls along smoothly. Scroll by hand and it stops following
  until you press "Theo dõi câu đang đọc".
- **Seeking:** the bar above the controls moves to another card; the buttons go a sentence back or forward (← →) or a card back
  or forward (Shift + ← →); a click on any line of the transcript reads from that line. Play / pause is Space. While it plays you
  can open another tab: a small bar at the bottom keeps the controls. Lock-screen and headset buttons work where the browser
  supports the Media Session API.
- Choose the source and section (all cards by default), in order or shuffled, the speed, the length of the pause before the
  answer, and whether the answers are read at all. The position is kept, so it continues where you stopped.
- A sentence is read in one piece; only a sentence that is too long for one go (over 200 characters) is cut, at a comma or a
  joining word, never inside a word. Abbreviations such as "e.g.", "Inc." or "Dr." do not end a sentence.
- By default there is no AI or audio model and no audio file: the voices are the ones of the browser and the operating system
  (the Web Speech API). Voices that run on the device are preferred, and they work offline. A voice marked "(online)" (some of
  Chrome and Edge) sends the text to the company that runs it, so pick one only when you accept that, because the questions
  are encrypted on purpose. It needs a Vietnamese voice on the device to read Vietnamese; without one that part is skipped.
  On a phone the screen may have to stay on: the app asks the browser to keep it on while it reads.

### Better English voice (optional)

The setting "Giọng tiếng Anh chất lượng cao (Kokoro)" switches the English to a neural voice, [Kokoro-82M][kokoro] (8-bit),
that runs **on the device** in a Web Worker (onnxruntime-web, WebAssembly). Nothing is sent anywhere; the model is a static file
of this site (`vendor/tts/`, about 95 MB, downloaded once and kept by the browser).

- It generates sound slower than it is spoken (about 2 to 3.5 times its length on a laptop; more on a phone), so the audio of
  each sentence is **made ahead and kept** in IndexedDB. A sentence is made once; after that it plays at once, also offline.
  The app prepares the next 12 cards by itself; "Chuẩn bị cả danh sách" prepares the whole list (leave the screen on).
  About 48 KB of storage per second of speech; "Xóa âm thanh đã lưu" empties it.
- A sentence that is not ready yet is read by the browser's voice, or, with "Chỉ đọc bằng giọng này", the podcast waits for it.
- The speed setting changes the playback speed only, so it does not make the sentences again. Vietnamese is still read by the
  voice of the device.
- Voices: Heart and Emma (female), Michael (male). Licences: Kokoro and kokoro-js Apache-2.0, onnxruntime-web MIT.

## Mathematics

Calculations are typeset with [KaTeX][katex] (`vendor/katex/`): LaTeX between `$…$` (inline) or `$$…$$` (a line of its own), and
plain calculations such as `Profit = 20 × 5 / 4 = 25` or `(120 − 100) / 100 × 100% = 20%`, which become fractions with × and
%. Money such as "$5 and $10" is left alone. The podcast says a formula in words ("a divided by b", "x squared").

[kokoro]: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
[katex]: https://katex.org
