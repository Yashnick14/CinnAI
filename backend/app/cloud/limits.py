"""Bound JSON bodies on new cloud routes without touching image uploads."""

from starlette.responses import JSONResponse
from .report_settings import MAX_LOGO_DATA_URL_LENGTH


class CloudBodyLimit:
    # Configure the ASGI wrapper and cloud request-body byte limit.
    def __init__(self, app, limit=131072):
        self.app, self.limit = app, limit

    # Enforce the cloud request size limit while forwarding other ASGI traffic.
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith("/cloud/"):
            return await self.app(scope, receive, send)
        # Only authenticated admin report uploads need room for base64 logo data.
        # Authorization remains enforced by the route; other cloud limits stay unchanged.
        limit = (MAX_LOGO_DATA_URL_LENGTH + 16 * 1024
                 if scope.get("path", "").rstrip("/") == "/cloud/admin/report-settings"
                 and scope.get("method") == "PUT" else self.limit)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                return await JSONResponse(
                    {"detail": "Cloud request is too large."}, status_code=413
                )(scope, receive, send)
            if not message.get("more_body", False):
                break
        sent = False

        # Count streamed request bytes and stop oversized cloud payloads.
        async def bounded_receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)
