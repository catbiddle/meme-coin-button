# Meme Coin shop

The Meme Coin website with whole-cart checkout through Square.

## What's in here

- `site/` is the website. Netlify publishes this folder.
  - `index.html` is the page.
  - `buttons.json` is the list of buttons: title, price, photo, and whether it has sold.
  - `images/` holds the photos.
- `netlify/functions/checkout.mjs` is the small server piece. It takes the buyer's stash, looks up the buttons in `buttons.json`, works out the prices, and asks Square for one checkout page for the whole order plus $1.50 shipping.
- `netlify.toml` tells Netlify where those two things are.

## Setup, once

1. **Square.** Create a Square account, then sign in at developer.squareup.com and create an application. From it you need two values:
   - the **Production access token** (treat it like a password)
   - your **Location ID**
2. **GitHub.** Put this whole folder in a GitHub repository.
3. **Netlify.** Connect the Netlify project to that repository. Netlify reads `netlify.toml`, so no build settings are needed.
4. **Netlify environment variables.** In the project's settings, add:
   - `SQUARE_ACCESS_TOKEN` = the access token
   - `SQUARE_LOCATION_ID` = the location ID
   Then redeploy.

Drag-and-drop uploads will show the site but checkout will not work, because Netlify only runs the server piece on deploys from GitHub or its command-line tool.

## Testing with fake money first

Square gives every developer application a sandbox. Use the **Sandbox** access token and sandbox location ID, and add one more variable: `SQUARE_ENV` = `sandbox`. Place a test order with Square's test card numbers. When it works, swap in the production values and delete `SQUARE_ENV`.

## Day to day

- **A button sold:** open `site/buttons.json`, find its line, and change `"sold":false` to `"sold":true`. Save. The site updates in about a minute.
- **A new button:** add its photo to `site/images/`, then copy a line in `buttons.json`, give it a new `id`, and change the title and photo name. Every line except the last needs a comma at the end.
- **Button prices:** 1 button is $4; 2 or more are $3 each (a double card counts as 2, a triple as 3). Set in two places that must match: `EACH` and `SOLO` in `site/index.html`, and `EACH_CENTS` and `SOLO_CENTS` in `netlify/functions/checkout.mjs`. The `price` numbers in `buttons.json` are no longer used.
- **Shipping price:** it is set in two places that must match: `SHIPPING` in `site/index.html` and `SHIPPING_CENTS` in `netlify/functions/checkout.mjs`.

Square does not know which buttons are one of a kind, so two people could pay for the same button before you mark it sold. If that happens, refund the second order from the Square dashboard.
