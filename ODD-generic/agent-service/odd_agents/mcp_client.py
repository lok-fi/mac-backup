"""MCP connection helpers built on ADK's MCPToolset. Defensive across ADK
versions where the connection-params class lives in different modules / has
different names. Targets remote MCP servers over Streamable HTTP (with an SSE
fallback), authenticated with a bearer token in the request headers."""

from typing import Dict, List, Optional


def _connection_params(url: str, token: Optional[str]):
    headers: Dict[str, str] = {}
    if token:
        headers["Authorization"] = "Bearer " + token

    # Streamable HTTP is the current transport; try its class names first,
    # then fall back to SSE for older servers/SDKs.
    candidates = [
        ("google.adk.tools.mcp_tool", "StreamableHTTPConnectionParams"),
        ("google.adk.tools.mcp_tool.mcp_session_manager", "StreamableHTTPConnectionParams"),
        ("google.adk.tools.mcp_tool", "SseConnectionParams"),
        ("google.adk.tools.mcp_tool.mcp_session_manager", "SseConnectionParams"),
        ("google.adk.tools.mcp_tool.mcp_session_manager", "SseServerParams"),
    ]
    last_err = None
    for module_name, cls_name in candidates:
        try:
            module = __import__(module_name, fromlist=[cls_name])
            cls = getattr(module, cls_name)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
        # Try the common constructor signatures.
        for kwargs in ({"url": url, "headers": headers}, {"url": url}):
            try:
                return cls(**kwargs)
            except Exception as exc:  # noqa: BLE001
                last_err = exc
    raise RuntimeError("Could not build an MCP connection params object: %s" % last_err)


def build_toolset(url: str, token: Optional[str]):
    from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset

    params = _connection_params(url, token)
    try:
        return MCPToolset(connection_params=params)
    except TypeError:
        # Some versions accept positional connection params.
        return MCPToolset(params)


async def list_tools(url: str, token: Optional[str]) -> List[dict]:
    """Connect and return the tools/resources the MCP server exposes."""
    toolset = build_toolset(url, token)
    try:
        tools = await toolset.get_tools()
        out = []
        for tool in tools:
            out.append({
                "name": getattr(tool, "name", str(tool)),
                "description": getattr(tool, "description", "") or "",
            })
        return out
    finally:
        await _safe_close(toolset)


async def _safe_close(toolset) -> None:
    for attr in ("close", "aclose"):
        fn = getattr(toolset, attr, None)
        if fn is None:
            continue
        try:
            res = fn()
            if hasattr(res, "__await__"):
                await res
            return
        except Exception:  # noqa: BLE001
            pass
