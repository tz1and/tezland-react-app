# tezland-react-app

## certbot notes:
to initially get certs (disable ssl):
docker-compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d tz1and.com -d www.tz1and.com -d backend.tz1and.com -d indexer.tz1and.com -d multiplayer.tz1and.com -d framer.tz1and.com
(maybe with --dry-run to test)

set up a cron job to renew the certificates:
docker compose run --rm certbot renew

## after deploying

when the indexer, the backend and the website are deployed, run

docker-compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.indexer.yml up

to start them.