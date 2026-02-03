# Rote OpenKey (API Key) – Quick Reference

Base: `/v2/api`

Auth (required): include `openkey`

- **GET**: `?openkey=YOUR_API_KEY`
- **POST/PUT/DELETE**: JSON body includes `{"openkey": "YOUR_API_KEY"}`

Permissions:
- `SENDROTE` create notes
- `GETROTE` list/search notes
- `SENDARTICLE` create articles
- `ADDREACTION` add reactions
- `DELETEREACTION` delete reactions
- `EDITPROFILE` get/update profile

## Create note (recommended)
`POST /v2/api/openkey/notes`

JSON body:
```json
{
  "openkey": "YOUR_API_KEY",
  "content": "...",            
  "title": "optional",
  "state": "private|public",
  "type": "rote|article|other",
  "tags": ["tag1", "tag2"],
  "pin": false,
  "articleId": "optional-article-uuid"
}
```

## Create note (legacy GET)
`GET /v2/api/openkey/notes/create?openkey=...&content=...&tag=tag1&tag=tag2&state=private`

Avoid this in chat because URLs leak `content` and can expose credentials.

## List notes
`GET /v2/api/openkey/notes?openkey=...&skip=0&limit=20&archived=false&tag=tag1&tag=tag2`

Notes:
- Tag filter accepts `tag` or `tag[]` and uses **hasEvery** (note must include all specified tags).
- Other query params act as exact-match filters for note fields.

## Search notes
`GET /v2/api/openkey/notes/search?openkey=...&keyword=...&skip=0&limit=20`

## Create article
`POST /v2/api/openkey/articles`

JSON body:
```json
{
  "openkey": "YOUR_API_KEY",
  "content": "..."
}
```

## Add reaction
`POST /v2/api/openkey/reactions`

JSON body:
```json
{
  "openkey": "YOUR_API_KEY",
  "type": "like",
  "roteid": "note_uuid",
  "metadata": {}
}
```

## Remove reaction
`DELETE /v2/api/openkey/reactions/:roteid/:type?openkey=...`

## Get profile
`GET /v2/api/openkey/profile?openkey=...`

## Update profile
`PUT /v2/api/openkey/profile`

JSON body:
```json
{
  "openkey": "YOUR_API_KEY",
  "nickname": "New Nickname",
  "description": "New description",
  "avatar": "https://example.com/new-avatar.jpg",
  "cover": "https://example.com/new-cover.jpg",
  "username": "newusername"
}
```

## Check permissions
`GET /v2/api/openkey/permissions?openkey=...`
