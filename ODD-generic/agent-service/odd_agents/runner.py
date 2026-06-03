"""Headless ADK execution helper: run an agent with a single user message and
return its final text. Works across ADK versions where create_session may be
sync or async."""

import inspect
import uuid

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

APP_NAME = "odd"


async def run_agent_text(agent, prompt: str) -> str:
    """Run `agent` on `prompt`, return the final response text."""
    session_service = InMemorySessionService()
    runner = Runner(agent=agent, app_name=APP_NAME, session_service=session_service)

    user_id = "odd-user"
    session_id = uuid.uuid4().hex

    maybe = session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if inspect.isawaitable(maybe):
        await maybe

    content = types.Content(role="user", parts=[types.Part(text=prompt)])

    final_text = ""
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=content
    ):
        if event.is_final_response() and event.content and event.content.parts:
            piece = event.content.parts[0].text
            if piece:
                final_text = piece
    return final_text or ""
