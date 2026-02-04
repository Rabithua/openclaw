---
name: rote-notes
description: Interact with the Rote platform via OpenKey (API Key). Capabilities include creating notes/articles, searching/retrieving notes, managing reactions, and updating user profiles.
---

# Rote Notes Skill

This skill allows you to interact with a Rote instance programmatically using an **OpenKey**.

## Authentication

All API requests **must** include the `openkey` parameter.

- **GET Requests**: Use it as a query parameter: `?openkey=YOUR_API_KEY`
- **POST/PUT/DELETE Requests**: Include `{"openkey": "YOUR_API_KEY"}` in the JSON body.

## Permissions

Ensure the OpenKey has the necessary permissions for the task:

- `SENDROTE`: Create notes (POST /v2/api/openkey/notes)
- `GETROTE`: Retrieve/Search notes (GET /v2/api/openkey/notes)
- `EDITROTE`: Edit/Delete notes
- `SENDARTICLE`: Create articles
- `ADDREACTION`: Add reactions
- `DELETEREACTION`: Delete reactions
- `EDITPROFILE`: Get/Update user profile

## Endpoints

### 1. Create Note

**POST** `/v2/api/openkey/notes`

- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "openkey": "...",
    "content": "Note content (required)",
    "title": "Optional title",
    "state": "private|public",
    "type": "rote|article|other",
    "tags": ["tag1", "tag2"],
    "pin": false,
    "articleId": "optional-article-uuid"
  }
  ```

### 2. Create Article

**POST** `/v2/api/openkey/articles`

- **Body**: `{"openkey": "...", "content": "..."}`

### 3. Retrieve/List Notes

**GET** `/v2/api/openkey/notes`

- **Params**:
  - `openkey`: (Required)
  - `skip`, `limit`: Pagination
  - `archived`: `true`|`false`
  - `tag`: Filter by tag (supports `tag` or `tag[]`). Multiple tags use AND logic.

### 4. Search Notes

**GET** `/v2/api/openkey/notes/search`

- **Params**: `openkey`, `keyword` (required), `skip`, `limit`, `archived`, `tag`.

### 5. Reactions

- **Add**: **POST** `/v2/api/openkey/reactions`
  - **Body**: `{"openkey": "...", "type": "like", "roteid": "note_uuid", "metadata": {}}`
- **Remove**: **DELETE** `/v2/api/openkey/reactions/:roteid/:type?openkey=...`

### 6. User Profile

- **Get**: **GET** `/v2/api/openkey/profile?openkey=...`
- **Update**: **PUT** `/v2/api/openkey/profile`
  - **Body**: `{"openkey": "...", "nickname": "...", "description": "...", "avatar": "...", "username": "..."}`

### 7. Check Permissions

**GET** `/v2/api/openkey/permissions?openkey=...`

## Helper Scripts

For deterministic calls from the host machine, you may use the provided script if applicable, but prefer direct API calls based on the documentation above for full feature support.

- `scripts/rote_openkey.ts`
