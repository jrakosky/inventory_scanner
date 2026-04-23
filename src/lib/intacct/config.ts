export const intacctConfig = {
  get clientId() {
    return process.env.INTACCT_CLIENT_ID || "";
  },
  get clientSecret() {
    return process.env.INTACCT_CLIENT_SECRET || "";
  },
  get redirectUri() {
    return process.env.INTACCT_REDIRECT_URI || "";
  },
  get apiUrl() {
    return process.env.INTACCT_API_URL || "https://api.intacct.com/ia/api/v1";
  },
  get authorizeUrl() {
    return `${this.apiUrl}/oauth2/authorize`;
  },
  get tokenUrl() {
    return `${this.apiUrl}/oauth2/token`;
  },
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  },
};
