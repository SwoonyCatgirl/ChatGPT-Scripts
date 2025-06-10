# Dependencies

The token capture script is required for many other scripts in this repo which aren't `standalone` scripts.

This is the case because a variety of logic involves fetch requests which need a bearer token. The capture script handles that, and tucks a copy of it away in `localStorage` using the `captured-token` key on each page refresh, making it available to other scripts which need it.
