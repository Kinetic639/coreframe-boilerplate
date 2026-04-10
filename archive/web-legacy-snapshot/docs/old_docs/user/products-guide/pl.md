---
title: "Przewodnik Zarządzania Produktami"
slug: "products-guide"
lang: "pl"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["produkty", "inwentarz", "sku", "warianty"]
category: "przewodnik-użytkownika"
difficulty: "beginner"
audience: ["pracownicy-magazynu", "kierownicy"]
status: "published"
author: "Zespół AmbraWMS"
estimatedReadTime: 10
prerequisites: ["getting-started"]
related: ["warehouse-basics"]
---

# Przewodnik Zarządzania Produktami

Naucz się tworzyć, zarządzać i organizować produkty w AmbraWMS. Ten przewodnik obejmuje wszystko, od podstawowej konfiguracji produktu po zaawansowane zarządzanie wariantami.

## Zrozumienie Produktów

W AmbraWMS produkty są fundamentem systemu inwentaryzacyjnego. Każdy produkt reprezentuje unikalny przedmiot, który przechowujesz, sprzedajesz lub zarządzasz.

### Struktura Produktu

```
Produkt (Podstawowy Artykuł)
  └── Warianty
       ├── Rozmiar: Mały, Średni, Duży
       ├── Kolor: Czerwony, Niebieski, Zielony
       └── Materiał: Bawełna, Poliester
```

### Kluczowe Pola Produktu

**Wymagane Pola:**

- **Nazwa** - Nazwa wyświetlana produktu
- **SKU** - Stock Keeping Unit (unikalny identyfikator)
- **Jednostka Miary** - szt, kg, m, L, itp.

**Opcjonalne ale Zalecane:**

- **Opis** - Szczegółowe informacje o produkcie
- **Zdjęcia** - Fotografie produktu
- **Kategoria** - Klasyfikacja produktu
- **Kod Kreskowy** - Do skanowania
- **Dostawca** - Domyślny dostawca

## Tworzenie Nowego Produktu

### Proces Krok po Kroku

1. Przejdź do **Magazyn** → **Produkty**
2. Kliknij przycisk **Dodaj Produkt**
3. Wypełnij informacje o produkcie
4. Dodaj zdjęcia (obsługiwane przeciąganie i upuszczanie)
5. Skonfiguruj warianty jeśli potrzeba
6. Ustaw parametry inwentaryzacyjne
7. Kliknij **Zapisz**

### Najlepsze Praktyki SKU

Dobry system SKU jest:

- **Spójny** - Podążaj za tym samym wzorem
- **Opisowy** - Mówi o produkcie
- **Zwięzły** - Nie za długi
- **Unikalny** - Bez duplikatów

**Przykłady:**

```
TEE-001-NIE-M    (Koszulka #001, Niebieski, Średni)
LAP-HP-E840-16   (Laptop, HP, EliteBook 840, 16GB RAM)
PUD-STD-30X20    (Pudełko, Standardowe, 30x20 cm)
```

## Warianty Produktu

Warianty pozwalają zarządzać różnymi wersjami tego samego produktu podstawowego.

### Kiedy Używać Wariantów

✅ **Używaj wariantów dla:**

- Różnych rozmiarów tego samego produktu
- Różnych kolorów tego samego artykułu
- Różnych konfiguracji
- Produktów z drobnymi wariacjami

❌ **Nie używaj wariantów dla:**

- Całkowicie różnych produktów
- Produktów z różnymi dostawcami
- Artykułów z różnymi cenami (chyba że opartych na wariancie)

### Tworzenie Wariantów

1. Otwórz szczegóły produktu
2. Przejdź do zakładki **Warianty**
3. Wybierz opcje wariantów (Rozmiar, Kolor, itp.)
4. Wygeneruj kombinacje wariantów
5. Ustaw dane specyficzne dla wariantu:
   - Sufiks SKU
   - Korekty cen
   - Zdjęcia
   - Poziomy zapasów

**Przykład:**

Produkt Podstawowy: "Koszulka Premium"

Wygenerowane warianty:

- Koszulka Premium - Mała - Czerwona
- Koszulka Premium - Mała - Niebieska
- Koszulka Premium - Średnia - Czerwona
- Koszulka Premium - Średnia - Niebieska
- Koszulka Premium - Duża - Czerwona
- Koszulka Premium - Duża - Niebieska

## Zdjęcia Produktów

### Wytyczne dla Zdjęć

- **Format**: JPG, PNG, WebP
- **Rozmiar**: Max 5MB na zdjęcie
- **Rozdzielczość**: Co najmniej 800x800px
- **Tło**: Preferowane białe lub przezroczyste

### Wiele Zdjęć

Możesz dodać wiele zdjęć na produkt:

1. **Zdjęcie Główne** - Główne zdjęcie produktu
2. **Dodatkowe Zdjęcia** - Różne kąty, szczegóły
3. **Zdjęcia Wariantów** - Specyficzne dla każdego wariantu

## Kategorie i Tagi

### Kategorie Produktów

Organizuj produkty w strukturze hierarchicznej:

```
Elektronika
  └── Komputery
       ├── Laptopy
       ├── Komputery Stacjonarne
       └── Akcesoria
  └── Urządzenia Mobilne
       ├── Smartfony
       └── Tablety
```

### Tagi

Dodaj elastyczne tagi dla lepszej wyszukiwalności:

- Sezonowe: `lato`, `zima`, `święta`
- Cechy: `wodoodporny`, `ekologiczny`, `bestseller`
- Promocje: `wyprzedaż`, `nowość`, `przecena`

## Parametry Inwentarzowe

### Ustawienia Per Magazyn

Każdy produkt może mieć różne ustawienia dla każdego magazynu:

**Punkt Zamawiania**: Kiedy uruchomić uzupełnienie

- Przykład: 50 sztuk

**Minimalny Stan**: Poziom zapasu bezpieczeństwa

- Przykład: 20 sztuk

**Maksymalny Stan**: Pojemność magazynowa

- Przykład: 500 sztuk

**Czas Realizacji**: Dni do otrzymania po zamówieniu

- Przykład: 7 dni

### Alerty Stanowe

System automatycznie monitoruje:

- 🔴 **Krytyczny**: Poniżej 25% punktu zamawiania
- 🟡 **Niski**: Poniżej punktu zamawiania
- 🟢 **Normalny**: Powyżej punktu zamawiania

## Ceny i Koszty

### Śledzenie Kosztów

- **Koszt Zakupu**: Ile zapłaciłeś
- **Cena Sprzedaży**: Ile pobierasz
- **Marża**: Procent zysku

## Kody Kreskowe i Skanowanie

### Obsługiwane Typy Kodów Kreskowych

- **EAN-13**: Standardowy kod kreskowy detaliczny
- **UPC**: Universal Product Code
- **Code 128**: Wszechstronny kod przemysłowy
- **QR Code**: Kod matrycowy 2D

## Operacje Zbiorcze

### Importowanie Produktów

Prześlij produkty przez CSV/Excel:

1. Pobierz szablon
2. Wypełnij dane produktów
3. Prześlij plik
4. Przejrzyj i potwierdź
5. System tworzy produkty

## Najlepsze Praktyki

### Organizacja

1. **Używaj jasnych nazw** - Opisz co to jest
2. **Spójne SKU** - Podążaj za konwencją nazewnictwa
3. **Kompletne opisy** - Pomóż użytkownikom znaleźć produkty
4. **Dobre zdjęcia** - Wiele kątów, wysoka jakość

---

_Ostatnia aktualizacja: 26 listopada 2025 | Wersja 1.0_
