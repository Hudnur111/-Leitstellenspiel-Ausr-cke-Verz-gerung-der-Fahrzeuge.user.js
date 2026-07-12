# 🚒 Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache (v6.0.0)

**Autor:** Hudnur111 
**Status:** Publish v6
**Website:** [Leitstellenspiel](https://www.leitstellenspiel.de)

---

## 📌 Beschreibung

Dieses **Benutzerskript** für das Spiel **Leitstellenspiel** zeigt alle Fahrzeuge der aktuellen Wache in einer übersichtlichen Sidebar und macht die native **„Ausrücke-Verzögerung"** jedes Fahrzeugs (Zeit in Sekunden, bis es nach der Alarmierung die Wache verlässt) an einer zentralen Stelle bearbeitbar, statt jedes Fahrzeug einzeln über „Fahrzeug bearbeiten“ öffnen zu müssen.

---

## ✨ Hauptfunktionen

- 🔧 **Alle Fahrzeuge einer Wache an einer Stelle**  
  Sidebar zeigt jedes Fahrzeug der aktuell geöffneten Wache mit seiner echten, aktuellen Ausrücke-Verzögerung.

- 💾 **Schreibt direkt in die native Spiel-Einstellung**  
  Beim Speichern wird die echte „Fahrzeug bearbeiten“-Seite im Hintergrund abgerufen und mit dem neuen Wert erneut abgeschickt – alle anderen Felder (Funkrufname, Personenanzahl, Arbeitszeiten, …) bleiben unverändert.

- 🎨 **Dunkles Design passend zur Spieloberfläche**  
  Sidebar und Buttons sind an den dunklen Look von Leitstellenspiel angelehnt.

- 🧭 **Benutzerfreundliche Steuerung**  
  Ein Button in der unteren rechten Ecke öffnet oder schließt die Sidebar.

- 🔄 **Automatische Updates**  
  Tampermonkey prüft selbstständig (über `@updateURL`/`@downloadURL`), ob im GitHub-Repo eine neue Version vorliegt, und installiert sie automatisch – kein manuelles Nachschauen nötig.

---

## 🛠️ Installation

Dieses Skript kann mithilfe eines **UserScript-Managers** wie **Tampermonkey** oder **Greasemonkey** in Ihrem Browser installiert werden:

1. Erweiterung (z. B. Tampermonkey) installieren  
2. Skript einfügen und aktivieren  
3. Sicherstellen, dass das Skript auf den Seiten von [Leitstellenspiel](https://www.leitstellenspiel.de) ausgeführt wird

---

## ⚠️ Hinweis

Für eine optimale Nutzung sollte die Oberfläche des Spiels aktuell und mit dem Skript kompatibel sein.  
Es wird empfohlen, regelmäßig nach Updates zu schauen, um von den neuesten Verbesserungen zu profitieren.

---

## ℹ️ Sonstige Informationen

### 🧪 Aktueller Entwicklungsstand (v6.0.0)

**Wichtigste Erkenntnis:** Leitstellenspiel hat die Ausrücke-Verzögerung **bereits eingebaut** – als Feld auf der nativen „Fahrzeug bearbeiten“-Seite (`/vehicles/<id>/edit`). Die Versionen bis v5.x haben das nicht genutzt, sondern versucht, das Alarmieren selbst über einen abgefangenen Klick zu verzögern (clientseitiger Nachbau) bzw. den Wert nur lokal in `localStorage` zu speichern – beides ohne echten Effekt im Spiel.

Seit v6.0.0 schreibt das Skript stattdessen direkt in das native Feld:

1. Für jedes Fahrzeug der Wache wird die echte Bearbeiten-Seite im Hintergrund per `fetch` geladen und der aktuelle Wert aus dem Feld mit dem Label „Ausrücke-Verzögerung“ ausgelesen (nicht anhand eines geratenen Feldnamens, sondern über den sichtbaren Text).
2. Beim Speichern wird nur für **geänderte** Fahrzeuge das komplette native Formular (inkl. CSRF-Token und allen anderen Feldern unverändert) mit dem neuen Wert erneut abgeschickt.
3. Automatisiert gegen eine nachgebaute Kopie der echten Bearbeiten-Seite getestet: Lesen funktioniert, nur geänderte Fahrzeuge werden gespeichert, alle anderen Formularfelder bleiben nachweislich unangetastet.

Damit entfällt der gesamte bisherige Klick-Interception-Mechanismus samt Countdown-Anzeige – nicht mehr nötig, da das Spiel die Verzögerung selbst korrekt umsetzt, sobald das native Feld gesetzt ist.

**Frühere Erkenntnis (weiterhin relevant für die Wachen-Erkennung):** Leitstellenspiel öffnet Wachen als AJAX-Overlay, **ohne die Browser-URL zu wechseln**. Die aktuell angezeigte Wache wird daher über ihren sichtbaren Namen (Überschrift im Overlay) erkannt und mit `/api/buildings` bzw. `/api/vehicles` abgeglichen; ein `MutationObserver` beobachtet das Overlay laufend, da es ohne klassischen Seitenwechsel per AJAX nachlädt.

⚠️ **Bekannte Einschränkung:** Die Erkennung des Verzögerungs-Feldes basiert auf dem sichtbaren Label-Text „Ausrücke-Verzögerung“. Ändert sich dieser Text im Spiel grundlegend, kann das Feld nicht gefunden werden – dann erscheint eine Fehlermeldung im Panel statt eines falschen Speicherversuchs. Zum Debuggen `window.__lssAvzDebug = true` in der Browser-Konsole setzen.

🛠️ Rückmeldungen zum Live-Verhalten sind willkommen.

---
📬 **Feedback & Vorschläge**?  
Eröffne gerne ein Issue oder schick einen Pull Request – wir freuen uns über Unterstützung und Ideen!
