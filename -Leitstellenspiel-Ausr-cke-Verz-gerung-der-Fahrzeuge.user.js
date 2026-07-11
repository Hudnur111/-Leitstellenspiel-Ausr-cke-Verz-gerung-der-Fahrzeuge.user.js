// ==UserScript==
// @name         Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache
// @namespace    https://www.leitstellenspiel.de/
// @version      4.0.0
// @description  Zeigt Fahrzeuge der aktuellen Wache, ermöglicht die Konfiguration einer Ausrückverzögerung pro Fahrzeug und verzögert das tatsächliche Alarmieren im Spiel um die eingestellte Zeit.
// @author       Hudnur111 - IBoy - Coding Crew Tag 1
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://www.leitstellenspiel.de/missions/*
// @icon         https://cdn-icons-png.flaticon.com/512/3135/3135715.png
// @license      GPL-3.0-or-later
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

// Betatester: m7e

(function () {
    'use strict';

    if (window.__lssAusrueckverzoegerungLoaded) return;
    window.__lssAusrueckverzoegerungLoaded = true;

    // ---------------------------------------------------------------------
    // Skriptinformationen / Update-Check
    // ---------------------------------------------------------------------
    const SCRIPT_NAME = 'Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache';
    const CURRENT_VERSION = '4.0.0';
    const UPDATE_URL = 'https://github.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js/raw/main/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js';
    const VERSION_URL = 'https://raw.githubusercontent.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge/main/version.txt';
    const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // alle 6 Stunden, nicht bei jedem Seitenaufruf
    const LAST_CHECK_KEY = 'lss_avz_last_update_check';

    function checkForUpdate() {
        if (typeof GM_xmlhttpRequest !== 'function') return;

        const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
        if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
        localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

        GM_xmlhttpRequest({
            method: 'GET',
            url: VERSION_URL,
            onload(response) {
                if (response.status === 200) {
                    const latestVersion = response.responseText.trim();
                    if (latestVersion && latestVersion !== CURRENT_VERSION) {
                        notifyUserForUpdate(latestVersion);
                    }
                } else {
                    console.warn(`[${SCRIPT_NAME}] Versionsprüfung fehlgeschlagen: ${response.status} ${response.statusText}`);
                }
            },
            onerror() {
                console.warn(`[${SCRIPT_NAME}] Versionsprüfung: Server nicht erreichbar.`);
            }
        });
    }

    function notifyUserForUpdate(latestVersion) {
        if (typeof GM_notification !== 'function') return;
        GM_notification({
            text: `${SCRIPT_NAME} (Version ${latestVersion}) ist verfügbar. Jetzt aktualisieren!`,
            title: 'Neue Version verfügbar',
            onclick() {
                window.open(UPDATE_URL, '_blank');
            }
        });
    }

    // ---------------------------------------------------------------------
    // Verzögerungs-Speicher (localStorage, da das Spiel selbst keine
    // Ausrückverzögerung kennt - diese wird ausschließlich clientseitig
    // durch dieses Skript simuliert)
    // ---------------------------------------------------------------------
    const DELAY_KEY_PREFIX = 'lss_avz_delay_v1_';
    const LEGACY_KEY_PREFIX = 'verzögerung-';
    const MAX_DELAY_SECONDS = 900; // Sicherheitsobergrenze: 15 Minuten

    // Alte, unpräfixte Keys (Version <= 3.1) einmalig übernehmen, damit
    // bestehende Einstellungen der Nutzer nicht verloren gehen.
    function migrateLegacyDelays() {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LEGACY_KEY_PREFIX)) continue;
            const vehicleId = key.slice(LEGACY_KEY_PREFIX.length);
            const newKey = DELAY_KEY_PREFIX + vehicleId;
            if (localStorage.getItem(newKey) === null) {
                localStorage.setItem(newKey, localStorage.getItem(key));
            }
            localStorage.removeItem(key);
        }
    }

    function getDelaySeconds(vehicleId) {
        const raw = localStorage.getItem(DELAY_KEY_PREFIX + vehicleId);
        const value = Number.parseInt(raw, 10);
        if (!Number.isFinite(value) || value < 0) return 0;
        return Math.min(value, MAX_DELAY_SECONDS);
    }

    function setDelaySeconds(vehicleId, delay) {
        const value = Number.parseInt(delay, 10);
        const clamped = Number.isFinite(value) && value > 0 ? Math.min(value, MAX_DELAY_SECONDS) : 0;
        localStorage.setItem(DELAY_KEY_PREFIX + vehicleId, String(clamped));
        return clamped;
    }

    // ---------------------------------------------------------------------
    // Sidebar zur Konfiguration der Verzögerungen (nur auf /buildings/*)
    // ---------------------------------------------------------------------
    async function loadFahrzeuge() {
        const match = window.location.pathname.match(/^\/buildings\/(\d+)/);
        if (!match) return;
        const wacheId = Number(match[1]);

        try {
            const response = await fetch('/api/vehicles', { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`Fehler beim Abrufen der Fahrzeuge: ${response.status} ${response.statusText}`);

            const alleFahrzeuge = await response.json();
            if (!Array.isArray(alleFahrzeuge)) {
                throw new Error('Unerwartetes Antwortformat der Fahrzeug-API.');
            }

            const fahrzeuge = alleFahrzeuge
                .filter(fz => Number(fz.building_id) === wacheId)
                .sort((a, b) => (a.caption || '').localeCompare(b.caption || ''));

            if (fahrzeuge.length === 0) {
                console.info(`[${SCRIPT_NAME}] Keine Fahrzeuge für Wache ${wacheId} gefunden.`);
                return;
            }

            createSidebar(fahrzeuge);
        } catch (error) {
            console.error(`[${SCRIPT_NAME}] Fehler beim Laden der Fahrzeuge:`, error);
        }
    }

    function createSidebar(fahrzeuge) {
        const toggleButton = document.createElement('button');
        toggleButton.id = 'avzToggleButton';
        toggleButton.type = 'button';
        toggleButton.textContent = '🚒 Fahrzeugeinstellungen';
        document.body.appendChild(toggleButton);

        const sidebar = document.createElement('div');
        sidebar.id = 'vehicleSidebar';
        sidebar.style.display = 'none';
        sidebar.innerHTML = `
            <div class="avz-header">
                <h4>Fahrzeug-Ausrück-Verzögerung</h4>
                <button type="button" id="avzCloseButton" aria-label="Schließen">&times;</button>
            </div>
            <p class="avz-hint">Verzögerung in Sekunden je Fahrzeug. Bei 0 wird sofort alarmiert.</p>
            <div id="fahrzeugVerzoegerungList"></div>
            <button class="btn btn-primary" id="saveDelays">Speichern</button>
            <span id="saveFeedback" class="avz-feedback" style="display:none;">Verzögerungen erfolgreich gespeichert!</span>
        `;
        document.body.appendChild(sidebar);

        const fahrzeugList = sidebar.querySelector('#fahrzeugVerzoegerungList');

        fahrzeuge.forEach(fz => {
            const label = fz.vehicle_type_caption || fz.caption || `Fahrzeug #${fz.id}`;
            const fzItem = document.createElement('div');
            fzItem.className = 'form-group';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.setAttribute('for', `avz-fz-${fz.id}`);

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-control delayInput';
            input.id = `avz-fz-${fz.id}`;
            input.min = '0';
            input.max = String(MAX_DELAY_SECONDS);
            input.placeholder = 'Verzögerung in Sekunden';
            input.value = String(getDelaySeconds(fz.id));
            input.dataset.vehicleId = String(fz.id);

            fzItem.appendChild(labelEl);
            fzItem.appendChild(input);
            fahrzeugList.appendChild(fzItem);
        });

        sidebar.querySelector('#saveDelays').addEventListener('click', () => saveDelays(fahrzeuge));
        sidebar.querySelector('#avzCloseButton').addEventListener('click', () => {
            sidebar.style.display = 'none';
        });

        toggleButton.addEventListener('click', () => {
            sidebar.style.display = (sidebar.style.display === 'none') ? 'block' : 'none';
        });

        fahrzeugList.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('delayInput')) {
                e.preventDefault();
                saveDelays(fahrzeuge);
            }
        });
    }

    function saveDelays(fahrzeuge) {
        fahrzeuge.forEach(fz => {
            const input = document.getElementById(`avz-fz-${fz.id}`);
            if (!input) return;
            const clamped = setDelaySeconds(fz.id, input.value);
            input.value = String(clamped);
        });

        const feedback = document.getElementById('saveFeedback');
        feedback.style.display = 'inline';
        setTimeout(() => { feedback.style.display = 'none'; }, 2000);
    }

    // ---------------------------------------------------------------------
    // Ausrück-Interceptor: verzögert das tatsächliche Alarmieren
    //
    // Leitstellenspiel kennt serverseitig keine Ausrückverzögerung - das
    // Spiel löst die Alarmierung eines Fahrzeugs über einen AJAX-Link
    // (Rails-UJS, `data-remote="true"`) auf `/vehicles/<id>/...` aus, z.B.
    // beim Rückalarmieren `/vehicles/<id>/backalarm?return=mission`. Der
    // Interceptor fängt den Klick auf einen solchen Alarmieren-Link ab,
    // zeigt einen Countdown an und löst den echten Klick erst danach aus,
    // damit Rails-UJS die Anfrage wie gewohnt verarbeitet.
    //
    // Hinweis: Ohne Zugriff auf einen eingeloggten Testaccount konnte der
    // exakte href-Aufbau des "Alarmieren"-Links nicht live verifiziert
    // werden. Greift die Erkennung nicht, passiert nichts Schädliches -
    // das Fahrzeug rückt einfach ohne Verzögerung aus wie bisher. Über
    // `window.__lssAvzDebug = true` in der Konsole lässt sich mitloggen,
    // welche Links erkannt/ignoriert werden, um den Selektor bei Bedarf
    // anzupassen.
    // ---------------------------------------------------------------------
    const pendingLinks = new WeakSet();
    const bypassLinks = new WeakSet();

    function extractVehicleId(href) {
        const match = href.match(/\/vehicles\/(\d+)/);
        return match ? match[1] : null;
    }

    function isDispatchLink(link) {
        if (!(link instanceof HTMLAnchorElement)) return false;
        const href = link.getAttribute('href') || '';
        if (!/\/vehicles\/\d+/.test(href)) return false;
        if (/backalarm|zurueck|recall/i.test(href)) return false; // Rückalarmierung ausschließen
        return /alarm/i.test(href);
    }

    function debugLog(...args) {
        if (window.__lssAvzDebug) console.log(`[${SCRIPT_NAME}]`, ...args);
    }

    function showCountdownBadge(link, seconds, onCancel) {
        const badge = document.createElement('span');
        badge.className = 'avz-countdown-badge';
        let remaining = seconds;
        badge.textContent = ` (Ausrücken in ${remaining}s) `;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'avz-countdown-cancel';
        cancelBtn.textContent = 'Abbrechen';
        badge.appendChild(cancelBtn);

        link.insertAdjacentElement('afterend', badge);

        const interval = setInterval(() => {
            remaining -= 1;
            badge.firstChild.textContent = ` (Ausrücken in ${Math.max(remaining, 0)}s) `;
        }, 1000);

        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearInterval(interval);
            badge.remove();
            onCancel();
        });

        return {
            remove() {
                clearInterval(interval);
                badge.remove();
            }
        };
    }

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link) return;

        if (bypassLinks.has(link)) {
            bypassLinks.delete(link);
            debugLog('Verzögerter Klick wird durchgelassen:', link.href);
            return; // Diesen Klick unverändert durchlassen (echte Alarmierung)
        }

        if (!isDispatchLink(link)) {
            debugLog('Kein Alarmieren-Link, ignoriert:', link.getAttribute('href'));
            return;
        }

        const vehicleId = extractVehicleId(link.getAttribute('href') || '');
        if (!vehicleId) return;

        const delay = getDelaySeconds(vehicleId);
        if (delay <= 0) {
            debugLog(`Fahrzeug ${vehicleId}: keine Verzögerung konfiguriert.`);
            return;
        }

        if (pendingLinks.has(link)) {
            // Bereits ein Countdown für diesen Link aktiv - weiteren Klick ignorieren
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        pendingLinks.add(link);
        debugLog(`Fahrzeug ${vehicleId}: Alarmierung wird um ${delay}s verzögert.`);

        const timeoutId = setTimeout(() => {
            pendingLinks.delete(link);
            bypassLinks.add(link);
            link.click();
        }, delay * 1000);

        showCountdownBadge(link, delay, () => {
            clearTimeout(timeoutId);
            pendingLinks.delete(link);
            debugLog(`Fahrzeug ${vehicleId}: Verzögerte Alarmierung abgebrochen.`);
        });
    }, true); // Capture-Phase: läuft vor dem Rails-UJS-Handler des Spiels

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------
    GM_addStyle(`
        #avzToggleButton {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background-color: #007bff;
            color: #fff;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            cursor: pointer;
        }
        #avzToggleButton:hover {
            background-color: #0056b3;
        }
        #vehicleSidebar {
            position: fixed;
            top: 100px;
            right: 10px;
            width: 350px;
            max-height: 70vh;
            overflow-y: auto;
            background-color: #f8f9fa;
            color: #212529;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 15px 20px 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        #vehicleSidebar .avz-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        #vehicleSidebar .avz-header h4 {
            margin: 0;
        }
        #avzCloseButton {
            background: none;
            border: none;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            color: #666;
        }
        #avzCloseButton:hover {
            color: #000;
        }
        #vehicleSidebar .avz-hint {
            font-size: 12px;
            color: #666;
            margin: 8px 0 12px;
        }
        #vehicleSidebar input {
            margin-bottom: 10px;
        }
        .btn-primary {
            background-color: #007bff;
            border-color: #007bff;
            padding: 8px 16px;
            color: white;
            border-radius: 4px;
            border: 1px solid #007bff;
            cursor: pointer;
        }
        .btn-primary:hover {
            background-color: #0056b3;
            border-color: #004085;
        }
        .avz-feedback {
            display: inline-block;
            margin-left: 10px;
            color: #28a745;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            font-weight: bold;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .avz-countdown-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #856404;
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 2px 6px;
            margin-left: 4px;
        }
        .avz-countdown-cancel {
            border: none;
            background: #dc3545;
            color: #fff;
            border-radius: 3px;
            font-size: 11px;
            padding: 1px 6px;
            cursor: pointer;
        }
        .avz-countdown-cancel:hover {
            background: #b02a37;
        }
    `);

    migrateLegacyDelays();
    checkForUpdate();
    loadFahrzeuge();
})();
