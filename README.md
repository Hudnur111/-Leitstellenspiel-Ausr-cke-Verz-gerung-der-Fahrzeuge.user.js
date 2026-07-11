# 🚒 Leitstellenspiel Ausrücke-Verzögerung für einzelne Wache (v4.0.0)

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

- 🔄 **Versionsprüfung**  
  Das Skript prüft automatisch (höchstens alle 6 Stunden) auf **verfügbare Updates** und informiert den Nutzer entsprechend.

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

### 🧪 Aktueller Entwicklungsstand (v4.0.0)

Leitstellenspiel kennt **serverseitig keine Ausrückverzögerung** – diese Funktion existiert im Spiel selbst nicht (siehe Forendiskussionen dazu). Bis Version 3.1 hat das Skript die eingestellte Verzögerung nur in `localStorage` gespeichert, ohne dass sie irgendeinen Effekt im Spiel hatte – die Kernfunktion war faktisch ein Platzhalter.

Ab v4.0.0 fängt das Skript den echten Alarmieren-Klick im Spiel ab (Rails-UJS-Link auf `/vehicles/<id>/...`) und verzögert ihn aktiv um die konfigurierte Zeit, inklusive sichtbarem Countdown und Abbrechen-Option. Außerdem wurde behoben:

- Falscher API-Endpunkt (`/api/buildings/{id}/vehicles` existiert nicht) → jetzt `/api/vehicles`, gefiltert nach Wache
- Versionsprüfung lief bei **jedem** Seitenaufruf gegen GitHub → jetzt auf alle 6 Stunden gedrosselt
- Fehlende Fehlerrückmeldung im UI bei fehlgeschlagenem Laden der Fahrzeuge
- Bestehende Verzögerungen aus v3.1 werden beim ersten Start automatisch migriert

⚠️ **Bekannte Einschränkung:** Der genaue Aufbau des „Alarmieren"-Links konnte ohne Zugriff auf einen eingeloggten Testaccount nicht live verifiziert werden. Greift die Erkennung nicht, rückt das Fahrzeug wie gewohnt ohne Verzögerung aus (kein Absturz, kein Blockieren). Zum Debuggen `window.__lssAvzDebug = true` in der Browser-Konsole setzen – dort wird jeder erkannte/ignorierte Link geloggt.

🛠️ Rückmeldungen zum Live-Verhalten (insbesondere ob der Countdown beim Alarmieren erscheint) sind willkommen.

---
📬 **Feedback & Vorschläge**?  
Eröffne gerne ein Issue oder schick einen Pull Request – wir freuen uns über Unterstützung und Ideen!
