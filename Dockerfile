# build app
FROM node:16-alpine as build

# Copy our modified p-queue and byte-data
WORKDIR /dist

COPY node_modules/p-queue ./p-queue
COPY node_modules/byte-data ./byte-data

# Copy the react app
WORKDIR /dist/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY index.html ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY .env ./
COPY .env.production ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

# Generate licenses file for acknowledgements
RUN yarn generate-licenses
# Build.
RUN yarn build

# build prod
FROM nginx:stable-alpine

COPY --from=build /dist/app/dist /usr/share/nginx/html

EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]