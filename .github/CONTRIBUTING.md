# Contributing to Devloom

Thanks for helping improve the local development workspace.

1. Read the [contribution and issue guidelines](../README.md#contributing).
2. Branch from `dev`, using a focused name such as `fix/log-filter` or `feat/service-health`.
3. Keep the [interface and code conventions](../DESIGN.md) intact.
4. Run `npm run check`. For UI changes, also run `npm run test:e2e`.
5. Open a pull request against **`dev`**, explain the change, and include validation results.

`main` contains the reviewed project baseline; `dev` is the integration branch. Maintainers promote reviewed changes from `dev` to `main`.

CI checks Node.js 22 and 24, runs Chromium browser tests, and builds the Docker image. Browser screenshots are available as workflow artifacts.

Use the [bug report or feature request forms](https://github.com/daisyorscry/devloom/issues/new/choose) for reproducible problems and focused proposals. Keep discussion respectful, and never include private logs or credentials. Report vulnerabilities through [private reporting](https://github.com/daisyorscry/devloom/security/advisories/new).
