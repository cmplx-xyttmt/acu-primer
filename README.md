# acu-primer

A course-authoring tool and the lesson player that runs what it makes. A course author turns a
textbook section into short, interactive lessons that change course when a student gets
something wrong, and every lesson shows whether a person has checked it.

Built for Devpost's Build With AI: Basics. Planning documents are in `devpost/`.

## Run it locally

You need Node 20 or newer.

```sh
npm install
npm run db:migrate:local                          # create the local D1 tables
npm run import:local -- content/openintro-sampling # load the sample chapter (and its subject)
npm run dev                                        # http://localhost:5173
```

The home page at http://localhost:5173 lists subjects; a chapter plays at
http://localhost:5173/s/openintro-statistics/openintro-sampling. The author side (review,
sign-off, the show-unreviewed switch) at http://localhost:5173/author. Locally the author side
is open until you set `AUTHOR_PASSPHRASE` in `.dev.vars`; after that it asks for it.

## Try it offline

The service worker only runs in a build, not in `npm run dev`. Run `npm run preview` (or use the
deployed link), open a course once, then go offline (DevTools > Network > Offline, or turn the
wifi off) and reload: the course, fonts and formulas still work, and answers queue up until the
connection is back.

## Check it

```sh
npm test       # lesson schema tests
npm run check  # TypeScript and Svelte checks
```

## Deploy

```sh
npx wrangler login
npx wrangler d1 create acu-primer   # once; put the database_id in wrangler.jsonc
npm run db:migrate:remote
npm run import:remote -- content/openintro-sampling
npm run deploy
```
