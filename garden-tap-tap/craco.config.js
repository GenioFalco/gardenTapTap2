module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          fs: false,
          path: false,
          util: false,
          crypto: false,
          stream: false,
          zlib: false,
          process: false
        }
      }
    }
  }
}; 