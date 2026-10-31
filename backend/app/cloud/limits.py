"""Bound JSON bodies on new cloud routes without touching image uploads."""
from starlette.responses import JSONResponse

class CloudBodyLimit:
    def __init__(self, app, limit=131072):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith("/cloud/"):
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > self.limit:
                return await JSONResponse({"detail": "Cloud request is too large."}, status_code=413)(scope, receive, send)
            if not message.get("more_body", False): break
        sent = False
        async def bounded_receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()
        await self.app(scope, bounded_receive, send)
