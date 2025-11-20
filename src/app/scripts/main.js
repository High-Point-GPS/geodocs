import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import '../styles/app-styles.css';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

const sessionInfo = {};

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

const isEulaAccepted = async (userName) => {
    const endpoint = 'https://us-central1-geotabfiles.cloudfunctions.net/checkEula';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session: sessionInfo,
                database: sessionInfo.database,
                username: userName
            })
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        return !!data.eulaAccepted;
    } catch (error) {
        console.error('Failed to check EULA acceptance:', error);
        return false;
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

            freshApi.getSession(async (session, server) => {
                    Object.assign(sessionInfo, {
                    database: session.database,
                    userName: session.userName,
                    sessionId: session.sessionId,
                    server: server
                });

                const eulaAcceptanceStatus = await isEulaAccepted(sessionInfo.userName);

                if (!eulaAcceptanceStatus) {
                    showModal(true);
                } else {
                    showModal(false);
                }

                
				const acceptButton = document.getElementById('eula-accept-button');
				const declineButton = document.getElementById('eula-decline-button');
				acceptButton.addEventListener('click', () => handleButtonClick('Accept', freshApi));
				declineButton.addEventListener('click', () => handleButtonClick('Decline', freshApi));

                    
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
            // getting the current user to display in the UI
            freshApi.getSession(async (session, server) => {
                // show main content
                const container = document.getElementById('app');

                container.style.display = 'block';
                const eulaAcceptanceStatus = await isEulaAccepted(sessionInfo.userName);

                if (container && eulaAcceptanceStatus) {
                    const root = createRoot(container);
                    root.render(<App api={freshApi} database={session.database} session={session} server={server} />);
                }
            });
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
            const container = document.getElementById('app');

                container.style.display = 'none';
        },
    };
};
