const webpack = require("webpack");
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin')


module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    buffer: require.resolve("buffer/"),
                    crypto: require.resolve("crypto-browserify"),
                    stream: require.resolve("stream-browserify"),
                    path: require.resolve("path-browserify"),
                },
            },
            plugins: [
                new webpack.ProvidePlugin({
                    Buffer: ["buffer", "Buffer"],
                    process: "process/browser",
                }),
            ],
        },
    },
    // Temporary fix for ModuleScopePlugin incorrectly(?) detecting relative imports.
    plugins: [
        { plugin: {
            overrideWebpackConfig: ({ webpackConfig }) => {
                webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
                    plugin => !(plugin instanceof ModuleScopePlugin)
                )
        
                return webpackConfig
            }
        } }
    ]
};