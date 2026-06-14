const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = merge(common, {
	mode: 'development',
	entry: './src/.dev/index.js',
	module: {
		rules: [
			{
				// Inline the pdf.js worker as source text (Blob at runtime) — no separate file.
				test: /pdf\.worker\.min\.js$/,
				type: 'asset/source',
			},
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader'],
			},
			{
				test: /\.js$/,
				exclude: [/node_modules/],
				use: {
					loader: 'babel-loader',
				},
			},
			{
				test: /\.html$/,
				use: [
					{
						loader: 'html-loader',
						options: { minimize: true },
					},
				],
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				resourceQuery: /inline/,
				type: 'asset/inline',
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				resourceQuery: { not: [/inline/] },
				type: 'asset/resource',
			},
		],
	},
	optimization: {
		minimizer: [new CssMinimizerPlugin()],
	},
	plugins: [
		new webpack.HotModuleReplacementPlugin(),
		new ESLintPlugin({
			extensions: ['js'],
			exclude: ['node_modules', '/.dev/'],
			formatter: 'stylish',
		}),
		new CopyWebpackPlugin({
			patterns: [
				{ from: './src/app/images/icon.svg', to: 'images/' },
				{ from: './src/app/config.json' },
			],
		}),
		new MiniCssExtractPlugin(),
	],
	devServer: {
		static: {
			directory: path.join(__dirname),
		},
		devMiddleware: {
			index: 'hpgpsFilemanager.html',
		},
		compress: true,
		port: 9000,
		open: false,
	},
});
