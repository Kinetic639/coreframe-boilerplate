---
title: "Wprowadzenie do API"
slug: "api-introduction"
lang: "pl"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["api", "integracja", "rest", "uwierzytelnianie"]
category: "przewodnik-deweloperski"
difficulty: "intermediate"
audience: ["deweloperzy", "integratorzy"]
status: "published"
author: "Zespół AmbraWMS"
estimatedReadTime: 15
prerequisites: ["architecture"]
related: ["architecture"]
---

# Wprowadzenie do API

Witamy w dokumentacji API AmbraWMS. Naucz się integrować z AmbraWMS programowo używając naszego REST API.

## Przegląd

API AmbraWMS to REST API, które pozwala na:

- Zarządzanie produktami i inwentarzem
- Tworzenie i śledzenie ruchów magazynowych
- Zapytania o poziomy zapasów w czasie rzeczywistym
- Zarządzanie lokalizacjami i magazynami
- Dostęp do raportów i analiz

### Podstawowy URL

```
Produkcja: https://api.ambrawms.com/v1
Staging: https://api-staging.ambrawms.com/v1
```

### Wersjonowanie API

Wersja API jest zawarta w ścieżce URL. Obecna wersja: **v1**

## Uwierzytelnianie

AmbraWMS używa kluczy API do uwierzytelniania.

### Uzyskiwanie Klucza API

1. Zaloguj się do AmbraWMS
2. Przejdź do **Organizacja** → **Ustawienia API**
3. Kliknij **Wygeneruj Nowy Klucz API**
4. Nazwij swój klucz (np. "Integracja Produkcyjna")
5. Ustaw uprawnienia (odczyt, zapis, admin)
6. Skopiuj i zabezpiecz klucz

⚠️ **Ważne**: Klucze API są pokazywane tylko raz. Przechowuj je bezpiecznie.

### Używanie Klucza API

Dołącz klucz API w nagłówku `Authorization`:

```bash
curl https://api.ambrawms.com/v1/products \
  -H "Authorization: Bearer TWOJ_KLUCZ_API"
```

### Zakresy Klucza API

Kontroluj co klucz może robić:

- **read**: Dostęp tylko do odczytu
- **write**: Tworzenie i aktualizacja zasobów
- **delete**: Usuwanie zasobów
- **admin**: Pełny dostęp administracyjny

## Format Żądania

### Metody HTTP

- **GET**: Pobieranie zasobów
- **POST**: Tworzenie nowych zasobów
- **PUT**: Aktualizacja całych zasobów
- **PATCH**: Częściowa aktualizacja
- **DELETE**: Usuwanie zasobów

### Typ Zawartości

Wszystkie żądania z danymi muszą używać:

```
Content-Type: application/json
```

### Przykładowe Żądanie

```bash
POST /v1/products
Content-Type: application/json
Authorization: Bearer TWOJ_KLUCZ_API

{
  "name": "Koszulka Premium",
  "sku": "TEE-001",
  "category_id": "cat_123",
  "unit_of_measure": "szt",
  "price": 29.99
}
```

## Format Odpowiedzi

### Odpowiedź Sukcesu

Status: `200 OK` lub `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "name": "Koszulka Premium",
    "sku": "TEE-001",
    "created_at": "2025-11-26T10:00:00Z"
  }
}
```

### Odpowiedź Błędu

Status: `4xx` lub `5xx`

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Produkt o ID 'prod_abc123' nie został znaleziony",
    "details": {
      "product_id": "prod_abc123"
    }
  }
}
```

### Kody Statusu HTTP

| Kod | Znaczenie             | Opis                                  |
| --- | --------------------- | ------------------------------------- |
| 200 | OK                    | Żądanie zakończone sukcesem           |
| 201 | Created               | Zasób utworzony pomyślnie             |
| 204 | No Content            | Sukces, brak zawartości do zwrócenia  |
| 400 | Bad Request           | Nieprawidłowy format żądania          |
| 401 | Unauthorized          | Nieprawidłowy lub brakujący klucz API |
| 403 | Forbidden             | Klucz API nie ma wymaganych uprawnień |
| 404 | Not Found             | Zasób nie istnieje                    |
| 422 | Unprocessable Entity  | Walidacja nie powiodła się            |
| 429 | Too Many Requests     | Przekroczony limit zapytań            |
| 500 | Internal Server Error | Błąd serwera                          |
| 503 | Service Unavailable   | Tymczasowa awaria                     |

## Paginacja

Endpointy listowe obsługują paginację:

```bash
GET /v1/products?page=2&limit=50
```

### Parametry Zapytania

- **page**: Numer strony (domyślnie: 1)
- **limit**: Elementów na stronę (domyślnie: 25, max: 100)

### Odpowiedź

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 150,
    "pages": 3,
    "has_next": true,
    "has_prev": true
  }
}
```

## Filtrowanie

Użyj parametrów zapytania do filtrowania wyników:

```bash
GET /v1/products?category=electronics&status=active&min_price=100
```

### Popularne Filtry

- **status**: `active`, `inactive`, `archived`
- **category**: ID lub slug kategorii
- **supplier**: ID dostawcy
- **location**: ID lokalizacji
- **search**: Wyszukiwanie pełnotekstowe
- **created_after**: Data ISO
- **updated_after**: Data ISO

## Sortowanie

Sortuj wyniki z parametrem `sort`:

```bash
GET /v1/products?sort=-created_at,name
```

- **Rosnąco**: `name`, `price`
- **Malejąco**: `-name`, `-price`
- **Wiele pól**: Oddzielone przecinkami

## Limit Zapytań

### Limity

- **Standardowy**: 1000 zapytań/godzinę
- **Premium**: 10,000 zapytań/godzinę
- **Enterprise**: Niestandardowe limity

### Nagłówki

Odpowiedź zawiera informacje o limicie:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1638360000
```

### Przekroczenie Limitów

Status: `429 Too Many Requests`

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Limit zapytań przekroczony. Spróbuj ponownie za 3600 sekund.",
    "retry_after": 3600
  }
}
```

## Webhooks

Subskrybuj zdarzenia w czasie rzeczywistym.

### Dostępne Zdarzenia

- `product.created`
- `product.updated`
- `product.deleted`
- `stock_movement.created`
- `stock_movement.completed`
- `stock_level.low`
- `stock_level.critical`

### Konfiguracja Webhooks

1. Przejdź do **Organizacja** → **Webhooks**
2. Kliknij **Dodaj Webhook**
3. Wprowadź URL endpointu
4. Wybierz zdarzenia do subskrypcji
5. Ustaw sekret do weryfikacji podpisu
6. Zapisz

## SDK i Biblioteki

### Oficjalne SDK

**JavaScript/TypeScript**

```bash
npm install @ambrawms/sdk
```

```javascript
import { AmbraWMS } from "@ambrawms/sdk";

const client = new AmbraWMS({
  apiKey: "TWOJ_KLUCZ_API",
  environment: "production",
});

// Pobierz produkty
const products = await client.products.list();

// Utwórz produkt
const product = await client.products.create({
  name: "Koszulka Premium",
  sku: "TEE-001",
});
```

**Python**

```bash
pip install ambrawms
```

```python
from ambrawms import AmbraWMS

client = AmbraWMS(api_key='TWOJ_KLUCZ_API')

# Pobierz produkty
products = client.products.list()

# Utwórz produkt
product = client.products.create(
    name='Koszulka Premium',
    sku='TEE-001'
)
```

**PHP**

```bash
composer require ambrawms/sdk
```

```php
use AmbraWMS\Client;

$client = new Client(['api_key' => 'TWOJ_KLUCZ_API']);

// Pobierz produkty
$products = $client->products->list();

// Utwórz produkt
$product = $client->products->create([
    'name' => 'Koszulka Premium',
    'sku' => 'TEE-001'
]);
```

## Najlepsze Praktyki

### Obsługa Błędów

Zawsze obsługuj błędy w sposób elegancki:

```javascript
try {
  const product = await client.products.get("prod_123");
} catch (error) {
  if (error.code === "PRODUCT_NOT_FOUND") {
    // Obsłuż brakujący produkt
  } else if (error.code === "RATE_LIMIT_EXCEEDED") {
    // Poczekaj i spróbuj ponownie
    await sleep(error.retry_after * 1000);
  } else {
    // Zaloguj i powiadom
    console.error(error);
  }
}
```

## Wsparcie

### Zasoby Deweloperskie

- **Dokumentacja API**: Pełna dokumentacja endpointów
- **Przykłady Kodu**: Popularne wzorce integracji
- **Kolekcja Postman**: Gotowe do użycia wywołania API

### Uzyskiwanie Pomocy

- **Forum Deweloperów**: community.ambrawms.com
- **Wsparcie Email**: developers@ambrawms.com
- **Discord**: discord.gg/ambrawms

## Następne Kroki

- [Dokumentacja API](/docs/api/reference) - Kompletna dokumentacja endpointów
- [Przewodnik Uwierzytelniania](/docs/api/auth) - Szczegółowa konfiguracja auth
- [Przewodnik Webhooks](/docs/api/webhooks) - Integracje oparte na zdarzeniach

---

_Ostatnia aktualizacja: 26 listopada 2025 | Wersja 1.0_
