/**
 * Nice Checkers plugin
 * A collection of essential HTML validation rules
 */

import type { Plugin } from 'html-validate'
import CanonicalLinkRule from './rules/CanonicalLinkRule'
import ExternalLinksRule from './rules/ExternalLinksRule'
import HttpsLinksRule from './rules/HttpsLinksRule'
import InternalLinksRule from './rules/InternalLinksRule'
import LatestPackagesRule from './rules/LatestPackagesRule'
import MailtoAwesomeRule from './rules/MailtoAwesomeRule'
import NoJqueryRule from './rules/NoJqueryRule'
import SchemaOrgJsonLdRule from './rules/SchemaOrgJsonLdRule'

const plugin: Plugin = {
  name: 'nice-checkers-plugin',

  rules: {
    'nice-checkers/canonical-link': CanonicalLinkRule,
    'nice-checkers/external-links': ExternalLinksRule,
    'nice-checkers/https-links': HttpsLinksRule,
    'nice-checkers/internal-links': InternalLinksRule,
    'nice-checkers/latest-packages': LatestPackagesRule,
    'nice-checkers/mailto-awesome': MailtoAwesomeRule,
    'nice-checkers/no-jquery': NoJqueryRule,
    'nice-checkers/schema-org-json-ld': SchemaOrgJsonLdRule,
  },

  configs: {
    recommended: {
      rules: {
        'nice-checkers/canonical-link': ['error'],
        'nice-checkers/external-links': ['error'],
        'nice-checkers/https-links': ['error'],
        'nice-checkers/internal-links': ['error'],
        'nice-checkers/latest-packages': ['warn'],
        'nice-checkers/mailto-awesome': ['error'],
        'nice-checkers/no-jquery': ['error'],
        'nice-checkers/schema-org-json-ld': ['error'],
      },
    },
  },
}

export default plugin
