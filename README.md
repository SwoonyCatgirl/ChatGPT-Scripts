# ChatGPT-Scripts

Some handy ChatGPT scripts to customize your UI experience!

Some of these were the product of necessity as OpenAI decides to rip features out of the interface from time to time. Others are just fun or useful!

## Scripts?

Yes! Tampermonkey userscripts to be more specific.

- [Grab Tampermonkey](https://www.tampermonkey.net/)
- Use the Tampermonkey dashboard to make a new script
- Replace that 'boilerplate' content with whichever script you're interested in here!
- Save it, then go to a new or existing ChatGPT chat and refresh the page.

---

## Here's what we've got

### REQ
This folder contains some necessary logic for piggybacking on data involved in network requests.
- See the `readme` in that directory for more details
- You'll need to have the `token_capture` script up and running for many scripts not denoted as `standalone`

### read_aloud
This was a quick way to restore the "Read Aloud" / TTS button and functionality when OpenAI "accidentally" (?) removed the button. I still keep the script enabled in my browser because:
- It includes a 'stop' button so you can interrupt playback!
- Quick voice switching using a convenient dropdown

### chat_history
Another OpenAI big brain move eliminated the organization of chat history entries by date. I liked the feature. So I brought it back.
