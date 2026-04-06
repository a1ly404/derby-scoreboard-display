# Plan for external spectator access via Cloudflare Tunnel

## Goal

Allow spectators to view the scoreboard overlay from mobile data while reducing load on the event Wi‑Fi/router.

## Constraints

- Keep the scoreboard PC on the internal LAN.
- Run tunnel/proxy on a separate internal machine.
- Avoid router port-forwarding where possible.
- Use owned custom domain with Cloudflare DNS.
- Prefer secure HTTPS with access control.

## Recommended architecture

Use **Cloudflare Tunnel (`cloudflared`)** on a spare internal machine.

Traffic flow:

1. Spectator opens `https://scoreboard.yourdomain.com` on mobile data.
2. Cloudflare receives request over HTTPS.
3. Cloudflare Tunnel forwards request through outbound tunnel to the spare LAN machine.
4. Spare machine proxies to scoreboard LAN origin (e.g., `http://SCOREBOARD_IP:PORT`).

## Why this option

- No inbound router changes required (outbound tunnel).
- Works behind NAT/dynamic public IP.
- Uses existing Cloudflare DNS ownership.
- Easy HTTPS + optional Cloudflare Access authentication.

## Implementation checklist (for another agent/operator)

1. **Confirm origin**
   - Determine scoreboard overlay URL on LAN (`http://<scoreboard-ip>:<port>/custom/eod-custom-overlay/index.html` or equivalent).
   - Verify spare machine can reach that URL.

2. **Create Tunnel in Cloudflare**
   - In Cloudflare Zero Trust, create a named tunnel (e.g., `scoreboard-tunnel`).
   - Install `cloudflared` on spare machine (macOS/Linux/Windows).
   - Authenticate tunnel connector to account.

3. **Map hostname**
   - Create DNS route for `scoreboard.yourdomain.com` to the tunnel.
   - Configure tunnel ingress to point to scoreboard origin `http://<scoreboard-ip>:<port>`.

4. **Secure access**
   - Enable **Cloudflare Access** policy for `scoreboard.yourdomain.com`.
   - Allow only approved emails/identity provider group (staff/officials).
   - Optional: for public spectators, disable identity login but keep rate limiting + bot protections.

5. **Harden and validate**
   - Add Cloudflare rate limiting rules for overlay path.
   - Test from LTE/5G phone (not on event Wi‑Fi).
   - Confirm latency and concurrent viewer behavior.

6. **Network hygiene at venue**
   - Rotate Wi‑Fi password.
   - Keep event operations on primary SSID.
   - Optionally create separate guest SSID with bandwidth limits.

## Minimal operational runbook

- Start/ensure tunnel service running on spare machine before games.
- Verify external URL loads overlay from mobile data.
- Keep fallback local URL for announcers/operators if internet path degrades.

## Fallback options

If Cloudflare Tunnel is blocked by policy/network:

1. SSH reverse tunnel from spare machine to small public VPS + Caddy TLS on VPS.
2. ngrok paid plan with custom domain.

## Open questions before execution

1. Peak concurrent external viewers expected?
2. Which hostname should be used (`scoreboard.<domain>`?)
3. Should URL be public or staff-authenticated?
4. Which OS is the spare tunnel machine?
