module.exports = {
  // Experience/trial version can use WeChat Cloud Development to avoid custom HTTPS domain requirements.
  // 1. Create a cloud environment in WeChat DevTools.
  // 2. Fill cloudEnvId if DevTools does not automatically pick the default environment.
  useCloud: true,
  cloudEnvId: '',
  cloudFunctionName: 'api',

  // Keep the server address for local DevTools debugging or future official HTTPS deployment.
  // Set useCloud to false when switching back to the HTTP/HTTPS backend.
  apiBaseUrl: 'http://39.106.161.170:8080/api',
  tokenStorageKey: 'student_service_token'
}
