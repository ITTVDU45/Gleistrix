# GAEB XSD-Schemata

Hier werden die **offiziellen GAEB-DA-XML-XSD-Schemata** abgelegt (Bezug:
https://www.gaeb.de/ – Downloads > GAEB Datenaustausch). Die Bündelung ist
freigegeben.

## Struktur

Die Pfade entsprechen den `xsdPath`-Angaben in `lib/gaeb/registry.ts`, z. B.:

```
lib/gaeb/xsd/
  da-xml/
    3.3/
      GAEB_DA_XML_3.3.xsd
    3.2/
      GAEB_DA_XML_3.2.xsd
```

## Verhalten ohne Schemata

Die XSD-Validierung ist **optional** und deploy-sicher:

- Ist keine XSD-Datei vorhanden **oder** das native Modul `libxmljs2` nicht
  installiert, fällt die Validierung automatisch auf die **strukturelle
  Validierung** (`structuralValidator.ts`) zurück.
- Für echte XSD-Prüfung zusätzlich installieren:
  `npm install libxmljs2` und die XSD-Dateien hier ablegen.
