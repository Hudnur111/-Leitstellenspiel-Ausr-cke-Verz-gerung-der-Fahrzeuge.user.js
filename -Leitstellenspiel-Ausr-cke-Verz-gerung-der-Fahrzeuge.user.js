// ==UserScript==
// @name         Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache
// @namespace    https://www.leitstellenspiel.de/
// @version      6.4.0
// @description  Zeigt alle Fahrzeuge der aktuellen Wache in einer Sidebar und ermöglicht das komfortable Bearbeiten der nativen "Ausrücke-Verzögerung" für alle Fahrzeuge an einer Stelle.
// @author       Hudnur111 - IBoy - Coding Crew Tag 1
// @match        https://www.leitstellenspiel.de/*
// @match        https://leitstellenspiel.de/*
// @icon         https://cdn-icons-png.flaticon.com/512/3135/3135715.png
// @license      GPL-3.0-or-later
// @updateURL    https://raw.githubusercontent.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js/main/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js
// @downloadURL  https://raw.githubusercontent.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js/main/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

// Betatester: m7e

(function () {
    'use strict';

    if (window.__lssAusrueckverzoegerungLoaded) return;
    window.__lssAusrueckverzoegerungLoaded = true;

    // ---------------------------------------------------------------------
    // Skriptinformationen
    //
    // Automatische Updates laufen über die @updateURL/@downloadURL-Angaben
    // im Header (Tampermonkey-Bordmittel): der Manager prüft von sich aus
    // periodisch, ob sich @version in der main-Branch-Datei erhöht hat,
    // und installiert die neue Fassung automatisch. Ein eigener
    // GM_xmlhttpRequest-Check ist dafür nicht nötig (der bisherige zeigte
    // zudem auf eine nicht existierende version.txt und lief nie).
    // ---------------------------------------------------------------------
    const SCRIPT_NAME = 'Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache';
    const CURRENT_VERSION = '6.4.0';

    // ---------------------------------------------------------------------
    // Sichtbare Status-/Fehlermeldungen. Fehler beim Laden der Fahrzeuge
    // liefen bisher nur in die Browser-Konsole und blieben für die meisten
    // Nutzer unsichtbar - dadurch wirkte das Skript, als würde es "nicht
    // mit dem Spiel verbinden", obwohl der eigentliche Fehler erkennbar
    // gewesen wäre. Ab sofort erscheint jede relevante Meldung auch direkt
    // auf der Seite.
    // ---------------------------------------------------------------------
    // Alle Toasts teilen sich einen Container mit Flex-Layout, damit
    // mehrere gleichzeitige Meldungen (z.B. Ladebestätigung + eine
    // Warnung kurz danach) gestapelt statt exakt übereinander gerendert
    // werden.
    let toastContainer = null;
    function getToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'avzToastContainer';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function showToast(message, type = 'info', timeoutMs = 6000) {
        const toast = document.createElement('div');
        toast.className = `avz-toast avz-toast-${type}`;
        toast.textContent = message;
        getToastContainer().appendChild(toast);
        if (timeoutMs > 0) {
            setTimeout(() => toast.remove(), timeoutMs);
        }
        return toast;
    }

    function debugLog(...args) {
        if (window.__lssAvzDebug) console.log(`[${SCRIPT_NAME}]`, ...args);
    }

    // ---------------------------------------------------------------------
    // Native Ausrücke-Verzögerung
    //
    // Wichtige Korrektur gegenüber v5.x: Leitstellenspiel hat dieses
    // Feature bereits eingebaut ("Ausrücke-Verzögerung" auf der
    // Fahrzeug-Bearbeiten-Seite, /vehicles/<id>/edit) - das Skript muss
    // also nicht selbst irgendetwas verzögern, sondern nur bequem dieses
    // native Feld für alle Fahrzeuge einer Wache an einer Stelle
    // konfigurierbar machen. Dazu wird die echte Bearbeiten-Seite im
    // Hintergrund abgerufen, das Feld anhand seines sichtbaren Labels
    // gefunden (nicht anhand eines geratenen Feldnamens) und das
    // Formular mit geändertem Wert erneut abgeschickt - alle anderen
    // Felder (Personenanzahl, Arbeitszeiten, ...) bleiben dabei unangetastet,
    // da sie unverändert aus dem echten Formular übernommen werden.
    // ---------------------------------------------------------------------
    const MAX_DELAY_SECONDS = 900; // Sicherheitsobergrenze: 15 Minuten
    const DELAY_LABEL_TEXT = /ausrücke-?verzögerung/i;

    // ---------------------------------------------------------------------
    // Request-Drosselung (N+1-Problem, siehe GitHub-Issue #6): Jedes
    // Fahrzeug einer Wache benötigt einen eigenen Request auf seine
    // Bearbeiten-Seite. Ohne Begrenzung würde eine Wache mit vielen
    // Fahrzeugen dutzende Requests gleichzeitig abfeuern - unnötige Last
    // für den Spiel-Server und ein Risiko für Rate-Limits. Ein einfacher
    // Scheduler begrenzt sowohl die parallele Anzahl als auch den
    // Mindestabstand zwischen Requests. Zusätzlich wird jeder gelesene
    // Wert kurzzeitig gecacht, damit ein erneutes Öffnen derselben Wache
    // nicht sofort wieder alle Fahrzeuge neu abfragt.
    // ---------------------------------------------------------------------
    const MAX_CONCURRENT_VEHICLE_REQUESTS = 2;
    const MIN_VEHICLE_REQUEST_INTERVAL_MS = 400; // max. ~2,5 Requests/Sekunde

    function createRequestLimiter(maxConcurrent, minIntervalMs) {
        let active = 0;
        let lastStart = 0;
        let timerScheduled = false;
        const queue = [];

        function pump() {
            timerScheduled = false;
            while (active < maxConcurrent && queue.length > 0) {
                const wait = lastStart + minIntervalMs - Date.now();
                if (wait > 0) {
                    if (!timerScheduled) {
                        timerScheduled = true;
                        setTimeout(pump, wait);
                    }
                    return;
                }
                const task = queue.shift();
                active++;
                lastStart = Date.now();
                task.fn().then(task.resolve, task.reject).finally(() => {
                    active--;
                    pump();
                });
            }
        }

        return function schedule(fn) {
            return new Promise((resolve, reject) => {
                queue.push({ fn, resolve, reject });
                pump();
            });
        };
    }

    const scheduleVehicleRequest = createRequestLimiter(
        MAX_CONCURRENT_VEHICLE_REQUESTS,
        MIN_VEHICLE_REQUEST_INTERVAL_MS
    );

    const nativeDelayCache = new Map(); // vehicleId -> { value, at }
    const NATIVE_DELAY_CACHE_TTL_MS = 45 * 1000;

    function vehicleEditUrl(vehicleId) {
        return `/vehicles/${vehicleId}/edit`;
    }

    function findDelayInput(doc) {
        const labels = doc.querySelectorAll('label');
        for (const label of labels) {
            if (!DELAY_LABEL_TEXT.test(label.textContent || '')) continue;
            const forId = label.getAttribute('for');
            if (forId) {
                const input = doc.getElementById(forId);
                if (input) return input;
            }
            const container = label.closest('div') || label.parentElement;
            const input = container && container.querySelector('input[type="number"], input[type="text"]');
            if (input) return input;
        }
        return null;
    }

    // Alle Requests auf Fahrzeug-Bearbeiten-Seiten laufen durch den
    // Scheduler, damit gleichzeitig immer nur wenige unterwegs sind.
    async function fetchVehicleEditDoc(vehicleId) {
        return scheduleVehicleRequest(async () => {
            const response = await fetch(vehicleEditUrl(vehicleId), {
                credentials: 'same-origin',
                headers: { Accept: 'text/html' }
            });
            if (!response.ok) {
                throw new Error(`Bearbeiten-Seite für Fahrzeug ${vehicleId}: HTTP ${response.status}`);
            }
            const html = await response.text();
            return new DOMParser().parseFromString(html, 'text/html');
        });
    }

    async function readNativeDelay(vehicleId, { useCache = true } = {}) {
        const cached = nativeDelayCache.get(vehicleId);
        if (useCache && cached && (Date.now() - cached.at) < NATIVE_DELAY_CACHE_TTL_MS) {
            return cached.value;
        }
        const doc = await fetchVehicleEditDoc(vehicleId);
        const input = findDelayInput(doc);
        if (!input) throw new Error('"Ausrücke-Verzögerung"-Feld nicht gefunden');
        const value = Number.parseInt(input.value, 10);
        const result = Number.isFinite(value) ? value : 0;
        nativeDelayCache.set(vehicleId, { value: result, at: Date.now() });
        return result;
    }

    async function writeNativeDelay(vehicleId, seconds) {
        const doc = await fetchVehicleEditDoc(vehicleId);
        const input = findDelayInput(doc);
        if (!input || !input.name) throw new Error('"Ausrücke-Verzögerung"-Feld nicht gefunden');
        const form = input.closest('form');
        if (!form) throw new Error('Formular für die Fahrzeug-Bearbeitung nicht gefunden');

        const formData = new FormData(form);
        formData.set(input.name, String(seconds));

        const action = form.getAttribute('action') || `/vehicles/${vehicleId}`;
        const response = await scheduleVehicleRequest(() => fetch(action, {
            method: 'POST', // Rails-Formulare senden PATCH/PUT per _method-Feld immer als POST
            credentials: 'same-origin',
            body: formData
        }));
        if (!response.ok) {
            throw new Error(`Speichern fehlgeschlagen: HTTP ${response.status}`);
        }
        nativeDelayCache.set(vehicleId, { value: seconds, at: Date.now() });
    }

    // ---------------------------------------------------------------------
    // Sidebar zur Konfiguration der Verzögerungen
    //
    // Leitstellenspiel öffnet Wachen/Fahrzeuge als AJAX-Overlay, OHNE die
    // Browser-URL zu wechseln - `window.location.pathname` bleibt dabei
    // unverändert. Die aktuell angezeigte Wache lässt sich daher nicht aus
    // der URL bestimmen, sondern nur aus dem sichtbaren Seiteninhalt: der
    // Name der Wache (z.B. "THW Schwäbisch Gmünd") wird als Überschrift
    // angezeigt und mit den Fahrzeug-/Gebäudedaten aus der API abgeglichen.
    // ---------------------------------------------------------------------
    const VEHICLE_ENDPOINTS = ['/api/vehicles', '/api/vehicles.json'];
    const BUILDING_ENDPOINTS = ['/api/buildings', '/api/buildings.json'];
    const BUILDING_ID_FIELDS = ['building_id', 'caserne_id', 'station_id'];
    const INDEX_CACHE_TTL_MS = 60 * 1000;

    async function fetchJsonList(endpoints) {
        let lastError = null;
        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) {
                    lastError = new Error(`${url} → HTTP ${response.status} ${response.statusText}`);
                    continue;
                }
                const data = await response.json();
                if (Array.isArray(data)) return data;
                if (data && Array.isArray(data.result)) return data.result;
                if (data && Array.isArray(data.vehicles)) return data.vehicles;
                if (data && Array.isArray(data.buildings)) return data.buildings;
                lastError = new Error(`${url} → unerwartetes Antwortformat: ${JSON.stringify(data).slice(0, 200)}`);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error(`Keiner der Endpunkte (${endpoints.join(', ')}) konnte erreicht werden.`);
    }

    let vehiclesIndexCache = null;
    let vehiclesIndexCacheAt = 0;
    async function getVehiclesIndex(forceRefresh = false) {
        if (!forceRefresh && vehiclesIndexCache && (Date.now() - vehiclesIndexCacheAt) < INDEX_CACHE_TTL_MS) {
            return vehiclesIndexCache;
        }
        vehiclesIndexCache = await fetchJsonList(VEHICLE_ENDPOINTS);
        vehiclesIndexCacheAt = Date.now();
        debugLog(`${vehiclesIndexCache.length} Fahrzeuge von der API geladen.`);
        return vehiclesIndexCache;
    }

    let buildingsIndexCache = null;
    let buildingsIndexCacheAt = 0;
    async function getBuildingsIndex(forceRefresh = false) {
        if (!forceRefresh && buildingsIndexCache && (Date.now() - buildingsIndexCacheAt) < INDEX_CACHE_TTL_MS) {
            return buildingsIndexCache;
        }
        buildingsIndexCache = await fetchJsonList(BUILDING_ENDPOINTS);
        buildingsIndexCacheAt = Date.now();
        debugLog(`${buildingsIndexCache.length} Gebäude von der API geladen.`);
        return buildingsIndexCache;
    }

    function findBuildingIdField(fahrzeuge) {
        return BUILDING_ID_FIELDS.find(field => fahrzeuge.some(fz => fz[field] !== undefined));
    }

    // Sucht unter allen Überschriften-ähnlichen Elementen der Seite nach
    // einem Text, der exakt dem "caption"-Feld eines Eintrags entspricht.
    // Robuster als das Raten von CSS-Klassen, da der Name im Spiel immer
    // sichtbar als Überschrift/Titel angezeigt wird.
    //
    // Namenskollisionen (siehe GitHub-Issue #5): Das Spiel erlaubt mehrere
    // Wachen mit identischem Namen. Eine Datenbank-Eindeutigkeitsprüfung
    // kann dieses Skript nicht erzwingen (das liegt am Spiel-Server, nicht
    // am Client), aber es kann verhindern, bei einem Namens-Duplikat
    // stillschweigend die falsche Wache zu treffen: Existieren mehrere
    // Einträge mit demselben sichtbaren Namen, wird das als "ambiguous"
    // markiert statt irgendeinen davon zu raten.
    function findEntityByVisibleCaption(entities) {
        if (!entities || entities.length === 0) return null;
        const captionGroups = new Map(); // getrimmter Name -> passende Einträge
        entities.forEach(entity => {
            if (!entity.caption) return;
            const key = entity.caption.trim();
            if (!captionGroups.has(key)) captionGroups.set(key, []);
            captionGroups.get(key).push(entity);
        });

        const headingEls = document.querySelectorAll('h1, h2, h3, h4, .modal-title, .panel-title, .box-title, strong');
        for (const el of headingEls) {
            const text = el.textContent.trim();
            if (!text || !captionGroups.has(text)) continue;
            const matches = captionGroups.get(text);
            if (matches.length > 1) {
                return { ambiguous: true, caption: text, candidates: matches };
            }
            return matches[0];
        }
        return null;
    }

    const sidebarState = {
        toggleButton: null,
        sidebar: null,
        fahrzeugList: null,
        currentBuildingId: null
    };

    function ensureSidebarShell() {
        if (sidebarState.sidebar) return sidebarState;

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
                <h4 id="avzSidebarTitle">Fahrzeug-Ausrück-Verzögerung</h4>
                <button type="button" id="avzCloseButton" aria-label="Schließen">&times;</button>
            </div>
            <p class="avz-hint">Ausrücke-Verzögerung in Sekunden je Fahrzeug (native Spiel-Einstellung). Bei 0 rückt das Fahrzeug sofort aus.</p>
            <div id="fahrzeugVerzoegerungList"></div>
            <button class="btn btn-primary" id="saveDelays">Speichern</button>
            <span id="saveFeedback" class="avz-feedback" style="display:none;">Verzögerungen erfolgreich gespeichert!</span>
        `;
        document.body.appendChild(sidebar);

        sidebar.querySelector('#avzCloseButton').addEventListener('click', () => {
            sidebar.style.display = 'none';
        });
        toggleButton.addEventListener('click', () => {
            sidebar.style.display = (sidebar.style.display === 'none') ? 'block' : 'none';
        });

        sidebarState.toggleButton = toggleButton;
        sidebarState.sidebar = sidebar;
        sidebarState.fahrzeugList = sidebar.querySelector('#fahrzeugVerzoegerungList');
        return sidebarState;
    }

    async function populateSidebar(building, fahrzeuge) {
        const { sidebar, fahrzeugList } = ensureSidebarShell();
        sidebar.querySelector('#avzSidebarTitle').textContent = `Ausrück-Verzögerung: ${building.caption}`;
        fahrzeugList.innerHTML = '';

        const sorted = fahrzeuge.slice().sort((a, b) => (a.caption || '').localeCompare(b.caption || ''));

        sorted.forEach(fz => {
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
            input.placeholder = 'Lädt...';
            input.disabled = true;
            input.dataset.vehicleId = String(fz.id);

            fzItem.appendChild(labelEl);
            fzItem.appendChild(input);
            fahrzeugList.appendChild(fzItem);
        });

        const saveButton = sidebar.querySelector('#saveDelays');
        saveButton.onclick = () => saveDelays(sorted);
        fahrzeugList.onkeypress = (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('delayInput')) {
                e.preventDefault();
                saveDelays(sorted);
            }
        };

        // Aktuelle Werte kommen von der echten Fahrzeug-Bearbeiten-Seite -
        // parallel pro Fahrzeug nachladen, damit das Panel nicht blockiert.
        await Promise.all(sorted.map(fz => loadDelayForRow(fz)));
    }

    // Lädt (bzw. lädt erneut) den echten Wert für genau ein Fahrzeug.
    // Wichtig: Bei einem Lesefehler bleibt das Feld deaktiviert und ohne
    // gesetzten "loadedValue" - sonst würde saveDelays() das leere Feld als
    // "geändert" werten und die echte Verzögerung im Spiel beim nächsten
    // Speichern versehentlich auf 0 zurücksetzen.
    async function loadDelayForRow(fz) {
        const input = document.getElementById(`avz-fz-${fz.id}`);
        if (!input) return;
        const retryBtn = input.parentElement && input.parentElement.querySelector('.avz-retry');
        if (retryBtn) retryBtn.remove();

        input.disabled = true;
        input.placeholder = 'Lädt...';
        try {
            const value = await readNativeDelay(fz.id);
            input.value = String(value);
            input.dataset.loadedValue = String(value);
            input.disabled = false;
        } catch (error) {
            input.placeholder = 'Fehler beim Laden';
            debugLog(`Ausrücke-Verzögerung für Fahrzeug ${fz.id} konnte nicht gelesen werden:`, error);

            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'avz-retry';
            retry.textContent = 'Erneut versuchen';
            retry.addEventListener('click', () => loadDelayForRow(fz));
            input.insertAdjacentElement('afterend', retry);
        }
    }

    let saveInProgress = false;

    async function saveDelays(fahrzeuge) {
        if (saveInProgress) return; // verhindert parallele Speicher-Requests bei Doppelklick/Enter+Klick
        const saveButton = document.getElementById('saveDelays');

        const changed = fahrzeuge
            .map(fz => ({ fz, input: document.getElementById(`avz-fz-${fz.id}`) }))
            .filter(({ input }) => input && !input.disabled && input.value !== input.dataset.loadedValue);

        if (changed.length === 0) {
            showToast('Ausrückverzögerung: Keine Änderungen zum Speichern.', 'info', 3000);
            return;
        }

        saveInProgress = true;
        if (saveButton) saveButton.disabled = true;
        try {
            const results = await Promise.allSettled(changed.map(async ({ fz, input }) => {
                const clamped = Math.min(Math.max(Number.parseInt(input.value, 10) || 0, 0), MAX_DELAY_SECONDS);
                await writeNativeDelay(fz.id, clamped);
                input.value = String(clamped);
                input.dataset.loadedValue = String(clamped);
            }));

            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                failed.forEach(r => debugLog('Speichern fehlgeschlagen:', r.reason));
                showToast(
                    `Ausrückverzögerung: ${failed.length} von ${changed.length} Fahrzeugen konnten nicht gespeichert werden.`,
                    'error',
                    8000
                );
            }
            const succeeded = changed.length - failed.length;
            if (succeeded > 0) {
                const feedback = document.getElementById('saveFeedback');
                feedback.textContent = `${succeeded} Fahrzeug(e) gespeichert!`;
                feedback.style.display = 'inline';
                setTimeout(() => { feedback.style.display = 'none'; }, 2500);
            }
        } finally {
            saveInProgress = false;
            if (saveButton) saveButton.disabled = false;
        }
    }

    // Wird bei jeder relevanten DOM-Änderung erneut ausgeführt, um zu
    // erkennen, ob gerade eine Wache angezeigt wird - da sich weder URL
    // noch ein "Seitenwechsel"-Event dafür eignen.
    async function refreshForCurrentView() {
        try {
            const vehicles = await getVehiclesIndex();
            const buildings = await getBuildingsIndex();
            const building = findEntityByVisibleCaption(buildings);
            if (!building) return;

            if (building.ambiguous) {
                // Mehrere Wachen mit demselben Namen (siehe GitHub-Issue #5) -
                // welche davon gemeint ist, lässt sich vom Client aus nicht
                // sicher bestimmen. Lieber klar warnen als eventuell die
                // falsche Wache anzuzeigen. Nur einmal pro Namens-Duplikat
                // melden, nicht bei jeder DOM-Änderung erneut.
                const marker = `ambiguous:${building.caption}`;
                if (sidebarState.currentBuildingId !== marker) {
                    sidebarState.currentBuildingId = marker;
                    showToast(
                        `Ausrückverzögerung: ${building.candidates.length} Wachen heißen "${building.caption}" - ` +
                        'Zuordnung ist nicht eindeutig, Sidebar bleibt für diese Wache deaktiviert. ' +
                        'Bitte einen der Wachennamen im Spiel eindeutig machen.',
                        'error',
                        12000
                    );
                }
                return;
            }

            if (building.id === sidebarState.currentBuildingId) return;

            const buildingField = findBuildingIdField(vehicles);
            let fahrzeuge;
            if (buildingField) {
                fahrzeuge = vehicles.filter(fz => Number(fz[buildingField]) === Number(building.id));
            } else {
                showToast(
                    'Ausrückverzögerung: Wache konnte nicht anhand der Fahrzeugdaten gefiltert werden - zeige alle Fahrzeuge. Bitte melden!',
                    'warning',
                    10000
                );
                fahrzeuge = vehicles;
            }

            if (fahrzeuge.length === 0) {
                showToast(
                    `Ausrückverzögerung: Keine Fahrzeuge für Wache "${building.caption}" gefunden.`,
                    'warning',
                    8000
                );
                return;
            }

            populateSidebar(building, fahrzeuge);
            sidebarState.currentBuildingId = building.id;
            debugLog(`Wache erkannt: ${building.caption} (#${building.id}), ${fahrzeuge.length} Fahrzeuge.`);
        } catch (error) {
            debugLog('Fehler bei refreshForCurrentView:', error);
        }
    }

    function debounce(fn, waitMs) {
        let timeoutId = null;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), waitMs);
        };
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------
    // Farben an die tatsächliche Leitstellenspiel-Oberfläche angelehnt:
    // neutrales dunkles Grau statt Navy-Blau für Panels, und Grün (wie der
    // "Alarmieren"-Button und aktive Kategorie-Buttons im Spiel) als
    // Akzentfarbe statt Blau.
    GM_addStyle(`
        #avzToggleButton {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            background-color: #3ba757;
            color: #fff;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 12px rgba(0,0,0,0.5);
            cursor: pointer;
        }
        #avzToggleButton:hover {
            background-color: #2f8a46;
        }
        #vehicleSidebar {
            position: fixed;
            top: 100px;
            right: 10px;
            width: 360px;
            max-height: 70vh;
            overflow-y: auto;
            background-color: #2e2e2e;
            color: #e8e8e8;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 16px 20px 20px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            z-index: 10000;
            font-size: 14px;
        }
        #vehicleSidebar .avz-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 10px;
        }
        #vehicleSidebar .avz-header h4 {
            margin: 0;
            font-size: 16px;
            color: #fff;
        }
        #avzCloseButton {
            background: none;
            border: none;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            color: #9aa0a6;
        }
        #avzCloseButton:hover {
            color: #fff;
        }
        #vehicleSidebar .avz-hint {
            font-size: 12px;
            color: #9aa0a6;
            margin: 10px 0 14px;
        }
        .btn-primary {
            background-color: #3ba757;
            border-color: #3ba757;
            padding: 8px 16px;
            color: #fff;
            border-radius: 5px;
            border: 1px solid #3ba757;
            cursor: pointer;
            font-weight: bold;
        }
        .btn-primary:hover {
            background-color: #2f8a46;
            border-color: #2f8a46;
        }
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: default;
        }
        .avz-retry {
            display: block;
            margin-top: 4px;
            background: none;
            border: 1px solid #dc3545;
            color: #ff8a95;
            border-radius: 4px;
            font-size: 11px;
            padding: 2px 8px;
            cursor: pointer;
        }
        .avz-retry:hover {
            background-color: rgba(220, 53, 69, 0.15);
        }
        .avz-feedback {
            display: inline-block;
            margin-left: 10px;
            color: #3ddc84;
        }
        .form-group {
            margin-bottom: 14px;
        }
        .form-group label {
            display: block;
            font-weight: bold;
            color: #cfd3d8;
            margin-bottom: 4px;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            background-color: #1e1e1e;
            color: #fff;
            border: 1px solid #4a4a4a;
            border-radius: 5px;
            box-sizing: border-box;
        }
        .form-group input:focus {
            outline: none;
            border-color: #3ba757;
        }
        .form-group input:disabled {
            opacity: 0.5;
        }
        #avzToastContainer {
            position: fixed;
            bottom: 70px;
            right: 20px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-end;
        }
        .avz-toast {
            max-width: 320px;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 13px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            color: #fff;
        }
        .avz-toast-info {
            background-color: #3ba757;
        }
        .avz-toast-warning {
            background-color: #e0a800;
            color: #1e1e1e;
        }
        .avz-toast-error {
            background-color: #dc3545;
        }
    `);

    // Da Wachen als AJAX-Overlay ohne URL-Wechsel angezeigt werden, gibt
    // es kein "Seite geladen"-Ereignis dafür - stattdessen wird bei jeder
    // DOM-Änderung (debounced) neu geprüft, ob gerade eine Wache sichtbar ist.
    //
    // Die eigenen UI-Elemente (Sidebar, Toggle-Button, Toasts) lösen dabei
    // selbst laufend Mutationen aus (Toast erscheint/verschwindet,
    // Fahrzeugliste wird neu befüllt). Ohne Filter würde jede eigene
    // Änderung einen weiteren (unnötigen) Erkennungslauf anstoßen - das
    // ist zwar durch die Caches billig, aber vermeidbarer Ballast.
    const OWN_ELEMENT_IDS = ['avzToggleButton', 'vehicleSidebar', 'avzToastContainer'];

    function isOwnMutation(records) {
        return records.every(record => {
            const nodes = [...record.addedNodes, ...record.removedNodes];
            return nodes.every(node => (
                node.nodeType === Node.ELEMENT_NODE &&
                (OWN_ELEMENT_IDS.includes(node.id) || OWN_ELEMENT_IDS.some(id => node.closest && node.closest(`#${id}`)))
            ));
        });
    }

    const debouncedRefresh = debounce(refreshForCurrentView, 400);
    new MutationObserver((records) => {
        if (isOwnMutation(records)) return;
        debouncedRefresh();
    }).observe(document.body, { childList: true, subtree: true });
    refreshForCurrentView();

    // Bestätigt, dass das Skript auf dieser Seite überhaupt injiziert und
    // ausgeführt wurde. Bleibt diese Meldung aus, greift das @match nicht
    // (falsche Domain/Pfad) oder der UserScript-Manager blockiert das
    // Skript - unabhängig von allen anderen Fehlern hier im Code.
    showToast(`Ausrückverzögerung v${CURRENT_VERSION} geladen.`, 'info', 4000);
})();
