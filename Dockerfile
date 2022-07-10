# build app
FROM node:16.13.2-alpine as build

# Copy our modified p-queue
WORKDIR /dist

COPY node_modules/p-queue/dist ./p-queue/dist
COPY node_modules/p-queue/source ./p-queue/source
COPY node_modules/p-queue/package.json ./p-queue/package.json

# Copy the react app
WORKDIR /dist/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY tsconfig.json ./
COPY .env.production.local ./
COPY craco.config.js ./
COPY src ./src
COPY public ./public

# Generate licenses file for acknowledgements
RUN yarn generate-licenses
# Build.
RUN yarn build

# build prod
FROM nginx:stable-alpine

COPY --from=build /dist/app/build /usr/share/nginx/html

EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]