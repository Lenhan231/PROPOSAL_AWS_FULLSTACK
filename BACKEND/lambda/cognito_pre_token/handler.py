"""
Pre Token Generation trigger to ensure Cognito group claims are always
present in issued tokens.

Injects:
- cognito:groups (array) into claimsToAddOrOverride
- groupOverrideDetails.groupsToOverride to mirror existing groups
"""

from typing import Any, Dict, List


def _extract_groups(event: Dict[str, Any]) -> List[str]:
    """
    Extract group names from Pre Token event payload.
    Priority:
    1) request.groupConfiguration.groupsToOverride (Cognito passes current groups)
    2) request.userAttributes["cognito:groups"] (fallback)
    """
    req = event.get("request", {}) or {}
    group_cfg = req.get("groupConfiguration", {}) or {}

    raw = group_cfg.get("groupsToOverride")
    if not raw:
        attrs = req.get("userAttributes", {}) or {}
        raw = attrs.get("cognito:groups") or attrs.get("groups")

    if isinstance(raw, list):
        return [g for g in raw if g]
    if isinstance(raw, str):
        return [g for g in raw.split(",") if g]
    return []


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    # Cognito expects response to be an object; normalize even if None
    response_section = event.get("response") or {}
    event["response"] = response_section

    groups = _extract_groups(event)

    if groups:
        # Ensure response + claimsOverrideDetails are dicts even if Cognito passes None
        cod = response_section.get("claimsOverrideDetails") or {}
        response_section["claimsOverrideDetails"] = cod

        # Use groupOverrideDetails (Cognito will populate cognito:groups in tokens from this)
        cod["groupOverrideDetails"] = {"groupsToOverride": groups}

    return event
