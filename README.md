# :cherry_blossom: Nice Checkers

[![CI](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/ci.yml/badge.svg)](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/ci.yml)

An opinionated collection of essential HTML validation rules that promote best practices™ for web development. Use this plugin with [HTML-validate](https://html-validate.org/).

## Features

- :white_check_mark: **Turnkey validation**: 8 rules covering SEO, security, accessibility, and best practices
- :white_check_mark: **TypeScript**: full type definitions included
- :warning: **Dual module support**: works with both ESM (`import`) and CJS (`require`) (known issue: ESM and CommonJS builds are [sometimes not building correctly](https://github.com/fulldecent/html-validate-nice-checkers/issues/6))
- :white_check_mark: **Tree shakeable**: import only what you need
- :white_check_mark: **Modern tooling**: [built with tsup](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/tsup.config.ts), [tested with Vitest](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/vitest.config.ts), [good IDE hinting](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/tsconfig.json) and [enforced style checking](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/.prettierrc)
- :white_check_mark: **Comprehensive testing**: high test coverage with realistic fixtures

## Installation

These instructions assume you will use Nice Checkers as part of a web test suite running Node (20+) and [HTML-validate](https://html-validate.org/). See [GitHub Pages Template](https://github.com/fulldecent/github-pages-template) for an end-to-end example, including GitHub Actions continuous integration, testing and GitHub Pages deployment for all modern best practices.

### Add package dev dependency

_Nice Checkers is a **dev** dependency for you because you need it to test your website, not to deploy it._

```sh
# Using Yarn
yarn add -D html-validate-nice-checkers

# Using npm
npm install --dev html-validate-nice-checkers
```

### Update your HTML-validate configuration

This example assumes you are using the .htmlvalidate.mjs configuration flavor. HTML-validate also [supports other configuration flavors](https://html-validate.org/usage/index.html#configuration).

```diff
  import { defineConfig } from "html-validate";
+ import { NiceCheckersPlugin } from "@fulldecent/nice-checkers-plugin"

  export default defineConfig({
-   "extends": ["htmlvalidate:recommended"]
+   "plugins": [NiceCheckersPlugin],
+   "extends": ["htmlvalidate:recommended", "nice-checkers-plugin:recommended"]
  });
```

## Rules

All rules are enabled by default when you extend from `nice-checkers-plugin:recommended`. Find introductions and configuration options for each rule below.

### `nice-checkers/alternate-language-url`

Ensures that all alternate language links (`<link rel="alternate" hreflang="...">`) use fully qualified URLs with protocol (https://). This follows Google's best practices for international and multilingual websites.

According to [Google's documentation on localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), alternate language links must use fully qualified URLs:

> "The value of the hreflang attribute identifies the language (in ISO 639-1 format) and optionally a region (in ISO 3166-1 Alpha 2 format) of an alternate URL. **The href attribute contains the full URL of the alternate version.**"

Using relative or protocol-relative URLs can cause search engines to misinterpret or ignore your international content signals.

```diff
- <!-- Incorrect: relative path -->
- <link rel="alternate" hreflang="es" href="/es/page" />
- <link rel="alternate" hreflang="fr" href="../fr/page.html" />
+ <!-- Correct: fully qualified URL -->
+ <link rel="alternate" hreflang="es" href="https://example.com/es/page" />
+ <link rel="alternate" hreflang="fr" href="https://example.fr/page" />
```

#### Configuration

```json
{
  "rules": {
    "nice-checkers/alternate-language-url": "error"
  }
}
```

#### Configuration options

This rule has no configurable options.

### `nice-checkers/canonical-link`

Ensures that each HTML document contains a single canonical link element pointing to the preferred URL for that page. This rule helps with SEO by preventing duplicate content issues and clarifies the primary URL for search engines.

Also this rule enforces that your public URL does not end with a file extension (e.g. `.html`) or an index (`/index`). Each character in your URL is valuable real estate and you should not expose such implementation details in your URL.

```diff
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>My first website about horses</title>
+     <link rel="canonical" href="https://example.com/horses" />
    </head>
    <body>
      This page is missing a required canonical link element in the head.
    </body>
  </html>
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/canonical-link": "error"
  }
}
```

### Configuration options

This rule has no configurable options.

### `nice-checkers/external-links`

Validates that all external links are live and accessible. This rule helps maintain website quality by catching broken external links before they go live, improving user experience and SEO.

**Note:** This rule automatically skips validation of:

- `<link rel="canonical">` - Canonical URLs point to the site itself and may not be published yet during development/preview
- `<link rel="alternate">` - Alternate language URLs also point to the site itself and may not exist during development

This allows you to validate your HTML before publishing, even when the canonical and alternate URLs reference the final production URLs.

```diff
- <a href="https://wrong-subdomain.example.com">This link is broken</a>
+ <a href="https://example.com/nonexistent-page">This link works</a>
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/external-links": [
      "error",
      {
        "proxyUrl": "",
        "skipRegexes": ["://example.com", "://localhost"],
        "cacheExpiryFoundSeconds": 2592000,
        "cacheExpiryNotFoundSeconds": 259200,
        "timeoutSeconds": 5,
        "cacheDatabasePath": "cache/external-links.db",
        "userAgent": "Mozilla/5.0 (compatible; html-validate-nice-checkers)"
      }
    ]
  }
}
```

### Configuration options

| Option                       | Type       | Default                                                   | Description                                             |
| ---------------------------- | ---------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `proxyUrl`                   | `string`   | `""`                                                      | Proxy URL to use for HTTP requests                      |
| `skipRegexes`                | `string[]` | `[]`                                                      | Array of regex patterns for URLs to skip checking       |
| `cacheExpiryFoundSeconds`    | `number`   | `2592000`                                                 | Cache duration for successful checks (default: 30 days) |
| `cacheExpiryNotFoundSeconds` | `number`   | `259200`                                                  | Cache duration for failed checks (default: 3 days)      |
| `timeoutSeconds`             | `number`   | `5`                                                       | Request timeout in seconds                              |
| `cacheDatabasePath`          | `string`   | `"cache/external-links.db"`                               | Path to the cache database file                         |
| `userAgent`                  | `string`   | `"Mozilla/5.0 (compatible; html-validate-nice-checkers)"` | User agent string for HTTP requests                     |

### `nice-checkers/https-links`

Reports insecure HTTP links that are accessible via HTTPS, encouraging the use of secure connections. This rule promotes security best practices by identifying opportunities to upgrade to HTTPS.

```diff
- <a href="http://example.com/page">Should use HTTPS</a>
- <img src="http://cdn.example.com/image.webp" alt="Image" />
+ <a href="https://example.com/page">Uses HTTPS</a>
+ <img src="https://cdn.example.com/image.webp" alt="Image" />
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/https-links": [
      "warn",
      {
        "cacheExpiryFoundSeconds": 2592000,
        "cacheExpiryNotFoundSeconds": 259200,
        "timeoutSeconds": 10,
        "cacheDatabasePath": "cache/https-availability.db"
      }
    ]
  }
}
```

### Configuration options

| Option                       | Type     | Default                         | Description                                                   |
| ---------------------------- | -------- | ------------------------------- | ------------------------------------------------------------- |
| `cacheExpiryFoundSeconds`    | `number` | `2592000`                       | Cache duration for successful HTTPS checks (default: 30 days) |
| `cacheExpiryNotFoundSeconds` | `number` | `259200`                        | Cache duration for failed HTTPS checks (default: 3 days)      |
| `timeoutSeconds`             | `number` | `10`                            | Request timeout in seconds                                    |
| `cacheDatabasePath`          | `string` | `"cache/https-availability.db"` | Path to the cache database file                               |

### `nice-checkers/internal-links`

Validates that all internal links point to existing files in your project. This rule prevents broken internal navigation and missing resource references.

```diff
- <a href="/nonexistent-page">Broken internal link</a>
- <img src="../images/missing.webp" alt="Missing image" />
+ <a href="/about">Working internal link</a>
+ <img src="../images/logo.webp" alt="Company logo" />
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/internal-links": [
      "error",
      {
        "webRoot": "./build",
        "alternativeExtensions": [".html", ".php"],
        "indexFile": "index.html"
      }
    ]
  }
}
```

### Configuration options

| Option                  | Type       | Default        | Description                                 |
| ----------------------- | ---------- | -------------- | ------------------------------------------- |
| `webRoot`               | `string`   | `"./build"`    | Root directory for resolving absolute links |
| `alternativeExtensions` | `string[]` | `[".html"]`    | Extensions to check for extensionless links |
| `indexFile`             | `string`   | `"index.html"` | Default file to look for in directory links |

### `nice-checkers/latest-packages`

Ensures that package assets loaded from CDNs (like jsDelivr) are using the latest version and have proper SRI attributes. This rule promotes security and ensures you're using up-to-date packages.

```diff
- <!-- Outdated package without SRI -->
- <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.0/dist/js/bootstrap.min.js"></script>
+ <!-- Latest package with SRI -->
+ <script
+   src="https://cdn.jsdelivr.net/npm/bootstrap@.../dist/js/bootstrap.min.js"
+   integrity="sha384-..."
+   crossorigin="anonymous"
+ ></script>
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/latest-packages": [
      "warn",
      {
        "cacheExpirySeconds": 172800,
        "timeoutSeconds": 10,
        "cacheDatabasePath": "cache/latest-packages.db",
        "skipUrlPatterns": ["googletagmanager.com"]
      }
    ]
  }
}
```

### Configuration options

| Option               | Type       | Default                      | Description                                                 |
| -------------------- | ---------- | ---------------------------- | ----------------------------------------------------------- |
| `cacheExpirySeconds` | `number`   | `172800`                     | Cache duration for package version checks (default: 2 days) |
| `timeoutSeconds`     | `number`   | `10`                         | Request timeout in seconds                                  |
| `cacheDatabasePath`  | `string`   | `"cache/latest-packages.db"` | Path to the cache database file                             |
| `skipUrlPatterns`    | `string[]` | `[]`                         | Array of URL patterns to skip checking                      |

### `nice-checkers/mailto-awesome`

Enforces that `mailto:` links contain specific parameters to improve user experience. This rule ensures email links provide helpful context to users.

```diff
- <a href="mailto:contact@example.com">Send email</a>
+ <a href="mailto:contact@example.com?subject=Website%20Inquiry&body=Hello,%20I%20would%20like%20to...">Send email</a>
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/mailto-awesome": [
      "error",
      {
        "requiredParameters": ["subject", "body"]
      }
    ]
  }
}
```

### Configuration options

| Option               | Type       | Default | Description                                                                  |
| -------------------- | ---------- | ------- | ---------------------------------------------------------------------------- |
| `requiredParameters` | `string[]` | `[]`    | Array of parameters that must be present (e.g., `["subject", "body", "cc"]`) |

### `nice-checkers/no-jquery`

If you are still using jQuery after 2022, please try to open your favorite chatbot and ask how to replace it with vanilla JavaScript. Your page will run faster. And it is very possible that your chatbot can do this entire operation in one go without interactive back-and-forth.

```diff
- <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
- <script src="../js/jquery.min.js"></script>
```

### Configuration

```json
{
  "rules": {
    "nice-checkers/no-jquery": "error"
  }
}
```

### Configuration options

This rule has no configurable options.

## Development

This package is built with TypeScript and supports both ESM and CommonJS module systems. Thank you for contributing improvements to this project!

:warning: Known issue: ESM and CommonnJS builds are [sometimes not building correctly](https://github.com/fulldecent/html-validate-nice-checkers/issues/6).

### Install

```sh
# Clone the repository
git clone https://github.com/yourusername/html-validate-nice-checkers.git
cd html-validate-nice-checkers

# Setup Node, for example using nvm
nvm use

# Enable Yarn Berry
corepack enable

# Install dependencies
yarn install
```

### Hint: VS Code setup for Yarn Berry

These notes are [from the Yarn project](https://yarnpkg.com/getting-started/editor-sdks#).

```sh
yarn dlx @yarnpkg/sdks vscode
```

and YES, use workspace TypeScript version.

### [Development scripts](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/package.json)

- `yarn build` builds the package
- `yarn build:watch` builds the package in watch mode
- `yarn test` runs the tests once
- `yarn test:watch` runs the tests in watch mode
- `yarn test:coverage` runs the tests and generates a coverage report
- `yarn lint` runs TypeScript type checking
- `yarn format` formats all source files with Prettier

## Publishing to [npm registry](https://www.npmjs.com/package/@fulldecent/nice-checkers-plugin)

@fulldecent will periodically create a GitHub release and this triggers [the npm publish workflow](https://github.com/fulldecent/html-validate-nice-checkers/blob/main/.github/workflows/publish.yml).

## Maintenance

Periodically, load schemaorg-current-https.jsonld file from <https://schema.org/docs/developers.html> and save to src/vendor/schemaorg-current-https.jsonld. Ideally, the sponsors of Schema.org: Google, Inc., Yahoo, Inc., Microsoft Corporation and Yandex should maintain a NPM package for this file that we can depend on. This would allow our package manager to handle updates.

## Browser support

This is a Node.js library designed for build-time HTML validation. For browser usage, ensure your bundler supports the module format you're using. Some of our rules use `cURL` which will not work in the browser. We would like to switch to `fetch()` but [are limited by](https://gitlab.com/html-validate/html-validate/-/issues/317) HTML-validate.

## Contributing

Ensure your changes pass `yarn format && yarn lint && yarn test`.
