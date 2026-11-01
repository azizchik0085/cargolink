# CARGOLINK — Production Deployment & DevOps Runbook

This guide covers the zero-downtime, enterprise-grade deployment of **CARGOLINK** on production servers (Ubuntu 22.04 / 24.04 LTS, AWS EC2, DigitalOcean, or Hetzner).

---

## 1. Prerequisites
- Docker Engine >= 26.0 & Docker Compose >= 2.27
- Registered Domain Name (`cargolink.io` / DNS A records pointed to server IP)
- Ports 80 & 443 open in firewall / Security Group

---

## 2. Server Setup & Clone
```bash
# Update server
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw

# Configure UFW Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Environment & Secrets Configuration
Copy the template and generate secure random credentials:
```bash
cd cargolink
cp .env.example .env

# Generate secure 64-char secrets
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)

# Update in .env
sed -i "s/REPLACE_WITH_SECURE_RANDOM_SECRET_KEY_MIN_32_CHARS/$SECRET_KEY/g" .env
sed -i "s/REPLACE_WITH_STRONG_DB_PASSWORD/$POSTGRES_PASSWORD/g" .env
sed -i "s/REPLACE_WITH_STRONG_REDIS_PASSWORD/$REDIS_PASSWORD/g" .env
```

> [!CAUTION]
> Never commit `.env` or production credentials to git repositories.

---

## 4. Initial SSL Certificate Generation (Certbot)
Run an ephemeral Certbot container to obtain the initial Let's Encrypt certificate:
```bash
docker run -it --rm -p 80:80 \
  -v $(pwd)/certbot_certs:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d cargolink.io -d www.cargolink.io \
  --email admin@cargolink.io --agree-tos --no-eff-email
```

---

## 5. Launch Full Stack with Docker Compose
```bash
docker compose up -d --build
```

Verify all 6 services are healthy:
```bash
docker compose ps
```
Expected output:
- `cargolink_nginx` (healthy, ports 80/443)
- `cargolink_certbot` (running)
- `cargolink_web` (running)
- `cargolink_backend` (healthy, port 8000)
- `cargolink_db` (healthy, PostGIS 16)
- `cargolink_redis` (healthy, Redis 7)

---

## 6. Automated Daily Backups
Add a cron job on the host machine to execute the database backup daily at 03:00 AM:
```bash
crontab -e
```
Add the following line:
```cron
0 3 * * * docker exec cargolink_db /usr/local/bin/backup.sh >> /var/log/cargolink_backup.log 2>&1
```

---

## 7. Zero-Downtime Rolling Updates
To deploy code updates with zero downtime:
```bash
git pull origin main
docker compose build backend web
docker compose up -d --no-deps backend web
```

---

## 8. Health Check & Monitoring
- **Health Check Endpoint:** `https://cargolink.io/health`
- **Application Logs:**
  ```bash
  docker compose logs -f backend
  docker compose logs -f nginx
  ```
- **Live Metrics:** Check MRR and platform usage via the Super Admin Dashboard.
