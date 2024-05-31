const path = require('path');

module.exports = {
  entry: './app.js', // 入口文件
  output: {
    filename: 'bundle.js', // 输出文件名
    path: path.resolve(__dirname, 'dist'), // 输出文件夹
  },
  module: {
    rules: [
      {
        test: /\.js$/, // 使用babel-loader转译所有.js文件
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};