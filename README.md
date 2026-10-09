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
npm run import:local -- content/openintro-sampling # load the sample 5.1 lesson
npm run dev                                        # http://localhost:5173
```

The player is at http://localhost:5173/c/openintro-sampling, and the author side (review,
sign-off, the show-unreviewed switch) at http://localhost:5173/author. Locally the author side
is open until you set `AUTHOR_PASSPHRASE` in `.dev.vars`; after that it asks for it.

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
