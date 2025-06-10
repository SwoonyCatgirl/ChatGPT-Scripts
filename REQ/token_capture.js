// ==UserScript==
// @name         ChatGPT Token Capture v2
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Capture Bearer token from fetch requests - Required for other scripts
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let bearerToken = localStorage.getItem("captured-token");
    let tokenCapturedThisSession = false;
    let tokenMatchConfirmedLogged = false;

    let tokenPromiseResolve;
    const tokenPromise = new Promise((resolve) => {
        tokenPromiseResolve = resolve;
    });

    const originalFetch = window.fetch;
    window.fetch = async function(resource, config = {}) {
        let authHeader = null;
        let source = null;

        try {
            // console.log("[TokenCapture] Fetch called:", { resource, config });

            // Check resource.headers if resource is a Request object
            if (resource instanceof Request && resource.headers) {
                const headerValue = resource.headers.get("Authorization");
                // console.log("[TokenCapture] Found in resource.headers:", headerValue);
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
                    // console.log("[TokenCapture] Found in config.headers (Headers):", headerValue);
                    if (headerValue && headerValue.startsWith("Bearer ")) {
                        authHeader = headerValue;
                        source = "config.headers (Headers)";
                    }
                } else if (typeof headers === "object") {
                    const headerValue = headers["Authorization"] || headers["authorization"];
                    // console.log("[TokenCapture] Found in config.headers (object):", headerValue);
                    if (headerValue && headerValue.startsWith("Bearer ")) {
                        authHeader = headerValue;
                        source = "config.headers (object)";
                    }
                }
            }

            if (authHeader) {
                if (authHeader !== bearerToken) {
                    bearerToken = authHeader;
                    localStorage.setItem("captured-token", bearerToken);

                    if (!tokenCapturedThisSession) {
                        tokenCapturedThisSession = true;
                        console.log(`[TokenCapture] Token captured from ${source}`);
                        tokenPromiseResolve(bearerToken);
                    }
                } else if (!tokenMatchConfirmedLogged) {
                    tokenMatchConfirmedLogged = true;
                    console.log(`[TokenCapture] Token match confirmed from ${source}`);
                }
            }
        } catch (err) {
            console.warn("[TokenCapture] Error during fetch inspection:", err);
        }

        return originalFetch(resource, config);
    };

    console.log("[TokenCapture] Waiting for token...");

    tokenPromise.then((token) => {
        console.log("[TokenCapture] Token captured and stored!");
        window.fetch = originalFetch;
    });

})();
