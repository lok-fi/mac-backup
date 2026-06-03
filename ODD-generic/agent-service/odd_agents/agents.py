"""ADK agent definitions for ODD.

- analyst_agent   : data profile -> full dashboard spec (structured output).
- assistant_agent : question + current spec -> {reply, actions} (JSON text).
- build_mcp_agent : per-request agent wired to a live MCP source for ingestion.
"""

import os

from google.adk.agents import LlmAgent
from google.genai import types

from .prompts import (
    ANALYST_INSTRUCTION,
    ANALYSIS_INSTRUCTION,
    DESIGN_INSTRUCTION,
    ASSISTANT_INSTRUCTION,
    EXTRACT_INSTRUCTION,
    MCP_INGEST_INSTRUCTION,
)
from .schema import DashboardSpec, DataPlan

MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

# The interactive assistant must feel snappy. Flash models run with "thinking"
# enabled by default, which adds several seconds per reply — unnecessary for the
# assistant's short JSON responses. Disable it for low latency.
FAST_CFG = types.GenerateContentConfig(
    temperature=0.3,
    thinking_config=types.ThinkingConfig(thinking_budget=0),
)


# Reused across requests (stateless — per-request data goes in the user message).
analyst_agent = LlmAgent(
    name="odd_analyst",
    model=MODEL,
    instruction=ANALYST_INSTRUCTION,
    description="Designs a dashboard spec from a dataset profile.",
    output_schema=DashboardSpec,   # guarantees a valid spec as JSON
)

assistant_agent = LlmAgent(
    name="odd_assistant",
    model=MODEL,
    instruction=ASSISTANT_INSTRUCTION,
    description="Answers questions and edits the dashboard via JSON actions.",
    generate_content_config=FAST_CFG,   # no thinking -> fast interactive replies
)

extract_agent = LlmAgent(
    name="odd_extract",
    model=MODEL,
    instruction=EXTRACT_INSTRUCTION,
    description="Extracts structured tables from unstructured document text.",
)

# Two-stage "data architect": analyse the data, then design each dashboard.
analysis_agent = LlmAgent(
    name="odd_analysis",
    model=MODEL,
    instruction=ANALYSIS_INSTRUCTION,
    description="Profiles the data and produces a precise Data Plan (roles, grains, groupings).",
    output_schema=DataPlan,
)

design_agent = LlmAgent(
    name="odd_design",
    model=MODEL,
    instruction=DESIGN_INSTRUCTION,
    description="Designs one polished dashboard spec from its plan + column profiles.",
    output_schema=DashboardSpec,
)


def build_mcp_agent(toolset):
    """An agent wired to a live MCP source; used to pull tabular data."""
    return LlmAgent(
        name="odd_mcp_ingest",
        model=MODEL,
        instruction=MCP_INGEST_INSTRUCTION,
        description="Pulls tabular data from a connected MCP source.",
        tools=[toolset],
    )
