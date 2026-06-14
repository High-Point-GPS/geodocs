const path = require('path');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const config = require('./src/app/config.json');
const ESLintPlugin = require('eslint-webpack-plugin');

// Absolute base URL the add-in is registered to load from (GitHub Pages). Derived from
// the configured add-in URL by stripping the HTML filename, so it stays in sync with
// config.json's single source of truth -> 'https://high-point-gps.github.io/geodocs/'.
const PUBLIC_PATH = config.items[0].url.replace(/[^/]+$/, '');

/**
 * Removes "dev" element of the config tree on production build
 *
 * @param {Buffer} content content of file
 * @param {string} path path to file
 */
const transform = function (content, path) {
	let config = JSON.parse(content);
	let host = config.dev.dist.host;
	let len = config.items.length;
	// Appending the host to all item's url and icon
	for (let i = 0; i < len; i++) {
		config.items[i].url = host + config.items[i].url;
		config.items[i].icon = host + config.items[i].icon;
	}

	delete config['dev'];
	let response = JSON.stringify(config, null, 2);
	// Returned string is written to file
	return response;
};

module.exports = merge(common, {
	mode: 'production',
	entry: './src/app/index.js',
	module: {
		rules: [
			{
				// Inline the pdf.js worker as source text (turned into a same-origin Blob
				// at runtime) so it needs no separate file/URL inside the Geotab embed.
				test: /pdf\.worker\.min\.js$/,
				type: 'asset/source',
			},
			{
				// App CSS is sandbox-prefixed (#hpgpsFilemanager) to avoid leaking into the
				// Geotab page. `?global` imports opt out — used for PrimeReact + the group
				// picker overrides, whose dropdown panel renders at document.body (outside
				// the prefixed scope) and so must be styled with unprefixed selectors.
				test: /\.css$/,
				exclude: /\.dev/,
				resourceQuery: { not: [/global/] },
				use: [
					{
						loader: MiniCssExtractPlugin.loader,
						options: {
							publicPath: config.dev.dist.host,
						},
					},
					'css-loader',
					{
						loader: './src/.dev/loaders/css-sandbox/css-sandbox.js',
						options: { prefix: '#hpgpsFilemanager' },
					},
				],
			},
			{
				test: /\.css$/,
				resourceQuery: /global/,
				use: [
					{
						loader: MiniCssExtractPlugin.loader,
						options: {
							publicPath: config.dev.dist.host,
						},
					},
					'css-loader',
				],
			},
			{
				test: /\.js$/,
				exclude: [/node_modules/, /\.dev/],
				use: {
					loader: 'babel-loader',
				},
			},
			{
				test: /\.html$/,
				exclude: /\.dev/,
				use: [
					{
						loader: 'html-loader',
						options: { minimize: true },
					},
				],
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				exclude: /\.dev/,
				resourceQuery: /inline/,
				type: 'asset/inline',
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				exclude: /\.dev/,
				resourceQuery: { not: [/inline/] },
				type: 'asset/resource',
			},
			{
				// Roboto (@fontsource) and PrimeIcons font files.
				test: /\.(woff2?|ttf|eot)$/,
				type: 'asset/resource',
			},
		],
	},
	optimization: {
		minimize: true,
		minimizer: [
			new CssMinimizerPlugin(),
			new TerserPlugin({
				test: /\.js(\?.*)?$/i,
			}),
		],
	},
	plugins: [
		new ESLintPlugin({
			extensions: ['js'],
			exclude: ['node_modules', '/.dev/'],
			formatter: 'stylish',
		}),
		new RemoveEmptyScriptsPlugin(),
		new CopyWebpackPlugin({
			patterns: [
				{ from: './src/app/images/icon.svg', to: 'images/' },
				{ from: './src/app/config.json', transform: transform },
				{ from: './src/app/translations/', to: 'translations/' },
			],
		}),
	],
	output: {
		// Pin the chunk base URL to the absolute GitHub Pages host. 'auto' can't be used
		// here: it resolves at runtime from document.currentScript, but inside the
		// my.geotab.com embed the add-in's bundle isn't the current script when the webpack
		// runtime runs (MyGeotab injects it as a deferred script), so 'auto' fell back to the
		// host page and fetched dynamic chunks (the PDF viewer, on-demand CSS) from
		// my.geotab.com/<db>/ — a 404. An explicit absolute path loads them from where they
		// actually live regardless of the embedding page.
		publicPath: PUBLIC_PATH,
		assetModuleFilename: '[name][ext][query]',
	},
});
