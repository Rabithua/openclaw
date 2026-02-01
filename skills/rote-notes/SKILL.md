---
name: rote-notes
description: Create, search, and list notes in a self-hosted (or hosted) Rote instance via its OpenKey (API Key) HTTP API. Use when the user wants you to save chat content as notes, default to a Rote “inbox”, tag notes, or retrieve notes by keyword/tag.
---

# Rote Notes

Use this skill to treat **Rote** as the user’s default note backend: capture notes, structure them, and write them into Rote via **OpenKey (API Key)**.

## Quick setup checklist (one-time)

1. Get the user’s **API base** (their self-hosted domain).
   - Example: `https://notes.example.com/v2/api`
2. Get an **API Key** created in Rote with least privilege:
   - `SENDROTE` (create)
   - `GETROTE` (list/search) if needed
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
- Auth mechanism varies by deployment:
  - Some deployments accept `Authorization: Bearer <API_KEY>`.
  - Others require `openkey=<API_KEY>` (query) or `{"openkey": "..."}` (JSON body).
  - This skill defaults to the latter when using the helper script.

## Reference

- Load `references/rote-openkey-api.md` for endpoint details and payload shapes.
