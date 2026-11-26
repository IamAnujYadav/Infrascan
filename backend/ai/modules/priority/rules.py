"""Rule-based maintenance priority (spec module 16).

Priority follows the severity category. The spec also lists asset importance,
inspection history and damage progression; those come from the platform
(database) and can be added later as extra inputs.
These mappings are PROVISIONAL and must be agreed with the engineers.
"""
from ai.core.schemas import PriorityResult, SeverityResult
from ai.modules.severity.rules import CRITICAL, NONE

# severity category -> (priority level, engineering review needed?)
PRIORITY_BY_SEVERITY = {
    NONE: ("Routine Monitoring", False),
    "Minor Damage": ("Low Priority", False),
    "Moderate Damage": ("Medium Priority", False),
    "Severe Damage": ("High Priority", True),
    CRITICAL: ("Urgent Engineering Review", True),
}


def decide_priority(severity: SeverityResult, evidence) -> PriorityResult:
    level, review = PRIORITY_BY_SEVERITY[severity.category]
    reason = severity.category + "."
    if evidence.sources:
        reason += " Reported by: " + ", ".join(evidence.sources) + "."
    if review:
        reason += " A qualified engineer should review this finding."
    if evidence.crack_detected and len(evidence.sources) == 1 and level != "Routine Monitoring":
        reason += " Only one model reported it, so confirm it with a follow-up check."
    return PriorityResult(level=level, requires_engineering_review=review, reason=reason)