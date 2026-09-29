# Nice Checkers

[![Lint](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/lint.yml)
[![Test](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/fulldecent/html-validate-nice-checkers/actions/workflows/test.yml)

## What this project does

Nice Checkers is an [HTML-validate](https://html-validate.org/) plugin with 11 rules for SEO, security, accessibility, and URLs.

The npm package is [@fulldecent/nice-checkers-plugin](https://www.npmjs.com/package/@fulldecent/nice-checkers-plugin). It publishes ESM and CommonJS builds and TypeScript types. It runs in Node.js while a site is built. Some rules call other sites with `curl`. A `fetch()` implementation is blocked by [html-validate issue 317](https://gitlab.com/html-validate/html-validate/-/issues/317).

`engines` allows Node.js 22.16 and newer, which is the oldest Node.js supported by html-validate 10. [Tests](.github/workflows/test.yml) run on the Node.js 22, 24, and 26 release lines. [Lint](.github/workflows/lint.yml) checks Prettier and markdownlint. Local development uses the Node.js version in [.node-version](.node-version).

[GitHub Pages template](https://github.com/fulldecent/github-pages-template) is a site that uses this plugin, with Actions and Pages deployment.

## Installation

These instructions assume Nice Checkers is part of a web test suite running Node.js 22.16 or newer and [HTML-validate](https://html-validate.org/).

### Add the package

Install Nice Checkers as a dev dependency. It is used to test the site.

Yarn:

```sh
yarn add -D @fulldecent/nice-checkers-plugin
```

npm:

```sh
npm install -D @fulldecent/nice-checkers-plugin
```

### Update your HTML-validate configuration

This example assumes you are using the .htmlvalidate.mjs configuration flavor. HTML-validate also [supports other configuration flavors](https://html-validate.org/usage/index.html#configuration).

```diff
  import { defineConfig } from "html-validate";
+ import NiceCheckersPlugin from "@fulldecent/nice-checkers-plugin"

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

#### Configuration

```json
{
  "rules": {
    "nice-checkers/canonical-link": "error"
  }
}
```

#### Configuration options

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

#### Configuration

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
        "cacheDatabasePath": "cache/external-links.csv",
        "userAgent": "Mozilla/5.0 (compatible; html-validate-nice-checkers)"
      }
    ]
  }
}
```

#### Configuration options

| Option                          | Type                                         | Default                                                   | Description                                                                                                                        |
| ------------------------------- | -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `proxyUrl`                      | `string`                                     | `""`                                                      | Proxy URL to use for HTTP requests                                                                                                 |
| `skipRegexes`                   | `string[]`                                   | `[]`                                                      | Array of regex patterns for URLs to skip checking                                                                                  |
| `cacheExpiryFoundSeconds`       | `number`                                     | `2592000`                                                 | Cache duration for successful checks (default: 30 days)                                                                            |
| `cacheExpiryNotFoundSeconds`    | `number`                                     | `259200`                                                  | Cache duration for failed checks (default: 3 days)                                                                                 |
| `timeoutSeconds`                | `number`                                     | `5`                                                       | Request timeout in seconds                                                                                                         |
| `cacheDatabasePath`             | `string`                                     | `"cache/external-links.csv"`                              | Path to the CSV cache database file                                                                                                |
| `userAgent`                     | `string`                                     | `"Mozilla/5.0 (compatible; html-validate-nice-checkers)"` | User agent string for HTTP requests                                                                                                |
| `manuallyReviewedPath`          | `string`                                     | `""`                                                      | Path to CSV file with manually reviewed URLs (see below)                                                                           |
| `manuallyReviewedExpirySeconds` | `number`                                     | `31536000`                                                | Expiry time for manually reviewed URLs (default: 365 days)                                                                         |
| `urlRewrites`                   | `{ pattern: string, replacement: string }[]` | `[]`                                                      | Regex rewrite rules mapping absolute `https://` URLs to local paths. Matched URLs are checked on disk instead of over the network. |
| `alternativeExtensions`         | `string[]`                                   | `[".html"]`                                               | Extensions to try when a rewritten local path has no extension.                                                                    |
| `indexFile`                     | `string`                                     | `"index.html"`                                            | Filename to look for when a rewritten local path resolves to a directory.                                                          |

When a URL is rewritten to a local path, the rule checks the path as-is, then with each `alternativeExtensions` suffix, then as a directory with `indexFile` — matching Eleventy's pretty-URL output format (e.g. `page.html` or `page/index.html`).

#### Manually reviewed URLs

Some websites resist automated checking (anti-scraping, rate limiting, etc.). You can maintain a CSV file of manually reviewed URLs that should be treated as valid:

**CSV format:**

```csv
url,last_approved_timestamp
https://anti-scraping-site.example.com/page,1764877136
https://example.com/manually-verified,1764877136
```

- The first line must be the header: `url,last_approved_timestamp`
- `url`: The exact URL to approve (must match exactly, including protocol and path)
- `last_approved_timestamp`: Unix timestamp (seconds since epoch) when you last verified the URL

URLs in this file are approved if:

1. The URL matches exactly
2. Current time < (last_approved_timestamp + manuallyReviewedExpirySeconds)

This allows time-limited manual approvals that automatically expire, ensuring you periodically re-verify that URLs still exist.

### `nice-checkers/https-links`

Reports insecure HTTP links that are accessible via HTTPS, encouraging the use of secure connections. This rule promotes security best practices by identifying opportunities to upgrade to HTTPS.

```diff
- <a href="http://example.com/page">Should use HTTPS</a>
- <img src="http://cdn.example.com/image.webp" alt="Image" />
+ <a href="https://example.com/page">Uses HTTPS</a>
+ <img src="https://cdn.example.com/image.webp" alt="Image" />
```

#### Configuration

```json
{
  "rules": {
    "nice-checkers/https-links": [
      "warn",
      {
        "cacheExpiryFoundSeconds": 2592000,
        "cacheExpiryNotFoundSeconds": 259200,
        "timeoutSeconds": 10,
        "cacheDatabasePath": "cache/https-availability.csv"
      }
    ]
  }
}
```

#### Configuration options

| Option                       | Type     | Default                          | Description                                                   |
| ---------------------------- | -------- | -------------------------------- | ------------------------------------------------------------- |
| `cacheExpiryFoundSeconds`    | `number` | `2592000`                        | Cache duration for successful HTTPS checks (default: 30 days) |
| `cacheExpiryNotFoundSeconds` | `number` | `259200`                         | Cache duration for failed HTTPS checks (default: 3 days)      |
| `timeoutSeconds`             | `number` | `10`                             | Request timeout in seconds                                    |
| `cacheDatabasePath`          | `string` | `"cache/https-availability.csv"` | Path to the CSV cache database file                           |

### `nice-checkers/internal-links`

Validates that all internal links point to existing files in your project. This rule prevents broken internal navigation and missing resource references.

**Case-sensitive checking:** This rule performs case-sensitive file matching even on case-insensitive file systems (like macOS default). A link to `/abc.webp` will fail if the actual file is `/AbC.webp`, ensuring your code works correctly on Linux servers where case matters.

```diff
- <a href="/nonexistent-page">Broken internal link</a>
- <img src="../images/missing.webp" alt="Missing image" />
- <a href="/Logo.png">Wrong case (actual file: logo.png)</a>
+ <a href="/about">Working internal link</a>
+ <img src="../images/logo.webp" alt="Company logo" />
+ <a href="/logo.png">Correct case</a>
```

#### Configuration

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

#### Configuration options

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

#### Configuration

```json
{
  "rules": {
    "nice-checkers/latest-packages": [
      "warn",
      {
        "cacheExpirySeconds": 172800,
        "timeoutSeconds": 10,
        "cacheDatabasePath": "cache/latest-packages.csv",
        "skipUrlPatterns": ["googletagmanager.com"]
      }
    ]
  }
}
```

#### Configuration options

| Option               | Type       | Default                       | Description                                                 |
| -------------------- | ---------- | ----------------------------- | ----------------------------------------------------------- |
| `cacheExpirySeconds` | `number`   | `172800`                      | Cache duration for package version checks (default: 2 days) |
| `timeoutSeconds`     | `number`   | `10`                          | Request timeout in seconds                                  |
| `cacheDatabasePath`  | `string`   | `"cache/latest-packages.csv"` | Path to the CSV cache database file                         |
| `skipUrlPatterns`    | `string[]` | `[]`                          | Array of URL patterns to skip checking                      |

### `nice-checkers/match-regex`

Requires page source to match all `mustMatch` regexes and none of the `mustNotMatch` regexes. This rule is off by default because it requires user-provided patterns.

Use this to enforce that specific content or HTML elements are present on every page, or to forbid certain words or patterns. All patterns are evaluated with the `s` (dotAll) flag enabled, so they can match across multiple lines.

When configuring via JSON, patterns must be given as strings. When configuring via JavaScript or TypeScript, each entry may be either a string or a `RegExp` instance. For `RegExp` inputs, all existing user flags are preserved and `s` is added if not already present.

For example, you might require a specific footer script on every page:

```json
{
  "rules": {
    "nice-checkers/match-regex": [
      "error",
      {
        "mustMatch": [
          "<script src=\"/assets/global/site\\.js\\?[0-9a-f]+\" async></script>\\s*</body>"
        ],
        "mustNotMatch": ["naughty"]
      }
    ]
  }
}
```

#### Configuration

```json
{
  "rules": {
    "nice-checkers/match-regex": [
      "error",
      {
        "mustMatch": [],
        "mustNotMatch": []
      }
    ]
  }
}
```

#### Configuration options

| Option         | Type                   | Default | Description                                  |
| -------------- | ---------------------- | ------- | -------------------------------------------- |
| `mustMatch`    | `(string \| RegExp)[]` | `[]`    | Patterns that the page source must match     |
| `mustNotMatch` | `(string \| RegExp)[]` | `[]`    | Patterns that the page source must not match |

### `nice-checkers/mailto-awesome`

Enforces that `mailto:` links contain specific parameters to improve user experience. This rule ensures email links provide helpful context to users.

```diff
- <a href="mailto:contact@example.com">Send email</a>
+ <a href="mailto:contact@example.com?subject=Website%20Inquiry&body=Hello,%20I%20would%20like%20to...">Send email</a>
```

#### Configuration

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

#### Configuration options

| Option               | Type       | Default | Description                                                                  |
| -------------------- | ---------- | ------- | ---------------------------------------------------------------------------- |
| `requiredParameters` | `string[]` | `[]`    | Array of parameters that must be present (e.g., `["subject", "body", "cc"]`) |

### `nice-checkers/no-jquery`

If you are still using jQuery after 2022, please try to open your favorite chatbot and ask how to replace it with vanilla JavaScript. Your page will run faster. And it is very possible that your chatbot can do this entire operation in one go without interactive back-and-forth.

```diff
- <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
- <script src="../js/jquery.min.js"></script>
```

#### Configuration

```json
{
  "rules": {
    "nice-checkers/no-jquery": "error"
  }
}
```

#### Configuration options

This rule has no configurable options.

### `nice-checkers/alternate-language-links`

This rule enforces best practices for alternate language links (`<link rel="alternate" hreflang="...">`) in the `<head>` of HTML documents, as recommended by authoritative and established sources:

- [Google Search Central: specify alternate language pages](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [W3C HTML Standard: link types](https://html.spec.whatwg.org/multipage/links.html#link-type-alternate)

Note that these sources we reference have a conflict. One says that you may use relative URLs and the other says you must use fully qualified URLs. To be conservative, we require fully qualified URLs.

**Activation:** this checker is only active if one or more `<link rel="alternate" hreflang="...">` elements exist in the document `<head>`.

**Checks performed:**

1. **Self-link requirement:**
   - There must be at least one `<link rel="alternate" hreflang="...">` whose `href` exactly matches the canonical URL of the page.
   - The `hreflang` of this self-link must match the page's `<html lang="...">` attribute, if set.
   - The canonical URL must exist (enforced by another checker).

2. **Fully qualified URLs:**
   - Every alternate language link must use a fully qualified URL (must include a scheme, e.g., `https://`).

3. **Reciprocal linking:**
   - Every alternate language page linked out to must reciprocate by linking back to the current page's canonical URL via its own `<link rel="alternate" hreflang="...">`.
   - The `hreflang` of the reciprocal link on the remote page must match the `<html lang="...">` of the current page (if set).
   - This is enforced by fetching the remote page and verifying its `<head>` contains the correct reciprocal link.

**Example:**

- The English page must link to itself and to the French page.
- The French page (`https://example.com/page-fr`) must link back to the English canonical page, and the `hreflang` must match the English page’s `<html lang="en">`.

**References:**

- [Google: specify alternate language pages](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [W3C: link type 'alternate'](https://html.spec.whatwg.org/multipage/links.html#link-type-alternate)

#### Configuration options

| Option        | Type                                         | Default | Description                                                                                                |
| ------------- | -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `urlRewrites` | `{ pattern: string, replacement: string }[]` | `[]`    | Regex rewrite rules applied to each alternate URL before reciprocal validation. Useful for local fixtures. |

### `nice-checkers/schema-org-json-ld`

Validates `<script type="application/ld+json">` structured data against the bundled Schema.org vocabulary. This rule catches typos and mistakes in class names, property names, and property values before search engines silently ignore your structured data.

```diff
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
-   "@type": "MyTotallyFakeClass",
+   "@type": "WebSite",
    "name": "My Awesome Site",
    "url": "https://example.com/"
  }
  </script>
```

#### Configuration

```json
{
  "rules": {
    "nice-checkers/schema-org-json-ld": "error"
  }
}
```

#### Configuration options

This rule has no configurable options.

### Example configuration for local build validation

```json
{
  "rules": {
    "nice-checkers/alternate-language-links": [
      "error",
      {
        "urlRewrites": [
          {
            "pattern": "^https://example\\.invalid",
            "replacement": "./build"
          }
        ]
      }
    ]
  }
}
```

With this configuration, an alternate URL like `https://example.invalid/some-page` is validated against `./build/some-page.html` or `./build/some-page/index.html` without network access.

## Disabled html-validate core rules

`nice-checkers-plugin:recommended` explicitly turns off the following built-in html-validate rules because they conflict with common HTML minification tools.

### `no-implicit-button-type` and `no-implicit-input-type`

HTML minifiers such as [`@minify-html/node`](https://github.com/wilsonzlin/minify-html) strip the `type` attribute from `<button>` and `<input>` elements when it equals the HTML-spec default value (e.g. `type="submit"` on `<button>`, `type="text"` on `<input>`). This is valid per the spec and reduces page size, but it causes false-positive warnings from these two core rules when validating **minified** output.

```js
import { minify } from '@minify-html/node'

const html = '<button type="submit">Go</button><input type="text" name="q">'
const minified = minify(Buffer.from(html), {
  /* options */
})
// → "<button>Go</button><input name=q>"
// type="submit" and type="text" are stripped as they are HTML defaults
```

Extending `nice-checkers-plugin:recommended` disables both rules so that projects validating minified output do not need a workaround.

If you author your HTML by hand (i.e. you are **not** validating minified output) and want to enforce these rules, you can re-enable them explicitly in your own configuration:

```json
{
  "extends": ["htmlvalidate:recommended", "nice-checkers-plugin:recommended"],
  "rules": {
    "no-implicit-button-type": "error",
    "no-implicit-input-type": "error"
  }
}
```

See [issue #23](https://github.com/fulldecent/html-validate-nice-checkers/issues/23) for the full discussion.

## Development

Clone the repo:

```sh
git clone https://github.com/fulldecent/html-validate-nice-checkers.git ~/Developer/html-validate-nice-checkers
cd ~/Developer/html-validate-nice-checkers
```

Use Node and yarn. The Node version is pinned in [.node-version](.node-version), and the Yarn version is pinned in [package.json](package.json). Quick start with [fnm](https://github.com/Schniz/fnm):

```sh
fnm install
fnm use
corepack enable
yarn install
yarn test
```

Format files the lint workflow checks:

```sh
yarn format
```

[Development scripts](package.json):

- `yarn build` builds the package
- `yarn build:watch` builds the package in watch mode
- `yarn test` runs the tests once
- `yarn test:watch` runs the tests in watch mode
- `yarn test:coverage` runs the tests and generates a coverage report
- `yarn lint` runs TypeScript type checking
- `yarn check:package` checks the built package with publint and arethetypeswrong
- `yarn format` formats files with Prettier and markdownlint

Changes are ready to push when `yarn format && yarn lint && yarn test` passes.

### Editor setup for Yarn

Yarn installs with Plug'n'Play. An editor that loads TypeScript from a global install will not see this project's version. [Yarn's editor SDK instructions](https://yarnpkg.com/getting-started/editor-sdks) are:

```sh
yarn dlx @yarnpkg/sdks vscode
```

Then select the workspace TypeScript version.

`yarn format` and the lint workflow both run `npx prettier@latest`. The editor's Prettier extension can be a different version, so the command above is the one that matches CI.

### Testing notes

When running `yarn test` to test Nice Checkers itself, you may see two warnings about missing "root" paths. These come from the mock HTTP server (`@jaredwray/mockhttp`) which is only used in our test suite. The warnings are harmless and do not affect test results. We consider this an error in the upstream mock HTTP server package. These warnings do not appear for downstream users who install Nice Checkers to validate their own websites.

## Releasing

Package versions use [Semantic Versioning](https://semver.org/).

1. Finish the changes that belong in the release.
1. Bump `peerDependencies` when a newly supported html-validate version requires it.
1. Run `yarn && yarn format && yarn lint && yarn build && yarn test && yarn check:package`.
1. Bump `version` in package.json in a commit by itself.
1. Create a GitHub release for that version. [publish.yml](.github/workflows/publish.yml) publishes the package to npm.

## Maintenance and dependency updates

Do this every month or so and please send a PR here if you see updates available:

1. Identify external Actions in [.github/workflows](./.github/workflows) scripts and look for available new versions. Review and then update to the new version if it is safe. GitHub-supported Actions (i.e. under the actions/ organization) may require only cursory review.
1. Review the Node.js version in `.node-version`. Update it when a newer version is appropriate. `fnm install` reads that file. This local pin is separate from the versions the package supports.
1. Review the supported Node.js versions against the [Node.js release schedule](https://nodejs.org/en/about/previous-releases). This package supports the Current, Active LTS, and Maintenance LTS release lines, the same as html-validate. It does not support a Node.js version that the oldest html-validate in `peerDependencies` has dropped from its `engines`. `engines.node` in package.json is the floor, and tsdown compiles to that floor. When a release line reaches end-of-life, or a `peerDependencies` bump raises html-validate's floor, raise `engines.node` and update the Node.js versions in [test.yml](.github/workflows/test.yml) in the same commit.
1. Review the Yarn version in `package.json` (`packageManager`). Update it with `yarn set version stable && yarn` when a newer stable version is appropriate. [Yarn's install instructions](https://yarnpkg.com/getting-started/install) document that command.
1. Review direct dependencies with `yarn upgrade-interactive`. Keep `typescript` on 6.x. TypeScript 7 does not resolve packages installed with Yarn PnP ([TypeScript issue #63769](https://github.com/microsoft/TypeScript/issues/63769)).
1. Download the Schema.org vocabulary from <https://schema.org/docs/developers.html> and save it as `src/vendor/schemaorg-current-https.json`. Schema.org does not publish that file as an npm package, so the update is manual.

## References

1. We use title case for titles and proper nouns; not for headings and things. This includes our README above as well as our workflow rules and other configuration files. If you have a different policy, then please implement it throughout.
1. This project uses the MIT license, the same license as [node.js-template](https://github.com/fulldecent/node.js-template).
1. We would prefer if fnm supported build attestations since it is installed as a binary ([issue #1588](https://github.com/Schniz/fnm/issues/1588)).
1. Node.js ignore rules are inlined from [Node.gitignore](https://github.com/github/gitignore/blob/main/Node.gitignore). This project also ignores `/cache`, the fixture files that tests rewrite, and `package-lock.json`. `package-lock.json` is ignored because dependencies are locked with `yarn.lock`.
1. `.yarnrc.yml` sets `enableScripts` to true (Yarn 4.14 defaults to false) and `npmMinimalAgeGate` to 0 (Yarn 4.12 defaults to one day). `approvedGitRepositories` is `"**"`, which approves every git dependency. [Yarn: Security](https://yarnpkg.com/features/security)
1. Prettier options are in [.prettierrc](.prettierrc). [node.js-template](https://github.com/fulldecent/node.js-template) has no application source and therefore no Prettier config. Formatting still uses `npx prettier@latest`, the same command as that template's lint workflow.
1. `.prettierignore` ignores `*.md`, the same as the template. It also ignores `tests/fixtures` and `src/vendor`. Fixture HTML is the exact input for `required-reports.json`, which records line, column, and byte offset. `src/vendor/schemaorg-current-https.json` is a file downloaded from Schema.org.
1. markdownlint disables MD013, the same as the template, and sets MD024 `siblings_only`. Each rule section repeats the headings "Configuration" and "Configuration options". `siblings_only` allows that because each heading sits under a different rule.
1. [test.yml](.github/workflows/test.yml) runs `yarn lint`, `yarn test`, and `yarn build`. Then it checks the package with publint and arethetypeswrong, packs it, and loads it into html-validate from ESM and from CommonJS. The CommonJS test uses html-validate's `cjsResolver`, which loads plugins with `require()`. The test script in node.js-template is `true`, which is enough for a package with no behavior of its own. This job runs on Node.js 22, 24, and 26, the Maintenance LTS, Active LTS, and Current release lines. `.node-version` stays at 24.
1. [tsdown.config.ts](tsdown.config.ts) builds `dist/` from `src/index.ts`: `.js` and `.d.ts` for `import`, `.cjs` and `.d.cts` for `require`, matching `exports` in package.json. `tsc --noEmit` type checks and does not publish. The build is not minified so that people can debug the rules. html-validate is a peer dependency and is not bundled. CommonJS is kept for html-validate's `cjsResolver`, so the build turns off tsdown's `legacyCjs` warning.
1. [publish.yml](.github/workflows/publish.yml) publishes to npm when a GitHub release is published. node.js-template sets `"private": true` and is not an npm package.
1. This project is built based on [best practices documented in node.js-template](https://github.com/fulldecent/node.js-template).
1. This project is built based on [best practices documented in project-template](https://github.com/fulldecent/project-template), release 1.0.0.
