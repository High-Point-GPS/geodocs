const path = require('path');
const webpack = require('webpack');
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
		new webpack.HotModuleReplacementPlugin(),
	],
	output: {
		path: path.resolve(__dirname, 'docs'),
		filename: 'hpgpsFilemanager.js',
	},
};
