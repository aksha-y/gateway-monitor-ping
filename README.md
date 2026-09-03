# UniFi Gateway Monitoring Tool

![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)
![SQLite](https://img.shields.io/badge/SQLite-embedded-blue?style=flat&logo=sqlite)

A comprehensive, self-hosted monitoring solution designed specifically for tracking the uptime and connectivity of large-scale UniFi Gateway deployments. It leverages a lightweight background ICMP worker and an integrated controller dashboard for real-time alerts.

## 🚀 Key Features

### 1. Robust ICMP Monitoring Engine
- **Continuous Tracking**: The background worker polls the gateways via ICMP (ping) on a configurable interval (default 60s).
- **Server Outage Protection**: Prevents false-positive alert storms. If a gateway is unreachable, the tool verifies its own internet access against `1.1.1.1`. If the server is offline, down alerts are suppressed.
- **Maintenance Mode**: Pause active pings and alerts during scheduled network downtime.

### 2. Intelligent Outage Lifecycle Management
- **5-Minute Threshold**: Gateways must fail consecutive checks for 5 solid minutes before they are officially declared `DOWN`, effectively filtering out temporary packet loss.
- **Linear Outage Tracking**: Outages are tracked chronologically from `start_time` to `recovery_time`.
- **Downtime Calculation**: System actively aggregates total downtime in seconds for auditing and SLA compliance.

### 3. Secure Email Alerting
- **No Alert Spam**: The system guarantees exactly ONE alert when the gateway drops, and exactly ONE recovery email when it comes back online.
- **Queue System**: Alerts are held in a `PENDING` state and safely retried if your SMTP server is temporarily unreachable.
- **Encrypted Credentials**: SMTP passwords are encrypted at rest via AES-256.

### 4. Enterprise Data Management
- **Bulk CSV Import**: Import thousands of properties at once with strict pre-import validation.
- **Comprehensive History**: Every state transition is permanently logged for auditing.
- **Audit Logs**: Administrative actions (Logins, Logouts, Property Additions) are tracked securely.

### 5. Secure Architecture
- **Authentication**: JWT-based session management locked behind a local SQLite database using strong `bcryptjs` password hashing.
- **Zero Dependencies**: Utilizes an embedded SQLite database (`better-sqlite3`). No need to install MySQL or PostgreSQL. Completely portable.

---

## 🛠️ Installation & Deployment

This application is designed to be effortlessly portable. You can host it on any Windows/Linux machine or public server with Node.js installed.

### Prerequisites
- [Node.js](https://nodejs.org/en) (v18 or higher)
- **Port 50010** must be open on your firewall/server if exposing to the network.

### 1-Click Installation (Windows)
1. Download or clone this repository to your target machine.
2. Double-click the `start-unifi-monitor.bat` file.
3. The script will autonomously:
   - Verify Node.js is installed.
   - Install all necessary `npm` dependencies.
   - Compile a fully optimized Production Build.
   - Start the Next.js server bound to `0.0.0.0` on Port `50010`.
   - Launch the background ICMP monitoring worker.

### Accessing the Tool
Once running, you can access the tool from any computer on the network or internet (if public IP is assigned) by navigating to:

**`http://<YOUR_SERVER_IP>:50010`**  
*(Example: `http://192.168.10.15:50010`)*

### Default Administrator Credentials
- **Username**: `admin`
- **Password**: `password123`

*(Note: It is highly recommended to change this password in the database for public servers, or restrict access via a reverse proxy/VPN).*

---

## 🛑 Troubleshooting

### "Monitoring Worker: STALLED"
If the System Health widget on the dashboard reports that the worker is stalled, the background process has died. 
**Fix**: Simply close the terminal window running the `.bat` file and double-click it again to restart the system.

### "SMTP: UNCONFIGURED"
Emails will not be sent, but outages will still be recorded. Go to **Settings > SMTP** in the dashboard to configure your mail server.

### Error: "Invalid Credentials" (Locked Out)
If you are locked out, you can reset the password back to `password123` securely by running:
```bash
node reset-password.js
```
in the root directory of this project.

## 📄 License
This project is proprietary and confidential.
