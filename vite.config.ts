import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
//import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
//import rollupPolyfillNode from 'rollup-plugin-polyfill-node'

export default defineConfig(({mode}) => {
    // Ref: https://github.com/Taiwan-Ebook-Lover/Taiwan-Ebook-Lover.github.io/pull/62/commits/cf27dd66280e8c21daaf3b51c594c1eea9065fdd#r886052909
    const env = loadEnv(mode, '');
    const htmlPlugin = () => ({
        name: "html-transform",
        transformIndexHtml: (html: string) =>
            html.replace(
                /<%=\s*([a-zA-Z_]+)\s*%>/g,
                (_match, variableName) => env[variableName]
            )
    });

    return {
        resolve: {
            alias: {
                //assert: "assert/",
                buffer: "buffer/",
                crypto: "crypto-browserify",
                //event: "event/",
                path: "path-browserify",
                process: "process/browser",
                stream: "stream-browserify",
                util: "util/",
            },
        },

        optimizeDeps: {
            esbuildOptions: {
                define: {
                    global: 'globalThis'
                },
                plugins: [
                    //NodeModulesPolyfillPlugin(),
                    NodeGlobalsPolyfillPlugin({
                        buffer: true,
                        process: true
                    }),
                    {
                        name: 'fix-node-globals-polyfill',
                        setup(build) {
                            build.onResolve(
                                { filter: /(_virtual-process-polyfill_|_buffer)\.js/ },
                                ({ path }) => ({ path })
                            )
                        }
                    }
                ]
            }
        },

        /*build: {
            rollupOptions: {
                plugins: [
                    rollupPolyfillNode({include: ['buffer']})
                ]
            }
        },*/

        plugins: [
            htmlPlugin(),
            react()
        ]
    }
})