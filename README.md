# tezland-react-app

## certbot notes:
to initially get certs (disable ssl):
docker-compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d tz1and.com -d www.tz1and.com -d backend.tz1and.com
(maybe with --dry-run to test)

set up a cron job to renew the certificates:
docker compose run --rm certbot renew