const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      loginWith: {
        oauth: {
          domain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '').replace('https://', ''),
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000'],
          redirectSignOut: [process.env.NEXT_PUBLIC_REDIRECT_URL || 'http://localhost:3000'],
          responseType: 'code',
        },
      },
    },
  },
};

// Debug logging
if (typeof window !== 'undefined') {
  console.log('AWS Config Debug:', {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'MISSING',
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 'MISSING',
    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'MISSING',
    redirectUrl: process.env.NEXT_PUBLIC_REDIRECT_URL || 'MISSING',
  });
}

export default awsConfig;