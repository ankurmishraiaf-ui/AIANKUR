module.exports = {
  entry: './src/main.js',
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    fallback: {
      fs: false,
      path: require.resolve('path-browserify'),
    },
  },
};
