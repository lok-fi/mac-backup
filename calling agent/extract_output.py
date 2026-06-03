"""
Post-call: extract 15 structured output fields from the transcript using Gemini Flash.
"""
import json
import logging

from google import genai

from config import settings

log = logging.getLogger(__name__)

EXTRACTION_MODEL = "gemini-3.1-flash-lite-preview"

_PROMPT_TEMPLATE = """
You are analyzing a phone call transcript between a TeamLease AI agent and a prospect.

Extract ALL fields listed below. Return ONLY a valid JSON object — no markdown, no explanation.

=== LEAD INFO (pre-filled from form) ===
Name: {name}
Phone: {phone}
Email: {email}

=== TRANSCRIPT ===
{transcript}

=== FIELDS TO EXTRACT ===
{{
  "company_name": string | null,
  "person_name": string,                    // use lead info if not mentioned in call
  "person_designation": string | null,
  "person_email": string,                   // use lead info if not mentioned
  "person_phone": string,                   // use lead info
  "contract_staffing_required": "yes" | "no" | null,
  "contract_staffing_mode": "transfer" | "hire" | null,
  "number_of_staff": number | null,
  "roles_of_staff": [string] | null,
  "experience_of_roles": string | null,
  "salary_of_roles": string | null,
  "location_of_roles": [string] | null,
  "other_requirements": string | null,      // if not contract staffing
  "call_type": "business" | "candidate" | "associate",
  "call_summary": string                    // 2-3 sentence summary
}}

Rules:
- call_type = "business" if the caller is a company/HR representative
- call_type = "candidate" if they are looking for a job
- call_type = "associate" if they are a TeamLease employee/associate
- Use null for any field that cannot be determined from the conversation
- person_name, person_email, person_phone should default to lead info if not overridden in call
"""


async def extract_output_variables(transcript: list[dict], lead: dict) -> tuple[dict, str, str]:
    """
    Returns (output_dict, call_type, summary).
    """
    if not transcript:
        return {}, "business", "No conversation recorded."

    transcript_text = "\n".join(
        f"{'Agent' if t['role'] == 'assistant' else 'Caller'}: {t['text']}"
        for t in transcript
    )

    prompt = _PROMPT_TEMPLATE.format(
        name=lead.get("name", ""),
        phone=lead.get("phone", ""),
        email=lead.get("email", ""),
        transcript=transcript_text,
    )

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        resp = await client.aio.models.generate_content(
            model=EXTRACTION_MODEL,
            contents=prompt,
        )
        raw = resp.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json\n"):
                raw = raw[5:]
        output = json.loads(raw)
    except Exception as exc:
        log.error("Output extraction failed: %s", exc)
        output = {"error": str(exc), "person_name": lead.get("name"), "person_phone": lead.get("phone")}

    call_type = output.get("call_type", "business")
    summary = output.pop("call_summary", None) or "Call completed."
    return output, call_type, summary
