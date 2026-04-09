# Stelld Infrastructure & Deployment

**Last updated:** 2026-04-08

## Architecture Overview

```
Internet
  └── Route 53 (stelld.ca DNS)
       └── ALB (HTTPS, ACM cert)
            └── EC2 (t3.small, ca-central-1)
                 └── Docker container (--network host)
                      └── Next.js 16 (standalone build)

PostgreSQL (RDS, ca-central-1)
  └── Automated backups, encryption at rest

Resend (external)
  └── Transactional email (password resets, submission notifications)
```

## Server

- **EC2 instance:** t3.small, ca-central-1
- **OS:** Amazon Linux 2023
- **Docker:** Container runs with `--network host` (required for IAM role access to instance metadata)
- **App directory:** `/home/ec2-user/stelld/`

## Docker

### Build & Deploy

```bash
# On EC2, from the app directory:
docker build -t stelld .
docker stop stelld && docker rm stelld
docker run -d --name stelld --network host --env-file .env stelld
```

### Why `--network host`?

The container needs access to the EC2 instance metadata service (169.254.169.254) to use the IAM role for AWS SDK calls. Docker's default bridge network blocks this. Using `--network host` shares the host's network stack directly. No `-p 3000:3000` is needed.

### Dockerfile

Multi-stage build: deps → build (with Prisma generate) → production runner. Uses Next.js standalone output mode. Runs as non-root `nextjs` user on port 3000.

## Email: Resend

**Previous:** Amazon SES (ca-central-1). Abandoned because AWS denied production access for a new account, and SES sandbox mode only allows sending to verified recipient addresses.

**Current:** Resend (resend.com)

- Sender domain: `stelld.ca` (verified via DNS records)
- From address: `noreply@stelld.ca`
- Email types: password resets, form submission notifications
- No marketing emails

### Environment Variables

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@stelld.ca
```

### Code

Email sending is in `src/lib/email.ts`. Uses the `resend` npm package. Two functions:
- `sendPasswordResetEmail(toEmail, token)` — bilingual EN/FR reset link
- `sendSubmissionNotification(toEmail, formTitle, formId, submissionId)` — bilingual notification with dashboard link

## DNS

### stelld.ca
- Managed in Route 53
- A record → ALB
- Resend DNS records (DKIM, SPF) for email sending
- ACM certificate for HTTPS

### jsdesigns.ca
- SES domain verification pending (not actively used)
- Can be removed from SES verified identities

## Environment Variables (Server)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (RDS) |
| `AUTH_SECRET` | Auth.js session secret |
| `NEXT_PUBLIC_APP_URL` | `https://www.stelld.ca` |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `EMAIL_FROM` | Sender address (`noreply@stelld.ca`) |
| `AWS_REGION` | `ca-central-1` |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

**Important:** Do NOT set empty `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` — the AWS SDK will try to use them instead of the IAM role.

## Database

- **Engine:** PostgreSQL 16 on RDS
- **Region:** ca-central-1 (Montreal)
- **Encryption:** At rest (AWS-managed key)
- **Backups:** Automated daily snapshots
- **ORM:** Prisma v6 (generates client to `src/generated/prisma/client`)

## SSL/HTTPS

- ACM certificate on the ALB
- All traffic terminates HTTPS at the ALB, forwarded to port 3000 on EC2

## Deployment Process

1. Push code changes to the repository
2. SSH into EC2
3. Pull latest code: `git pull`
4. Rebuild Docker image: `docker build -t stelld .`
5. Restart container: `docker stop stelld && docker rm stelld && docker run -d --name stelld --network host --env-file .env stelld`
6. Verify: `docker logs stelld --tail 20`

## Troubleshooting

### Container can't send emails
- Check `docker logs stelld --tail 30` for error messages
- Verify `RESEND_API_KEY` is set in `.env`
- Verify `stelld.ca` domain is verified in Resend dashboard

### Container can't reach RDS
- Ensure security group allows inbound PostgreSQL (5432) from EC2
- Check `DATABASE_URL` in `.env`

### Container can't access AWS services (S3, etc.)
- Must use `--network host` for IAM role credential access
- Do not set empty `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in `.env`
