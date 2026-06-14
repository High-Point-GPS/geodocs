const path = require('path');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
	plugins: [
		new HtmlWebPackPlugin({
			template: './src/app/hpgpsFilemanager.html',

			filename: './hpgpsFilemanager.html',
		}),
		new MiniCssExtractPlugin({
			filename: '[name].css',
			chunkFilename: '[id].css',
		}),
		// HMR lives in the dev config only (webpack.development.js) — it has no place in
		// the production / build-dev bundles, where its runtime was dead weight.
	],
	output: {
		path: path.resolve(__dirname, 'docs'),
		filename: 'hpgpsFilemanager.js',
	},
};
