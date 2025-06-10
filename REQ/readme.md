# Dependencies

The `token_capture` script is required for many other scripts in this repo which aren't `standalone` scripts.

This is the case because a variety of logic involves fetch requests which need a bearer token. The capture script handles that, and tucks a copy of it away in `localStorage` using the `captured-token` key on each page refresh, making it available to other scripts which need it.

## Sure, but why?
Some of the handy scripts in this repo involve making network requests. Most of those require being able to 'prove' that we're authorized to make those requests. Since we're already using ChatGPT, we happily note that we *are* authorized (or more specifically - the browser session is authorized). So to facilitate enabling the convenient use of `fetch` to make such requests in our scripts, we need an `authorization` Bearer token to include. It just so happens those are flying around in most of the normal network traffic present during typical use of ChatGPT. So we delicately leverage that fact.

## How it works
1. Upon page refresh, it replaces the default `fetch` functionality
2. It keeps an eye out for `authorization` tokens which are present in the normal requests involved in loading the ChatGPT page
3. It politely borrows such a token when it finds one and gently shoves it into the browser's `localStorage` using `captured-token` as a key.

This keeps the token handy for various other scripts to make use of, while keeping the data entirely within the browser.
