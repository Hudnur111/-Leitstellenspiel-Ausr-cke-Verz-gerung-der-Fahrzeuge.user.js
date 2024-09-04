// ==UserScript==
// @name         Leitstellenspiel Ausrücke-Verzögerung der Fahrzeuge
// @namespace    https://www.leitstellenspiel.de/
// @version      1.6
// @description  Ermöglicht die Konfiguration der Ausrücke-Verzögerung von Fahrzeugen, um eine realistischere Simulation der Einsatzzeiten zu gewährleisten.
// @author       Hudnur111 - IBoy - Coding Crew Tag 1
// @match        https://www.leitstellenspiel.de/*
// @icon         https://www.leitstellenspiel.de/favicon.ico
// @license      GPL-3.0-or-later
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Skriptinformationen
    const SCRIPT_NAME = 'Leitstellenspiel Ausrücke-Verzögerung der Fahrzeuge';
    const CURRENT_VERSION = '1.6';
    const UPDATE_URL = 'https://github.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js/raw/main/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge.user.js';
    const VERSION_URL = 'https://raw.githubusercontent.com/Hudnur111/-Leitstellenspiel-Ausr-cke-Verz-gerung-der-Fahrzeuge/main/version.txt';

    // Überprüft, ob es eine neue Version gibt
    function checkForUpdate() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: VERSION_URL,
            onload: function(response) {
                if (response.status === 200) {
                    const latestVersion = response.responseText.trim();
                    if (latestVersion !== CURRENT_VERSION) {
                        notifyUserForUpdate(latestVersion);
                    }
                } else {
                    console.error('Fehler beim Abrufen der Versionsinformationen:', response.statusText);
                }
            },
            onerror: function() {
                console.error('Fehler beim Abrufen der Versionsinformationen.');
            }
        });
    }

    // Benachrichtigt den Benutzer über ein verfügbares Update
    function notifyUserForUpdate(latestVersion) {
        GM_notification({
            text: `${SCRIPT_NAME} (Version ${latestVersion}) Jetzt aktualisieren!`,
            title: 'Neue Version verfügbar',
            onclick: function() {
                window.open(UPDATE_URL, '_blank');
            }
        });
    }

    checkForUpdate();

    // Erstellt das Menü in der Navigationsleiste
    function createMenu() {
        const navbar = document.querySelector('.navbar-nav');
        if (!navbar) return;

        const li = document.createElement('li');
        li.className = 'dropdown';
        li.innerHTML = `
            <a href="#" class="dropdown-toggle" data-toggle="dropdown">Ausrückverzögerung <b class="caret"></b></a>
            <ul class="dropdown-menu" id="wachenMenu" style="max-height: 400px; overflow-y: auto;">
                <li><input type="text" id="searchInput" class="form-control" placeholder="Wache suchen..."></li>
            </ul>
        `;
        navbar.appendChild(li);

        document.getElementById('searchInput').addEventListener('input', filterWachen);

        listWachen();
    }

    // Listet die Wachen auf
    async function listWachen() {
        try {
            const wachenMenu = document.getElementById('wachenMenu');
            if (!wachenMenu) return;

            const response = await fetch('/api/buildings');
            if (!response.ok) throw new Error(`Fehler beim Abrufen der Wachen: ${response.statusText}`);
            
            const wachen = await response.json();

            // Überprüft, ob die API-Antwort ein Array ist
            if (!Array.isArray(wachen)) {
                console.error('Die API-Antwort ist kein Array:', wachen);
                return;
            }

            // Filtert die Wachen basierend auf den ausgeschlossenen Typen
            const excludedTypes = [6, 2, 20];
            let filteredWachen = wachen.filter(wache => !excludedTypes.includes(parseInt(wache.building_type, 10)));

            if (filteredWachen.length === 0 && wachen.length > 0) {
                filteredWachen = wachen.filter(wache => wache.building_type && !excludedTypes.includes(parseInt(wache.building_type, 10)));
            }

            if (filteredWachen.length === 0) {
                console.warn('Keine Wachen gefunden oder alle Wachen sind ausgeschlossen.');
                return;
            }

            // Sortiert und fügt die Wachen zum Menü hinzu
            filteredWachen.sort((a, b) => a.caption.localeCompare(b.caption));

            filteredWachen.forEach(wache => {
                const wacheItem = document.createElement('li');
                wacheItem.innerHTML = `<a href="#">${wache.caption}</a>`;
                wacheItem.dataset.wacheName = wache.caption.toLowerCase();
                wacheItem.addEventListener('click', () => showFahrzeuge(wache.id, wache.caption));
                wachenMenu.appendChild(wacheItem);
            });
        } catch (error) {
            console.error('Fehler beim Laden der Wachen:', error);
        }
    }

    // Filtert die Wachen in der Suchleiste
    function filterWachen() {
        const searchValue = document.getElementById('searchInput').value.toLowerCase();
        const wachenItems = document.querySelectorAll('#wachenMenu li');

        wachenItems.forEach(item => {
            if (item.dataset.wacheName && item.dataset.wacheName.includes(searchValue)) {
                item.style.display = '';
            } else if (item.dataset.wacheName) {
                item.style.display = 'none';
            }
        });
    }

    // Zeigt die Fahrzeuge einer Wache an
    async function showFahrzeuge(wacheId, wacheName) {
        try {
            const response = await fetch(`/api/buildings/${wacheId}/vehicles`);
            if (!response.ok) throw new Error(`Fehler beim Abrufen der Fahrzeuge: ${response.statusText}`);

            const fahrzeuge = await response.json();

            // Überprüft, ob die API-Antwort ein Array ist
            if (!Array.isArray(fahrzeuge)) {
                console.error('Die API-Antwort für Fahrzeuge ist kein Array:', fahrzeuge);
                return;
            }

            if (fahrzeuge.length > 0) {
                fahrzeuge.sort((a, b) => a.vehicle_type_caption.localeCompare(b.vehicle_type_caption));
                const modal = createModal(wacheName, fahrzeuge);
                document.body.appendChild(modal);
                $(modal).modal('show');
            } else {
                alert(`Keine Fahrzeuge für die Wache ${wacheName} gefunden.`);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Fahrzeuge:', error);
        }
    }

    // Erstellt das Modal zur Konfiguration der Verzögerungen
    function createModal(wacheName, fahrzeuge) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Verzögerungen für Wache: ${wacheName}</h4>
                    </div>
                    <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                        <form id="verzögerungsForm">
                            ${fahrzeuge.map(fz => `
                                <div class="form-group">
                                    <label>${fz.vehicle_type_caption || fz.caption || 'Unbekanntes Fahrzeug'}</label>
                                    <input type="number" class="form-control" id="fz-${fz.id}" placeholder="Verzögerung in Sekunden" value="${getVerzögerung(fz.id)}">
                                </div>`).join('')}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="saveVerzögerungen">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        modal.querySelector('#saveVerzögerungen').addEventListener('click', () => {
            fahrzeuge.forEach(fz => {
                const delay = modal.querySelector(`#fz-${fz.id}`).value;
                setVerzögerung(fz.id, delay);
            });
            $(modal).modal('hide');
        });

        return modal;
    }

    // Ruft die gespeicherte Verzögerungszeit eines Fahrzeugs ab
    function getVerzögerung(fahrzeugId) {
        return localStorage.getItem(`verzögerung-${fahrzeugId}`) || 0;
    }

    // Speichert die Verzögerungszeit eines Fahrzeugs
    function setVerzögerung(fahrzeugId, delay) {
        localStorage.setItem(`verzögerung-${fahrzeugId}`, delay);
    }

    // Menü erstellen
    createMenu();
})();
