// ==UserScript==
// @name         ChatGPT Sidebar Chat Title Blur
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Blur chat history entry titles in the ChatGPT sidebar for anonymized demos
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SIDEBAR_SELECTOR = '#history aside';

    // Inject blur CSS
    function injectStyles() {
        if (document.getElementById('tm-blur-title-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-blur-title-style';
        style.textContent = `
        .tm-blur-title {
            filter: blur(4px) !important;
            transition: filter 0.2s;
        }`;
        document.head.appendChild(style);
    }

    // Function to blur all chat titles
    function blurTitles() {
        document.querySelectorAll('.truncate > span').forEach(el => {
            el.classList.add('tm-blur-title');
        });
    }

    async function main() {
        injectStyles();

        // Wait for sidebar to be present (up to 30 tries, 300ms apart)
        let sidebar;
        for (let i = 0; i < 30; i++) {
            sidebar = document.querySelector(SIDEBAR_SELECTOR);
            if (sidebar) break;
            await new Promise(r => setTimeout(r, 300));
        }
        if (!sidebar) return;

        // Initial blur
        blurTitles();

        // Observe sidebar for changes
        const observer = new MutationObserver(() => {
            blurTitles();
        });
        observer.observe(sidebar, { childList: true, subtree: true });
    }

    // Run main logic after DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
