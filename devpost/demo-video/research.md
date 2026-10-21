# Demo video research

Notes for the acu-primer demo video (Build With AI: Basics, deadline Mon Oct 26, 2026). Gathered Oct 21, 2026. The concepts and prototypes are in the folders next to this file, and `index.html` puts them side by side.

## What the video has to be

From `.claude/skills/6-ship/SKILL.md`:

- A short demo video is required. Reviewers should see the proof of concept working without cloning the repo, and a deployed app doesn't replace it.
- It has to show the working kernel, not slides or code. A local recording is fine.
- The narration and the submission text are yours. The skill says the agent doesn't write narration. So every "narration outline" in the concept files is a list of points to cover, not wording, and every caption in them is a bracketed placeholder for you to rewrite.
- Use the length and format the live submission form gives. Don't trust a number from here over the form.

What I could find about this hackathon:

- The Devpost pages (buildwithai-basics.devpost.com and its /rules page) returned HTTP 403 to the research agent, so nothing here comes from Devpost directly. Please open the Rules tab yourself.
- A third-party listing describes the submission as a "1-3 minute working demo video", a public repo with scope.md, prd.md and spec.md, and Devpost registration. It gives the deadline as Oct 26, 2026 at 5:00 PM ET, which is midnight EAT (https://internshala.com/competitions/?p=11290).
- Devpost's general rule is that the video link must be YouTube, Vimeo or Youku, and publicly visible. Any other link fails with "Must be a valid YouTube, Vimeo, or Youku url" (https://help.devpost.com/article/85-uploading-a-demo-video). The article doesn't mention unlisted videos, so check that too.
- Some Devpost hackathons ban third-party music and trademarks, or require English subtitles (an example: https://hackernoon.com/i-refused-to-fake-auraduels-crowd-for-its-117-second-shipaton-demo-video). Check the Rules tab for this one.

So the safe target is **2:15 to 2:45, public on YouTube**, marked "Not made for kids" so judges can play it (https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video). Upload a day early, because YouTube processing can take a while (https://help.devpost.com/article/84-video-making-best-practices).

## What makes a demo video work

- **Say what it is in the first few seconds.** Devpost's own tips say to open with the pitch (problem, solution) and then show the running app (https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video). Wistia's retention data shows the steepest drop in the first 10 to 15 seconds (https://wistia.com/learn/marketing/engagement-graph-learnings).
- **Shorter keeps more viewers.** About 4.9% of viewers leave early in 1-2 minute videos, against 17.3% in 5-10 minute ones (https://wistia.com/blog/understanding-audience-retention).
- **Problem, then a long demo, then a short close.** AngelHack suggests about 30 seconds on the problem and who has it, half the runtime on the live demo, and a short close (https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/). Hackathon.com says to show the product early and write against the judging criteria (https://tips.hackathon.com/article/creating-the-best-demo-video-for-a-hackathon-what-to-know).
- **Don't cram, and don't speed up the audio** to fit a limit (Devpost tips, above). Rehearse from your outline and cut the slow parts.
- **Captions help even when judges have sound on.** In a 2019 Verizon Media/Publicis survey of 5,616 US adults, 69% watched video with the sound off in public, and 80% said captions make them more likely to finish a video (https://www.3playmedia.com/blog/verizon-media-and-publicis-media-find-viewers-want-captions/). That's a share of people, not "80% more likely". For acu-primer, big on-screen labels on the key beats ("wrong answer", "the fallback for that mistake") do the job that captions do.

What this means for acu-primer: the kernel has four steps, and a viewer who stops at 0:15 should already know two things. Students get help aimed at their mistake. And a person checks the lesson first.

## Recording the app

I recorded the beats with Playwright against a local `wrangler dev` (a throwaway author passphrase, with the paid routes blocked at the browser), at 1280x720. They're in `media/clips/`:

| Clip | What it shows | Length |
|---|---|---|
| 01-student-wrong-then-right | name, overview, lesson intro with outcomes, module 1, a wrong pick, the re-explanation and simpler question, retry, green with the explanation | 44 s |
| 02-student-fails-fallback | dark mode, module 2, types the count (43), fails the simpler question, "go back through the material", Skip for now | 25 s |
| 03-theme-switch | Auto, Light, Dark on the lesson intro | 12 s |
| 04-author-review | the author gate, Author home, step-by-step review of the in-app draft (-394a13), approve two steps, the resolved suggestion "Claude changed: reading ($0.092)" | 25 s |
| 05-student-log | the student list, then Amina's path, every answer, fallback and the material suggestion, with times | 11 s |
| 06-offline | network off, reload, the course still opens and module 2 plays and grades | 23 s |

These are reference footage and could go straight into a rough cut. For the final cut I'd re-record the same beats at 1920x1080 yourself, because you'll want to pace them to your voice. Some things I noticed while recording:

- **Author home shows "Claude this month: $1.37 of $15".** Decide whether you want that on screen. It's honest, and it shows the budget guard, but it's a detail a viewer might stop on.
- **The drafting beat is the one I couldn't record.** Pressing Draft costs money (the in-app draft of 5.1 cost $1.28 on Oct 16 per the `spend` table), so I didn't. Two options: record one real draft (about $1.30, and it shows progress streaming in, which is the "page becomes a lesson" moment), or show the Session page and the drafted lesson in review, and let a motion-graphic transition carry the page-to-lesson idea. Concept B leans on this beat the most.
- **Use a fresh student name and a fresh browser profile** when you record. The overview's Continue only counts a module as passed once you press Continue after the right answer, so a half-finished run can leave you at "Start" again.
- **The student log only fills in once events flush** (about 2 seconds after each action, and on reload). If the log looks short, reload the student page once before switching to the author view.
- The fixture lesson (`openintro-5-1-fixture`, hand-written and signed off) is the one students see at `/c/openintro-sampling`. The Claude-drafted lesson (-394a13) is unreviewed, so it's hidden from students until you sign it off. For the video, the strongest story is: review and sign off the drafted lesson on camera, then play *that* lesson as the student. That needs a sign-off on your local database, which I didn't do.

## Motion graphics with code

The options, for this Mac (Node 24.18, ffmpeg in Homebrew, Playwright's Chromium 1124 already downloaded):

- **HTML/CSS/SVG plus Playwright frame capture plus ffmpeg (what I used).** Each prototype is one HTML file with a `render(t)` function that sets every element from the time `t`. In a browser it plays live. A short Node script (`render.cjs` in this folder, with how to run it in its header) calls `render(i/30)` for every frame, screenshots the stage, and pipes the PNGs into ffmpeg. A 20-second clip renders in about 35 seconds, frame-exact, with nothing new installed. The catch is that CSS transitions and keyframes don't step with a fake clock, so all motion has to be computed in `render(t)`. Tools like timecut work around that by faking `requestAnimationFrame` and `Date.now` (https://github.com/tungs/timecut), but they still don't drive CSS transitions.
- **Remotion** (React to MP4). The best docs, a preview studio, and frame-based timing, so it's the natural upgrade if the prototypes grow. License: free for individuals, for-profit companies with up to 3 employees, and non-profits. Companies with 4 or more people need a paid Company License (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md, https://www.remotion.pro/license). A personal hackathon entry fits the free tier. If the video were made for Tunga, it wouldn't. Setup is `npx create-video@latest`, plus learning its compositions and `useCurrentFrame()`.
- **Motion Canvas** (MIT, TypeScript, generator-based scenes, with a browser editor) is good for vector explainer animation, and less good at wrapping real UI (https://github.com/motion-canvas/motion-canvas). **Revideo** began as a fork of it and is MIT, but its API has moved, so it's a riskier choice for a few hours of work (https://github.com/redotvideo/revideo). **Manim** is built for math animation and needs LaTeX. It's not a fit here.

**What I'd recommend:** stay with HTML plus Playwright plus ffmpeg for the few motion pieces this video needs. The prototypes already work that way, they reuse the app's fonts and colors, and there's nothing to install or license. Switch to Remotion only if you end up wanting to edit the whole video in code. For cutting the recordings and motion clips together, any free editor works: iMovie, DaVinci Resolve (free up to 4K60, https://www.blackmagicdesign.com/products/davinciresolve), Shotcut or Kdenlive. Plain `ffmpeg` concat is enough for a simple cut.

## Recording your own screen and voice

- **Cmd+Shift+5** or **QuickTime** records the screen with your microphone. This Mac is on macOS 14, so it can't capture system audio, which doesn't matter here (https://support.apple.com/en-us/102618).
- **OBS** is free (GPL) if you want your face in a corner (https://obsproject.com).
- **Cap** is open source (mostly AGPLv3) and has a local Studio mode with backgrounds, zooms and trimming. The free tier has no time limit on local recordings (https://cap.so/pricing, https://github.com/CapSoftware/Cap). I couldn't confirm that its automatic zoom is free. **Screen Studio** does automatic zoom too, but it's paid (https://screen.studio).
- Before recording: a new Chrome profile with no bookmarks bar or extensions, the window at 1920x1080, and the browser zoom at 125% or so, so the text is readable in a YouTube embed.

## Music

No music is a fine choice. It can't get a Content ID claim, it can't break a rule, and it keeps your voice clear. If you want some:

| Source | Credit needed? | Notes |
|---|---|---|
| YouTube Audio Library | only on tracks marked "Attribution required" | won't get Content ID claims on YouTube (https://support.google.com/youtube/answer/3376882) |
| Pixabay Music | no | some tracks are registered with Content ID by their composers, so you may need to dispute a claim with the license certificate (https://pixabay.com/service/license-summary/) |
| Incompetech (Kevin MacLeod) | yes, CC BY 4.0 credit in the description | https://incompetech.com/music/royalty-free/licenses/ |
| Free Music Archive | depends on the track | avoid ND (no syncing to video) and NC tracks (https://freemusicarchive.org/License_Guide) |
| Uppbeat free | yes, one credit per video | 3 downloads to start (https://uppbeat.io/pricing) |

If you use music, keep it under your voice at about -20 dB and choose it before you cut, so the cuts can land on the beat.
