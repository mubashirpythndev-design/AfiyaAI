"""Run backend pytest using process-only test settings, never dotenv files.

Existing tests keep their own SQLite fixtures. External network connections are
blocked; ASGI/TestClient and loopback sockets remain available. No LLM imports.
"""
import ipaddress
import os
from pathlib import Path
import socket
import sys

from pydantic_settings import BaseSettings


def main() -> int:
    api = Path(__file__).resolve().parents[1] / "apps" / "api"
    os.chdir(api)
    sys.path.insert(0, str(api))
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
    os.environ["JWT_SECRET"] = "isolated-local-pytest-secret-not-for-deployment"
    os.environ["GEMINI_API_KEY"] = "isolated-test-key-not-valid"
    original_init = BaseSettings.__init__
    def isolated_init(self: BaseSettings, *args: object, **kwargs: object) -> None:
        if self.__class__.__module__ == "app.config":
            kwargs["_env_file"] = None
        original_init(self, *args, **kwargs)
    BaseSettings.__init__ = isolated_init
    original_connect = socket.socket.connect
    def local_connect(self: socket.socket, address: object) -> object:
        if isinstance(address, tuple):
            host = str(address[0])
            try:
                permitted = ipaddress.ip_address(host).is_loopback
            except ValueError:
                permitted = host.lower() == "localhost"
            if not permitted:
                raise OSError("External network disabled for isolated backend tests")
        return original_connect(self, address)
    socket.socket.connect = local_connect
    import pytest
    return pytest.main(sys.argv[1:] or ["tests", "-q", "--disable-warnings", "--tb=short"])


if __name__ == "__main__":
    raise SystemExit(main())
