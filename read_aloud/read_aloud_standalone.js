// ==UserScript==
// @name         ChatGPT Read-Aloud++ v3 - Standalone
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Adds a play audio button and voice selector dropdown to ChatGPT assistant messages.
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // --- Standalone: Token Capture Logic ---
    let bearerToken = null;
    let tokenCapturedThisSession = false;

    let tokenPromiseResolve;
    const tokenPromise = new Promise((resolve) => {
        tokenPromiseResolve = resolve;
    });

    const originalFetch = window.fetch;
    window.fetch = async function(resource, config = {}) {
        let authHeader = null;
        let source = null;

        try {
            
            // Check resource.headers if resource is a Request object
            if (resource instanceof Request && resource.headers) {
                const headerValue = resource.headers.get("Authorization");
                if (headerValue && headerValue.startsWith("Bearer ")) {
                    authHeader = headerValue;
                    source = "resource.headers";
                }
            }

            // Check config.headers as well
            const headers = config.headers;
            if (!authHeader && headers) {
                if (headers instanceof Headers) {
                    const headerValue = headers.get("Authorization");
                    if (headerValue && headerValue.startsWith("Bearer ")) {
                        authHeader = headerValue;
                        source = "config.headers (Headers)";
                    }
                } else if (typeof headers === "object") {
                    const headerValue = headers["Authorization"] || headers["authorization"];
                    if (headerValue && headerValue.startsWith("Bearer ")) {
                        authHeader = headerValue;
                        source = "config.headers (object)";
                    }
                }
            }

            if (authHeader) {
                if (authHeader !== bearerToken) {
                    bearerToken = authHeader;
                    if (!tokenCapturedThisSession) {
                        tokenCapturedThisSession = true;
                        console.log(`[TokenCapture] Token captured from ${source}`);
                        tokenPromiseResolve(bearerToken);
                    }
                }
            }
        } catch (err) {
            console.warn("[TokenCapture] Error during fetch inspection:", err);
        }

        return originalFetch(resource, config);
    };

    console.log("[TokenCapture] Waiting for token...");

    tokenPromise.then((token) => {
        console.log("[TokenCapture] Token captured!");
        window.fetch = originalFetch;
    });
    // --- End Token Capture Logic ---

    const VOICE_STORAGE_KEY = 'tm-selected-voice';
    let availableVoices = [];
    let selectedVoice = null;
    const dropdowns = new Set();

    const PLAY_ICON_PATH = "M8 5v14l11-7z";
    const STOP_ICON_PATH = "M6 6h12v12H6z";
    const DROPDOWN_ICON_PATH = "M7 10l5 5 5-5z";
    const SPINNER_SVG = `<svg width="24" height="24" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
        <circle cx="50" cy="50" r="32" stroke-width="8" stroke="#999" stroke-dasharray="50.2655 50.2655" fill="none" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1"></animateTransform>
        </circle>
    </svg>`;

    let currentAudio = null;

    async function fetchVoices() {
        try {
            const res = await fetch("https://chatgpt.com/backend-api/settings/voices", {
                method: "GET",
                credentials: "include",
                headers: {
                    "authorization": bearerToken,
                },
            });

            const json = await res.json();
            availableVoices = json.voices;
            selectedVoice = localStorage.getItem(VOICE_STORAGE_KEY) || json.selected;
        } catch (e) {
            console.error("[Voice Fetch Error]", e);
        }
    }

    function createAudioButton(messageId) {
        const button = document.createElement("button");
        const playIcon = document.createElement("div");
        playIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="${PLAY_ICON_PATH}" fill="currentColor"/></svg>`;
        button.appendChild(playIcon);
        button.className = "tm-play-button text-token-text-secondary hover:bg-token-bg-secondary rounded-lg";
        button.title = "Play Audio";
        button.style.marginLeft = "4px";

        button.onclick = async () => {
            if (currentAudio && !currentAudio.paused) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
                playIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="${PLAY_ICON_PATH}" fill="currentColor"/></svg>`;
                return;
            }

            const originalHTML = playIcon.innerHTML;
            playIcon.innerHTML = SPINNER_SVG;

            try {
                const conversationId = window.location.pathname.split('/').pop();
                const voice = localStorage.getItem(VOICE_STORAGE_KEY) || selectedVoice || 'glimmer';
                const url = `https://chatgpt.com/backend-api/synthesize?message_id=${messageId}&conversation_id=${conversationId}&voice=${voice}&format=aac`;

                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "accept": "*/*",
                        "authorization": bearerToken,
                    },
                    credentials: "include",
                });

                const blob = await response.blob();
                const audioURL = URL.createObjectURL(blob);
                currentAudio = new Audio(audioURL);

                currentAudio.addEventListener("ended", () => {
                    playIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="${PLAY_ICON_PATH}" fill="currentColor"/></svg>`;
                    currentAudio = null;
                });

                currentAudio.play();
                playIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="${STOP_ICON_PATH}" fill="currentColor"/></svg>`;
            } catch (err) {
                console.error("Audio fetch/play failed:", err);
                playIcon.innerHTML = originalHTML;
            }
        };

        return button;
    }

    function updateAllDropdowns() {
        dropdowns.forEach(dropdown => {
            Array.from(dropdown.children).forEach(option => {
                const isSelected = option.dataset.voice === selectedVoice;
                option.style.fontWeight = isSelected ? "bold" : "normal";
                option.style.background = isSelected ? "#2a2a2a" : "transparent";
            });
        });
    }

    function createVoiceDropdown(triggerButton) {
        const dropdown = document.createElement("div");
        dropdown.style.position = "fixed";
        dropdown.style.background = "var(--token-bg-primary, #1e1e1e)";
        dropdown.style.border = "1px solid #333";
        dropdown.style.color = "#fff";
        dropdown.style.zIndex = "9999";
        dropdown.style.display = "none";
        dropdown.style.minWidth = "120px";
        dropdown.style.boxShadow = "0px 4px 10px rgba(0,0,0,0.5)";
        dropdown.style.borderRadius = "6px";
        dropdown.style.padding = "4px 0";

        availableVoices.forEach(voice => {
            const option = document.createElement("div");
            option.textContent = voice.name;
            option.dataset.voice = voice.voice;
            option.style.padding = "6px 12px";
            option.style.cursor = "pointer";
            option.style.fontSize = "14px";
            option.style.color = "#eee";
            option.style.transition = "background 0.2s";
            if (voice.voice === selectedVoice) {
                option.style.fontWeight = "bold";
                option.style.background = "#2a2a2a";
            }
            option.onmouseenter = () => option.style.background = "#333";
            option.onmouseleave = () => option.style.background = voice.voice === selectedVoice ? "#2a2a2a" : "transparent";
            option.onclick = () => {
                localStorage.setItem(VOICE_STORAGE_KEY, voice.voice);
                selectedVoice = voice.voice;
                dropdown.style.display = "none";
                updateAllDropdowns();
                console.log("Voice changed to:", voice.voice);
            };
            dropdown.appendChild(option);
        });

        triggerButton.onclick = (e) => {
            e.stopPropagation();
            const rect = triggerButton.getBoundingClientRect();
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.top = `${rect.bottom + 4}px`;
            dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        };

        document.body.appendChild(dropdown);
        dropdowns.add(dropdown);
        document.body.addEventListener("click", () => dropdown.style.display = "none");
    }

    function addButtonsToMessages() {
        document.querySelectorAll("[data-message-id]").forEach(messageEl => {
            const messageId = messageEl.getAttribute("data-message-id");
            const role = messageEl.getAttribute("data-message-author-role");
            if (role !== "assistant") return;

            const container = messageEl.parentElement?.nextElementSibling?.querySelector("div.flex.items-center");
            if (container && !container.querySelector(".tm-play-button")) {
                container.appendChild(createAudioButton(messageId));

                const voiceBtn = document.createElement("button");
                voiceBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="${DROPDOWN_ICON_PATH}" fill="currentColor"/></svg>`;
                voiceBtn.className = "tm-voice-button text-token-text-secondary hover:bg-token-bg-secondary rounded-lg";
                voiceBtn.title = "Select Voice";
                voiceBtn.style.marginLeft = "4px";

                container.appendChild(voiceBtn);
                createVoiceDropdown(voiceBtn);
            }
        });
    }

    async function init() {
        await fetchVoices();
        addButtonsToMessages();
        const observer = new MutationObserver(() => addButtonsToMessages());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Wait for token before running main logic
    tokenPromise.then(() => {
        init();
    });
})();
