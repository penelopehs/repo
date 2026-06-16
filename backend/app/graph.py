"""Microsoft Graph access on behalf of the authenticated user.

Uses the OAuth2 On-Behalf-Of (OBO) flow: the incoming user access token (issued
for this API) is exchanged, using the app's confidential-client credentials, for a
Microsoft Graph token scoped to the permissions below. That token is then used to
call Graph as the signed-in user.
"""

import msal

from app.auth import settings

# Delegated Graph scopes requested during the OBO exchange. Sites.Read.All is needed
# to read a SharePoint site's document library (requires admin consent).
GRAPH_SCOPES = ["https://graph.microsoft.com/Sites.Read.All"]

_app = msal.ConfidentialClientApplication(
    client_id=settings.azure_client_id,
    authority=f"https://login.microsoftonline.com/{settings.azure_tenant_id}",
    client_credential=settings.azure_client_secret,
)


def get_graph_token_obo(user_token: str) -> str:
    """Exchange a user access token for a Microsoft Graph token via the OBO flow."""
    result = _app.acquire_token_on_behalf_of(user_token, scopes=GRAPH_SCOPES)
    if "access_token" not in result:
        # Surface the AAD error (e.g. consent_required, invalid_grant).
        detail = result.get("error_description") or result.get("error") or "unknown error"
        raise RuntimeError(detail)
    return result["access_token"]
