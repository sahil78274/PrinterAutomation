/**
 * SmartPrint site configuration.
 *
 * Business-sensitive details (company name, contact, legal info) live here
 * so they can be updated without touching component code. No invented details —
 * every value must be configured before launch.
 */

const siteConfig = {
  // Brand
  name: 'SmartPrint',
  tagline: 'Touchless, QR-based self-service document printing',

  // Legal pages
  legal: {
    companyName: null, // Configure before launch — e.g. 'Your Company Name Pvt Ltd'
    // No GSTIN, CIN, registration number, address, phone, or email stored here.
    // These must be added by the operator before going live.
  },

  // Contact — only expose what has been explicitly configured
  contact: {
    supportEmail: null, // Configure before launch
    // No phone number or address stored by default
  },

  // Links
  links: {
    terms: '/terms',
    privacy: '/privacy',
    refundPolicy: '/refund-policy',
    cookiePolicy: '/cookie-policy',
  },

  // Dynamic copyright
  get copyrightYear() {
    return new Date().getFullYear();
  },
};

export default siteConfig;
