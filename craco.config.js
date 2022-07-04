const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin')


module.exports = {
    webpack: {
        configure: {
            plugins: [
                new NodePolyfillPlugin({
                    includeAliases: ['crypto', 'buffer', 'path', 'stream']
                })
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
