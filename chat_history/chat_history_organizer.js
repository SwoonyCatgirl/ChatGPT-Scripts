// ==UserScript==
// @name         ChatGPT Chat History Organizer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Organize ChatGPT chat history sidebar by date with friendly dark mode separators
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURABLES ---
    const SIDEBAR_SELECTOR = '#history aside';
    const CHAT_LINK_SELECTOR = 'a[href^="/c/"]';
    const SEPARATOR_CLASS = 'tm-date-separator';
    const FETCH_URL = 'https://chatgpt.com/backend-api/conversations?order=updated';

    // Smarter fetch logic
    const DEFAULT_LIMIT = 50;      // On page load
    const NEW_CHAT_LIMIT = 5;      // When a new chat is created
    const SCROLL_BATCH_SIZE = 28;  // When sidebar is scrolled to load more
    const SAFETY_CAP = 1000;

    // --- STYLE INJECTION ---
    function injectStyles() {
        if (document.getElementById('tm-date-separator-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-date-separator-style';
        style.textContent = `
            .${SEPARATOR_CLASS} {
                background: #303030;
                color: #ececec;
                font-weight: bold;
                font-size: 0.95em;
                border-bottom: 2px solid rgba(68,68,68,0.6);
                padding: 6px 16px;
                margin: 8px 0 4px 0;
                border-radius: 6px;
                letter-spacing: 0.02em;
                user-select: none;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    // --- DATE GROUPING LOGIC ---
    function getDateGroup(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (now.toDateString() === date.toDateString()) return 'Today';
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (yesterday.toDateString() === date.toDateString()) return 'Yesterday';
        if (diffDays < 7) return 'Last 7 Days';
        if (now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth()) return 'This Month';
        if (now.getFullYear() === date.getFullYear()) return 'This Year';
        return 'Older';
    }

    // --- FETCH CHAT METADATA ---
    // Refactored: fetchChats accepts offset and limit, and can fetch a single batch or multiple if needed
    async function fetchChats(offset = 0, limit = DEFAULT_LIMIT, fetchAll = false, safetyCap = SAFETY_CAP) {
        const token = localStorage.getItem('captured-token');
        if (!token) return [];
        let allChats = [];
        let total = 0;
        let first = true;
        do {
            const url = `${FETCH_URL}&offset=${offset}&limit=${limit}`;
            const resp = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Authorization': token,
                    'Accept': '*/*'
                },
                method: 'GET',
                mode: 'cors'
            });
            if (!resp.ok) break;
            const data = await resp.json();
            if (!data.items) break;
            allChats = allChats.concat(data.items);
            total = data.total || 0;
            offset += limit;
            // Only loop if fetchAll is true
            if (!fetchAll) break;
            first = false;
        } while (allChats.length < total && offset < safetyCap);
        return allChats;
    }

    // --- ORGANIZE SIDEBAR ---
    function organizeSidebar(chatsById) {
        //console.log('organizeSidebar called');
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        // Remove old separators
        sidebar.querySelectorAll(`.${SEPARATOR_CLASS}`).forEach(el => el.remove());
        //console.log('Separators removed');

        // Gather chat links and map to metadata
        const chatLinks = Array.from(sidebar.querySelectorAll(CHAT_LINK_SELECTOR));
        //console.log('Sidebar chat link hrefs:', chatLinks.map(l => l.getAttribute('href')));
        const chatLinkUUIDs = chatLinks.map(link => (link.getAttribute('href') || '').split('/c/')[1]);
        //console.log('Sidebar chat link UUIDs:', chatLinkUUIDs);

        const chatsByIdKeys = Object.keys(chatsById);
        //console.log('chatsById UUIDs:', chatsByIdKeys);

        const chatItems = chatLinks.map(link => {
            const uuid = (link.getAttribute('href') || '').split('/c/')[1];
            const meta = chatsById[uuid];
            if (!meta) {
                //console.warn('Chat link skipped (not in chatsById):', uuid, link);
            }
            return meta ? { link, meta } : null;
        }).filter(Boolean);
        //console.log('organizeSidebar: chatItems.length =', chatItems.length);

        // Sort by update_time descending (most recent first)
        chatItems.sort((a, b) => new Date(b.meta.update_time) - new Date(a.meta.update_time));

        // Log the sorted chatItems with update_time and group (debugging)
//         console.log('Sorted chatItems (UUID, update_time, group):', chatItems.map(({ link, meta }) => ({
//             uuid: (link.getAttribute('href') || '').split('/c/')[1],
//             update_time: meta.update_time,
//             group: getDateGroup(meta.update_time)
//         })));

        // Insert separators
        let lastGroup = null;
        chatItems.forEach(({ link, meta }, idx) => {
            const group = getDateGroup(meta.update_time);
            if (group !== lastGroup) {
                const sep = document.createElement('div');
                sep.className = SEPARATOR_CLASS;
                sep.textContent = group;
                link.parentNode.insertBefore(sep, link);
                lastGroup = group;
            }
        });
        //console.log('Separators inserted');
    }

    // --- MAIN LOGIC ---
    // Persistent map of all chats by ID
    let allChatsById = {};
    let sidebarObserver = null;

    // Smarter refresh logic: accepts mode and sidebar state
    async function refreshAndOrganizeSidebar(mode = "initial", prevSidebarCount = 0) {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        let chats = [];
        if (mode === "initial") {
            // On page load: fetch first DEFAULT_LIMIT
            chats = await fetchChats(0, DEFAULT_LIMIT, false);
        } else if (mode === "new_chat") {
            // On new chat: fetch a small batch from the top
            chats = await fetchChats(0, NEW_CHAT_LIMIT, false);
        } else if (mode === "scroll") {
            // On scroll: fetch next batch based on sidebar count
            const currentCount = sidebar ? sidebar.querySelectorAll(CHAT_LINK_SELECTOR).length : 0;
            chats = await fetchChats(currentCount, SCROLL_BATCH_SIZE, false);
        } else {
            // Fallback: fetch all (legacy)
            chats = await fetchChats(0, DEFAULT_LIMIT, true);
        }
        if (!chats.length) return;
        // Map by UUID
        // Merge new chats into persistent allChatsById
        chats.forEach(chat => {
            allChatsById[chat.id] = chat;
        });
        organizeSidebar(allChatsById);
    }

    async function main() {
        console.log("[ChatHistory] Running!");
        injectStyles();

        // Wait for sidebar to be present
        let sidebar;
        for (let i = 0; i < 30; i++) {
            sidebar = document.querySelector(SIDEBAR_SELECTOR);
            if (sidebar) break;
            await new Promise(r => setTimeout(r, 300));
        }
        if (!sidebar) return;

        // Initial organization
        await refreshAndOrganizeSidebar("initial");

        // Track previous sidebar state for smarter detection
        let prevSidebarCount = sidebar.querySelectorAll(CHAT_LINK_SELECTOR).length;

        // MutationObserver for dynamic updates
        sidebarObserver = new MutationObserver(async (mutationsList) => {
            //console.log('MutationObserver fired');
            if (sidebarObserver) sidebarObserver.disconnect();

            // Re-query sidebar and count
            const sidebarNow = document.querySelector(SIDEBAR_SELECTOR);
            const chatLinksNow = sidebarNow ? sidebarNow.querySelectorAll(CHAT_LINK_SELECTOR) : [];
            const currentCount = chatLinksNow.length;

            // Detect event type
            let mode = "initial";
            if (currentCount > prevSidebarCount) {
                // More entries: likely a scroll
                mode = "scroll";
            } else if (currentCount === prevSidebarCount + 1) {
                // One new entry: likely a new chat
                mode = "new_chat";
            } else {
                // Fallback to initial
                mode = "initial";
            }

            await refreshAndOrganizeSidebar(mode, prevSidebarCount);

            // Update previous count
            prevSidebarCount = sidebarNow ? sidebarNow.querySelectorAll(CHAT_LINK_SELECTOR).length : 0;

            if (sidebarObserver) sidebarObserver.observe(sidebarNow, { childList: true, subtree: true });
        });
        sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    }

    // Run main logic after DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
