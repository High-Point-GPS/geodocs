import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import '../styles/app-styles.css';

import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

const sessionInfo = {};

// The React root is created once and reused so repeated focus() calls (e.g. on global
// group-filter changes) don't spin up new roots.
let appRoot = null;

const showModal = (shouldShow) => {
   	const backdrop = document.getElementById('eula-modal-backdrop');

	if (backdrop) {
		backdrop.style.display = shouldShow ? 'flex' : 'none';
	}
	
    return shouldShow;
};

const handleButtonClick = async (buttonValue, api) => {
    showModal(false);

    if (buttonValue === 'Decline') {
        redirectToDashboard();
    } else if (buttonValue === 'Accept') {
        try {
            // Replace with your actual Firebase endpoint URL
            const endpoint = 'https://us-central1-geotabfiles.cloudfunctions.net/addEulaUser';

            // Get session info if not already available
            const session = sessionInfo.sessionId || (await new Promise(resolve => {
                api.getSession((sess) => resolve(sess.sessionId));
            }));
            const database = sessionInfo.database;
            const username = sessionInfo.userName;

            if (!session || !database || !username) {
                throw new Error('Missing session, database, or username');
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session: sessionInfo,
                    database,
                    username
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            location.reload(true);

        } catch (error) {
            console.error('Error in handleButtonClick:', error);
        }
    }
};

const redirectToDashboard = () => {
    if (sessionInfo.server && sessionInfo.database) {
        window.location.href = `https://${sessionInfo.server}/${sessionInfo.database}/#dashboard`;
    } else {
        console.error('Error: sessionInfo.server or sessionInfo.database is undefined.');
    }
};

/**
 * @returns {{initialize: Function, focus: Function, blur: Function, startup; Function, shutdown: Function}}
 */
geotab.addin.hpgpsFilemanager = function () {
    'use strict';

    // the root container

    return {
        /**
         * initialize() is called only once when the Add-In is first loaded. Use this function to initialize the
         * Add-In's state such as default values or make API requests (MyGeotab or external) to ensure interface
         * is ready for the user.
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         * @param {function} initializeCallback - Call this when your initialize route is complete. Since your initialize routine
         *        might be doing asynchronous operations, you must call this method when the Add-In is ready
         *        for display to the user.
         */
        initialize: function (freshApi, freshState, initializeCallback) {
            // Loading translations if available

            freshApi.getSession((session, server) => {
                Object.assign(sessionInfo, {
                    // Database is always treated lowercase so document lookups are
                    // case-insensitive (Geotab may return the name in any case).
                    database: (session.database || '').toLowerCase(),
                    userName: session.userName,
                    sessionId: session.sessionId,
                    server: server
                });

                // Wire the EULA modal's buttons up front, then hand control straight back to
                // MyGeotab. We deliberately do NOT make a checkEula round trip here: <App>
                // derives EULA acceptance from config.eula (already returned by
                // getDatabaseConfig) and shows this modal afterward only if the user hasn't
                // accepted — so the mount is never blocked on it, and already-accepted users
                // (the common case) pay zero EULA-related latency on load.
                const acceptButton = document.getElementById('eula-accept-button');
                const declineButton = document.getElementById('eula-decline-button');
                if (acceptButton) acceptButton.addEventListener('click', () => handleButtonClick('Accept', freshApi));
                if (declineButton) declineButton.addEventListener('click', () => handleButtonClick('Decline', freshApi));

                // MUST call initializeCallback when done any setup
                initializeCallback();
            });


        },

        /**
         * focus() is called whenever the Add-In receives focus.
         *
         * The first time the user clicks on the Add-In menu, initialize() will be called and when completed, focus().
         * focus() will be called again when the Add-In is revisited. Note that focus() will also be called whenever
         * the global state of the MyGeotab application changes, for example, if the user changes the global group
         * filter in the UI.
         *
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         */
        focus: function (freshApi, freshState) {
            // Alert emails deep-link as #addin-...,fileId:<id>; MyGeotab hands those
            // URL params to the add-in through state (the iframe can't see the hash).
            let deepLinkFileId = null;
            try {
                const pageState = freshState && typeof freshState.getState === 'function' ? freshState.getState() : {};
                deepLinkFileId = pageState && pageState.fileId ? String(pageState.fileId) : null;
            } catch (e) {
                deepLinkFileId = null;
            }

            // getting the current user to display in the UI
            const mount = (session, server) => {
                // show main content
                const container = document.getElementById('app');
                if (!container) return;

                container.style.display = 'block';

                // Create the root once; re-render into it on later focus() calls.
                if (!appRoot) {
                    appRoot = createRoot(container);
                }
                appRoot.render(
                    <App
                        api={freshApi}
                        database={(session.database || '').toLowerCase()}
                        session={session}
                        server={server}
                        deepLinkFileId={deepLinkFileId}
                        onRequireEula={() => showModal(true)}
                    />
                );
            };

            // initialize() already resolved the session into sessionInfo before MyGeotab
            // could call focus() (it gates focus on initializeCallback, which fires inside
            // the initialize getSession callback). Reuse it so we don't pay a second
            // getSession round trip before the first render. Fall back to a fresh
            // getSession only if sessionInfo somehow isn't populated yet.
            if (sessionInfo.sessionId) {
                mount(sessionInfo, sessionInfo.server);
            } else {
                freshApi.getSession((session, server) => mount(session, server));
            }
        },

        /**
         * blur() is called whenever the user navigates away from the Add-In.
         *
         * Use this function to save the page state or commit changes to a data store or release memory.
         *
         * @param {object} freshApi - The GeotabApi object for making calls to MyGeotab.
         * @param {object} freshState - The page state object allows access to URL, page navigation and global group filter.
         */
        blur: function () {
            // hide main content
            // try to remove popup
            const popup = document.querySelector('.MuiDialog-root');

            if (popup) {
                popup.remove();
            }
        },
    };
};
