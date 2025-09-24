/**
 * Nice Checkers plugin
 * A collection of essential HTML validation rules
 */

import type { Plugin, ConfigData, RuleConstructor } from 'html-validate'
import CanonicalLinkRule from './rules/CanonicalLinkRule'
import ExternalLinksRule from './rules/ExternalLinksRule'
import HttpsLinksRule from './rules/HttpsLinksRule'
import InternalLinksRule from './rules/InternalLinksRule'
import LatestPackagesRule from './rules/LatestPackagesRule'
import MailtoAwesomeRule from './rules/MailtoAwesomeRule'
import NoJqueryRule from './rules/NoJqueryRule'

/**
 * The Nice Checker plugin exposes and defaults to rules that make your website
 * more usable.
 */
export default class NiceCheckersPlugin implements Plugin {
  name = 'nice-checkers'

  rules: Record<string, RuleConstructor<any, any>> = {
    'nice-checkers/canonical-link': CanonicalLinkRule,
    'nice-checkers/external-links': ExternalLinksRule,
    'nice-checkers/https-links': HttpsLinksRule,
    'nice-checkers/internal-links': InternalLinksRule,
    'nice-checkers/latest-packages': LatestPackagesRule,
    'nice-checkers/mailto-awesome': MailtoAwesomeRule,
    'nice-checkers/no-jquery': NoJqueryRule,
  }

  configs: Record<string, ConfigData> = {
    recommended: {
      rules: {
        'nice-checkers/canonical-link': ['error'],
        'nice-checkers/external-links': ['error'],
        'nice-checkers/https-links': ['error'],
        'nice-checkers/internal-links': ['error'],
        'nice-checkers/latest-packages': ['warn'],
        'nice-checkers/mailto-awesome': ['warn'],
        'nice-checkers/no-jquery': ['error'],
      },
    },
  }
}
