# tezland-react-app

## certbot notes:
to initially get certs (disable ssl): docker-compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ --dry-run -d tz1and.com
set up a cron job to renew the certificates: docker compose run --rm certbot renew