# Amazon SES setup (Sheplates email)

The app already contains everything on its side: templates, a queue with retries, bounce handling and signing codes. This is what you do in AWS and on the server.

## 1. In AWS (region **Asia Pacific (Mumbai) ap-south-1**)
1. **Verified identity**: SES > Identities > Create identity > *Domain* `sheplates.com`. Tick *Easy DKIM* (2048-bit). Add the three CNAME records it shows to the domain's DNS.
2. **Custom MAIL FROM** (better delivery): on the identity, set MAIL FROM domain `mail.sheplates.com` and add the MX and TXT records shown.
3. **SPF and DMARC** in DNS: TXT on `sheplates.com`: `v=spf1 include:amazonses.com ~all` (merge into your existing SPF if you have one). TXT on `_dmarc.sheplates.com`: `v=DMARC1; p=none; rua=mailto:dmarc@sheplates.com` (move to `p=quarantine` after a few clean weeks).
4. **Production access**: SES starts in *sandbox* (only verified addresses can receive). Request production access: use case "transactional email for a food marketplace: order confirmations, payment and settlement notices, account codes"; say there is no marketing mail, that bounces and complaints are removed automatically, and give the site URL.
5. **Configuration set** `sheplates-prod` > Event destinations > Amazon SNS topic `sheplates-ses-events`, events: *Bounce* and *Complaint*.
6. **SNS**: topic `sheplates-ses-events` > Create subscription > protocol HTTPS > endpoint `https://app.sheplates.com/api/email/ses-events`. The app confirms the subscription by itself once `SNS_TOPIC_ARN` is set and the site is live.
7. **IAM user** `sheplates-ses-sender` with only this policy (replace the account id):
```json
{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }] }
```
Create an access key for it. Put it only in the server's `.env`, never in GitHub or chat.

## 2. On the server (`/var/www/sheplates-production/shared/.env`)
`EMAIL_TRANSPORT=ses`, `AWS_REGION=ap-south-1`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM=Sheplates <no-reply@sheplates.com>`, `EMAIL_REPLY_TO=support@sheplates.com`, `SES_CONFIGURATION_SET=sheplates-prod`, `SNS_TOPIC_ARN=<the topic ARN>`, `CRON_SECRET=<long random>`. Add the cron line from `deploy/hostinger/crontab.txt` so the queue is sent every minute.

## 3. In Supabase
Run `supabase/V9_23_EMAIL_OUTBOX.sql` and `supabase/V9_24_E_SIGNATURES.sql`. For sign-up and password-reset mail: Authentication > SMTP Settings > custom SMTP, host `email-smtp.ap-south-1.amazonaws.com`, port 587, user/password from SES > SMTP settings (a separate SMTP credential, not the access key), sender `no-reply@sheplates.com`.

## 4. Check it works
- Staging first, with a verified test address while still in sandbox. Place a test order: two mails appear in `email_outbox` (customer, vendor) and are sent within a minute.
- SES mailbox simulator: send to `bounce@simulator.amazonses.com`; the address must appear in `email_suppressions`.
- Watch `email_outbox` where `status = 'failed'` (the `last_error` column says why). Keep SES bounce rate under 5% and complaints under 0.1%.

## What sends what
Order confirmed (customer) and new order (vendor) go out when the payment is confirmed. Signing codes go out immediately; the signed agreement copies go to the vendor and to `AGREEMENT_COPY_TO`. Other templates (order status, cancel, refund, payment failed, approval notes, subscription reminders, Wednesday settlement statement, staff account) are ready in `lib/email/templates.ts` and are sent by calling `enqueueEmail` at the matching event.
