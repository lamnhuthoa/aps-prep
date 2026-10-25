# APS Prep

Password-protected study app. The question data is encrypted.

## Podcast

The **Podcast** tab reads all the cards aloud, one after the other, so you can study by listening.

- It reads each card as: its section (when the cards are in order), "Question n", the question, a pause to think, "Answer",
  then the answer. English, Vietnamese, or English then Vietnamese, following the EN / EN + VI / VI buttons or its own setting.
- Choose the source and section (all cards by default), in order or shuffled, the speed, the length of the pause before the
  answer, and whether the answers are read at all. The position is kept, so it continues where you stopped.
- Play / pause (Space), previous / next card (arrow keys), jump to a card number, read the card again. While it plays you can
  open another tab: a small bar at the bottom keeps the controls. Lock-screen and headset buttons work where the browser
  supports the Media Session API.
- There is no AI or audio model in the app and no audio file: the voices are the ones of the browser and the operating system
  (the Web Speech API). Voices that run on the device are preferred, and they work offline. A voice marked "(online)" (some of
  Chrome and Edge) sends the text to the company that runs it, so pick one only when you accept that, because the questions
  are encrypted on purpose. It needs a Vietnamese voice on the device to read Vietnamese; without one that part is skipped.
  On a phone the screen may have to stay on: the app asks the browser to keep it on while it reads.
