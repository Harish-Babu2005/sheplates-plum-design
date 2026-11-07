# Deploying Sheplates on a Hostinger VPS

Two sites on one VPS (Ubuntu 22.04/24.04): **production** `app.sheplates.com` (port 3000) and **staging** `staging.sheplates.com` (port 3001). Staging uses its own Supabase project, Razorpay *test* keys and a password in front of it.

## One-time server setup (as root, then a normal `deploy` user)
```bash
adduser deploy && usermod -aG sudo deploy
apt update && apt install -y nginx certbot python3-certbot-nginx ufw rsync curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs && npm i -g pm2
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
mkdir -p /var/www/sheplates-production/{releases,shared} /var/www/sheplates-staging/{releases,shared} && chown -R deploy:deploy /var/www
```
1. Point DNS `A` records for `app` and `staging` at the VPS address.
2. Copy `deploy/hostinger/nginx.conf` to `/etc/nginx/sites-available/sheplates`, enable it, run `certbot --nginx`, `nginx -t`, `systemctl reload nginx`. Create the staging password: `htpasswd -c /etc/nginx/.htpasswd-staging team`.
3. Create `/var/www/sheplates-production/shared/.env` from `deploy/hostinger/env.production.example` (and the staging one with test keys), `chmod 600`.
4. `sudo -u deploy pm2 startup` and run the command it prints, so the apps return after a reboot.
5. Add the cron lines from `deploy/hostinger/crontab.txt` for the `deploy` user.
6. SSH key for GitHub: `ssh-keygen -t ed25519 -f deploy_key`, put the public half in `/home/deploy/.ssh/authorized_keys`, the private half in the GitHub environment secret `SSH_PRIVATE_KEY`.

## GitHub
Settings > Environments: create `staging` and `production`. On `production` add **Required reviewers** (you), so nothing goes live without approval. Fill the secrets and variables listed at the top of `.github/workflows/deploy-hostinger.yml`.

## Daily use
- Push to `staging` branch: tests run, build, upload, health check, live on staging.
- Merge to `main`: same, then waits for your approval, then goes live on production.
- If the health check (`/api/health`) fails, the pipeline switches back to the previous release by itself.
- Manual rollback: Actions > *Deploy to Hostinger VPS* > Run workflow > `rollback_to` = a folder name from `/var/www/sheplates-production/releases`.
- The last 5 releases are kept.

## Before going live
Run the SQL files in `supabase/` that are pending (see the hand-over note), set Razorpay live keys and the webhook URL `https://app.sheplates.com/api/payments/razorpay/webhook`, finish SES (`docs/SES_SETUP.md`), turn on Supabase backups, add an uptime monitor on `/api/health`, and confirm `NEXT_PUBLIC_DEMO_MODE=false` and `NEXT_PUBLIC_BRAND_SPLASH` is not set to `off`.

## Notes
PDFs and the web manifest are served with the correct types by `nginx.conf` (the old host sent them as `application/octet-stream`). The real visitor address reaches the app through `X-Real-IP`, which is what the e-signature audit page records.
