---
name: rote-notes
description: Create, search, and list notes in a self-hosted (or hosted) Rote instance via its OpenKey (API Key) HTTP API. Use when the user wants you to save chat content as notes, default to a Rote “inbox”, tag notes, or retrieve notes by keyword/tag.
---

# Rote Notes

Use this skill to treat **Rote** as the user’s default note backend: capture notes, structure them, and write them into Rote via **OpenKey (API Key)**.

## Quick setup checklist (one-time)

1. Get the user’s **API base** (their self-hosted domain).
  - Example: `https://notes.example.com/v2/api`
2. Get an **API Key (OpenKey)** created in Rote with least privilege:
  - `SENDROTE` (create notes)
  - `GETROTE` (list/search notes)
  - Optional: `SENDARTICLE`, `ADDREACTION`, `DELETEREACTION`, `EDITPROFILE` as needed
3. **Never ask the user to paste keys into public chats.** If they already pasted a key, tell them to revoke/rotate it.

## Core tasks

### 1) Create a note (recommended)

- Prefer `POST /openkey/notes` (JSON body) instead of putting content/tags into URL.
- Default behavior unless user requests otherwise:
  - `state=private`
  - `type=rote`
  - tags include `inbox` (or a user-chosen default tag)
  - title optional

### 1b) Create an article (OpenKey)

- Use `POST /openkey/articles` with JSON body `{ content }`.
- Requires OpenKey permission: `SENDARTICLE`.

If you need a deterministic call from the host machine, use:
- `scripts/rote_openkey.ts` (Deno, recommended)
- `scripts/rote_openkey.py` (Python, kept as a fallback)

### 2) Search notes

- Use `GET /openkey/notes/search?keyword=...`
- Return a short list: title (or first line), createdAt, tags, id, and a 1–2 line snippet.

### 3) List recent notes

- Use `GET /openkey/notes?skip=0&limit=...`
- Allow filtering by tags.

## Security rules

- Treat API Keys as passwords.
- Do not store API Keys in notes, repositories, or logs.
- Prefer **least-privilege** OpenKeys.
## Authentication rules

- All OpenKey requests must include `openkey`.
  - **GET**: use query param `?openkey=...`
  - **POST/PUT/DELETE**: include `{"openkey": "..."}` in JSON body
- The helper script already applies this behavior.

## Additional supported tasks (if requested)

- Add reaction: `POST /openkey/reactions` (`ADDREACTION`)
- Remove reaction: `DELETE /openkey/reactions/:roteid/:type` (`DELETEREACTION`)
- Get profile: `GET /openkey/profile` (`EDITPROFILE`)
- Update profile: `PUT /openkey/profile` (`EDITPROFILE`)
- Check permissions: `GET /openkey/permissions`

## Reference

- Load `references/rote-openkey-api.md` for endpoint details and payload shapes.
