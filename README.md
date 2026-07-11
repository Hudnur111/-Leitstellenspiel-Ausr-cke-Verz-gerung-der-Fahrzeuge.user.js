# 🚒 Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache (v5.1.0)

**Autor:** Hudnur111 · IBoy · Coding Crew Tag 1  
**Status:** In Entwicklung  
**Website:** [Leitstellenspiel](https://www.leitstellenspiel.de)

---

## 📌 Beschreibung

Dieses **Benutzerskript** für das Spiel **Leitstellenspiel** bietet eine erweiterte Möglichkeit zur **individuellen Konfiguration von Ausrückverzögerungen** für Fahrzeuge **einer einzelnen Wache**.  
Es ergänzt die Spieloberfläche um eine moderne, benutzerfreundliche **Sidebar**, mit der alle Verzögerungen übersichtlich und intuitiv angepasst werden können, und verzögert das tatsächliche Alarmieren im Spiel um die eingestellte Zeit.

---

## ✨ Hauptfunktionen

- 🔧 **Individuelle Fahrzeugverzögerungen**  
  Passen Sie die Ausrückverzögerungen **pro Fahrzeug** direkt über die Sidebar an – einfach, flexibel und in Echtzeit.

- ⏱️ **Echte Verzögerung beim Alarmieren**  
  Beim Klick auf „Alarmieren“ im Spiel erscheint ein Countdown; das Fahrzeug rückt erst danach tatsächlich aus. Der Countdown kann jederzeit abgebrochen werden.

- 🎨 **Professionelles Design**  
  Die Sidebar ist modern gestaltet, bietet eine klare Struktur und eine Scrollfunktion für lange Fahrzeuglisten.

- 💾 **Speicherfunktion**  
  Verzögerungen können entweder über die **„Speichern“-Schaltfläche** oder durch **Drücken der Enter-Taste** gesichert werden.

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

### 🧪 Aktueller Entwicklungsstand (v5.1.0)

**Automatische Updates (v5.1.0):** Das Skript enthält jetzt `@updateURL`/`@downloadURL` im Header. Tampermonkey prüft damit selbstständig (Standardeinstellung: periodisch im Hintergrund), ob sich `@version` in der `main`-Branch-Datei erhöht hat, und installiert neue Versionen automatisch. Voraussetzungen dafür:

1. Änderungen müssen in den `main`-Branch des Repos gemergt sein (nicht nur in einen Feature-Branch) – nur davon liest Tampermonkey.
2. In Tampermonkey unter *Einstellungen → Update* muss die automatische Update-Prüfung aktiviert sein (Standard: an).
3. Nach dem Einspielen dieser Version einmalig das Skript neu installieren bzw. in Tampermonkey unter *Dashboard → Skript → Updates prüfen* einmal manuell aktualisieren, damit die neuen `@updateURL`-Angaben übernommen werden. Ab dann läuft es automatisch.

Der bisherige eigene Update-Check per `GM_xmlhttpRequest` wurde entfernt – er zeigte auf eine nicht existierende `version.txt` und hat nie funktioniert. `@updateURL`/`@downloadURL` sind der Standard-Mechanismus von Tampermonkey/Greasemonkey und robuster.

Leitstellenspiel kennt **serverseitig keine Ausrückverzögerung** – diese Funktion existiert im Spiel selbst nicht. Bis Version 3.1 hat das Skript die eingestellte Verzögerung nur in `localStorage` gespeichert, ohne dass sie irgendeinen Effekt im Spiel hatte.

**Wichtige Erkenntnis in v5.0.0:** Leitstellenspiel öffnet Wachen und Fahrzeuge als AJAX-Overlay, **ohne die Browser-URL zu wechseln**. Das Skript hat sich bis v4.1.0 auf `window.location.pathname` (`/buildings/123`) verlassen, das in der echten Spieloberfläche nie zutrifft – deshalb hat das Skript nie reagiert.

Seit v5.0.0:

- Die aktuell angezeigte Wache/das Fahrzeug wird über den **sichtbaren Namen** (Überschrift im Overlay) erkannt und mit `/api/buildings` bzw. `/api/vehicles` abgeglichen – unabhängig von der URL
- Ein `MutationObserver` beobachtet das Overlay laufend, da es ohne klassischen Seitenwechsel per AJAX nachlädt
- Der „Alarmieren“-Button wird über seinen sichtbaren Text erkannt (nicht mehr über einen geratenen Link-Aufbau)
- `@match` gilt jetzt für die komplette Domain (`leitstellenspiel.de/*`), damit das Skript unabhängig vom Overlay-Zustand aktiv ist

Außerdem wurde behoben:

- Falscher API-Endpunkt (`/api/buildings/{id}/vehicles` existiert nicht) → jetzt `/api/vehicles` und `/api/buildings`
- Versionsprüfung lief bei **jedem** Seitenaufruf gegen GitHub → jetzt auf alle 6 Stunden gedrosselt
- Fehlende Fehlerrückmeldung im UI bei fehlgeschlagenem Laden der Fahrzeuge → sichtbare Toast-Meldungen
- Bestehende Verzögerungen aus v3.1 werden beim ersten Start automatisch migriert

⚠️ **Bekannte Einschränkung:** Die Erkennung basiert auf sichtbarem Text (Wachen-/Fahrzeugname, Button-Beschriftung „Alarmieren"). Weicht das Overlay strukturell stark ab, kann die Zuordnung fehlschlagen – dann greift keine Verzögerung, aber das Fahrzeug rückt wie gewohnt aus (kein Absturz). Zum Debuggen `window.__lssAvzDebug = true` in der Browser-Konsole setzen.

🛠️ Rückmeldungen zum Live-Verhalten sind willkommen.

---
📬 **Feedback & Vorschläge**?  
Eröffne gerne ein Issue oder schick einen Pull Request – wir freuen uns über Unterstützung und Ideen!
