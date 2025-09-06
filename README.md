# CryptoScalperProNg

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.1.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deployment (GitHub Pages)

This repository is configured to deploy the Angular application to **GitHub Pages** from the `gh-pages` branch via a GitHub Actions workflow (`.github/workflows/gh-pages.yml`).

### How it works

1. On every push to `main` (or manual trigger via the Actions tab) the workflow:
	- Installs dependencies with `npm ci`.
	- Builds the app using a base href: `/crypto-scalper-pro/`.
	- Copies `index.html` to `404.html` (SPA deep-link support).
	- Publishes the `dist/crypto-scalper-pro` directory to the `gh-pages` branch (force orphan commit).

### Manual trigger

You can also trigger it manually:
1. Go to GitHub repo -> Actions -> "Deploy Angular app to GitHub Pages" -> Run workflow.

### First-time setup checklist

- Ensure the repository name matches the base href segment (`/crypto-scalper-pro/`).
- In GitHub Settings -> Pages: select `Deploy from a branch` -> `gh-pages` / root.
- Wait for the workflow to finish (1–2 minutes) then open: `https://<your-username>.github.io/crypto-scalper-pro/`.

### Local preview of production build

```bash
npm run build:gh
npx http-server dist/crypto-scalper-pro
```

### Changing repository or custom domain

If you rename the repo or use a custom domain:
- Update the `--base-href` in `package.json` script `build:gh`.
- (Optional) Add a `CNAME` file under `public/` with your domain.

### Re-deploy without code changes

Push an empty commit:

```bash
git commit --allow-empty -m "chore: redeploy"
git push origin main
```

---
Deployment logs are visible in the Actions tab. If something fails, open the latest run and inspect the build / deploy steps.
