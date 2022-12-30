docker-build:
	docker-compose build --pull

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down -v

docker-push:
	docker save -o tezland-app-latest.tar tezland-app:latest
	rsync tezland-app-latest.tar docker-compose.yml nginx.conf tz1and.com:/home/yves/docker
	ssh tz1and.com "source .profile; cd docker; docker load -i tezland-app-latest.tar; mv nginx.conf nginx/conf/"
#	"; rm tezland-app-latest.tar"
	rm tezland-app-latest.tar
# mybe docker clean images or whatever
