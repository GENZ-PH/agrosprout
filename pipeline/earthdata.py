"""NASA Earthdata Login (EDL) bearer-token GET, shared by fetch_imerg.py and fetch_smap.py.

The token is read at run time from the env var EARTHDATA_TOKEN or, if that is unset, from
~/infrastructure/.secrets/earthdata-token.txt (override the path with EARTHDATA_TOKEN_FILE).
It is sent only as `Authorization: Bearer <token>` and only to *.nasa.gov hosts: on a redirect
to any other host (for example a pre-signed S3 link) the header is dropped. The token never goes
into a file name, a cache file, a log line or an exception message. Standard library only.
"""
from __future__ import annotations

import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

DEFAULT_TOKEN_FILE = Path.home() / "infrastructure" / ".secrets" / "earthdata-token.txt"
USER_AGENT = "agrosprout-pipeline"
TRUSTED_SUFFIX = ".nasa.gov"


class EarthdataError(RuntimeError):
    """A request failed. The message holds the URL and status, never the token."""


def read_token() -> str:
    tok = os.environ.get("EARTHDATA_TOKEN", "").strip()
    if tok:
        return tok
    path = Path(os.environ.get("EARTHDATA_TOKEN_FILE", str(DEFAULT_TOKEN_FILE)))
    try:
        tok = path.read_text().strip()
    except OSError as e:
        raise EarthdataError(f"no Earthdata token: set EARTHDATA_TOKEN or create {path}") from e
    if not tok:
        raise EarthdataError(f"Earthdata token file {path} is empty")
    return tok


def _trusted(url: str) -> bool:
    host = urllib.parse.urlsplit(url).hostname or ""
    return host == TRUSTED_SUFFIX[1:] or host.endswith(TRUSTED_SUFFIX)


class _Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and not _trusted(newurl):
            new.remove_header("Authorization")
        return new


_opener = urllib.request.build_opener(_Redirect)
_last_call = 0.0


def get(url: str, *, min_interval_s: float = 0.5, timeout_s: float = 120, token: Optional[str] = None,
        method: str = "GET") -> bytes:
    """GET (or POST) `url` with the bearer token, waiting at least `min_interval_s` since the last call."""
    global _last_call
    wait = min_interval_s - (time.monotonic() - _last_call)
    if wait > 0:
        time.sleep(wait)
    _last_call = time.monotonic()
    headers = {"User-Agent": USER_AGENT}
    if _trusted(url):
        headers["Authorization"] = f"Bearer {token or read_token()}"
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with _opener.open(req, timeout=timeout_s) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode("utf-8", "replace")
        raise EarthdataError(f"HTTP {e.code} for {url}: {body}") from None
    except urllib.error.URLError as e:
        raise EarthdataError(f"network error for {url}: {e.reason}") from None


def get_public(url: str, *, timeout_s: float = 60) -> bytes:
    """GET without any credential (CMR search is public)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise EarthdataError(f"HTTP {e.code} for {url}") from None
    except urllib.error.URLError as e:
        raise EarthdataError(f"network error for {url}: {e.reason}") from None
