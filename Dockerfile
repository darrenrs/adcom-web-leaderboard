FROM node:22.10.0

ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

WORKDIR /usr/src/app

COPY public/ public/
COPY .gitignore ./
COPY *.js ./
COPY LICENSE README.md package.json package-lock.json ./

RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "start"]