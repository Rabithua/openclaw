# Rote OpenKey (API Key) – Quick Reference

Base: `/v2/api`

Auth header (required):

```
Authorization: Bearer <API_KEY>
```

Permissions:
- `SENDROTE` create notes
- `GETROTE` list/search notes

## Create note (recommended)
`POST /v2/api/openkey/notes`

JSON body:
```json
{
  "content": "...",            
  "title": "optional",
  "state": "private|public",
  "type": "rote|article|other",
  "tags": ["tag1", "tag2"],
  "pin": false
}
```

## Create note (legacy GET)
`GET /v2/api/openkey/notes?content=...&tag=tag1&tag=tag2&state=private`

Avoid this in chat because URLs leak `content` and can expose credentials.

## List notes
`GET /v2/api/openkey/notes?skip=0&limit=20&archived=false&tag=tag1&tag=tag2`

## Search notes
`GET /v2/api/openkey/notes/search?keyword=...&skip=0&limit=20`
