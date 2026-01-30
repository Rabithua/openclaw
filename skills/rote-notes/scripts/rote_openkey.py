#!/usr/bin/env python3
"""Minimal Rote OpenKey client.

Uses Rote API Key (OpenKey) auth:
  Authorization: Bearer <API_KEY>

Env:
  ROTE_API_BASE  e.g. https://api.rote.ink/v2/api
  ROTE_API_KEY   your OpenKey

Examples:
  ROTE_API_KEY=... python3 rote_openkey.py create --content "hello" --tag inbox --private
  ROTE_API_KEY=... python3 rote_openkey.py list --limit 5
  ROTE_API_KEY=... python3 rote_openkey.py search --keyword "hello"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request


def _api_base() -> str:
    base = os.environ.get("ROTE_API_BASE", "").strip()
    if not base:
        # Sensible default for public hosted API; for self-hosted, override.
        base = "https://api.rote.ink/v2/api"
    return base.rstrip("/")


def _api_key() -> str:
    key = os.environ.get("ROTE_API_KEY", "").strip()
    if not key:
        raise SystemExit("Missing ROTE_API_KEY env var")
    return key


def _request(method: str, path: str, *, query: dict | None = None, body: dict | None = None) -> dict:
    url = _api_base() + path
    if query:
        qs = urllib.parse.urlencode(query, doseq=True)
        url = url + ("?" + qs)

    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Accept": "application/json",
    }

    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return {"httpStatus": e.code, "error": json.loads(raw)}
        except Exception:
            return {"httpStatus": e.code, "error": raw}


def cmd_create(args: argparse.Namespace) -> None:
    payload = {
        "content": args.content,
        "title": args.title,
        "state": "private" if args.private else "public" if args.public else "private",
        "type": args.type,
        "tags": args.tag or [],
        "pin": bool(args.pin),
    }
    # Remove None fields to keep payload clean.
    payload = {k: v for k, v in payload.items() if v is not None}
    out = _request("POST", "/openkey/notes", body=payload)
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_list(args: argparse.Namespace) -> None:
    query = {"skip": args.skip, "limit": args.limit}
    if args.archived is not None:
        query["archived"] = str(args.archived).lower()
    if args.tag:
        # API supports tag or tag[] (hasEvery logic). Use repeated tag.
        query["tag"] = args.tag
    out = _request("GET", "/openkey/notes", query=query)
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_search(args: argparse.Namespace) -> None:
    query = {
        "keyword": args.keyword,
        "skip": args.skip,
        "limit": args.limit,
    }
    if args.archived is not None:
        query["archived"] = str(args.archived).lower()
    if args.tag:
        query["tag"] = args.tag
    out = _request("GET", "/openkey/notes/search", query=query)
    print(json.dumps(out, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Rote OpenKey client")
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("create", help="Create a note")
    pc.add_argument("--content", required=True)
    pc.add_argument("--title")
    pc.add_argument("--type", default="rote", choices=["rote", "article", "other"])
    pc.add_argument("--tag", action="append", help="Repeatable tag", default=[])
    pc.add_argument("--pin", action="store_true")
    st = pc.add_mutually_exclusive_group()
    st.add_argument("--private", action="store_true")
    st.add_argument("--public", action="store_true")
    pc.set_defaults(func=cmd_create)

    pl = sub.add_parser("list", help="List notes")
    pl.add_argument("--skip", type=int, default=0)
    pl.add_argument("--limit", type=int, default=20)
    pl.add_argument("--archived", type=lambda x: x.lower() == "true", default=None)
    pl.add_argument("--tag", action="append", default=[])
    pl.set_defaults(func=cmd_list)

    ps = sub.add_parser("search", help="Search notes")
    ps.add_argument("--keyword", required=True)
    ps.add_argument("--skip", type=int, default=0)
    ps.add_argument("--limit", type=int, default=20)
    ps.add_argument("--archived", type=lambda x: x.lower() == "true", default=None)
    ps.add_argument("--tag", action="append", default=[])
    ps.set_defaults(func=cmd_search)

    return p


def main(argv: list[str]) -> int:
    p = build_parser()
    args = p.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
