# Concept A: The Primer

**Pitch:** acu-primer is named after the Primer in *The Diamond Age*, the book that teaches its reader. The video opens a book whose page turns into a question, answers a wrong pick in the margin, and then shows the real app doing the same thing.

The most personal of the three, and the one with the strongest look. It needs a few seconds to set up the idea before the app appears. And the book scenes look nothing like the app, so the cut from book to screen has to be clean.

Prototype: `index.html` (20 s, plays in a browser, click to pause). Render: `../media/renders/primer.mp4`. A green cloth book opens. The printed lines on the right page fade and become a question. A wrong pick gets circled in red, and the left page answers in blue ink with a simpler question. Then the right answer is circled in green and a "Reviewed by a person" stamp lands. Title.

No text from the novel is quoted anywhere. If you mention the book, say it in your own words.

## Storyboard (2:34)

| # | Time | Picture | Source |
|---|---|---|---|
| 1 | 0:00-0:06 | The closed book, title on the cover. It opens. | motion (prototype 0-4 s) |
| 2 | 0:06-0:16 | The printed page becomes a question. A wrong pick circled in red, and the left page answers in ink. | motion (prototype 4-13 s) |
| 3 | 0:16-0:22 | The right answer circled green, and the "Reviewed by a person" stamp. | motion (prototype 13-17 s) |
| 4 | 0:22-0:36 | You: where the name comes from, who it's for (the stats module, the CS course, the sports academy schools). | camera, or voice over the closed book |
| 5 | 0:36-0:40 | Match cut: the book page dissolves into the app's lesson intro in the same position. | motion, new (a short crossfade) |
| 6 | 0:40-1:05 | The student side, real: name, lesson intro with outcomes, module 1, a wrong pick, the re-explanation and simpler question, retry, green. | clip 01 |
| 7 | 1:05-1:15 | Fails the fallback, sent back to the material. | clip 02 |
| 8 | 1:15-1:20 | Title card in the book style: "Who wrote that help?" | motion, new |
| 9 | 1:20-1:45 | The author side: the PDF pages and the draft (or the Session page and the finished draft). | screen recording, new |
| 10 | 1:45-2:08 | The step-by-step review, the resolved suggestion, Sign off. The book's stamp appears in a corner as it's signed off. | clip 04, re-recorded with sign-off, plus a stamp overlay |
| 11 | 2:08-2:20 | The student's path in the log. | clip 05 |
| 12 | 2:20-2:26 | Offline and light/dark, 3 s each. | clips 06 and 03 |
| 13 | 2:26-2:34 | The book closes. Title, repo link. | motion (prototype end) |

## On-screen captions (placeholders)

- Shot 2: [a book that answers back]
- Shot 4: [named after the Primer in The Diamond Age]
- Shot 6: [a wrong answer changes the lesson]
- Shot 7: [two tries, then back to the reading]
- Shot 9: [drafted with Claude from the textbook]
- Shot 10: [checked by a person before any student sees it]
- Shot 11: [the author sees each student's path]

## Narration outline (points to cover, in your words)

1. Shots 1-3: silence or a single line. The images set up the idea.
2. Shot 4: the Primer as the inspiration, in a sentence. Then who you're building for, and why offline and adaptive matter for them.
3. Shots 6-7: walk through what the student sees, one mistake at a time.
4. Shots 8-9: the turn: the help was written for that mistake, with Claude, from the textbook.
5. Shot 10: why a person checks it, and how the review works.
6. Shot 11 and close: what the author learns, and what's next.

## Motion pieces needed

- The opening (shots 1-3). The prototype has it.
- The match cut (shot 5). This is the fiddly one: the right page of the book needs to line up with the app's content column so the dissolve looks intended.
- A book-style title card (shot 8) and a stamp overlay (shot 10). Both reuse the prototype's styles.
- The closing (shot 13): the prototype run backwards, or a simple fade to the title.
