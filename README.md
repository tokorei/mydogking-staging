# MyDogKing staging

This repository publishes the encrypted preview on GitHub Pages from the `docs` directory. Original website files are kept in the project workspace. The build utility, access screen and service worker are included here to reproduce the staging package.

From a checkout containing the website, set `STAGING_PASSWORD` in the environment and run:

```sh
node staging/build.mjs dist staging-output
```

The output directory must be new. Replace the published `docs` directory with its contents for each release. The per-release encryption key is derived from the preview password using PBKDF2-SHA256. A successful unlock lasts up to eight hours in that browser. Use HTTPS or localhost for service worker support. A short shared passcode is intended for demonstration material.
