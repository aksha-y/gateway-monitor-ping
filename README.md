# UniFi Gateway Monitoring Tool (Production Version)

A comprehensive, self-hosted, ICMP-based monitoring solution designed specifically for tracking the uptime and connectivity of large-scale UniFi Gateway deployments. 

## Features

### 1. Robust ICMP Monitoring Engine
- **Continuous Tracking**: The background worker constantly polls the gateways via ICMP (ping) on a 60-second interval.
- **Server Outage Protection**: If a gateway becomes unreachable, the tool verifies its own internet access against an external host (`1.1.1.1`). If the server itself has lost internet, it gracefully suppresses DOWN alerts to prevent false-positive alert storms.
- **Maintenance Mode**: Properties can be set to Maintenance mode, pausing all active pings and suppressing alerts during scheduled network downtime.

### 2. Intelligent Outage Lifecycle Management
- **5-Minute Threshold**: Gateways must fail consecutive checks for 5 solid minutes before they are officially declared `DOWN`, effectively filtering out temporary packet loss or routing blips.
- **Linear Outage Tracking**: Outages are tracked chronologically from `start_time` to `recovery_time`.
- **Downtime Calculation**: System actively aggregates total downtime in seconds for auditing and SLA compliance.

### 3. Secure Email Alerting
- **No Alert Spam**: The system guarantees exactly ONE alert when the gateway drops, and exactly ONE recovery email when it comes back online. Duplicate alerts are strictly prevented at the database level.
- **Queue System**: If your SMTP server is temporarily unreachable, alerts are held in a `PENDING` state and safely retried, never disrupting the ICMP monitoring worker.
- **Encrypted Credentials**: SMTP passwords are encrypted at rest via AES-256 and never returned to the frontend.

### 4. Enterprise Data Management
- **Bulk CSV Import**: Import thousands of properties at once. Features strict pre-import validation to catch duplicate IDs, malformed IPs, and empty rows *before* they are committed to the database.
- **Comprehensive History**: Every state transition (e.g. `ONLINE` ➔ `POSSIBLE_DOWN`) is permanently logged for auditing.
- **Audit Logs**: All administrative actions (Logins, Logouts, Property Additions) are tracked securely.

### 5. Secure Architecture
- **Authentication**: JWT-based session management locked behind a local SQLite database using strong `bcryptjs` password hashing.
- **Zero Dependencies**: Utilizes an embedded SQLite database (`better-sqlite3`), meaning there are no complex MySQL or PostgreSQL servers to configure or host. It's completely portable.

---

## Installation & Deployment

This application is designed to be effortlessly portable. You can host it on any Windows/Linux machine or public server with Node.js installed.

### Prerequisites
- [Node.js](https://nodejs.org/en) (v18 or higher)
- **Port 50010** must be open on your firewall/server.

### 1-Click Installation (Windows)
1. Download or clone this repository to your target machine.
2. Double-click the `start-unifi-monitor.bat` file.
3. The script will autonomously:
   - Verify Node.js is installed.
   - Install all necessary `npm` dependencies.
   - Compile a fully optimized Production Build (`.next`).
   - Start the Next.js server bound to `0.0.0.0` on Port `50010`.
   - Launch the background ICMP monitoring worker.

### Accessing the Tool
Once running, you can access the tool from any computer on the network or internet (if public IP is assigned) by navigating to:
**http://<YOUR_SERVER_IP>:50010**

*(Example: `http://192.168.10.15:50010`)*

### Default Administrator Credentials
- **Username**: `admin`
- **Password**: `password123`

*(Note: It is highly recommended to change this password in the database for public servers, or restrict access via a reverse proxy/VPN).*

---

## Troubleshooting

### "Monitoring Worker: STALLED"
If the System Health widget on the dashboard reports that the worker is stalled, the background process has died. 
**Fix**: Simply close the terminal window running the `.bat` file and double-click it again to restart the system.

### "SMTP: UNCONFIGURED"
Emails will not be sent, but outages will still be recorded. Go to **Settings > SMTP** to configure your mail server.

### Error: "Invalid Credentials"
If you are locked out, you can reset the password back to `password123` securely by running:
`node reset-password.js`
in the root directory of this project.
