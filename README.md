# :cherry_blossom: Nice Checkers

[![npm version](https://badge.fury.io/js/html-validate-nice-checkers.svg)](https://www.npmjs.com/package/html-validate-nice-checkers)

[![CI](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/html-validate-nice-checkers/actions/workflows/ci.yml)

[![codecov](https://codecov.io/gh/fulldecent/html-validate-nice-checkers/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/html-validate-nice-checkers)

An opinionated collection of essential HTML validation rules that promote best practices™ for web development. Use this plugin with [HTML-validate](https://html-validate.org/).

## Installation

These instructions assume you are using Nice Checkers as part of a web test suite running Node (20+) and HTML-proofer. See [github-pages-template](https://html-validate.org/) for an end-to-end example, including GitHub Actions continuous integration and GitHub Pages deployment.

### Add package dev dependency

_This is a dev dependency for you because it required to test your website, not to build it._

```sh
# Using Yarn
yarn add -D html-validate-nice-checkers

# Using npm
npm install --dev html-validate-nice-checkers
```

Update your .htmlvalidate.json configuration

```diff
{
  "plugins": ["dist"],
-  "extends": ["htmlvalidate:recommended"]
+  "extends": ["htmlvalidate:recommended", "nice-checkers:recommended"]
}
```

### Usage and configuration

You can configure individual rules:

```json
{
  "plugins": ["nice-checkers"],
  "extends": ["html-validate:recommended", "nice-checkers:recommended"],
  "rules": {
    "nice-checkers/canonical-link": "error",
    "nice-checkers/external-links": [
      "error",
      {
        "skipUrlPatterns": ["example.com", "localhost"],
        "cacheExpiryFoundSeconds": 2592000
      }
    ],
    "nice-checkers/https-links": "warn",
    "nice-checkers/internal-links": [
      "error",
      {
        "webRoot": "./dist",
        "alternativeExtensions": [".html"]
      }
    ],
    "nice-checkers/latest-packages": "warn",
    "nice-checkers/mailto-awesome": [
      "error",
      {
        "requiredParameters": ["subject", "body"]
      }
    ],
    "nice-checkers/no-jquery": "error"
  }
}
```

## Rules

All rules are enabled by default when you extend from `nice-checkers:recommended`.

### `nice-checkers/canonical-link`

Ensures that each HTML document contains a single canonical link element pointing to the preferred URL for that page. Additionally, this requires that your canonical URL does not have a `.html` suffix as that is deprecated usage.

**Bad:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My first website about horses</title>
    <!-- Missing canonical link -->
  </head>
  ody>
    This page is missing a required canonical link element in the head.
  </body>
</html>
```

**Good:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My first website about horses</title>
    <link rel="canonical" href="https://example.com/horses" />
  </head>
  <body>
    This page has a proper canonical link element.
  </body>
</html>
```

**Configuration:**

```json
{
  "rules": {
    "nice-checkers/canonical-link": "error"
  }
}
```

**Common violations:**

- Missing `<link rel="canonical">` in `<head>`
- Canonical URL has file extension (`.html`, `.php`, etc.)
- Canonical URL ends with `/index`

### `nice-checkers/external-links`

Validates that all external links are live and accessible. Uses caching to avoid repeated requests to the same URLs.

**Bad:**

```html
<!-- Broken external link -->
<a href="https://example.com/nonexistent-page">This link is broken</a>

<!-- Link that redirects -->
<a href="http://old-domain.example.com/page">This redirects</a>
```

**Good:**

```html
<!-- Working external link -->
<a href="https://example.com/working-page">This link works</a>
```

**Configuration:**

```json
{
  "rules": {
    "nice-checkers/external-links": [
      "error",
      {
        "proxyUrl": "",
        "skipUrlPatterns": ["example.com", "localhost"],
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

**Options:**

- `skipUrlPatterns`: Array of regex patterns for URLs to skip checking
- `cacheExpiryFoundSeconds`: Cache duration for successful checks (default: 30 days)
- `cacheExpiryNotFoundSeconds`: Cache duration for failed checks (default: 3 days)
- `timeoutSeconds`: Request timeout (default: 5 seconds)

### `nice-checkers/https-links`

Reports insecure HTTP links that are accessible via HTTPS, encouraging the use of secure connections.

**Bad:**

```html
<!-- HTTP link that's also available over HTTPS -->
<a href="http://secure-site.com/page">Should use HTTPS</a>
<img src="http://cdn.example.com/image.jpg" alt="Image" />
```

**Good:**

``tml

<!-- HTTPS link -->

<a href="https://secure-site.com/page">Uses HTTPS</a>
<img src="https://cdn.example.com/image.jpg" alt="Image" />

````

**Configuration:**

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
````

### `nice-checkers/internal-links`

Validates that all internal links point to existing files in your project.

**Bad:**

```html
<!-- Link to non-existent page -->
<a href="/nonexistent-page">Broken internal link</a>

<!-- Link to non-existent image -->
<img src="../images/missing.jpg" alt="Missing image" />
```

**Good:**

```html
<!-- Link to existing page -->
<a href="/about">About page</a>

<!-- Link to existing image -->
<img src="../images/logo.jpg" alt="Company logo" />
```

**Configuration:**

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

**Options:**

- `webRoot`: Root directory for resolving absolute links
- `alternativeExtensions`: Extensions to check for extensionless links
- `indexFile`: Default file to look for in directory links

### `nice-checkers/latest-packages`

Ensures that package assets loaded from CDNs (like jsDelivr) are using the latest version and have proper SRI attributes.

**Bad:**

````html
<!-- Outdated package without SRI -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.0/dist/js/bootstrap.min.js"></script>

<!-- Missing integrity and crossorigin -->
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
/>`` **Good:** ```html
<!-- Latest package with SRI -->
<script
  src="https://cdn.jsdelivr.net/npm/bootstrap@latest/dist/js/bootstrap.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@latest/dist/css/bootstrap.min.css"
  integrity="sha384-..."
  crossorigin="anonymous"
/>
````

**Configuration:**

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

### `nice-checkers/mailto-awesome`

Enforces that mailto links contain specific parameters to improve user experience.

**Bad:**

```html
<!-- Mailto without required parameters -->
<a href="mailto:contact@example.com">Send email</a>
```

**Good:**

```html
<! Mailto with subject and body -->
<a
  href="mailto:contact@example.com?subject=Website%20Inquiry&body=Hello,%20I%20would%20like%20to..."
>
  Send email
</a>
```

**Configuration:**

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

**Options:**

- `requiredParameters`: Array of parameters that must be present (e.g., `["subject", "body", "cc"]`)

### `nice-checkers/no-jquery`

Disallows the use of jQuery, encouraging modern vanilla JavaScript or more modern frameworks.

**Bad:**

```html
<!-- jQuery script tag -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="../js/jquery.min.js"></script>
```

**Good:**

``tml

<!-- Modern JavaScript or other libraries -->
<script src="https://unpkg.com/htmx.org@1.8.4"></script>
<script src="../js/vanilla-app.js"></script>

````

## Development

This package is built with TypeScript and supports both ESM and CommonJS module systems.

### Setup

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
````

### Hint: VS Code setup for Yarn Berry

These notes are [from the Yarn project](https://yarnpkg.com/getting-started/editor-sdks#).

```sh
yarn dlx @yarnpkg/sdks vscode
```

and YES use workspace TypeScript version.

### Development Scripts

```sh
# Build the package
yarn build

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Type checking
yarn lint

# Build in watch mode
yarn build:watch
```

## Publishing

The package uses GitHub Actions for CI/CD:

1. **Tests** run on all versions of Node.js that the Node.js project actively supports (now 20+)
2. **Package validation** tests ESM/CJS imports
3. **Publishing** to npm on tagged releases

## Package features

- ✅ **Dual Module Support**: Works with both ESM (`import`) and CJS (`require`)
- ✅ **TypeScript**: Full type definitions included
- ✅ **Tree Shakeable**: Import only what you need
- ✅ **Zero Dependencies**: No runtime dependencies
- ✅ **Modern Tooling**: Built with tsup, tested with Vitest
- ✅ **Comprehensive Testing**: High test coverage with realistic fixtures

## Browser support

This is a Node.js library designed for build-time HTML validation. For browser usage, ensure your bundler supports the module format you're using.

## Contributing

Ensure your changes pass `yarn test`, `yarn lint` and `yarn format`.

## Deploying

@fulldecent will deploy by making GitHub releases, this triggers the release workflow.
