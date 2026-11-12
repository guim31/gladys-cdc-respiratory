# CDC Respiratory Viruses

COVID-19, Grippe und RSV in deinem US-Bundesstaat oder County, aus den offenen Daten der **CDC** (Centers for Disease
Control and Prevention): die **Virusaktivität im Abwasser** des National Wastewater Surveillance System (NWSS) und die
**Krankenhausaufnahmen** des National Healthcare Safety Network (NHSN). Ein Gerät pro Ort, Szenenauslöser, eine
Szenenaktion und ein Dashboard-Widget.

> **Information zur öffentlichen Gesundheit, keine ärztliche Beratung.** Es sind Stufen für einen ganzen Bundesstaat
> oder einige Kläranlagen. Für deine Gesundheit frag deine Ärztin oder deinen Arzt.

Nicht mit der CDC verbunden.

## Was du bekommst

- **Ein Gerät pro gewähltem Ort**: ein Bundesstaat (die 50 Bundesstaaten, der District of Columbia und Puerto Rico)
  oder ein County, das du eingibst.
- Für COVID-19, Grippe und RSV: die **Abwasserstufe** (1 Sehr niedrig bis 5 Sehr hoch) und ihre **Tendenz**, die
  **Krankenhausaufnahmen pro 100.000 Einwohner** der Woche und ihre **Stufe** (1 bis 5).
- Die **Woche der Daten** („Woche bis 31. Okt.“).
- Zwei **Szenenauslöser** (eine Stufe steigt auf eine gewählte Stufe oder fällt darunter), eine **Szenenaktion** (die
  Woche in einem Satz) und ein **Dashboard-Widget**.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang für Gladys. Kein Konto, kein Schlüssel.
- Nur USA.

## Konfiguration

### Einstellungen

| Einstellung                | Standard    | Wirkung                                                                          |
| -------------------------- | ----------- | -------------------------------------------------------------------------------- |
| Bundesstaaten              | keine       | Die zu verfolgenden Bundesstaaten, je ein Gerät.                                 |
| Countys                    | leer        | `County, ST` durch Semikolons getrennt, höchstens 10: `Harris, TX; Cook, IL`     |
| App-Token (optional)       | leer        | Ein kostenloses Token von data.cdc.gov, nur wenn das Anfragelimit erreicht wird. |
| Sprache der Funktionsnamen | Französisch | Namen neuer Funktionen, Sprache ihrer Texte und der Zusammenfassung.             |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an.

Ein County wird über seinen Namen unter den Countys gefunden, die jede Kläranlage versorgt („Harris County“ und
„Harris“ sind gleich). Ein County **ohne eigene Kläranlage** zeigt die Stufen seines ganzen Bundesstaats, und seine
Woche sagt es („Abwasser des Bundesstaats“). Seine Klinikzahlen sind immer die seines Bundesstaats: Das NHSN
veröffentlicht nichts pro County.

## Geräte

| Funktion (× COVID-19, Grippe, RSV) | Typ  | Wert                                                                 |
| ---------------------------------- | ---- | -------------------------------------------------------------------- |
| Abwasser …, Stufe                  | Zahl | 1 Sehr niedrig, 2 Niedrig, 3 Mäßig, 4 Hoch, 5 Sehr hoch              |
| Abwasser …, Tendenz                | Text | steigend, stabil oder fallend                                        |
| Klinik …, Stufe                    | Zahl | 1 bis 5, die NHSN-Stufe der Aufnahmen des Bundesstaats               |
| Klinikaufnahmen … /100.000         | Zahl | neue Krankenhausaufnahmen pro 100.000 Einwohner in der Woche         |
| Datenwoche                         | Text | Enddatum der Woche (Samstag), je Quelle, wenn sie sich unterscheiden |

Die **Abwasserstufe eines Bundesstaats oder Countys** ist der Median der Stufen seiner Kläranlagen, die in dieser
Woche gemeldet haben, wie auf der Karte der CDC; die Integration berechnet ihn aus den Stufen pro Anlage, die die CDC
veröffentlicht, daher kann er selten um eine Stufe von der Karte abweichen. Bei Grippe misst das Abwasser **Influenza
A**; die Kliniken zählen jede Grippe.

Die **Tendenz** vergleicht den Median des Abwassers mit der Vorwoche: „steigend“ ab +20 % (und mindestens +0,5),
„fallend“ ab −1/6 (und mindestens −0,5), sonst „stabil“.

Die Stufen sind Zahlen: Eine Szenenbedingung wie „Abwasser RSV, Stufe ≥ 4“ funktioniert direkt.

## Dashboard-Widget

**Atemwegsviren**: der gewählte Ort (sonst der erste verfolgte), mit einer Zeile pro Virus für das Abwasser (Stufe und
Tendenz) und einer für die Kliniken (Aufnahmen und Stufe), grün bis Niedrig, orange bei Mäßig, rot ab Hoch, und eine
Fußzeile mit Woche und Quelle. Eine Einstellung wählt die angezeigten Indikatoren, eine andere blendet die Fußzeile
aus.

## Szenenauslöser

- **Stufe eines Atemwegsvirus steigt**: Wenn eine neue Woche erscheint, erreicht eine Abwasser- oder Klinikstufe eines
  Orts von unten die gewählte Stufe (Niedrig bis Sehr hoch). Filter: Ort, Virus, Indikator, Stufe.
- **Stufe eines Atemwegsvirus sinkt**: dasselbe nach unten: Die Stufe fällt wieder unter die gewählte.

Variablen: Ort, Virus, Indikator, Stufe (Zahl), Name der Stufe, vorherige Stufe, Woche. Die erste Woche nach der
Installation setzt nur die Referenz: Dabei wird nichts ausgelöst.

## Szenenaktion

**CDC: die Woche in einem Satz abrufen**: liefert für einen Ort (leer: den ersten verfolgten) einen fertigen Satz für
eine Benachrichtigung, etwa „Texas, Woche bis 31. Okt.: COVID-19: Abwasser niedrig und fallend, 1,15 Klinikaufnahmen
pro 100.000; Grippe: …“, in der Sprache der Konfiguration, mit jeder Stufe und Rate als eigener Ausgabe.

## Szenenbeispiele

- Jeden Samstag um 9 Uhr den Satz deines Countys an die Familiengruppe senden.
- Wenn die Grippe-Abwasserstufe deines Countys Hoch erreicht, alle ans Händewaschen erinnern oder die Grippeimpfung
  planen.
- Wenn die RSV-Stufe wieder unter Mäßig fällt, das Ende der Welle ansagen.

## Datenquellen, Lizenz und Kontingente

- Quelle: **CDC**, [data.cdc.gov](https://data.cdc.gov), gemeinfrei (Werk der US-Regierung), ohne Konto gelesen:
  - `atcp-73re`, „CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV“ (NWSS), freitags
    aktualisiert;
  - `vdzy-6i9v`, „Weekly Hospital Respiratory Admission Levels and Rates by Jurisdiction“ (NHSN), wöchentlich.
- Die Daten sind **wöchentlich**; die Integration liest sie **alle 6 Stunden** (zwei Anfragen, nur für die verfolgten
  Bundesstaaten und die letzten vier Wochen): Eine neue Woche erscheint weniger als 6 Stunden nach ihrer
  Veröffentlichung.
- Ohne Token begrenzt data.cdc.gov die Anfragen jeder Adresse; ein Haushalt bleibt weit darunter. Nach einer Antwort
  „zu viele Anfragen“ wartet die Integration eine Stunde (dann länger), Neustarts eingeschlossen. Ein App-Token
  (kostenlos, auf data.cdc.gov) hebt das Limit an.

## Fehlerbehebung

- **Kein Wert nach dem Anlegen des Geräts**: Warte ein paar Sekunden auf das erste Lesen; prüfe, ob Gladys
  Internetzugang hat.
- **Kein Abwasserwert**: Keine Kläranlage des Bundesstaats hat in den letzten vier Wochen gemeldet (North Dakota und
  Oklahoma zum Beispiel im November 2026). Die Klinikwerte kommen trotzdem.
- Der Verbindungsstatus sagt, dass data.cdc.gov nicht lesbar ist: Das Portal ist nicht erreichbar; die letzten Werte
  bleiben und die Integration versucht es alle 6 Stunden erneut.
- Der Verbindungsstatus sagt, dass data.cdc.gov die Anfragen begrenzt: Die Integration wartet und versucht es selbst
  erneut; füge ein App-Token hinzu, wenn es oft passiert.

## Grenzen

- Entwickelt und getestet gegen das echte data.cdc.gov, noch nicht in einem laufenden Gladys: Rückmeldungen
  willkommen.
- Die Abwasserstufen der Bundesstaaten und Countys berechnet die Integration aus den Stufen pro Anlage (Median), sie
  werden nicht von der Karte der CDC gelesen.
- Klinikdaten gibt es nur pro Bundesstaat; ein County bekommt die seines Bundesstaats.
- Außerhalb der Saison kann eine Stufe unveröffentlicht bleiben („Data Unavailable“): Das Gerät behält seinen letzten
  Wert.
