---
title: "API Introduction"
slug: "api-introduction"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["api", "integration", "rest", "authentication"]
category: "developer-guide"
difficulty: "intermediate"
audience: ["developers", "integrators"]
status: "published"
author: "AmbraWMS Team"
estimatedReadTime: 15
prerequisites: ["architecture"]
related: ["architecture"]
---

# API Introduction

Welcome to the AmbraWMS API documentation. Learn how to integrate with AmbraWMS programmatically using our REST API.

## Overview

The AmbraWMS API is a REST API that allows you to:

- Manage products and inventory
- Create and track stock movements
- Query real-time stock levels
- Manage locations and warehouses
- Access reports and analytics

### Base URL

```
Production: https://api.ambrawms.com/v1
Staging: https://api-staging.ambrawms.com/v1
```

### API Versioning

The API version is included in the URL path. Current version: **v1**

## Authentication

AmbraWMS uses API keys for authentication.

### Getting an API Key

1. Log in to AmbraWMS
2. Go to **Organization** → **API Settings**
3. Click **Generate New API Key**
4. Name your key (e.g., "Production Integration")
5. Set permissions (read, write, admin)
6. Copy and secure the key

⚠️ **Important**: API keys are shown only once. Store them securely.

### Using the API Key

Include the API key in the `Authorization` header:

```bash
curl https://api.ambrawms.com/v1/products \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### API Key Scopes

Control what the key can access:

- **read**: Read-only access
- **write**: Create and update resources
- **delete**: Delete resources
- **admin**: Full administrative access

## Request Format

### HTTP Methods

- **GET**: Retrieve resources
- **POST**: Create new resources
- **PUT**: Update entire resources
- **PATCH**: Partial update
- **DELETE**: Remove resources

### Content Type

All requests with body data must use:

```
Content-Type: application/json
```

### Example Request

```bash
POST /v1/products
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "name": "Premium T-Shirt",
  "sku": "TEE-001",
  "category_id": "cat_123",
  "unit_of_measure": "ea",
  "price": 29.99
}
```

## Response Format

### Success Response

Status: `200 OK` or `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "name": "Premium T-Shirt",
    "sku": "TEE-001",
    "created_at": "2025-11-26T10:00:00Z"
  }
}
```

### Error Response

Status: `4xx` or `5xx`

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID 'prod_abc123' not found",
    "details": {
      "product_id": "prod_abc123"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning               | Description                        |
| ---- | --------------------- | ---------------------------------- |
| 200  | OK                    | Request succeeded                  |
| 201  | Created               | Resource created successfully      |
| 204  | No Content            | Success, no content to return      |
| 400  | Bad Request           | Invalid request format             |
| 401  | Unauthorized          | Invalid or missing API key         |
| 403  | Forbidden             | API key lacks required permissions |
| 404  | Not Found             | Resource doesn't exist             |
| 422  | Unprocessable Entity  | Validation failed                  |
| 429  | Too Many Requests     | Rate limit exceeded                |
| 500  | Internal Server Error | Server error                       |
| 503  | Service Unavailable   | Temporary outage                   |

## Pagination

List endpoints support pagination:

```bash
GET /v1/products?page=2&limit=50
```

### Query Parameters

- **page**: Page number (default: 1)
- **limit**: Items per page (default: 25, max: 100)

### Response

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

## Filtering

Use query parameters to filter results:

```bash
GET /v1/products?category=electronics&status=active&min_price=100
```

### Common Filters

- **status**: `active`, `inactive`, `archived`
- **category**: Category ID or slug
- **supplier**: Supplier ID
- **location**: Location ID
- **search**: Full-text search
- **created_after**: ISO date
- **updated_after**: ISO date

## Sorting

Sort results with `sort` parameter:

```bash
GET /v1/products?sort=-created_at,name
```

- **Ascending**: `name`, `price`
- **Descending**: `-name`, `-price`
- **Multiple fields**: Comma-separated

## Rate Limiting

### Limits

- **Standard**: 1000 requests/hour
- **Premium**: 10,000 requests/hour
- **Enterprise**: Custom limits

### Headers

Response includes rate limit info:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1638360000
```

### Exceeding Limits

Status: `429 Too Many Requests`

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "retry_after": 3600
  }
}
```

## Webhooks

Subscribe to events in real-time.

### Available Events

- `product.created`
- `product.updated`
- `product.deleted`
- `stock_movement.created`
- `stock_movement.completed`
- `stock_level.low`
- `stock_level.critical`

### Setting Up Webhooks

1. Go to **Organization** → **Webhooks**
2. Click **Add Webhook**
3. Enter endpoint URL
4. Select events to subscribe
5. Set secret for signature verification
6. Save

### Webhook Payload

```json
{
  "id": "evt_123456",
  "type": "product.created",
  "created_at": "2025-11-26T10:00:00Z",
  "data": {
    "object": {
      "id": "prod_abc123",
      "name": "Premium T-Shirt",
      ...
    }
  }
}
```

### Signature Verification

Verify webhook authenticity:

```javascript
const crypto = require("crypto");

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

## SDK & Libraries

### Official SDKs

**JavaScript/TypeScript**

```bash
npm install @ambrawms/sdk
```

```javascript
import { AmbraWMS } from "@ambrawms/sdk";

const client = new AmbraWMS({
  apiKey: "YOUR_API_KEY",
  environment: "production",
});

// Get products
const products = await client.products.list();

// Create product
const product = await client.products.create({
  name: "Premium T-Shirt",
  sku: "TEE-001",
});
```

**Python**

```bash
pip install ambrawms
```

```python
from ambrawms import AmbraWMS

client = AmbraWMS(api_key='YOUR_API_KEY')

# Get products
products = client.products.list()

# Create product
product = client.products.create(
    name='Premium T-Shirt',
    sku='TEE-001'
)
```

**PHP**

```bash
composer require ambrawms/sdk
```

```php
use AmbraWMS\Client;

$client = new Client(['api_key' => 'YOUR_API_KEY']);

// Get products
$products = $client->products->list();

// Create product
$product = $client->products->create([
    'name' => 'Premium T-Shirt',
    'sku' => 'TEE-001'
]);
```

## Common Use Cases

### Sync Inventory from E-commerce

```javascript
// Get low stock products
const products = await client.products.list({
  stock_status: "low",
  limit: 100,
});

// Update external platform
for (const product of products.data) {
  await shopify.updateInventory(product.sku, product.stock.available);
}
```

### Automate Reorder Process

```javascript
// Get products below reorder point
const products = await client.products.list({
  stock_level: "below_reorder",
});

// Create purchase orders
for (const product of products.data) {
  await client.purchase_orders.create({
    supplier_id: product.default_supplier_id,
    items: [
      {
        product_id: product.id,
        quantity: product.reorder_quantity,
      },
    ],
  });
}
```

### Real-time Stock Dashboard

```javascript
// Subscribe to stock level events
client.webhooks.on("stock_level.low", (event) => {
  console.log(`Low stock alert: ${event.data.object.name}`);
  sendSlackNotification(event.data.object);
});

// Get current stock overview
const dashboard = await client.reports.stock_overview({
  warehouse_id: "warehouse_123",
});
```

## Best Practices

### Error Handling

Always handle errors gracefully:

```javascript
try {
  const product = await client.products.get("prod_123");
} catch (error) {
  if (error.code === "PRODUCT_NOT_FOUND") {
    // Handle missing product
  } else if (error.code === "RATE_LIMIT_EXCEEDED") {
    // Wait and retry
    await sleep(error.retry_after * 1000);
  } else {
    // Log and alert
    console.error(error);
  }
}
```

### Retry Logic

Implement exponential backoff:

```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### Batch Operations

Use batch endpoints when available:

```javascript
// ❌ Bad: Multiple requests
for (const product of products) {
  await client.products.create(product);
}

// ✅ Good: Single batch request
await client.products.createBatch(products);
```

### Caching

Cache responses when appropriate:

```javascript
const cache = new Map();

async function getProduct(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }

  const product = await client.products.get(id);
  cache.set(id, product);
  setTimeout(() => cache.delete(id), 60000); // 1 min TTL

  return product;
}
```

## Testing

### Sandbox Environment

Use staging for testing:

```javascript
const client = new AmbraWMS({
  apiKey: "test_YOUR_API_KEY",
  environment: "staging",
});
```

### Test Data

Staging includes test data:

- Sample products
- Test warehouses
- Mock transactions

## Support

### Developer Resources

- **API Reference**: Full endpoint documentation
- **Code Examples**: Common integration patterns
- **Postman Collection**: Ready-to-use API calls

### Getting Help

- **Developer Forum**: community.ambrawms.com
- **Email Support**: developers@ambrawms.com
- **Discord**: discord.gg/ambrawms

## Next Steps

- [API Reference](/docs/api/reference) - Complete endpoint documentation
- [Authentication Guide](/docs/api/auth) - Detailed auth setup
- [Webhooks Guide](/docs/api/webhooks) - Event-driven integrations

---

_Last updated: November 26, 2025 | Version 1.0_
