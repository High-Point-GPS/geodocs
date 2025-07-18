import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import '../styles/app.css';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';



const sessionInfo = {};
const addinId = 'amE0ZGVhYmYtZDQ5NS0xNGN';


const elements = {
    eulaModalBackdrop: document.getElementById('eula-modal-backdrop'),
    eulaModal: document.getElementById('eula-modal'),
    eulaMessageDiv: document.getElementById('eula-message'),
    acceptButton: document.getElementById('eula-accept-button'),
    declineButton: document.getElementById('eula-decline-button'),
    //mainUiDiv: document.getElementById('main-ui')
};

const showModal = (shouldShow) => {
    elements.eulaModalBackdrop.style.display = shouldShow ? 'flex' : 'none';
    return shouldShow;
};

const handleButtonClick = async (buttonValue, api) => {
    showModal(false);

    if (buttonValue === 'Decline') {
        redirectToDashboard();
    } else if (buttonValue === 'Accept') {
        try {
            const currentDate = new Date().toISOString();
            await addAddinData(addinId, { userName: sessionInfo.userName, acceptedDate: currentDate }, api);
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

const isEulaAccepted = (userName, addinId, api) => {
    return new Promise((resolve, reject) => {
        api.call('Get', {
            'typeName': 'AddInData',
            'search': { 'addInId': addinId, 'selectClause': 'acceptedDate', 'whereClause': `userName = "${userName}"` }
        }, (result) => {
            if (result.length > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        }, (error) => {
            console.error('Failed to get EULA acceptance:', error);
            reject(error);
        });
    });
};

const addAddinData = async (addInId, details, api) => {
    try {
        await new Promise((resolve, reject) => {
            api.call('Add', {
                'typeName': 'AddInData',
                'entity': { 'addInId': addInId, 'details': details }
            }, (res, err) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    } catch (error) {
        console.error('Error adding add-in data:', error);
        throw error;
    }
};


/**
 * @returns {{initialize: Function, focus: Function, blur: Function, startup; Function, shutdown: Function}}
 */
geotab.addin.hpgpsFilemanager = function () {
    'use strict';

    // the root container
    var elAddin = document.getElementById('hpgpsFilemanager');

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
            if (freshState.translate) {
                freshState.translate(elAddin || '');
            }

            // freshApi.getSession(async (session, server) => {
            //         Object.assign(sessionInfo, {
            //         database: session.database,
            //         userName: session.userName,
            //         sessionId: session.sessionId,
            //         server: server
            //     });

            //     // const eulaAcceptanceStatus = await isEulaAccepted(sessionInfo.userName, addinId, api);

            //     // if (!eulaAcceptanceStatus) {
            //     //     showModal(true);
            //     // } else {
            //     //     showModal(false);
            //     // }


            // });

            // elements.acceptButton.addEventListener('click', () => handleButtonClick('Accept', api));
            // elements.declineButton.addEventListener('click', () => handleButtonClick('Decline', api));
            // MUST call initializeCallback when done any setup
            initializeCallback();
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
                elAddin.querySelector('#hpgpsFilemanager-user').textContent = session.userName;

                elAddin.className = '';
                // show main content
                const container = document.getElementById('app');

                // const eulaAcceptanceStatus = await isEulaAccepted(sessionInfo.userName, addinId, api);
                const eulaAcceptanceStatus = true;
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
            elAddin.className += ' hidden';
        },
    };
};
